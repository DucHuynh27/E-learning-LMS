import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { QnaCatalogAccess } from '../qna/qna-catalog-access.service.js';
import { resolveCorsOrigins } from '../bootstrap.js';

export interface AuthenticatedSocket extends Socket {
  user?: AuthenticatedUser;
}

@Injectable()
@WebSocketGateway({
  cors: (req: any, callback: any) => {
    const origins = resolveCorsOrigins(process.env.CORS_ORIGIN);
    const origin = req.headers?.origin;
    if (!origin || origins.includes(origin)) {
      callback(null, { origin: true, credentials: true });
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
})
export class WsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly catalogAccess: QnaCatalogAccess,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Disconnecting unauthenticated socket ${client.id}`);
        client.disconnect();
        return;
      }

      const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });

      client.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      await client.join(`user:${client.user.userId}`);
    } catch {
      this.logger.warn(`Invalid token on socket handshake ${client.id}`);
      client.disconnect();
    }
  }

  @SubscribeMessage('join_course')
  async handleJoinCourse(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { courseId: string },
  ) {
    if (!client.user) {
      throw new WsException('Unauthorized');
    }

    if (!data?.courseId) {
      return { ok: false, error: 'courseId is required' };
    }

    try {
      const { canAccess } = await this.catalogAccess.checkAccess(
        data.courseId,
        client.user,
      );

      if (!canAccess) {
        return { ok: false, error: 'Forbidden: not enrolled or instructor' };
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { ok: false, error: 'Course not found' };
      }
      if (error instanceof ServiceUnavailableException) {
        return { ok: false, error: 'Course access could not be verified' };
      }
      return { ok: false, error: 'Course access could not be verified' };
    }

    await client.join(`course:${data.courseId}`);
    return { ok: true };
  }

  @SubscribeMessage('leave_course')
  async handleLeaveCourse(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { courseId: string },
  ) {
    if (data?.courseId) {
      await client.leave(`course:${data.courseId}`);
    }
    return { ok: true };
  }

  emitToCourse(courseId: string, event: string, payload: unknown) {
    this.server?.to(`course:${courseId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
