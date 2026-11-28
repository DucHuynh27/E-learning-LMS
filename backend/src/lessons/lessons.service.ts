import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lesson, LessonType } from './lesson.entity.js';
import { Section } from '../sections/section.entity.js';
import { CreateLessonDto } from './dto/create-lesson.dto.js';
import { UpdateLessonDto } from './dto/update-lesson.dto.js';
import { LessonResponse, toLessonResponse } from './dto/lesson.response.js';
import { Role } from '../user/user.entity.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Injectable()
export class LessonsService {
  constructor(
    @InjectRepository(Lesson)
    private readonly lessonRepo: Repository<Lesson>,
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
  ) {}

  async create(
    sectionId: string,
    dto: CreateLessonDto,
    user: AuthenticatedUser,
  ): Promise<LessonResponse> {
    const section = await this.sectionRepo.findOne({
      where: { id: sectionId },
      relations: { course: true },
    });

    if (!section || !section.course) {
      throw new NotFoundException('Section not found');
    }

    this.assertOwner(section.course.instructorId, user);

    let position = dto.position;
    if (position === undefined) {
      const maxLesson = await this.lessonRepo.findOne({
        where: { sectionId },
        order: { position: 'DESC' },
      });
      position = maxLesson ? maxLesson.position + 1 : 0;
    }

    const lesson = this.lessonRepo.create({
      sectionId,
      title: dto.title,
      content: dto.content ?? null,
      type: dto.type ?? LessonType.ARTICLE,
      position,
      durationSec: dto.durationSec ?? 0,
      isPublished: dto.isPublished ?? false,
    });

    const saved = await this.lessonRepo.save(lesson);
    return toLessonResponse(saved);
  }

  async update(
    id: string,
    dto: UpdateLessonDto,
    user: AuthenticatedUser,
  ): Promise<LessonResponse> {
    const lesson = await this.lessonRepo.findOne({
      where: { id },
      relations: { section: { course: true } },
    });

    if (!lesson || !lesson.section || !lesson.section.course) {
      throw new NotFoundException('Lesson not found');
    }

    this.assertOwner(lesson.section.course.instructorId, user);

    if (dto.title !== undefined) lesson.title = dto.title;
    if (dto.content !== undefined) lesson.content = dto.content;
    if (dto.type !== undefined) lesson.type = dto.type;
    if (dto.position !== undefined) lesson.position = dto.position;
    if (dto.durationSec !== undefined) lesson.durationSec = dto.durationSec;
    if (dto.isPublished !== undefined) lesson.isPublished = dto.isPublished;

    const saved = await this.lessonRepo.save(lesson);
    return toLessonResponse(saved);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const lesson = await this.lessonRepo.findOne({
      where: { id },
      relations: { section: { course: true } },
    });

    if (!lesson || !lesson.section || !lesson.section.course) {
      throw new NotFoundException('Lesson not found');
    }

    this.assertOwner(lesson.section.course.instructorId, user);

    await this.lessonRepo.remove(lesson);
  }

  private assertOwner(instructorId: string, user: AuthenticatedUser): void {
    if (
      user.role !== Role.ADMIN &&
      !(user.role === Role.INSTRUCTOR && instructorId === user.userId)
    ) {
      throw new ForbiddenException(
        'You do not have permission to manage lessons for this course',
      );
    }
  }
}
