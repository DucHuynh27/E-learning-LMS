import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lesson } from './lesson.entity.js';
import { Section } from '../sections/section.entity.js';
import { LessonsService } from './lessons.service.js';
import { LessonsController } from './lessons.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Lesson, Section])],
  controllers: [LessonsController],
  providers: [LessonsService],
  exports: [LessonsService],
})
export class LessonsModule {}
