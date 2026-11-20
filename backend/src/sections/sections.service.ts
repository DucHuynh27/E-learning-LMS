import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Section } from './section.entity.js';
import { Course } from '../courses/course.entity.js';
import { CreateSectionDto } from './dto/create-section.dto.js';
import { UpdateSectionDto } from './dto/update-section.dto.js';
import { SectionResponse, toSectionResponse } from './dto/section.response.js';
import { Role } from '../user/user.entity.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { PublishedLessonCache } from '../learning/published-lesson-cache.service.js';

@Injectable()
export class SectionsService {
  constructor(
    @InjectRepository(Section)
    private readonly sectionRepo: Repository<Section>,
    @InjectRepository(Course)
    private readonly courseRepo: Repository<Course>,
    @Optional()
    private readonly publishedCache?: PublishedLessonCache,
  ) {}

  async create(
    courseId: string,
    dto: CreateSectionDto,
    user: AuthenticatedUser,
  ): Promise<SectionResponse> {
    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    this.assertOwner(course.instructorId, user);

    let position = dto.position;
    if (position === undefined) {
      const maxSection = await this.sectionRepo.findOne({
        where: { courseId },
        order: { position: 'DESC' },
      });
      position = maxSection ? maxSection.position + 1 : 0;
    }

    const section = this.sectionRepo.create({
      courseId,
      title: dto.title,
      position,
    });

    const saved = await this.sectionRepo.save(section);
    return toSectionResponse(saved);
  }

  async update(
    id: string,
    dto: UpdateSectionDto,
    user: AuthenticatedUser,
  ): Promise<SectionResponse> {
    const section = await this.sectionRepo.findOne({
      where: { id },
      relations: { course: true },
    });

    if (!section || !section.course) {
      throw new NotFoundException('Section not found');
    }

    this.assertOwner(section.course.instructorId, user);

    if (dto.title !== undefined) section.title = dto.title;
    if (dto.position !== undefined) section.position = dto.position;

    const saved = await this.sectionRepo.save(section);
    return toSectionResponse(saved);
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    const section = await this.sectionRepo.findOne({
      where: { id },
      relations: { course: true },
    });

    if (!section || !section.course) {
      throw new NotFoundException('Section not found');
    }

    this.assertOwner(section.course.instructorId, user);

    const courseId = section.courseId;
    await this.sectionRepo.remove(section);
    await this.publishedCache?.invalidate(courseId);
  }

  private assertOwner(instructorId: string, user: AuthenticatedUser): void {
    if (
      user.role !== Role.ADMIN &&
      !(user.role === Role.INSTRUCTOR && instructorId === user.userId)
    ) {
      throw new ForbiddenException(
        'You do not have permission to manage sections for this course',
      );
    }
  }
}
