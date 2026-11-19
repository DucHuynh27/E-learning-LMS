import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import {
  AttemptParamsDto,
  LessonParamsDto,
} from '../learning/dto/learning-params.dto.js';
import { Role } from '../user/user.entity.js';
import { SubmitAttemptDto } from './dto/submit-attempt.dto.js';
import { AttemptsService } from './attempts.service.js';

@Roles(Role.STUDENT)
@Controller()
export class AttemptsController {
  constructor(
    @Inject(AttemptsService) private readonly attempts: AttemptsService,
  ) {}

  @Post('lessons/:lessonId/quiz/attempts')
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LessonParamsDto,
  ) {
    return this.attempts.start(user, params.lessonId);
  }

  @HttpCode(200)
  @Post('quiz-attempts/:id/submit')
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: AttemptParamsDto,
    @Body() dto: SubmitAttemptDto,
  ) {
    return this.attempts.submit(user, params.id, dto);
  }
}
