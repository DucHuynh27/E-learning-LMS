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

export interface QnaCourse {
  id: string;
  instructorId: string;
  status: string;
}

export interface QnaLesson {
  id: string;
  courseId: string;
  isPublished: boolean;
  courseStatus: string;
}

@Injectable()
export class QnaCatalogAccess {
  constructor(@Inject(DataSource) private readonly source: DataSource) {}

  private async query<T>(
    manager: EntityManager,
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    return manager.query<T[]>(sql, params);
  }

  private isCatalogUnavailableError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }
    const code = (error as { code?: string }).code;
    return code === '42P01' || code === '42P02' || code === '3F000';
  }

  private catalogUnavailable(error: unknown): ServiceUnavailableException {
    if (this.isCatalogUnavailableError(error)) {
      return new ServiceUnavailableException(
        'Catalog data is unavailable; cannot verify course access',
      );
    }
    throw error;
  }

  async findCourse(
    courseId: string,
    manager = this.source.manager,
  ): Promise<QnaCourse | null> {
    try {
      const [course] = await this.query<QnaCourse>(
        manager,
        `SELECT "id", "instructorId", "status" FROM "courses" WHERE "id" = $1`,
        [courseId],
      );
      return course ?? null;
    } catch (error) {
      throw this.catalogUnavailable(error);
    }
  }

  async findLesson(
    lessonId: string,
    courseId: string,
    manager = this.source.manager,
  ): Promise<QnaLesson | null> {
    try {
      const [lesson] = await this.query<QnaLesson>(
        manager,
        `SELECT l."id", s."courseId", l."isPublished", c."status" AS "courseStatus"
         FROM "lessons" l
         JOIN "sections" s ON s."id" = l."sectionId"
         JOIN "courses" c ON c."id" = s."courseId"
         WHERE l."id" = $1 AND s."courseId" = $2`,
        [lessonId, courseId],
      );
      return lesson ?? null;
    } catch (error) {
      throw this.catalogUnavailable(error);
    }
  }

  async checkAccess(
    courseId: string,
    user: AuthenticatedUser,
    manager = this.source.manager,
  ): Promise<{ canAccess: boolean; isOwner: boolean }> {
    const course = await this.findCourse(courseId, manager);
    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    if (user.role === Role.ADMIN) {
      return { canAccess: true, isOwner: true };
    }

    if (user.role === Role.INSTRUCTOR && course.instructorId === user.userId) {
      return { canAccess: true, isOwner: true };
    }

    let enrolments: { id: string }[];
    try {
      enrolments = await this.query<{ id: string }>(
        manager,
        `SELECT "id" FROM "enrolments"
         WHERE "userId" = $1 AND "courseId" = $2 AND "status" IN ('ACTIVE', 'COMPLETED')`,
        [user.userId, courseId],
      );
    } catch (error) {
      throw this.catalogUnavailable(error);
    }

    return {
      canAccess: enrolments.length > 0,
      isOwner: false,
    };
  }

  async assertCanAccess(
    courseId: string,
    user: AuthenticatedUser,
    manager = this.source.manager,
  ): Promise<{ isOwner: boolean }> {
    const { canAccess, isOwner } = await this.checkAccess(
      courseId,
      user,
      manager,
    );
    if (!canAccess) {
      throw new ForbiddenException(
        'You must be enrolled or instructor to access this course Q&A',
      );
    }
    return { isOwner };
  }
}
