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
import { QnaService } from './qna.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { CreateThreadDto } from './dto/create-thread.dto.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { QueryThreadsDto } from './dto/query-threads.dto.js';

@Controller({ version: '1' })
@UseGuards(JwtAuthGuard)
export class QnaController {
  constructor(private readonly qnaService: QnaService) {}

  @Post('courses/:courseId/threads')
  createThread(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateThreadDto,
  ) {
    return this.qnaService.createThread(courseId, user.userId, dto);
  }

  @Get('courses/:courseId/threads')
  getThreads(
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Query() query: QueryThreadsDto,
  ) {
    return this.qnaService.findThreads(courseId, query);
  }

  @Get('threads/:id')
  getThread(@Param('id', ParseUUIDPipe) id: string) {
    return this.qnaService.getThreadWithPosts(id);
  }

  @Post('threads/:id/posts')
  createPost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePostDto,
  ) {
    return this.qnaService.createPost(id, user.userId, dto);
  }

  @Patch('threads/:id/resolve')
  resolveThread(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.qnaService.resolveThread(id, user);
  }
}

