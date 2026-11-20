import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from './lesson.entity.js';
import { Section } from '../sections/section.entity.js';
import { LessonsService } from './lessons.service.js';
import { LessonsController } from './lessons.controller.js';
import { LearningModule } from '../learning/learning.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Lesson, Section]), LearningModule],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
