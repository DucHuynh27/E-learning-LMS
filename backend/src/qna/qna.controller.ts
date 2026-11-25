import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { QnaService } from './qna.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateThreadDto } from './dto/create-thread.dto.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { QueryThreadsDto } from './dto/query-threads.dto.js';
import {
  PostResponseDto,
  ThreadResponseDto,
} from '../common/dto/realtime-responses.dto.js';

export const QNA_THREAD_THROTTLE = { ttl: 60_000, limit: 10 } as const;
export const QNA_POST_THROTTLE = { ttl: 60_000, limit: 20 } as const;

@Controller({ version: '1' })
@UseGuards(JwtAuthGuard)
export class QnaController {
  constructor(private readonly qnaService: QnaService) {}

  @Throttle({ default: QNA_THREAD_THROTTLE })
  @Post('courses/:courseId/threads')
  createThread(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateThreadDto,
  ): Promise<ThreadResponseDto> {
    return this.qnaService.createThread(courseId, user, dto);
  }

  @Get('courses/:courseId/threads')
  getThreads(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryThreadsDto,
  ) {
    return this.qnaService.findThreads(courseId, user, query);
  }

  @Get('threads/:id')
  getThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qnaService.getThreadWithPosts(id, user);
  }

  @Throttle({ default: QNA_POST_THROTTLE })
  @Post('threads/:id/posts')
  createPost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponseDto> {
    return this.qnaService.createPost(id, user, dto);
  }

  @Patch('threads/:id/resolve')
  resolveThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ThreadResponseDto> {
    return this.qnaService.resolveThread(id, user);
  }
}
