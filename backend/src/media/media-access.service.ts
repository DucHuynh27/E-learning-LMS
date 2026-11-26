import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from '../user/user.entity.js';

interface LessonAccessRecord {
  id: string;
  type: string;
  isPublished: boolean;
  courseStatus: string;
  instructorId: string;
  courseId: string;
}

@Injectable()
export class MediaAccessService {
  constructor(private readonly dataSource: DataSource) {}

  async assertCanManageLesson(
    lessonId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const lesson = await this.findLesson(lessonId);
    this.assertVideoLesson(lesson);
    if (!this.isOwnerOrAdmin(lesson, user)) {
      throw new ForbiddenException('You cannot manage this lesson');
    }
  }

  async assertCanViewVideo(
    lessonId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const lesson = await this.findLesson(lessonId);
    this.assertVideoLesson(lesson);
    if (this.isOwnerOrAdmin(lesson, user)) {
      return;
    }

    if (!lesson.isPublished || lesson.courseStatus !== 'PUBLISHED') {
      throw new ForbiddenException('Lesson is not published');
    }

    await this.assertEnrolled(lesson.courseId, user.userId);
  }

  async assertCanPlayVideo(
    lessonId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const lesson = await this.findLesson(lessonId);
    this.assertVideoLesson(lesson);
    if (!lesson.isPublished || lesson.courseStatus !== 'PUBLISHED') {
      throw new ForbiddenException('Lesson is not published');
    }

    if (this.isOwnerOrAdmin(lesson, user)) {
      return;
    }

    await this.assertEnrolled(lesson.courseId, user.userId);
  }

  private isOwnerOrAdmin(
    lesson: LessonAccessRecord,
    user: AuthenticatedUser,
  ): boolean {
    return (
      user.role === Role.ADMIN ||
      (user.role === Role.INSTRUCTOR && lesson.instructorId === user.userId)
    );
  }

  private async assertEnrolled(courseId: string, userId: string): Promise<void> {
    const enrollments = await this.dataSource.query<{ id: string }[]>(
      `SELECT e."id"
       FROM "enrolments" e
       WHERE e."courseId" = $1 AND e."userId" = $2 AND e."status" IN ('ACTIVE', 'COMPLETED')
       LIMIT 1`,
      [courseId, userId],
    );
    if (enrollments.length === 0) {
      throw new ForbiddenException('An active enrollment is required');
    }
  }

  private async findLesson(lessonId: string): Promise<LessonAccessRecord> {
    const lessons = await this.dataSource.query<LessonAccessRecord[]>(
      `SELECT l."id", l."type", l."isPublished", c."status" AS "courseStatus",
              c."instructorId", c."id" AS "courseId"
       FROM "lessons" l
       INNER JOIN "sections" s ON s."id" = l."sectionId"
       INNER JOIN "courses" c ON c."id" = s."courseId"
       WHERE l."id" = $1
       LIMIT 1`,
      [lessonId],
    );
    const lesson = lessons[0];
    if (!lesson) throw new NotFoundException('Lesson not found');
    return lesson;
  }

  private assertVideoLesson(lesson: LessonAccessRecord): void {
    if (lesson.type !== 'VIDEO') {
      throw new BadRequestException('Lesson is not a video lesson');
    }
  }
}
