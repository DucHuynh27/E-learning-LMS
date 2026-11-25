import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { JwtService } from '@nestjs/jwt';
import { io } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { Role } from '../src/user/user.entity.js';

describe('Realtime & QnA (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let accessToken: string;
  let httpServer: any;
  let serverPort: number;

  const mockUserId = '11111111-1111-4111-8111-111111111111';
  const mockCourseId = '22222222-2222-4222-8222-222222222222';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    httpServer = app.getHttpServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });

    jwtService = app.get(JwtService);
    accessToken = jwtService.sign(
      { sub: mockUserId, email: 'qa@lms.local', role: Role.STUDENT },
      { secret: process.env.JWT_ACCESS_SECRET },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('WebSocket Gateway', () => {
    it('should disconnect client with invalid or missing token', async () => {
      const socket = io(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: 'invalid_token' },
      });

      await new Promise<void>((resolve) => {
        socket.on('disconnect', () => {
          expect(socket.connected).toBe(false);
          resolve();
        });
      });
      socket.close();
    });

    it('should connect authenticated client and receive events', async () => {
      const socket = io(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: accessToken },
      });

      await new Promise<void>((resolve) => {
        socket.on('connect', () => {
          expect(socket.connected).toBe(true);
          resolve();
        });
      });

      const ack: any = await socket.emitWithAck('join_course', {
        courseId: mockCourseId,
      });
      expect(ack?.ok ?? ack?.data?.ok).toBe(true);

      socket.close();
    });
  });

  describe('QnA Threads & Posts REST', () => {
    let createdThreadId: string;

    it('POST /v1/courses/:courseId/threads - create thread', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/courses/${mockCourseId}/threads`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'How to understand ESM in NestJS 12?',
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toBe('How to understand ESM in NestJS 12?');
      expect(res.body.data.courseId).toBe(mockCourseId);
      expect(res.body.data).not.toHaveProperty('authorId');
      expect(res.body.data).not.toHaveProperty('posts');
      createdThreadId = res.body.data.id;
    });

    it('GET /v1/courses/:courseId/threads - query threads list with boolean filter', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/courses/${mockCourseId}/threads?resolved=false`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      for (const thread of res.body.data.items) {
        expect(thread).not.toHaveProperty('authorId');
        expect(thread).not.toHaveProperty('posts');
        expect(thread).toHaveProperty('id');
        expect(thread).toHaveProperty('courseId');
        expect(thread).toHaveProperty('lessonId');
        expect(thread).toHaveProperty('title');
        expect(thread).toHaveProperty('resolved');
        expect(thread).toHaveProperty('createdAt');
      }
    });

    it('POST /v1/threads/:id/posts - add reply post and trigger notification', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/threads/${createdThreadId}/posts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'You should ensure all local imports end with .js!',
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.threadId).toBe(createdThreadId);
      expect(res.body.data).not.toHaveProperty('authorId');
      expect(res.body.data).not.toHaveProperty('thread');
    });

    it('GET /v1/threads/:id - get thread details and posts', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/threads/${createdThreadId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.thread.id).toBe(createdThreadId);
      expect(res.body.data.posts.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.thread).not.toHaveProperty('authorId');
      for (const post of res.body.data.posts) {
        expect(post).not.toHaveProperty('authorId');
        expect(post).not.toHaveProperty('thread');
        expect(post.threadId).toBe(createdThreadId);
      }
    });

    it('should return 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .get(`/v1/threads/${createdThreadId}`)
        .expect(401);
    });
  });

  describe('Notifications', () => {
    it('GET /v1/notifications/me - get current user notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/notifications/me?read=false')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      for (const notification of res.body.data.items) {
        expect(notification).not.toHaveProperty('userId');
        expect(notification).toHaveProperty('id');
        expect(notification).toHaveProperty('type');
        expect(notification).toHaveProperty('payload');
        expect(notification).toHaveProperty('read');
        expect(notification).toHaveProperty('createdAt');
        expect(JSON.stringify(notification.payload)).not.toContain('replierId');
        expect(JSON.stringify(notification.payload)).not.toContain(
          'resolvedBy',
        );
        expect(JSON.stringify(notification.payload)).not.toContain('authorId');
        expect(JSON.stringify(notification.payload)).not.toContain('userId');
      }
    });
  });
});
