import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LessonsService } from './lessons.service.js';
import { Lesson, LessonType } from './lesson.entity.js';
import { Section } from '../sections/section.entity.js';
import { Course } from '../courses/course.entity.js';
import { Role } from '../user/user.entity.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

describe('LessonsService', () => {
  let service: LessonsService;
  let lessonRepo: Partial<Repository<Lesson>>;
  let sectionRepo: Partial<Repository<Section>>;

  const mockInstructor = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'instructor@example.com',
    role: Role.INSTRUCTOR,
  };

  function createCourse(overrides?: Partial<Course>): Course {
    const course = new Course();
    course.id = 'course-1';
    course.instructorId = mockInstructor.userId;
    return Object.assign(course, overrides);
  }

  function createSection(overrides?: Partial<Section>): Section {
    const section = new Section();
    section.id = 'sec-1';
    section.courseId = 'course-1';
    section.course = createCourse();
    return Object.assign(section, overrides);
  }

  function createLesson(overrides?: Partial<Lesson>): Lesson {
    const lesson = new Lesson();
    lesson.id = 'les-1';
    lesson.sectionId = 'sec-1';
    lesson.title = 'Lesson 1';
    lesson.type = LessonType.ARTICLE;
    lesson.position = 0;
    lesson.durationSec = 120;
    lesson.isPublished = true;
    lesson.section = createSection();
    return Object.assign(lesson, overrides);
  }

  beforeEach(() => {
    lessonRepo = {
      create: vi.fn().mockImplementation((val) => ({ ...val })),
      save: vi.fn().mockImplementation((val) => Promise.resolve({ ...val, id: 'les-1' })),
      findOne: vi.fn(),
      remove: vi.fn().mockResolvedValue(createLesson()),
    };

    sectionRepo = {
      findOne: vi.fn(),
    };

    service = new LessonsService(
      lessonRepo as Repository<Lesson>,
      sectionRepo as Repository<Section>,
    );
  });

  describe('create', () => {
    it('creates lesson with defaults and calculated position', async () => {
      vi.mocked(sectionRepo.findOne!).mockResolvedValue(createSection());
      vi.mocked(lessonRepo.findOne!).mockResolvedValue(createLesson({ position: 0 }));

      const result = await service.create(
        'sec-1',
        { title: 'Intro' },
        mockInstructor,
      );

      expect(lessonRepo.create).toHaveBeenCalledWith({
        sectionId: 'sec-1',
        title: 'Intro',
        type: LessonType.ARTICLE,
        position: 1,
        durationSec: 0,
        isPublished: false,
      });
      expect(result.title).toBe('Intro');
    });

    it('throws NotFoundException if section not found', async () => {
      vi.mocked(sectionRepo.findOne!).mockResolvedValue(null);

      await expect(
        service.create('unknown', { title: 'Intro' }, mockInstructor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates lesson details', async () => {
      vi.mocked(lessonRepo.findOne!).mockResolvedValue(createLesson());

      const result = await service.update(
        'les-1',
        { title: 'Updated Title', durationSec: 300 },
        mockInstructor,
      );

      expect(result.title).toBe('Updated Title');
      expect(result.durationSec).toBe(300);
    });

    it('throws ForbiddenException if user is not course instructor', async () => {
      vi.mocked(lessonRepo.findOne!).mockResolvedValue(createLesson());

      await expect(
        service.update(
          'les-1',
          { title: 'Hacked' },
          { ...mockInstructor, userId: 'someone-else' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('remove', () => {
    it('removes lesson when instructor requests it', async () => {
      vi.mocked(lessonRepo.findOne!).mockResolvedValue(createLesson());

      await service.remove('les-1', mockInstructor);
      expect(lessonRepo.remove).toHaveBeenCalled();
    });
  });
});
