import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QnaThread } from './entities/qna-thread.entity.js';
import { QnaPost } from './entities/qna-post.entity.js';
import { QnaService } from './qna.service.js';
import { QnaController } from './qna.controller.js';
import { QnaCatalogAccess } from './qna-catalog-access.service.js';
import { NotificationModule } from '../notification/notification.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([QnaThread, QnaPost]),
    NotificationModule,
  ],
  controllers: [QnaController],
  providers: [QnaService, QnaCatalogAccess],
  exports: [QnaService, QnaCatalogAccess],
})
export class QnaModule {}
