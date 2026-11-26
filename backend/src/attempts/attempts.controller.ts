import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import {
  QUIZ_READ_THROTTLE,
  QUIZ_START_THROTTLE,
  QUIZ_SUBMIT_THROTTLE,
} from '../common/throttling.js';
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

  @Throttle({ default: QUIZ_START_THROTTLE })
  @Post('lessons/:lessonId/quiz/attempts')
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LessonParamsDto,
  ) {
    return this.attempts.start(user, params.lessonId);
  }

  @Throttle({ default: QUIZ_READ_THROTTLE })
  @Get('lessons/:lessonId/quiz/attempts/active')
  active(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LessonParamsDto,
  ) {
    return this.attempts.active(user, params.lessonId);
  }

  @Throttle({ default: QUIZ_SUBMIT_THROTTLE })
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
