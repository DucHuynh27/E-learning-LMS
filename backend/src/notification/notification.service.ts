import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity.js';
import { QueryNotificationsDto } from './dto/query-notifications.dto.js';
import { WsGateway } from '../realtime/ws.gateway.js';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly wsGateway: WsGateway,
  ) {}

  async createNotification(
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ) {
    const notif = this.notifRepo.create({
      userId,
      type,
      payload,
    });
    const saved = await this.notifRepo.save(notif);

    this.wsGateway.emitToUser(userId, 'notification.created', {
      notification: saved,
    });

    return saved;
  }

  async getMyNotifications(userId: string, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.notifRepo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId });

    if (query.read !== undefined) {
      qb.andWhere('n.read = :read', { read: query.read });
    }

    qb.orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notif = await this.notifRepo.findOne({
      where: { id: notificationId },
    });
    if (!notif) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    if (notif.userId !== userId) {
      throw new ForbiddenException(
        'Cannot mark notification of another user as read',
      );
    }

    notif.read = true;
    return this.notifRepo.save(notif);
  }
}
