import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QnaThread } from './entities/qna-thread.entity.js';
import { QnaPost } from './entities/qna-post.entity.js';
import { QnaService } from './qna.service.js';
import { QnaController } from './qna.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([QnaThread, QnaPost])],
  controllers: [QnaController],
  providers: [QnaService],
  exports: [QnaService],
})
export class QnaModule {}
