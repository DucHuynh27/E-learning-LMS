import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './course.entity.js';
import { Section } from '../sections/section.entity.js';
import { Lesson } from '../lessons/lesson.entity.js';
import { CoursesService } from './courses.service.js';
import { CoursesController } from './courses.controller.js';
import { LearningModule } from '../learning/learning.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, Section, Lesson]),
    LearningModule,
  ],
  controllers: [CoursesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
