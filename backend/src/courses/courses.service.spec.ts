import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CoursesService } from './courses.service.js';
import { Course, CourseStatus } from './course.entity.js';
import { Role } from '../user/user.entity.js';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { Section } from '../sections/section.entity.js';
import type { Lesson } from '../lessons/lesson.entity.js';

describe('CoursesService', () => {
  let service: CoursesService;
  let courseRepo: Partial<Repository<Course>>;
  let sectionRepo: Partial<Repository<Section>>;
  let lessonRepo: Partial<Repository<Lesson>>;

  const mockInstructor = {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'instructor@example.com',
    role: Role.INSTRUCTOR,
  };

  const mockOtherInstructor = {
    userId: '22222222-2222-2222-2222-222222222222',
    email: 'other@example.com',
    role: Role.INSTRUCTOR,
  };

  function createCourse(overrides?: Partial<Course>): Course {
    const course = new Course();
    course.id = '33333333-3333-3333-3333-333333333333';
    course.title = 'Test Course';
    course.slug = 'test-course';
    course.description = 'A test course';
    course.thumbnailKey = null;
    course.priceCents = 1000;
    course.status = CourseStatus.DRAFT;
    course.instructorId = mockInstructor.userId;
    course.createdAt = new Date();
    course.updatedAt = new Date();
    return Object.assign(course, overrides);
  }

  beforeEach(() => {
    courseRepo = {
      create: vi.fn().mockImplementation((val) => ({ ...val })),
      save: vi.fn().mockImplementation((val) =>
        Promise.resolve(
          Object.assign(new Course(), val, {
            id: '33333333-3333-3333-3333-333333333333',
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        ),
      ),
      findOne: vi.fn(),
      createQueryBuilder: vi.fn(),
      remove: vi.fn().mockResolvedValue(createCourse()),
    };

    sectionRepo = {
      find: vi.fn(),
    };

    lessonRepo = {
      count: vi.fn(),
    };

    service = new CoursesService(
      courseRepo as Repository<Course>,
      sectionRepo as Repository<Section>,
      lessonRepo as Repository<Lesson>,
    );
  });

  describe('create', () => {
    it('creates course with slug and draft status', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(null);

      const result = await service.create(
        { title: 'My New Course', priceCents: 500 },
        mockInstructor.userId,
      );

      expect(courseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My New Course',
          slug: 'my-new-course',
          status: CourseStatus.DRAFT,
          instructorId: mockInstructor.userId,
          priceCents: 500,
        }),
      );
      expect(result.slug).toBe('my-new-course');
      expect(result.status).toBe(CourseStatus.DRAFT);
    });

    it('generates unique slug on collision', async () => {
      vi.mocked(courseRepo.findOne!)
        .mockResolvedValueOnce(createCourse())
        .mockResolvedValueOnce(null);

      const result = await service.create(
        { title: 'Test Course' },
        mockInstructor.userId,
      );

      expect(result.slug).toBe('test-course-1');
    });
  });

  describe('update', () => {
    it('allows course owner to update fields', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());

      const result = await service.update(
        '33333333-3333-3333-3333-333333333333',
        { title: 'Updated Title' },
        mockInstructor,
      );

      expect(result.title).toBe('Updated Title');
    });

    it('throws ForbiddenException if user is not the owner or admin', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());

      await expect(
        service.update(
          '33333333-3333-3333-3333-333333333333',
          { title: 'Hacked' },
          mockOtherInstructor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException if new slug is already taken by another course', async () => {
      vi.mocked(courseRepo.findOne!)
        .mockResolvedValueOnce(createCourse())
        .mockResolvedValueOnce(
          createCourse({
            id: 'other-id',
            slug: 'existing-slug',
          }),
        );

      await expect(
        service.update(
          '33333333-3333-3333-3333-333333333333',
          { slug: 'existing-slug' },
          mockInstructor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('publish', () => {
    it('throws ConflictException if course has no sections', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());
      vi.mocked(sectionRepo.find!).mockResolvedValue([]);

      await expect(
        service.publish('33333333-3333-3333-3333-333333333333', mockInstructor),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if sections have no lessons', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());
      vi.mocked(sectionRepo.find!).mockResolvedValue([
        { id: 'sec-1', courseId: '33333333-3333-3333-3333-333333333333' } as Section,
      ]);
      vi.mocked(lessonRepo.count!).mockResolvedValue(0);

      await expect(
        service.publish('33333333-3333-3333-3333-333333333333', mockInstructor),
      ).rejects.toThrow(ConflictException);
    });

    it('only counts published lessons', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());
      vi.mocked(sectionRepo.find!).mockResolvedValue([
        { id: 'sec-1', courseId: '33333333-3333-3333-3333-333333333333' } as Section,
      ]);
      vi.mocked(lessonRepo.count!).mockResolvedValue(0);

      await expect(
        service.publish('33333333-3333-3333-3333-333333333333', mockInstructor),
      ).rejects.toThrow(ConflictException);
      expect(lessonRepo.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isPublished: true }),
        }),
      );
    });

    it('publishes course if it has at least 1 section and 1 lesson', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());
      vi.mocked(sectionRepo.find!).mockResolvedValue([
        { id: 'sec-1', courseId: '33333333-3333-3333-3333-333333333333' } as Section,
      ]);
      vi.mocked(lessonRepo.count!).mockResolvedValue(1);

      const result = await service.publish(
        '33333333-3333-3333-3333-333333333333',
        mockInstructor,
      );
      expect(result.status).toBe(CourseStatus.PUBLISHED);
    });
  });

  describe('unpublish', () => {
    it('sets status back to DRAFT', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(
        createCourse({ status: CourseStatus.PUBLISHED }),
      );

      const result = await service.unpublish(
        '33333333-3333-3333-3333-333333333333',
        mockInstructor,
      );
      expect(result.status).toBe(CourseStatus.DRAFT);
    });
  });

  describe('remove', () => {
    it('throws NotFoundException if course not found', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(null);

      await expect(service.remove('unknown-id', mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('removes course when owner requests it', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());

      await service.remove('33333333-3333-3333-3333-333333333333', mockInstructor);
      expect(courseRepo.remove).toHaveBeenCalled();
    });
  });
});
