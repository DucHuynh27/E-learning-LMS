import {
  ForbiddenException,
  Inject,
  Injectable,
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
    try {
      return await manager.query<T[]>(sql, params);
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === '42P01'
      ) {
        return [];
      }
      throw error;
    }
  }

  async findCourse(
    courseId: string,
    manager = this.source.manager,
  ): Promise<QnaCourse | null> {
    const [course] = await this.query<QnaCourse>(
      manager,
      `SELECT "id", "instructorId", "status" FROM "courses" WHERE "id" = $1`,
      [courseId],
    );
    return course ?? null;
  }

  async findLesson(
    lessonId: string,
    courseId: string,
    manager = this.source.manager,
  ): Promise<QnaLesson | null> {
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
  }

  async checkAccess(
    courseId: string,
    user: AuthenticatedUser,
    manager = this.source.manager,
  ): Promise<{ canAccess: boolean; isOwner: boolean }> {
    if (user.role === Role.ADMIN) {
      return { canAccess: true, isOwner: true };
    }

    const course = await this.findCourse(courseId, manager);
    if (!course) {
      // Khi bảng Catalog chưa cài hoặc không tìm thấy course trên mock
      return { canAccess: true, isOwner: false };
    }

    if (user.role === Role.INSTRUCTOR && course.instructorId === user.userId) {
      return { canAccess: true, isOwner: true };
    }

    const enrolments = await this.query<{ id: string }>(
      manager,
      `SELECT "id" FROM "enrolments"
       WHERE "userId" = $1 AND "courseId" = $2 AND "status" IN ('ACTIVE', 'COMPLETED')`,
      [user.userId, courseId],
    );

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
    const { canAccess, isOwner } = await this.checkAccess(courseId, user, manager);
    if (!canAccess) {
      throw new ForbiddenException('You must be enrolled or instructor to access this course Q&A');
    }
    return { isOwner };
  }
}
