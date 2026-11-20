import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Enrolment } from './enrolment.entity.js';
import { Course } from '../courses/course.entity.js';
import { EnrolmentsService } from './enrolments.service.js';
import { EnrolmentsController } from './enrolments.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Enrolment, Course])],
  controllers: [EnrolmentsController],
  providers: [EnrolmentsService],
  exports: [EnrolmentsService],
})
export class EnrolmentsModule {}
