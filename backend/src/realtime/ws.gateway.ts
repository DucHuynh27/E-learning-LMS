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
import { Logger } from '@nestjs/common';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';

interface AuthenticatedSocket extends Socket {
  user?: JwtPayload;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class WsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WsGateway.name);

  constructor(private readonly jwtService: JwtService) {}

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

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      client.user = payload;
      // Auto join personal room for notifications
      await client.join(`user:${payload.sub}`);
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
    this.server.to(`course:${courseId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
