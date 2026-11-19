import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { ConfirmUploadDto } from './dto/confirm-upload.dto.js';
import { UploadUrlDto } from './dto/upload-url.dto.js';
import { MediaService } from './media.service.js';

@Controller()
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('lessons/:lessonId/video/upload-url')
  @HttpCode(HttpStatus.OK)
  createUploadUrl(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: UploadUrlDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.media.createUploadUrl(lessonId, dto, user);
  }

  @Post('lessons/:lessonId/video/confirm')
  @HttpCode(HttpStatus.ACCEPTED)
  confirmUpload(
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: ConfirmUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.media.confirmUpload(lessonId, dto, user);
  }

  @Get('lessons/:lessonId/video')
  getByLesson(@Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return this.media.getByLesson(lessonId);
  }

  @Get('videos/:id/playback')
  createPlaybackUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.media.createPlaybackUrl(id, user);
  }
}
