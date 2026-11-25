import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import type { Queue } from 'bullmq';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from '../user/user.entity.js';
import { MediaAccessService } from './media-access.service.js';
import { MediaService } from './media.service.js';
import { S3Service } from './s3.service.js';
import { Video, VideoStatus } from './video.entity.js';

describe('MediaService', () => {
  const user: AuthenticatedUser = {
    userId: '4bf5122f-3445-4c53-8d42-8fcb6e9a1f25',
    email: 'instructor@example.test',
    role: Role.INSTRUCTOR,
  };
  let service: MediaService;
  let videos: {
    findOneBy: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let queue: {
    add: ReturnType<typeof vi.fn>;
    getJob: ReturnType<typeof vi.fn>;
  };
  let storage: {
    createUploadUrl: ReturnType<typeof vi.fn>;
    createPlaybackUrl: ReturnType<typeof vi.fn>;
    assertObjectExists: ReturnType<typeof vi.fn>;
    presignedTtl: number;
  };
  let access: {
    assertCanManageLesson: ReturnType<typeof vi.fn>;
    assertCanPlayVideo: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    videos = {
      findOneBy: vi.fn(),
      create: vi.fn((value) => value),
      save: vi.fn(async (video) => ({
        ...video,
        id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      })),
    };
    queue = { add: vi.fn(), getJob: vi.fn() };
    storage = {
      createUploadUrl: vi.fn().mockResolvedValue('https://minio/upload'),
      createPlaybackUrl: vi.fn().mockResolvedValue('https://minio/play'),
      assertObjectExists: vi.fn(),
      presignedTtl: 900,
    };
    access = {
      assertCanManageLesson: vi.fn(),
      assertCanPlayVideo: vi.fn(),
    };
    service = new MediaService(
      videos as unknown as Repository<Video>,
      queue as unknown as Queue,
      storage as unknown as S3Service,
      access as unknown as MediaAccessService,
    );
  });

  it('creates a presigned upload without exposing storage credentials', async () => {
    const result = await service.createUploadUrl(
      'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      { contentType: 'video/mp4', sizeBytes: 1200 },
      user,
    );

    expect(result).toMatchObject({
      uploadUrl: 'https://minio/upload',
      expiresInSec: 900,
    });
    expect(result.key).toContain(
      'videos/b5d8a218-d68f-47ad-a8ef-6750e7f745a3/',
    );
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      result.key,
      'video/mp4',
    );
  });

  it('confirms an uploaded object and enqueues by video id', async () => {
    const video = {
      id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      lessonId: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      originalKey: 'videos/lesson/original',
      status: VideoStatus.PENDING,
    };
    videos.findOneBy.mockResolvedValue(video);
    queue.getJob.mockResolvedValue(undefined);

    const result = await service.confirmUpload(
      video.lessonId,
      { key: video.originalKey },
      user,
    );

    expect(storage.assertObjectExists).toHaveBeenCalledWith(video.originalKey);
    expect(queue.add).toHaveBeenCalledWith(
      'create-thumbnail',
      { videoId: video.id },
      { jobId: video.id },
    );
    expect(result).not.toHaveProperty('originalKey');
  });

  it('does not enqueue a duplicate confirmation while the job is waiting', async () => {
    const video = {
      id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      lessonId: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      originalKey: 'videos/lesson/original',
      status: VideoStatus.PROCESSING,
    };
    videos.findOneBy.mockResolvedValue(video);
    queue.getJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('waiting'),
    });

    await service.confirmUpload(
      video.lessonId,
      { key: video.originalKey },
      user,
    );

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects upload-url when video is already processing or ready', async () => {
    videos.findOneBy.mockResolvedValue({
      id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      lessonId: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      status: VideoStatus.READY,
    });

    await expect(
      service.createUploadUrl(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        { contentType: 'video/mp4' },
        user,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects confirmUpload with 409 when video is already ready', async () => {
    const video = {
      id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      lessonId: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      originalKey: 'videos/lesson/original',
      status: VideoStatus.READY,
    };
    videos.findOneBy.mockResolvedValue(video);

    await expect(
      service.confirmUpload(
        video.lessonId,
        { key: video.originalKey },
        user,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects confirmUpload when key does not match the initialized upload', async () => {
    videos.findOneBy.mockResolvedValue({
      id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      lessonId: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      originalKey: 'videos/lesson/original',
      status: VideoStatus.PENDING,
    });

    await expect(
      service.confirmUpload(
        'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
        { key: 'videos/lesson/other' },
        user,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('retries failed BullMQ job when confirming a failed video', async () => {
    const retry = vi.fn();
    const video = {
      id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      lessonId: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      originalKey: 'videos/lesson/original',
      status: VideoStatus.FAILED,
      error: 'Previous error',
    };
    videos.findOneBy.mockResolvedValue(video);
    queue.getJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('failed'),
      retry,
    });

    await service.confirmUpload(
      video.lessonId,
      { key: video.originalKey },
      user,
    );

    expect(retry).toHaveBeenCalledWith('failed');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns video metadata without originalKey', async () => {
    videos.findOneBy.mockResolvedValue({
      id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      lessonId: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      originalKey: 'videos/lesson/original',
      thumbnailKey: 'videos/2ec4/thumbnail.jpg',
      durationSec: 42,
      status: VideoStatus.READY,
      error: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    });

    const result = await service.getByLesson(
      'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
    );

    expect(result).not.toHaveProperty('originalKey');
    expect(result.thumbnailKey).toBe('videos/2ec4/thumbnail.jpg');
  });

  it('returns presigned playback URL when video is ready and user has access', async () => {
    videos.findOneBy.mockResolvedValue({
      id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      lessonId: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      originalKey: 'videos/lesson/original',
      status: VideoStatus.READY,
    });

    const result = await service.createPlaybackUrl(
      '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      user,
    );

    expect(access.assertCanPlayVideo).toHaveBeenCalledWith(
      'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      user,
    );
    expect(result).toEqual({ url: 'https://minio/play', expiresInSec: 900 });
  });

  it('rejects playback when video is not ready or missing', async () => {
    videos.findOneBy.mockResolvedValueOnce(null);
    await expect(
      service.createPlaybackUrl('2ec420f3-b3f0-4bfc-a0d9-19161352a713', user),
    ).rejects.toBeInstanceOf(NotFoundException);

    videos.findOneBy.mockResolvedValueOnce({
      id: '2ec420f3-b3f0-4bfc-a0d9-19161352a713',
      lessonId: 'b5d8a218-d68f-47ad-a8ef-6750e7f745a3',
      status: VideoStatus.PROCESSING,
    });
    await expect(
      service.createPlaybackUrl('2ec420f3-b3f0-4bfc-a0d9-19161352a713', user),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
