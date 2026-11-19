import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule } from '../app.module.js';
import { S3Module } from './s3.module.js';
import { MediaQueueProcessor } from './media.queue.js';
import { Video } from './video.entity.js';

@Module({
  imports: [AppModule, S3Module, TypeOrmModule.forFeature([Video])],
  providers: [MediaQueueProcessor],
})
export class MediaWorkerModule {}
