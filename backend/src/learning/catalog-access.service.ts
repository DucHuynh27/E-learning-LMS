import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Role } from '../user/user.entity.js';
import { Course } from '../courses/course.entity.js';
import { Section } from '../sections/section.entity.js';
import { Lesson } from '../lessons/lesson.entity.js';
import { Enrolment } from '../enrolments/enrolment.entity.js';
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

export interface CourseLessonProgressRow {
  lessonId: string;
  watchedSec: number;
  completed: boolean;
  completedAt: Date | null;
}

const CATALOG_UNAVAILABLE_CODES = new Set(['42P01', '42P02', '3F000']);

// Learning dùng entity của module Catalog (Course/Section/Lesson/Enrolment) thay vì raw SQL,
// nhưng chỉ SELECT các cột cần thiết để không phụ thuộc toàn bộ cột của Catalog.
@Injectable()
export class CatalogAccess {
  constructor(@Inject(DataSource) private readonly source: DataSource) {}

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: string }).code
          : undefined;
      if (code && CATALOG_UNAVAILABLE_CODES.has(code)) {
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
    const lesson = await this.run(() =>
      manager
        .getRepository(Lesson)
        .createQueryBuilder('l')
        .innerJoin(Section, 's', 's.id = l.sectionId')
        .innerJoin(Course, 'c', 'c.id = s.courseId')
        .select([
          'l.id AS "id"',
          'l.durationSec AS "durationSec"',
          'l.isPublished AS "isPublished"',
          's.courseId AS "courseId"',
          'c.instructorId AS "instructorId"',
          'c.status AS "courseStatus"',
        ])
        .where('l.id = :lessonId', { lessonId })
        .getRawOne<LearningLesson>(),
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
    const query = manager
      .getRepository(Enrolment)
      .createQueryBuilder('e')
      .innerJoin(Course, 'c', 'c.id = e.courseId')
      .select([
        'e.id AS "id"',
        'e.status AS "status"',
        'e.progressPct AS "progressPct"',
      ])
      .where('e.userId = :userId AND e.courseId = :courseId', {
        userId,
        courseId,
      })
      .andWhere('c.status = :published', { published: 'PUBLISHED' })
      .andWhere('e.status IN (:...statuses)', {
        statuses: ['ACTIVE', 'COMPLETED'],
      });
    if (lock) query.setLock('pessimistic_write', undefined, ['e']);

    const enrolment = await this.run(() => query.getRawOne<LearningEnrolment>());
    if (!enrolment)
      throw new ForbiddenException('An active enrolment is required');
    return enrolment;
  }

  // Truy vấn danh sách lesson published kèm tiến độ của user (thay cho raw SQL trong ProgressService).
  async courseLessons(
    userId: string,
    courseId: string,
    manager: EntityManager,
  ): Promise<CourseLessonProgressRow[]> {
    return this.run(() =>
      manager
        .getRepository(Lesson)
        .createQueryBuilder('l')
        .innerJoin(Section, 's', 's.id = l.sectionId')
        .leftJoin(
          'lesson_progress',
          'p',
          'p."lessonId" = l.id AND p."userId" = :userId',
          { userId },
        )
        .select([
          'l.id AS "lessonId"',
          'COALESCE(p."watchedSec", 0) AS "watchedSec"',
          'COALESCE(p."completed", false) AS "completed"',
          'p."completedAt" AS "completedAt"',
        ])
        .where('s.courseId = :courseId', { courseId })
        .andWhere('l.isPublished = true')
        .orderBy('s.position', 'ASC')
        .addOrderBy('l.position', 'ASC')
        .addOrderBy('l.id', 'ASC')
        .getRawMany(),
    );
  }

  // Đếm tổng lesson published và số lesson đã hoàn thành của user trong course.
  async countCompleted(
    userId: string,
    courseId: string,
    manager: EntityManager,
  ): Promise<{ total: number; completed: number }> {
    const row = await this.run(() =>
      manager
        .getRepository(Lesson)
        .createQueryBuilder('l')
        .innerJoin(Section, 's', 's.id = l.sectionId')
        .leftJoin(
          'lesson_progress',
          'p',
          'p."lessonId" = l.id AND p."userId" = :userId',
          { userId },
        )
        .select('COUNT(*)', 'total')
        .addSelect('COUNT(*) FILTER (WHERE p."completed" = true)', 'completed')
        .where('s.courseId = :courseId', { courseId })
        .andWhere('l.isPublished = true')
        .getRawOne<{ total: string; completed: string }>(),
    );
    return {
      total: Number(row?.total ?? 0),
      completed: Number(row?.completed ?? 0),
    };
  }
}
