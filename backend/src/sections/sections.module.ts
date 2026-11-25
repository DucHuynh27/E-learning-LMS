import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Section } from './section.entity.js';
import { Course } from '../courses/course.entity.js';
import { SectionsService } from './sections.service.js';
import { SectionsController } from './sections.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Section, Course])],
  controllers: [SectionsController],
  providers: [SectionsService],
  exports: [SectionsService],
})
export class SectionsModule {}
