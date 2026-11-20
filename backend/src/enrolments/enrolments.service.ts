import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Enrolment, EnrolmentStatus } from './enrolment.entity.js';
import { Course, CourseStatus } from '../courses/course.entity.js';
import { EnrolmentQueryDto } from './dto/enrolment-query.dto.js';
import {
  EnrolmentResponse,
  toEnrolmentResponse,
} from './dto/enrolment.response.js';
import { Role } from '../user/user.entity.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class EnrolmentsService {
  constructor(
    @InjectRepository(Enrolment)
    private readonly enrolmentRepo: Repository<Enrolment>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
  ) {}

  async enroll(
    courseId: string,
    user: AuthenticatedUser,
  ): Promise<EnrolmentResponse> {
    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new ConflictException('Course is not open for enrollment');
    }

    const existing = await this.enrolmentRepo.findOne({
      where: { courseId, userId: user.userId },
    });

    if (existing) {
      throw new ConflictException('Already enrolled in this course');
    }

    const enrolment = this.enrolmentRepo.create({
      courseId,
      userId: user.userId,
      status: EnrolmentStatus.ACTIVE,
      progressPct: 0,
    });

    const saved = await this.enrolmentRepo.save(enrolment);
    return toEnrolmentResponse(saved);
  }

  async findMyEnrolments(
    user: AuthenticatedUser,
    query: EnrolmentQueryDto,
  ): Promise<{ items: EnrolmentResponse[]; meta: { page: number; limit: number; total: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.enrolmentRepo.findAndCount({
      where: { userId: user.userId },
      order: { enrolledAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map(toEnrolmentResponse),
      meta: { page, limit, total },
    };
  }

  async findCourseEnrolments(
    courseId: string,
    user: AuthenticatedUser,
    query: EnrolmentQueryDto,
  ): Promise<{ items: EnrolmentResponse[]; meta: { page: number; limit: number; total: number } }> {
    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    if (
      user.role !== Role.ADMIN &&
      !(user.role === Role.INSTRUCTOR && course.instructorId === user.userId)
    ) {
      throw new ForbiddenException(
        'You do not have permission to view enrolments for this course',
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const [items, total] = await this.enrolmentRepo.findAndCount({
      where: { courseId },
      order: { enrolledAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map(toEnrolmentResponse),
      meta: { page, limit, total },
    };
  }
}
