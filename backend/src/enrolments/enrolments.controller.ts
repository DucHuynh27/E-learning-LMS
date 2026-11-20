import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { EnrolmentsService } from './enrolments.service.js';
import { EnrolmentQueryDto } from './dto/enrolment-query.dto.js';
import { EnrolmentResponse } from './dto/enrolment.response.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role } from '../user/user.entity.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Controller()
export class EnrolmentsController {
  constructor(private readonly enrolmentsService: EnrolmentsService) {}

  @Post('courses/:courseId/enroll')
  @Roles(Role.STUDENT)
  async enroll(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EnrolmentResponse> {
    return this.enrolmentsService.enroll(courseId, user);
  }

  @Get('enrolments/me')
  async findMyEnrolments(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EnrolmentQueryDto,
  ): Promise<{ items: EnrolmentResponse[]; meta: { page: number; limit: number; total: number } }> {
    return this.enrolmentsService.findMyEnrolments(user, query);
  }

  @Get('courses/:courseId/enrolments')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  async findCourseEnrolments(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EnrolmentQueryDto,
  ): Promise<{ items: EnrolmentResponse[]; meta: { page: number; limit: number; total: number } }> {
    return this.enrolmentsService.findCourseEnrolments(courseId, user, query);
  }
}
