import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { Course, CourseStatus } from './course.entity.js';
import { Section } from '../sections/section.entity.js';
import { Lesson } from '../lessons/lesson.entity.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CourseQueryDto } from './dto/course-query.dto.js';
import {
  CourseDetailResponse,
  CourseResponse,
  toCourseResponse,
} from './dto/course.response.js';
import { toLessonResponse } from '../lessons/dto/lesson.response.js';
import { toSectionResponse } from '../sections/dto/section.response.js';
import { slugify } from './slug.util.js';
import { Role } from '../user/user.entity.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
  ) {}

  async create(
    dto: CreateCourseDto,
    instructorId: string,
  ): Promise<CourseResponse> {
    const baseSlug = slugify(dto.title);
    let slug = baseSlug;
    let counter = 1;

    while (await this.courseRepo.findOne({ where: { slug } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    const course = this.courseRepo.create({
      title: dto.title,
      slug,
      description: dto.description ?? null,
      thumbnailKey: dto.thumbnailKey ?? null,
      priceCents: dto.priceCents ?? 0,
      status: CourseStatus.DRAFT,
      instructorId,
    });

    const saved = await this.courseRepo.save(course);
    return toCourseResponse(saved);
  }

  async findAll(
    query: CourseQueryDto,
    user?: AuthenticatedUser,
  ): Promise<{ items: CourseResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.courseRepo.createQueryBuilder('course');

    if (!user || user.role === Role.STUDENT) {
      qb.andWhere('course.status = :publishedStatus', {
        publishedStatus: CourseStatus.PUBLISHED,
      });
    } else if (user.role === Role.INSTRUCTOR) {
      if (query.status) {
        if (query.status === CourseStatus.PUBLISHED) {
          qb.andWhere('course.status = :status', { status: query.status });
        } else {
          qb.andWhere(
            'course.status = :status AND course.instructorId = :instructorId',
            { status: query.status, instructorId: user.userId },
          );
        }
      } else {
        qb.andWhere(
          '(course.status = :publishedStatus OR course.instructorId = :instructorId)',
          {
            publishedStatus: CourseStatus.PUBLISHED,
            instructorId: user.userId,
          },
        );
      }
    } else if (user.role === Role.ADMIN) {
      if (query.status) {
        qb.andWhere('course.status = :status', { status: query.status });
      }
    }

    if (query.q) {
      qb.andWhere(
        '(course.title ILIKE :q OR course.description ILIKE :q)',
        { q: `%${query.q}%` },
      );
    }

    if (query.instructorId) {
      qb.andWhere('course.instructorId = :instId', {
        instId: query.instructorId,
      });
    }

    qb.orderBy('course.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map(toCourseResponse),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(
    id: string,
    user?: AuthenticatedUser,
  ): Promise<CourseDetailResponse> {
    const course = await this.courseRepo
      .createQueryBuilder('course')
      .leftJoinAndSelect('course.sections', 'section')
      .leftJoinAndSelect('section.lessons', 'lesson')
      .where('course.id = :id', { id })
      .orderBy('section.position', 'ASC')
      .addOrderBy('lesson.position', 'ASC')
      .getOne();

    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const isOwner = user?.role === Role.INSTRUCTOR && course.instructorId === user.userId;
    const isAdmin = user?.role === Role.ADMIN;

    if (!isAdmin && !isOwner && course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException('Course not found');
    }

    const sections = (course.sections ?? []).map((section) => ({
      ...toSectionResponse(section),
      lessons: (section.lessons ?? []).map(toLessonResponse),
    }));

    return {
      ...toCourseResponse(course),
      sections,
    };
  }

  async update(
    id: string,
    dto: UpdateCourseDto,
    user: AuthenticatedUser,
  ): Promise<CourseResponse> {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    this.assertCourseOwner(course, user);

    if (dto.slug && dto.slug !== course.slug) {
      const existing = await this.courseRepo.findOne({
        where: { slug: dto.slug },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Slug already in use');
      }
      course.slug = dto.slug;
    }

    if (dto.title !== undefined) course.title = dto.title;
    if (dto.description !== undefined) course.description = dto.description;
    if (dto.priceCents !== undefined) course.priceCents = dto.priceCents;
    if (dto.thumbnailKey !== undefined) course.thumbnailKey = dto.thumbnailKey;

    const saved = await this.courseRepo.save(course);
    return toCourseResponse(saved);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    this.assertCourseOwner(course, user);

    try {
      await this.courseRepo.remove(course);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        'constraint' in error.driverError &&
        error.driverError.constraint === 'FK_certificate_course'
      ) {
        throw new ConflictException('A course with issued certificates cannot be deleted');
      }
      throw error;
    }
  }

  async publish(id: string, user: AuthenticatedUser): Promise<CourseResponse> {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    this.assertCourseOwner(course, user);

    const sections = await this.sectionRepo.find({ where: { courseId: id } });
    if (sections.length === 0) {
      throw new ConflictException(
        'Course must have at least one section and one lesson to publish',
      );
    }

    const sectionIds = sections.map((s) => s.id);
    const publishedLessonsCount = await this.lessonRepo.count({
      where: { sectionId: In(sectionIds), isPublished: true },
    });

    if (publishedLessonsCount === 0) {
      throw new ConflictException(
        'Course must have at least one section and one published lesson to publish',
      );
    }

    course.status = CourseStatus.PUBLISHED;
    const saved = await this.courseRepo.save(course);
    return toCourseResponse(saved);
  }

  async unpublish(
    id: string,
    user: AuthenticatedUser,
  ): Promise<CourseResponse> {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    this.assertCourseOwner(course, user);

    course.status = CourseStatus.DRAFT;
    const saved = await this.courseRepo.save(course);
    return toCourseResponse(saved);
  }

  private assertCourseOwner(course: Course, user: AuthenticatedUser): void {
    if (
      user.role !== Role.ADMIN &&
      !(user.role === Role.INSTRUCTOR && course.instructorId === user.userId)
    ) {
      throw new ForbiddenException(
        'You do not have permission to manage this course',
      );
    }
  }
}
