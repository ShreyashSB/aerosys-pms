import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { User, type CurrentUser } from '../auth/current-user.js';
import { NotificationsService, type NotificationDto } from './notifications.service.js';

/** Every route answers for the signed-in person only, so none needs an @Allow. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** GET /api/notifications → mine, newest first (at most 100) */
  @Get()
  list(@User() user: CurrentUser): Promise<NotificationDto[]> {
    return this.notifications.listForUser(user);
  }

  /** POST /api/notifications/read-all */
  @Post('read-all')
  @HttpCode(204)
  markAllRead(@User() user: CurrentUser): Promise<void> {
    return this.notifications.markAllRead(user);
  }

  /** POST /api/notifications/:id/read */
  @Post(':id/read')
  @HttpCode(204)
  markRead(@User() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.notifications.markRead(id, user);
  }
}
