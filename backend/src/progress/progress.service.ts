import { Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CertificatesService } from '../certificates/certificates.service.js';
import { CatalogAccess } from '../learning/catalog-access.service.js';
import { LessonProgressResponse } from '../learning/learning.responses.js';
import { PublishedLessonCache } from '../learning/published-lesson-cache.service.js';
import { LessonProgress } from './lesson-progress.entity.js';
import type { UpdateProgressDto } from './dto/update-progress.dto.js';

@Injectable()
export class ProgressService {
  constructor(
    @Inject(DataSource) private readonly source: DataSource,
    @Inject(CatalogAccess) private readonly catalog: CatalogAccess,
    @Inject(PublishedLessonCache) private readonly cache: PublishedLessonCache,
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
      await this.reconcile(
        manager,
        user.userId,
        lesson.courseId,
        enrolment.id,
        completed && !previous?.completed,
      );
      return new LessonProgressResponse(progress);
    });
  }

  async course(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<{ progressPct: number; lessons: LessonProgressResponse[] }> {
    this.catalog.assertStudent(user);
    return this.source.transaction(async (manager) => {
      const enrolment = await this.catalog.enrolment(
        user.userId,
        courseId,
        manager,
        true,
      );
      const progressPct = await this.reconcile(
        manager,
        user.userId,
        courseId,
        enrolment.id,
        true,
      );
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
        progressPct,
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
    refreshCount: boolean,
  ): Promise<number> {
    let total = refreshCount ? undefined : await this.cache.get(courseId);
    if (total === undefined) {
      total = await this.catalog.publishedCount(courseId, manager);
      await this.cache.set(courseId, total);
    }
    const [row] = await this.catalog.query<{ count: number }>(
      manager,
      `
      SELECT COUNT(*)::int AS "count" FROM "lesson_progress" p
      JOIN "lessons" l ON l."id" = p."lessonId" JOIN "sections" s ON s."id" = l."sectionId"
      WHERE p."userId" = $1 AND p."completed" = true AND l."isPublished" = true AND s."courseId" = $2`,
      [userId, courseId],
    );
    if (!refreshCount && row.count >= total) {
      total = await this.catalog.publishedCount(courseId, manager);
      await this.cache.set(courseId, total);
    }
    const progressPct =
      total === 0 ? 0 : Math.min(100, Math.round((row.count / total) * 100));
    // Rounding 199/200 gives 100, but a certificate still requires every published lesson.
    const complete = total > 0 && row.count === total;
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
