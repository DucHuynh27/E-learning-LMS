import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaAccessService } from './media-access.service.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { S3Module } from './s3.module.js';
import { MEDIA_QUEUE } from './media.queue.js';
import { Video } from './video.entity.js';

@Module({
  imports: [
    S3Module,
    TypeOrmModule.forFeature([Video]),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
          password: config.getOrThrow<string>('REDIS_PASSWORD'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: MEDIA_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    }),
  ],
  controllers: [MediaController],
  providers: [MediaAccessService, MediaService],
})
export class MediaModule {}
