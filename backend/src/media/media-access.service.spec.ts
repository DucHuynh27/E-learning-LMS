import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from '../user/user.entity.js';
import { MediaAccessService } from './media-access.service.js';

describe('MediaAccessService', () => {
  const owner: AuthenticatedUser = {
    userId: '4bf5122f-3445-4c53-8d42-8fcb6e9a1f25',
    email: 'owner@example.test',
    role: Role.INSTRUCTOR,
  };
  const student: AuthenticatedUser = {
    userId: 'f9c4a4b7-5572-4c2b-a5d1-2db1ea49c52b',
    email: 'student@example.test',
    role: Role.STUDENT,
  };
  let query: ReturnType<typeof vi.fn>;
  let service: MediaAccessService;

  beforeEach(() => {
    query = vi.fn();
    service = new MediaAccessService({ query } as unknown as DataSource);
  });

  it('allows the course owner to manage a VIDEO lesson', async () => {
    query.mockResolvedValue([
      {
        id: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        type: 'VIDEO',
        isPublished: false,
        courseStatus: 'DRAFT',
        instructorId: owner.userId,
        courseId: '5df221d4-a89d-4608-bf1a-1827ba21c036',
      },
    ]);

    await expect(
      service.assertCanManageLesson(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        owner,
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects another instructor from managing the lesson', async () => {
    query.mockResolvedValue([
      {
        id: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        type: 'VIDEO',
        isPublished: false,
        courseStatus: 'DRAFT',
        instructorId: '8e65ca83-8afd-4ec0-a06f-2a7f69aebd19',
        courseId: '5df221d4-a89d-4608-bf1a-1827ba21c036',
      },
    ]);

    await expect(
      service.assertCanManageLesson(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        owner,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an active enrollment for a published video lesson', async () => {
    query
      .mockResolvedValueOnce([
        {
          id: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
          type: 'VIDEO',
          isPublished: true,
          courseStatus: 'PUBLISHED',
          instructorId: owner.userId,
          courseId: '5df221d4-a89d-4608-bf1a-1827ba21c036',
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(
      service.assertCanPlayVideo(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        student,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns a client error for non-video lessons', async () => {
    query.mockResolvedValue([
      {
        id: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        type: 'ARTICLE',
        isPublished: true,
        courseStatus: 'PUBLISHED',
        instructorId: owner.userId,
        courseId: '5df221d4-a89d-4608-bf1a-1827ba21c036',
      },
    ]);

    await expect(
      service.assertCanManageLesson(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        owner,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows ADMIN to manage any VIDEO lesson and throws 404 when missing', async () => {
    const admin: AuthenticatedUser = {
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'admin@example.test',
      role: Role.ADMIN,
    };
    query
      .mockResolvedValueOnce([
        {
          id: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
          type: 'VIDEO',
          isPublished: false,
          courseStatus: 'DRAFT',
          instructorId: owner.userId,
          courseId: '5df221d4-a89d-4608-bf1a-1827ba21c036',
        },
      ])
      .mockResolvedValueOnce([]);

    await expect(
      service.assertCanManageLesson(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        admin,
      ),
    ).resolves.toBeUndefined();

    await expect(
      service.assertCanManageLesson(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        admin,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows an enrolled student to play a published video lesson', async () => {
    query
      .mockResolvedValueOnce([
        {
          id: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
          type: 'VIDEO',
          isPublished: true,
          courseStatus: 'PUBLISHED',
          instructorId: owner.userId,
          courseId: '5df221d4-a89d-4608-bf1a-1827ba21c036',
        },
      ])
      .mockResolvedValueOnce([{ id: 'enrolment-1' }]);

    await expect(
      service.assertCanPlayVideo(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        student,
      ),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining(`e."status" IN ('ACTIVE', 'COMPLETED')`),
      ['5df221d4-a89d-4608-bf1a-1827ba21c036', student.userId],
    );
  });

  it('rejects playback when lesson or course is unpublished', async () => {
    query.mockResolvedValue([
      {
        id: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        type: 'VIDEO',
        isPublished: false,
        courseStatus: 'PUBLISHED',
        instructorId: owner.userId,
        courseId: '5df221d4-a89d-4608-bf1a-1827ba21c036',
      },
    ]);

    await expect(
      service.assertCanPlayVideo(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        student,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
