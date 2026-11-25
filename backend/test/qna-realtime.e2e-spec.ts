import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { JwtService } from '@nestjs/jwt';
import { io } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { Role } from '../src/user/user.entity.js';
import { DataSource } from 'typeorm';
import { NotificationService } from '../src/notification/notification.service.js';

describe('Realtime & QnA (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let accessToken: string;
  let httpServer: any;
  let serverPort: number;
  let catalogTablesCreated = false;
  let enrolmentsTableCreated = false;

  const mockUserId = '11111111-1111-4111-8111-111111111111';
  const mockCourseId = '22222222-2222-4222-8222-222222222222';
  const unenrolledCourseId = '33333333-3333-4333-8333-333333333333';

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

    const source = app.get(DataSource);
    const coursesTable = await source.query(
      `SELECT to_regclass('public.courses') AS name`,
    );
    if (!coursesTable[0]?.name) {
      await source.query(`
        CREATE TABLE "courses" (
          "id" uuid PRIMARY KEY,
          "instructorId" uuid NOT NULL,
          "status" varchar(20) NOT NULL
        )
      `);
      catalogTablesCreated = true;
    }
    const enrolmentsTable = await source.query(
      `SELECT to_regclass('public.enrolments') AS name`,
    );
    if (!enrolmentsTable[0]?.name) {
      await source.query(`
        CREATE TABLE "enrolments" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" uuid NOT NULL,
          "courseId" uuid NOT NULL,
          "status" varchar(20) NOT NULL
        )
      `);
      enrolmentsTableCreated = true;
    }

    await source.query(
      `INSERT INTO "courses" ("id", "instructorId", "status")
       VALUES ($1, $2, 'PUBLISHED')
       ON CONFLICT ("id") DO UPDATE SET "status" = EXCLUDED."status"`,
      [mockCourseId, mockUserId],
    );
    await source.query(
      `INSERT INTO "enrolments" ("userId", "courseId", "status")
       VALUES ($1, $2, 'ACTIVE')`,
      [mockUserId, mockCourseId],
    );
    await source.query(
      `INSERT INTO "courses" ("id", "instructorId", "status")
       VALUES ($1, $2, 'PUBLISHED')
       ON CONFLICT ("id") DO UPDATE SET "status" = EXCLUDED."status"`,
      [unenrolledCourseId, '44444444-4444-4444-8444-444444444444'],
    );

    jwtService = app.get(JwtService);
    accessToken = jwtService.sign(
      { sub: mockUserId, email: 'qa@lms.local', role: Role.STUDENT },
      { secret: process.env.JWT_ACCESS_SECRET },
    );
  });

  afterAll(async () => {
    const source = app.get(DataSource);
    await source.query(`DELETE FROM "notifications" WHERE "userId" = $1`, [
      mockUserId,
    ]);
    await source.query(`DELETE FROM "qna_posts" WHERE "authorId" = $1`, [
      mockUserId,
    ]);
    await source.query(`DELETE FROM "qna_threads" WHERE "authorId" = $1`, [
      mockUserId,
    ]);
    await source.query(
      `DELETE FROM "enrolments" WHERE "userId" = $1 AND "courseId" = $2`,
      [mockUserId, mockCourseId],
    );
    await source.query(`DELETE FROM "courses" WHERE "id" = $1`, [mockCourseId]);
    await source.query(`DELETE FROM "courses" WHERE "id" = $1`, [
      unenrolledCourseId,
    ]);
    if (enrolmentsTableCreated) {
      await source.query(`DROP TABLE IF EXISTS "enrolments"`);
    }
    if (catalogTablesCreated) {
      await source.query(`DROP TABLE IF EXISTS "courses"`);
    }
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

    it('should reject joining a course without enrollment', async () => {
      const socket = io(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: accessToken },
      });
      await new Promise<void>((resolve) => {
        socket.on('connect', () => resolve());
      });

      const ack: any = await socket.emitWithAck('join_course', {
        courseId: unenrolledCourseId,
      });
      expect(ack?.ok ?? ack?.data?.ok).toBe(false);
      expect(ack?.error ?? ack?.data?.error).toContain('Forbidden');
      socket.close();
    });
  });

  describe('QnA Threads & Posts REST', () => {
    let createdThreadId: string;

    it('POST /v1/courses/:courseId/threads - create thread', async () => {
      const socket = io(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: accessToken },
      });
      await new Promise<void>((resolve) => {
        socket.on('connect', () => resolve());
      });
      const joinAck: any = await socket.emitWithAck('join_course', {
        courseId: mockCourseId,
      });
      expect(joinAck?.ok ?? joinAck?.data?.ok).toBe(true);
      const eventPromise = new Promise<any>((resolve) => {
        socket.once('qna.thread.created', resolve);
      });

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

      const event = await eventPromise;
      expect(event.thread).toEqual(res.body.data);
      expect(event.thread).not.toHaveProperty('authorId');
      expect(event.thread).not.toHaveProperty('posts');
      socket.close();
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
      const socket = io(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: accessToken },
      });
      await new Promise<void>((resolve) => {
        socket.on('connect', () => resolve());
      });
      await socket.emitWithAck('join_course', { courseId: mockCourseId });
      const eventPromise = new Promise<any>((resolve) => {
        socket.once('qna.post.created', resolve);
      });

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

      const event = await eventPromise;
      expect(event.threadId).toBe(createdThreadId);
      expect(event.post).toEqual(res.body.data);
      expect(event.post).not.toHaveProperty('authorId');
      expect(event.post).not.toHaveProperty('thread');
      socket.close();
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

    it('emits notification DTO without userId or nested identity fields', async () => {
      const socket = io(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: accessToken },
      });
      await new Promise<void>((resolve) => {
        socket.on('connect', () => resolve());
      });

      const eventPromise = new Promise<any>((resolve) => {
        socket.once('notification.created', resolve);
      });

      const notificationService = app.get(NotificationService);
      await notificationService.createNotification(mockUserId, 'qna.reply', {
        threadId: '11111111-aaaa-4111-8111-aaaaaaaaaaaa',
        courseId: mockCourseId,
        postId: '22222222-bbbb-4222-8222-bbbbbbbbbbbb',
        replierId: 'private-replier-id',
        nested: {
          authorId: 'private-author-id',
          userId: 'private-user-id',
        },
      });

      const event = await eventPromise;
      expect(event.notification).not.toHaveProperty('userId');
      expect(event.notification).toHaveProperty('id');
      expect(event.notification).toHaveProperty('type');
      expect(event.notification).toHaveProperty('payload');
      expect(JSON.stringify(event.notification.payload)).not.toContain(
        'replierId',
      );
      expect(JSON.stringify(event.notification.payload)).not.toContain(
        'authorId',
      );
      expect(JSON.stringify(event.notification.payload)).not.toContain(
        'userId',
      );
      socket.close();
    });
  });
});
