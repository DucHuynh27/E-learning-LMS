import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CertificatesService } from '../certificates/certificates.service.js';
import { CatalogAccess } from '../learning/catalog-access.service.js';
import { LessonProgressResponse } from '../learning/learning.responses.js';
import { LessonProgress } from './lesson-progress.entity.js';
import type { UpdateProgressDto } from './dto/update-progress.dto.js';

@Injectable()
export class ProgressService {
  constructor(
    @Inject(DataSource) private readonly source: DataSource,
    @Inject(CatalogAccess) private readonly catalog: CatalogAccess,
    @Inject(CertificatesService)
    private readonly certificates: CertificatesService,
  ) {}

  async update(
    user: AuthenticatedUser,
    lessonId: string,
    dto: UpdateProgressDto,
  ): Promise<LessonProgressResponse> {
    this.catalog.assertStudent(user);
    return this.source.transaction(async (manager) => {
      const lesson = await this.catalog.lesson(lessonId, manager);
      this.catalog.assertPublished(lesson);
      // Lock the enrolment, not only this lesson: concurrent completions affect the same course percentage.
      const enrolment = await this.catalog.enrolment(
        user.userId,
        lesson.courseId,
        manager,
        true,
      );
      const repository = manager.getRepository(LessonProgress);
      const previous = await repository.findOneBy({
        userId: user.userId,
        lessonId: lesson.id,
      });
      const watchedSec = Math.max(
        previous?.watchedSec ?? 0,
        Math.min(dto.watchedSec, lesson.durationSec),
      );
      const completed =
        Boolean(previous?.completed) || watchedSec >= lesson.durationSec * 0.9;
      const progress = await repository.save(
        repository.create({
          id: previous?.id,
          userId: user.userId,
          lessonId: lesson.id,
          watchedSec,
          completed,
          completedAt: completed ? (previous?.completedAt ?? new Date()) : null,
        }),
      );
      await this.reconcile(manager, user.userId, lesson.courseId, enrolment.id);
      return new LessonProgressResponse(progress);
    });
  }

  async course(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<{ progressPct: number; lessons: LessonProgressResponse[] }> {
    this.catalog.assertStudent(user);
    return this.source.transaction('REPEATABLE READ', async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      await this.catalog.enrolment(user.userId, courseId, manager);
      const lessons = await this.catalog.query<LessonProgress>(
        manager,
        `
        SELECT l."id" AS "lessonId", COALESCE(p."watchedSec", 0) AS "watchedSec",
               COALESCE(p."completed", false) AS "completed", p."completedAt"
        FROM "lessons" l JOIN "sections" s ON s."id" = l."sectionId"
        LEFT JOIN "lesson_progress" p ON p."lessonId" = l."id" AND p."userId" = $1
        WHERE s."courseId" = $2 AND l."isPublished" = true ORDER BY s."position", l."position", l."id"`,
        [user.userId, courseId],
      );
      return {
        progressPct:
          lessons.length === 0
            ? 0
            : Math.round(
                (100 * lessons.filter((lesson) => lesson.completed).length) /
                  lessons.length,
              ),
        lessons: lessons.map(
          (progress) => new LessonProgressResponse(progress),
        ),
      };
    });
  }

  private async reconcile(
    manager: EntityManager,
    userId: string,
    courseId: string,
    enrolmentId: string,
  ): Promise<number> {
    const [row] = await this.catalog.query<{
      total: number;
      completed: number;
    }>(
      manager,
      `
      SELECT COUNT(*)::int AS "total", COUNT(*) FILTER (WHERE p."completed" = true)::int AS "completed"
      FROM "lessons" l JOIN "sections" s ON s."id" = l."sectionId"
      LEFT JOIN "lesson_progress" p ON p."lessonId" = l."id" AND p."userId" = $1
      WHERE l."isPublished" = true AND s."courseId" = $2`,
      [userId, courseId],
    );
    const progressPct =
      row.total === 0 ? 0 : Math.round((row.completed / row.total) * 100);
    // Rounding 199/200 gives 100, but a certificate still requires every published lesson.
    const complete = row.total > 0 && row.completed === row.total;
    await manager.query(
      `UPDATE "enrolments" SET "progressPct" = $2,
      "status" = CASE WHEN $3 THEN 'COMPLETED' WHEN "status" = 'COMPLETED' THEN 'ACTIVE' ELSE "status" END,
      "completedAt" = CASE WHEN $3 THEN COALESCE("completedAt", CURRENT_TIMESTAMP) ELSE NULL END
      WHERE "id" = $1`,
      [enrolmentId, progressPct, complete],
    );
    if (complete) await this.certificates.issue(userId, courseId, manager);
    return progressPct;
  }
}
