import type { Job } from 'bullmq';
import { Readable } from 'node:stream';
import type { Repository } from 'typeorm';
import { MediaQueueProcessor } from './media.queue.js';
import type { S3Service } from './s3.service.js';
import { Video, VideoStatus } from './video.entity.js';

describe('MediaQueueProcessor', () => {
  const videoId = '2ec420f3-b3f0-4bfc-a0d9-19161352a713';
  let videos: {
    findOneBy: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let storage: {
    downloadObject: ReturnType<typeof vi.fn>;
    uploadThumbnail: ReturnType<typeof vi.fn>;
  };
  let processor: MediaQueueProcessor;

  beforeEach(() => {
    videos = {
      findOneBy: vi.fn(),
      save: vi.fn(async (v) => v),
    };
    storage = {
      downloadObject: vi.fn(),
      uploadThumbnail: vi.fn(),
    };
    processor = new MediaQueueProcessor(
      videos as unknown as Repository<Video>,
      storage as unknown as S3Service,
    );
  });

  it('rejects invalid job payload without querying the database', async () => {
    const job = {
      data: { videoId: 'not-a-uuid' },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as unknown as Job<unknown>;

    await expect(processor.process(job)).rejects.toThrow(
      'Invalid media job payload',
    );
    expect(videos.findOneBy).not.toHaveBeenCalled();
  });

  it('returns early when video is already READY', async () => {
    videos.findOneBy.mockResolvedValue({
      id: videoId,
      status: VideoStatus.READY,
    });
    const job = {
      data: { videoId },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as unknown as Job<unknown>;

    await expect(processor.process(job)).resolves.toBeUndefined();
    expect(storage.downloadObject).not.toHaveBeenCalled();
  });

  it('does not mark video FAILED before the final retry attempt', async () => {
    const video = {
      id: videoId,
      originalKey: 'videos/lesson/original',
      status: VideoStatus.PROCESSING,
      error: null,
    };
    videos.findOneBy.mockResolvedValue(video);
    storage.downloadObject.mockRejectedValue(new Error('MinIO timeout'));

    const job = {
      data: { videoId },
      opts: { attempts: 3 },
      attemptsMade: 0,
    } as unknown as Job<unknown>;

    await expect(processor.process(job)).rejects.toThrow('MinIO timeout');
    expect(video.status).toBe(VideoStatus.PROCESSING);
    expect(videos.save).not.toHaveBeenCalled();
  });

  it('marks video FAILED and records error on the final attempt', async () => {
    const video = {
      id: videoId,
      originalKey: 'videos/lesson/original',
      status: VideoStatus.PROCESSING,
      error: null,
    };
    videos.findOneBy.mockResolvedValue(video);
    storage.downloadObject.mockResolvedValue(Readable.from([]));
    storage.downloadObject.mockRejectedValueOnce(new Error('Corrupt stream'));

    const job = {
      data: { videoId },
      opts: { attempts: 3 },
      attemptsMade: 2,
    } as unknown as Job<unknown>;

    await expect(processor.process(job)).rejects.toThrow('Corrupt stream');
    expect(video.status).toBe(VideoStatus.FAILED);
    expect(video.error).toBe('Corrupt stream');
    expect(videos.save).toHaveBeenCalledWith(video);
  });
});
