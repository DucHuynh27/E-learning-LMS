import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { ConfirmUploadDto } from './dto/confirm-upload.dto.js';
import { UploadUrlDto } from './dto/upload-url.dto.js';
import { MEDIA_QUEUE } from './media.queue.js';
import { MediaAccessService } from './media-access.service.js';
import { S3Service } from './s3.service.js';
import { Video, VideoStatus } from './video.entity.js';

export interface VideoResponse {
  id: string;
  lessonId: string;
  status: VideoStatus;
  thumbnailKey: string | null;
  durationSec: number | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Video) private readonly videos: Repository<Video>,
    @InjectQueue(MEDIA_QUEUE) private readonly queue: Queue,
    private readonly storage: S3Service,
    private readonly access: MediaAccessService,
  ) {}

  async createUploadUrl(
    lessonId: string,
    dto: UploadUrlDto,
    user: AuthenticatedUser,
  ) {
    await this.access.assertCanManageLesson(lessonId, user);
    let video = await this.videos.findOneBy({ lessonId });
    if (
      video?.status === VideoStatus.PROCESSING ||
      video?.status === VideoStatus.READY
    ) {
      throw new ConflictException('Video is already being processed or ready');
    }

    if (!video) {
      video = this.videos.create({
        lessonId,
        originalKey: `videos/${lessonId}/${randomUUID()}/original`,
        status: VideoStatus.PENDING,
        thumbnailKey: null,
        durationSec: null,
        error: null,
      });
    } else {
      video.status = VideoStatus.PENDING;
      video.thumbnailKey = null;
      video.durationSec = null;
      video.error = null;
    }
    video = await this.videos.save(video);

    return {
      uploadUrl: await this.storage.createUploadUrl(
        video.originalKey,
        dto.contentType,
      ),
      key: video.originalKey,
      expiresInSec: this.storage.presignedTtl,
    };
  }

  async confirmUpload(
    lessonId: string,
    dto: ConfirmUploadDto,
    user: AuthenticatedUser,
  ): Promise<VideoResponse> {
    await this.access.assertCanManageLesson(lessonId, user);
    const video = await this.videos.findOneBy({ lessonId });
    if (!video) throw new NotFoundException('Upload was not initialized');
    if (dto.key !== video.originalKey) {
      throw new ConflictException('Upload key does not match this lesson');
    }
    if (video.status === VideoStatus.READY) return this.toResponse(video);

    await this.storage.assertObjectExists(video.originalKey);
    video.status = VideoStatus.PROCESSING;
    video.error = null;
    await this.videos.save(video);
    await this.enqueue(video.id);
    return this.toResponse(video);
  }

  async getByLesson(lessonId: string): Promise<VideoResponse> {
    const video = await this.videos.findOneBy({ lessonId });
    if (!video) throw new NotFoundException('Video not found');
    return this.toResponse(video);
  }

  async createPlaybackUrl(id: string, user: AuthenticatedUser) {
    const video = await this.videos.findOneBy({ id });
    if (!video) throw new NotFoundException('Video not found');
    if (video.status !== VideoStatus.READY) {
      throw new ConflictException('Video is not ready for playback');
    }
    await this.access.assertCanPlayVideo(video.lessonId, user);
    return {
      url: await this.storage.createPlaybackUrl(video.originalKey),
      expiresInSec: this.storage.presignedTtl,
    };
  }

  private async enqueue(videoId: string): Promise<void> {
    const existing = await this.queue.getJob(videoId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'failed') {
        await existing.retry('failed');
        return;
      }
      if (state !== 'completed') return;
      await existing.remove();
    }

    await this.queue.add('create-thumbnail', { videoId }, { jobId: videoId });
  }

  private toResponse(video: Video): VideoResponse {
    return {
      id: video.id,
      lessonId: video.lessonId,
      status: video.status,
      thumbnailKey: video.thumbnailKey,
      durationSec: video.durationSec,
      error: video.error,
      createdAt: video.createdAt,
      updatedAt: video.updatedAt,
    };
  }
}
