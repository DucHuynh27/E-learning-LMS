import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { Role } from '../src/user/user.entity.js';

describe('Realtime & QnA (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let accessToken: string;
  const mockUserId = '11111111-1111-4111-8111-111111111111';
  const mockCourseId = '22222222-2222-4222-8222-222222222222';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    jwtService = app.get(JwtService);
    accessToken = jwtService.sign(
      { sub: mockUserId, email: 'qa@lms.local', role: Role.STUDENT },
      { secret: process.env.JWT_ACCESS_SECRET },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('QnA Threads & Posts', () => {
    let createdThreadId: string;

    it('POST /v1/courses/:courseId/threads - create thread', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/courses/${mockCourseId}/threads`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'How to understand ESM in NestJS 12?',
        });

      if (res.status !== 201) {
        console.error('Response status:', res.status, 'body:', res.body);
      }
      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.title).toBe('How to understand ESM in NestJS 12?');
      expect(res.body.data.courseId).toBe(mockCourseId);
      createdThreadId = res.body.data.id;
    });

    it('GET /v1/courses/:courseId/threads - query threads list', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/courses/${mockCourseId}/threads`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    });

    it('POST /v1/threads/:id/posts - add reply post to thread', async () => {
      const res = await request(app.getHttpServer())
        .post(`/v1/threads/${createdThreadId}/posts`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          content: 'You should ensure all local imports end with .js!',
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.threadId).toBe(createdThreadId);
      expect(res.body.data.content).toBe('You should ensure all local imports end with .js!');
    });

    it('GET /v1/threads/:id - get thread details and posts', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/threads/${createdThreadId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.thread.id).toBe(createdThreadId);
      expect(res.body.data.posts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Notifications', () => {
    it('GET /v1/notifications/me - get current user notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/notifications/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('items');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });
});
