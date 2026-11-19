import { Body, Controller, Get, Inject, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import {
  CourseParamsDto,
  LessonParamsDto,
} from '../learning/dto/learning-params.dto.js';
import { Role } from '../user/user.entity.js';
import { UpdateProgressDto } from './dto/update-progress.dto.js';
import { ProgressService } from './progress.service.js';

@Roles(Role.STUDENT)
@Controller()
export class ProgressController {
  constructor(
    @Inject(ProgressService) private readonly progress: ProgressService,
  ) {}

  @Patch('lessons/:lessonId/progress')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LessonParamsDto,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.progress.update(user, params.lessonId, dto);
  }

  @Get('enrolments/:courseId/progress')
  course(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: CourseParamsDto,
  ) {
    return this.progress.course(user, params.courseId);
  }
}
