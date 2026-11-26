import { describe, expect, it, vi, beforeEach } from 'vitest';
import { EnrolmentsService } from './enrolments.service.js';
import { Enrolment, EnrolmentStatus } from './enrolment.entity.js';
import { Course, CourseStatus } from '../courses/course.entity.js';
import { Role } from '../user/user.entity.js';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Repository } from 'typeorm';

describe('EnrolmentsService', () => {
  let service: EnrolmentsService;
  let enrolmentRepo: Partial<Repository<Enrolment>>;
  let courseRepo: Partial<Repository<Course>>;

  const mockStudent = {
    userId: 'student-uuid-1',
    email: 'student@example.com',
    role: Role.STUDENT,
  };

  const mockInstructor = {
    userId: 'instructor-uuid-1',
    email: 'instructor@example.com',
    role: Role.INSTRUCTOR,
  };

  function createCourse(overrides?: Partial<Course>): Course {
    const course = new Course();
    course.id = 'course-uuid-1';
    course.title = 'Published Course';
    course.status = CourseStatus.PUBLISHED;
    course.instructorId = mockInstructor.userId;
    return Object.assign(course, overrides);
  }

  function createEnrolment(overrides?: Partial<Enrolment>): Enrolment {
    const enrolment = new Enrolment();
    enrolment.id = 'enrol-uuid-1';
    enrolment.courseId = 'course-uuid-1';
    enrolment.userId = mockStudent.userId;
    enrolment.status = EnrolmentStatus.ACTIVE;
    enrolment.progressPct = 0;
    enrolment.enrolledAt = new Date();
    enrolment.completedAt = null;
    return Object.assign(enrolment, overrides);
  }

  beforeEach(() => {
    enrolmentRepo = {
      create: vi.fn().mockImplementation((val) => ({ ...val })),
      save: vi.fn().mockImplementation((val) =>
        Promise.resolve(
          Object.assign(new Enrolment(), val, {
            id: 'enrol-uuid-1',
            enrolledAt: new Date(),
          }),
        ),
      ),
      findOne: vi.fn(),
      findAndCount: vi.fn(),
    };

    courseRepo = {
      findOne: vi.fn(),
    };

    service = new EnrolmentsService(
      enrolmentRepo as Repository<Enrolment>,
      courseRepo as Repository<Course>,
    );
  });

  describe('enroll', () => {
    it('creates active enrolment for published course', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());
      vi.mocked(enrolmentRepo.findOne!).mockResolvedValue(null);

      const result = await service.enroll('course-uuid-1', mockStudent);

      expect(enrolmentRepo.create).toHaveBeenCalledWith({
        courseId: 'course-uuid-1',
        userId: mockStudent.userId,
        status: EnrolmentStatus.ACTIVE,
        progressPct: 0,
      });
      expect(result.status).toBe(EnrolmentStatus.ACTIVE);
      expect(result.courseId).toBe('course-uuid-1');
    });

    it('throws ConflictException if course is not published', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(
        createCourse({ status: CourseStatus.DRAFT }),
      );

      await expect(
        service.enroll('course-uuid-1', mockStudent),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if already enrolled', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());
      vi.mocked(enrolmentRepo.findOne!).mockResolvedValue(createEnrolment());

      await expect(
        service.enroll('course-uuid-1', mockStudent),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if course does not exist', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(null);

      await expect(service.enroll('unknown', mockStudent)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findMyEnrolments', () => {
    it('returns paginated enrolments for student', async () => {
      vi.mocked(enrolmentRepo.findAndCount!).mockResolvedValue([
        [createEnrolment()],
        1,
      ]);

      const result = await service.findMyEnrolments(mockStudent, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findCourseEnrolments', () => {
    it('allows course instructor to view enrolments', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());
      vi.mocked(enrolmentRepo.findAndCount!).mockResolvedValue([
        [createEnrolment()],
        1,
      ]);

      const result = await service.findCourseEnrolments(
        'course-uuid-1',
        mockInstructor,
        { page: 1, limit: 20 },
      );

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('throws ForbiddenException if user is not the instructor or admin', async () => {
      vi.mocked(courseRepo.findOne!).mockResolvedValue(createCourse());

      await expect(
        service.findCourseEnrolments(
          'course-uuid-1',
          { ...mockInstructor, userId: 'other-instructor' },
          { page: 1, limit: 20 },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
