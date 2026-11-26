import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { NotificationService } from '../src/notification/notification.service.js';
import { Role } from '../src/user/user.entity.js';
import { assertSafeE2eDatabase } from './e2e-database.guard.js';

describe('Realtime & QnA (e2e)', () => {
  let app: INestApplication<App>;
  let source: DataSource;
  let jwtService: JwtService;
  let studentToken: string;
  let ownerToken: string;
  let adminToken: string;
  let outsiderToken: string;
  let httpServer: any;
  let serverPort: number;

  const studentId = randomUUID();
  const ownerId = randomUUID();
  const outsiderId = randomUUID();
  const adminId = randomUUID();
  const courseAId = randomUUID();
  const courseBId = randomUUID();
  const userIds = [studentId, ownerId, outsiderId, adminId];
  const courseIds = [courseAId, courseBId];
  const createdCatalogTables = new Set<string>();

  const signToken = (sub: string, role: Role) =>
    jwtService.sign(
      { sub, email: `${sub}@lms.local`, role },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

  beforeAll(async () => {
    assertSafeE2eDatabase(process.env.DB_NAME);
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    source = app.get(DataSource);
    assertSafeE2eDatabase(
      typeof source.options.database === 'string'
        ? source.options.database
        : undefined,
    );

    const catalogTables = (await source.query(
      `SELECT "table_name" FROM information_schema.tables
       WHERE "table_schema" = current_schema()
         AND "table_name" = ANY($1::text[])`,
      [['courses', 'enrolments']],
    )) as { table_name: string }[];
    const existingCatalogTables = new Set(
      catalogTables.map(({ table_name }) => table_name),
    );

    if (!existingCatalogTables.has('courses')) {
      await source.query(`
        CREATE TABLE "courses" (
          "id" uuid PRIMARY KEY,
          "title" varchar(200) NOT NULL,
          "slug" varchar(200) NOT NULL UNIQUE,
          "description" text,
          "thumbnailKey" varchar(512),
          "priceCents" integer NOT NULL DEFAULT 0,
          "status" varchar(20) NOT NULL,
          "instructorId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "createdAt" timestamptz NOT NULL DEFAULT now(),
          "updatedAt" timestamptz NOT NULL DEFAULT now()
        )
      `);
      createdCatalogTables.add('courses');
    }

    if (!existingCatalogTables.has('enrolments')) {
      await source.query(`
        CREATE TABLE "enrolments" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "courseId" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
          "status" varchar(20) NOT NULL,
          "progressPct" integer NOT NULL DEFAULT 0,
          "enrolledAt" timestamptz NOT NULL DEFAULT now(),
          "completedAt" timestamptz,
          UNIQUE ("userId", "courseId")
        )
      `);
      createdCatalogTables.add('enrolments');
    }

    await source.query(
      `INSERT INTO "users" ("id", "email", "passwordHash", "fullName", "role")
       VALUES
         ($1, $5, 'hash', 'Student', 'STUDENT'),
         ($2, $6, 'hash', 'Owner', 'INSTRUCTOR'),
         ($3, $7, 'hash', 'Outsider', 'STUDENT'),
         ($4, $8, 'hash', 'Admin', 'ADMIN')
       ON CONFLICT ("id") DO NOTHING`,
      [
        ...userIds,
        `${studentId}@lms.local`,
        `${ownerId}@lms.local`,
        `${outsiderId}@lms.local`,
        `${adminId}@lms.local`,
      ],
    );
    await source.query(
      `INSERT INTO "courses" ("id", "title", "slug", "priceCents", "status", "instructorId")
       VALUES
         ($1, 'Course A', $3, 0, 'PUBLISHED', $5),
         ($2, 'Course B', $4, 0, 'PUBLISHED', $6)
       ON CONFLICT ("id") DO NOTHING`,
      [
        courseAId,
        courseBId,
        `course-a-${courseAId}`,
        `course-b-${courseBId}`,
        ownerId,
        outsiderId,
      ],
    );
    await source.query(
      `INSERT INTO "enrolments" ("userId", "courseId", "status")
       VALUES
         ($1, $2, 'ACTIVE'),
         ($1, $3, 'ACTIVE')
       ON CONFLICT ("userId", "courseId") DO UPDATE SET "status" = 'ACTIVE'`,
      [studentId, courseAId, courseBId],
    );

    httpServer = app.getHttpServer();
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });

    jwtService = app.get(JwtService);
    studentToken = signToken(studentId, Role.STUDENT);
    ownerToken = signToken(ownerId, Role.INSTRUCTOR);
    adminToken = signToken(adminId, Role.ADMIN);
    outsiderToken = signToken(outsiderId, Role.STUDENT);
  });

  afterAll(async () => {
    if (source?.isInitialized) {
      await source.query(
        `DELETE FROM "qna_posts"
         WHERE "threadId" IN (
           SELECT "id" FROM "qna_threads" WHERE "courseId" = ANY($1::uuid[])
         ) OR "authorId" = ANY($2::uuid[])`,
        [courseIds, userIds],
      );
      await source.query(
        `DELETE FROM "qna_threads"
         WHERE "courseId" = ANY($1::uuid[]) OR "authorId" = ANY($2::uuid[])`,
        [courseIds, userIds],
      );
      await source.query(
        `DELETE FROM "notifications" WHERE "userId" = ANY($1::uuid[])`,
        [userIds],
      );
      await source.query(
        `DELETE FROM "enrolments"
         WHERE "courseId" = ANY($1::uuid[]) OR "userId" = ANY($2::uuid[])`,
        [courseIds, userIds],
      );
      await source.query(
        `DELETE FROM "courses" WHERE "id" = ANY($1::uuid[])`,
        [courseIds],
      );
      await source.query(`DELETE FROM "users" WHERE "id" = ANY($1::uuid[])`, [
        userIds,
      ]);

      if (createdCatalogTables.has('enrolments')) {
        await source.query(`DROP TABLE "enrolments"`);
      }
      if (createdCatalogTables.has('courses')) {
        await source.query(`DROP TABLE "courses"`);
      }
      await app.close();
    }
  });

  const connectSocket = async (token: string) => {
    const socket = io(`http://localhost:${serverPort}`, {
      transports: ['websocket'],
      auth: { token },
    });
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Socket did not connect')),
        3000,
      );
      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    return socket;
  };

  const expectNoEvent = async (
    socket: ReturnType<typeof io>,
    event: string,
    trigger: () => Promise<void>,
  ) => {
    let received = false;
    const listener = () => {
      received = true;
    };
    socket.on(event, listener);
    await trigger();
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    socket.off(event, listener);
    expect(received).toBe(false);
  };

  describe('WebSocket Gateway', () => {
    it('disconnects invalid token and accepts valid course room join', async () => {
      const invalid = io(`http://localhost:${serverPort}`, {
        transports: ['websocket'],
        auth: { token: 'invalid_token' },
      });
      await new Promise<void>((resolve) => {
        invalid.once('disconnect', () => resolve());
      });
      invalid.close();

      const socket = await connectSocket(studentToken);
      const ack: any = await socket.emitWithAck('join_course', {
        courseId: courseAId,
      });
      expect(ack?.ok ?? ack?.data?.ok).toBe(true);
      socket.close();
    });

    it('rejects join_course when student is not enrolled', async () => {
      const socket = await connectSocket(outsiderToken);
      const ack: any = await socket.emitWithAck('join_course', {
        courseId: courseAId,
      });
      expect(ack?.ok ?? ack?.data?.ok).toBe(false);
      socket.close();
    });

    it('does not deliver room broadcast after enrollment is revoked', async () => {
      const socket = await connectSocket(studentToken);
      const join: any = await socket.emitWithAck('join_course', {
        courseId: courseAId,
      });
      expect(join?.ok ?? join?.data?.ok).toBe(true);

      await source.query(
        `DELETE FROM "enrolments" WHERE "userId" = $1 AND "courseId" = $2`,
        [studentId, courseAId],
      );

      await expectNoEvent(socket, 'qna.thread.created', async () => {
        await request(app.getHttpServer())
          .post(`/v1/courses/${courseAId}/threads`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ title: 'After revoke' })
          .expect(201);
      });

      const rejoin: any = await socket.emitWithAck('join_course', {
        courseId: courseAId,
      });
      expect(rejoin?.ok ?? rejoin?.data?.ok).toBe(false);

      await source.query(
        `INSERT INTO "enrolments" ("userId", "courseId", "status")
         VALUES ($1, $2, 'ACTIVE')
         ON CONFLICT ("userId", "courseId") DO UPDATE SET "status" = 'ACTIVE'`,
        [studentId, courseAId],
      );
      socket.close();
    });

    it('does not leak qna broadcasts across course rooms', async () => {
      const socketA = await connectSocket(studentToken);
      const socketB = await connectSocket(studentToken);
      await socketA.emitWithAck('join_course', { courseId: courseAId });
      await socketB.emitWithAck('join_course', { courseId: courseBId });

      const receivedA = new Promise<void>((resolve) => {
        socketA.once('qna.thread.created', () => resolve());
      });
      await expectNoEvent(socketB, 'qna.thread.created', async () => {
        await request(app.getHttpServer())
          .post(`/v1/courses/${courseAId}/threads`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ title: 'Room isolation' })
          .expect(201);
      });
      await receivedA;

      socketA.close();
      socketB.close();
    });
  });

  describe('QnA authorization and REST', () => {
    let threadId: string;

    it('student create thread, student resolve forbidden, owner resolve success', async () => {
      const created = await request(app.getHttpServer())
        .post(`/v1/courses/${courseAId}/threads`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Authorization thread' })
        .expect(201);
      threadId = created.body.data.id;

      await request(app.getHttpServer())
        .patch(`/v1/threads/${threadId}/resolve`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/v1/threads/${threadId}/resolve`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send()
        .expect(200);
    });

    it('admin resolve is successful', async () => {
      const created = await request(app.getHttpServer())
        .post(`/v1/courses/${courseAId}/threads`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Admin resolve thread' })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/v1/threads/${created.body.data.id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send()
        .expect(200);
    });

    it('create post and get thread details with DTO fields', async () => {
      const post = await request(app.getHttpServer())
        .post(`/v1/threads/${threadId}/posts`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ content: 'A public reply' })
        .expect(201);

      expect(post.body.data).not.toHaveProperty('authorId');
      expect(post.body.data).not.toHaveProperty('thread');

      const detail = await request(app.getHttpServer())
        .get(`/v1/threads/${threadId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(detail.body.data.thread).not.toHaveProperty('authorId');
      expect(detail.body.data.posts[0]).not.toHaveProperty('authorId');
    });

    it('returns 404 for missing thread', async () => {
      await request(app.getHttpServer())
        .get('/v1/threads/99999999-9999-4999-8999-999999999999')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    });

    it('returns 404 for missing course', async () => {
      await request(app.getHttpServer())
        .post('/v1/courses/99999999-9999-4999-8999-999999999999/threads')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ title: 'Missing course' })
        .expect(404);
    });
  });

  describe('Notifications', () => {
    it('notification WebSocket payload contains no internal identity fields', async () => {
      const socket = await connectSocket(studentToken);
      const event = new Promise<any>((resolve) => {
        socket.once('notification.created', resolve);
      });
      const notificationService = app.get(NotificationService);
      await notificationService.createNotification(studentId, 'qna.reply', {
        threadId: '1',
        courseId: courseAId,
        postId: '2',
        replierId: 'private-replier',
        nested: { authorId: 'private-author', userId: 'private-user' },
      });

      const payload: any = await event;
      expect(payload.notification).not.toHaveProperty('userId');
      expect(JSON.stringify(payload.notification.payload)).not.toContain(
        'replierId',
      );
      expect(JSON.stringify(payload.notification.payload)).not.toContain(
        'authorId',
      );
      expect(JSON.stringify(payload.notification.payload)).not.toContain(
        'userId',
      );
      socket.close();
    });

    it('mark own notification success and mark other notification forbidden', async () => {
      const notificationService = app.get(NotificationService);
      const own = await notificationService.createNotification(
        studentId,
        'qna.reply',
        { threadId: '1', nested: { authorId: 'private' } },
      );
      const other = await notificationService.createNotification(
        ownerId,
        'qna.reply',
        { threadId: '2', replierId: 'private' },
      );

      await request(app.getHttpServer())
        .patch(`/v1/notifications/${own.id}/read`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/v1/notifications/${other.id}/read`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('returns 404 for missing notification', async () => {
      await request(app.getHttpServer())
        .patch('/v1/notifications/99999999-9999-4999-8999-999999999999/read')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    });
  });
});
