import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SectionsService } from './sections.service.js';
import { Section } from './section.entity.js';
import { Course } from '../courses/course.entity.js';
import { Role } from '../user/user.entity.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

describe('SectionsService', () => {
  let service: SectionsService;
  let sectionRepo: Partial<Repository<Section>>;
  let courseRepo: Partial<Repository<Course>>;

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
    course.id = 'course-1';
    course.title = 'Course 1';
    course.instructorId = mockInstructor.userId;
    return Object.assign(course, overrides);
  }

  function createSection(overrides?: Partial<Section>): Section {
    const section = new Section();
    section.id = 'sec-1';
    section.courseId = 'course-1';
    section.title = 'Section 1';
    section.position = 0;
    section.course = createCourse();
    return Object.assign(section, overrides);
  }

  beforeEach(() => {
    sectionRepo = {
      create: vi.fn().mockImplementation((val) => ({ ...val })),
      save: vi.fn().mockImplementation((val) => Promise.resolve({ ...val, id: 'sec-1' })),
      findOne: vi.fn(),
      remove: vi.fn().mockResolvedValue(createSection()),
    };

    courseRepo = {
      findOne: vi.fn(),
    };

    service = new SectionsService(
      sectionRepo as Repository<Section>,
      courseRepo as Repository<Course>,
    );
  });

  describe('create', () => {
    it('creates section with calculated position when position is omitted', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());
      vi.mocked(sectionRepo.findOne!).mockResolvedValue(createSection({ position: 2 }));

      const result = await service.create(
        'course-1',
        { title: 'New Section' },
        mockInstructor,
      );

      expect(sectionRepo.create).toHaveBeenCalledWith({
        courseId: 'course-1',
        title: 'New Section',
        position: 3,
      });
      expect(result.position).toBe(3);
    });

    it('throws ForbiddenException if non-owner attempts to create section', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());

      await expect(
        service.create('course-1', { title: 'New Section' }, mockOtherInstructor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('updates section title and position', async () => {
      vi.mocked(sectionRepo.findOne!).mockResolvedValue(createSection());

      const result = await service.update(
        'sec-1',
        { title: 'Updated Section', position: 1 },
        mockInstructor,
      );

      expect(result.title).toBe('Updated Section');
      expect(result.position).toBe(1);
    });
  });

  describe('remove', () => {
    it('removes section if user is owner', async () => {
      vi.mocked(sectionRepo.findOne!).mockResolvedValue(createSection());

      await service.remove('sec-1', mockInstructor);
      expect(sectionRepo.remove).toHaveBeenCalled();
    });

    it('throws NotFoundException if section does not exist', async () => {
      vi.mocked(sectionRepo.findOne!).mockResolvedValue(null);

      await expect(service.remove('unknown', mockInstructor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
