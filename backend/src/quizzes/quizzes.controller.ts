import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { QUIZ_READ_THROTTLE } from '../common/throttling.js';
import { LessonParamsDto } from '../learning/dto/learning-params.dto.js';
import { Role } from '../user/user.entity.js';
import { CreateQuizDto } from './dto/create-quiz.dto.js';
import { QuizzesService } from './quizzes.service.js';

@Controller('lessons/:lessonId/quiz')
export class QuizzesController {
  constructor(
    @Inject(QuizzesService) private readonly quizzes: QuizzesService,
  ) {}

  @Throttle({ default: QUIZ_READ_THROTTLE })
  @Get()
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LessonParamsDto,
  ) {
    return this.quizzes.get(user, params.lessonId);
  }

  @Get('manage')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  getManaged(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LessonParamsDto,
  ) {
    return this.quizzes.getManaged(user, params.lessonId);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LessonParamsDto,
    @Body() dto: CreateQuizDto,
  ) {
    return this.quizzes.create(user, params.lessonId, dto);
  }

  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  @Put()
  replace(
    @CurrentUser() user: AuthenticatedUser,
    @Param() params: LessonParamsDto,
    @Body() dto: CreateQuizDto,
  ) {
    return this.quizzes.create(user, params.lessonId, dto, true);
  }
}
