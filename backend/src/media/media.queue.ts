import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { validateSync, IsUUID } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pipeline } from 'node:stream/promises';
import { Repository } from 'typeorm';
import { Video, VideoStatus } from './video.entity.js';
import { S3Service } from './s3.service.js';

export const MEDIA_QUEUE = 'media';
const ffmpegPath = createRequire(import.meta.url)('ffmpeg-static') as
  string | null;

export class MediaJobPayload {
  @IsUUID()
  videoId: string;
}

@Processor(MEDIA_QUEUE)
export class MediaQueueProcessor extends WorkerHost {
  constructor(
    @InjectRepository(Video) private readonly videos: Repository<Video>,
    private readonly storage: S3Service,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    const payload = plainToInstance(MediaJobPayload, job.data);
    const errors = validateSync(payload);
    if (errors.length > 0) throw new Error('Invalid media job payload');

    const video = await this.videos.findOneBy({ id: payload.videoId });
    if (!video) throw new Error(`Video ${payload.videoId} does not exist`);
    if (video.status === VideoStatus.READY) return;
    if (video.status !== VideoStatus.PROCESSING) {
      throw new Error(`Video ${video.id} is not in PROCESSING state`);
    }

    const directory = await mkdtemp(join(tmpdir(), 'lms-media-'));
    const sourcePath = join(directory, 'source');
    const thumbnailPath = join(directory, 'thumbnail.jpg');

    try {
      await pipeline(
        await this.storage.downloadObject(video.originalKey),
        createWriteStream(sourcePath),
      );
      const durationSec = await this.createThumbnail(sourcePath, thumbnailPath);
      const thumbnailKey = `videos/${video.id}/thumbnail.jpg`;
      await this.storage.uploadThumbnail(
        thumbnailKey,
        await readFile(thumbnailPath),
      );

      video.thumbnailKey = thumbnailKey;
      video.durationSec = durationSec;
      video.status = VideoStatus.READY;
      video.error = null;
      await this.videos.save(video);
    } catch (error) {
      const maxAttempts = job.opts.attempts ?? 1;
      if (job.attemptsMade + 1 >= maxAttempts) {
        video.status = VideoStatus.FAILED;
        video.error = (
          error instanceof Error ? error.message : String(error)
        ).slice(0, 1000);
        await this.videos.save(video);
      }
      throw error;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async createThumbnail(
    sourcePath: string,
    thumbnailPath: string,
  ): Promise<number> {
    if (!ffmpegPath) throw new Error('FFmpeg binary is unavailable');

    const stderr = await new Promise<string>((resolve, reject) => {
      const process = spawn(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel',
          'info',
          '-i',
          sourcePath,
          '-frames:v',
          '1',
          '-q:v',
          '2',
          thumbnailPath,
        ],
        { windowsHide: true },
      );
      let output = '';
      process.stderr.setEncoding('utf8');
      process.stderr.on('data', (chunk: string) => {
        output += chunk;
      });
      process.once('error', reject);
      process.once('close', (code) => {
        if (code === 0) resolve(output);
        else
          reject(new Error(`FFmpeg failed with exit code ${code}: ${output}`));
      });
    });

    const durationMatch = stderr.match(
      /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/,
    );
    if (!durationMatch) {
      throw new Error('FFmpeg output did not include media duration');
    }
    return Math.round(
      Number(durationMatch[1]) * 3600 +
        Number(durationMatch[2]) * 60 +
        Number(durationMatch[3]),
    );
  }
}
