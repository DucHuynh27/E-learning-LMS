import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Role } from '../user/user.entity.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

export interface LearningLesson {
  id: string;
  courseId: string;
  durationSec: number;
  isPublished: boolean;
  courseStatus: string;
  instructorId: string;
}

export interface LearningEnrolment {
  id: string;
  status: string;
  progressPct: number;
}

@Injectable()
export class CatalogAccess {
  constructor(@Inject(DataSource) private readonly source: DataSource) {}

  async query<T>(
    manager: EntityManager,
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    try {
      return await manager.query<T[]>(sql, params);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code
          : undefined;
      if (code === '42P01' || code === '42P02' || code === '3F000') {
        throw new ServiceUnavailableException(
          'Catalog schema is not installed; run the Content migrations first',
        );
      }
      throw error;
    }
  }

  async lesson(
    lessonId: string,
    manager = this.source.manager,
  ): Promise<LearningLesson> {
    const [lesson] = await this.query<LearningLesson>(
      manager,
      `
      SELECT l."id", l."durationSec", l."isPublished", s."courseId",
             c."instructorId", c."status" AS "courseStatus"
      FROM "lessons" l JOIN "sections" s ON s."id" = l."sectionId"
      JOIN "courses" c ON c."id" = s."courseId" WHERE l."id" = $1`,
      [lessonId],
    );
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  assertPublished(lesson: LearningLesson): void {
    if (!lesson.isPublished || lesson.courseStatus !== 'PUBLISHED')
      throw new NotFoundException('Lesson not found');
  }

  assertStudent(user: AuthenticatedUser): void {
    if (user.role !== Role.STUDENT)
      throw new ForbiddenException('Student role is required');
  }

  assertOwner(lesson: LearningLesson, user: AuthenticatedUser): void {
    if (
      user.role !== Role.ADMIN &&
      !(user.role === Role.INSTRUCTOR && lesson.instructorId === user.userId)
    ) {
      throw new ForbiddenException(
        'Only the course instructor or an admin can edit this quiz',
      );
    }
  }

  async enrolment(
    userId: string,
    courseId: string,
    manager: EntityManager,
    lock = false,
  ): Promise<LearningEnrolment> {
    const [enrolment] = await this.query<LearningEnrolment>(
      manager,
      `
      SELECT e."id", e."status", e."progressPct" FROM "enrolments" e
      JOIN "courses" c ON c."id" = e."courseId"
      WHERE e."userId" = $1 AND e."courseId" = $2 AND c."status" = 'PUBLISHED'
        AND e."status" IN ('ACTIVE', 'COMPLETED') ${lock ? 'FOR UPDATE OF e' : ''}`,
      [userId, courseId],
    );
    if (!enrolment)
      throw new ForbiddenException('An active enrolment is required');
    return enrolment;
  }

}
