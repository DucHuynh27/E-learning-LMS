import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { NotificationResponseDto } from '../common/dto/realtime-responses.dto.js';

@Controller({ path: 'notifications', version: '1' })
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notifService: NotificationService) {}

  @Get('me')
  getMyNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryNotificationsDto,
  ): Promise<{
    items: NotificationResponseDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.notifService.getMyNotifications(user.userId, query);
  }

  @Patch(':id/read')
  markRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationResponseDto> {
    return this.notifService.markAsRead(id, user.userId);
  }
}
