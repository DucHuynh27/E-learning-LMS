import 'reflect-metadata';
import {
  Module,
  ServiceUnavailableException,
  type DynamicModule,
  type INestApplication,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { AuthService } from '../auth/auth.service.js';
import { configureApp } from '../bootstrap.js';
import { HealthService } from '../health/health.service.js';
import { Role, User } from '../user/user.entity.js';
import { LearningModule } from './learning.module.js';
import {
  createHttpTestDatabase,
  destroyHttpTestDatabase,
} from './testing/http-test-database.js';

@Module({})
class HttpTestDatabaseModule {
  static register(source: DataSource): DynamicModule {
    return {
      module: HttpTestDatabaseModule,
      global: true,
      providers: [{ provide: DataSource, useValue: source }],
      exports: [DataSource],
    };
  }
}

interface Actor {
  id: string;
  token: string;
}

describe.runIf(process.env.LEARNING_DB_TESTS === '1')(
  'Learning HTTP module integration (Catalog fixtures)',
  () => {
    let source: DataSource;
    let app: INestApplication<App>;
    let student: Actor;
    let outsider: Actor;
    let teacher: Actor;
    let otherTeacher: Actor;
    let admin: Actor;
    let courseId: string;
    let lessons: string[];
    const health = vi.fn();
    const quizInput = () => ({
      passScore: 70,
      timeLimitSec: 60,
      questions: [
        {
          content: 'First?',
          options: [
            { content: 'Yes', isCorrect: true },
            { content: 'No', isCorrect: false },
          ],
        },
        {
          content: 'Second?',
          options: [
            { content: 'Yes', isCorrect: true },
            { content: 'No', isCorrect: false },
          ],
        },
      ],
    });

    beforeAll(async () => {
      source = await createHttpTestDatabase();
      const module = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [
              () => ({
                JWT_ACCESS_SECRET: 'learning-http-test-access',
                JWT_REFRESH_SECRET: 'learning-http-test-refresh',
                JWT_ACCESS_TTL: 900,
                JWT_REFRESH_TTL: 3600,
                REDIS_HOST: '127.0.0.1',
                REDIS_PORT: 1,
              }),
            ],
          }),
          HttpTestDatabaseModule.register(source),
          AuthModule,
          LearningModule,
        ],
      })
        .overrideProvider(HealthService)
        .useValue({ check: health })
        .compile();
      app = module.createNestApplication();
      configureApp(app);
      await app.init();
      const auth = module.get(AuthService);
      async function actor(role: Role): Promise<Actor> {
        const email = `${randomUUID()}@learning.example.test`;
        const password = 'LearningTest2026!';
        const registered = await auth.register({
          email,
          password,
          fullName: 'HTTP test learner',
        });
        await source.getRepository(User).update(registered.user.id, { role });
        const session = await auth.login({ email, password });
        return { id: session.user.id, token: session.accessToken };
      }
      student = await actor(Role.STUDENT);
      outsider = await actor(Role.STUDENT);
      teacher = await actor(Role.INSTRUCTOR);
      otherTeacher = await actor(Role.INSTRUCTOR);
      admin = await actor(Role.ADMIN);
    }, 20000);

    beforeEach(async () => {
      const schema =
        'schema' in source.options ? source.options.schema : undefined;
      if (!schema || !/^learning_http_[a-f0-9]{32}$/.test(schema))
        throw new Error('Invalid HTTP test schema');
      await source.query(
        `TRUNCATE "${schema}"."courses", "${schema}"."quizzes", "${schema}"."lesson_progress", "${schema}"."certificates" CASCADE`,
      );
      courseId = randomUUID();
      const sectionId = randomUUID();
      lessons = [randomUUID(), randomUUID(), randomUUID()];
      await source.query('INSERT INTO "courses" VALUES ($1, $2, $3)', [
        courseId,
        teacher.id,
        'PUBLISHED',
      ]);
      await source.query('INSERT INTO "sections" VALUES ($1, $2, 0)', [
        sectionId,
        courseId,
      ]);
      for (const [position, id] of lessons.entries())
        await source.query(
          'INSERT INTO "lessons" VALUES ($1, $2, $3, 100, $4)',
          [id, sectionId, position, position < 2],
        );
      await source.query(
        'INSERT INTO "enrolments" ("userId", "courseId") VALUES ($1, $2)',
        [student.id, courseId],
      );
      health.mockReset().mockResolvedValue({
        status: 'ok',
        checks: { postgres: true, redis: true, minio: true },
      });
    });

    afterAll(async () => {
      try {
        await app?.close();
      } finally {
        if (source) await destroyHttpTestDatabase(source);
      }
    });

    const server = () => request(app.getHttpServer());
    const bearer = (actor: Actor) => `Bearer ${actor.token}`;
    const createQuiz = () =>
      server()
        .post(`/v1/lessons/${lessons[0]}/quiz`)
        .set('Authorization', bearer(teacher))
        .send(quizInput())
        .expect(201);
    const start = () =>
      server()
        .post(`/v1/lessons/${lessons[0]}/quiz/attempts`)
        .set('Authorization', bearer(student))
        .expect(201);

    it('enforces JWT and role guards before progress is written', async () => {
      const path = `/v1/lessons/${lessons[0]}/progress`;
      await server().patch(path).send({ watchedSec: 90 }).expect(401);
      await server()
        .patch(path)
        .set('Authorization', 'Bearer invalid')
        .send({ watchedSec: 90 })
        .expect(401);
      await server()
        .patch(path)
        .set('Authorization', bearer(teacher))
        .send({ watchedSec: 90 })
        .expect(403);
      await server()
        .patch(path)
        .set('Authorization', bearer(outsider))
        .send({ watchedSec: 90 })
        .expect(403);
      expect(
        await source.query('SELECT * FROM "lesson_progress"'),
      ).toHaveLength(0);
    });

    it('returns the canonical envelope and validates progress bodies and path UUIDs', async () => {
      const path = `/v1/lessons/${lessons[0]}/progress`;
      for (const body of [
        { watchedSec: -1 },
        { watchedSec: '90' },
        { watchedSec: 90, completed: true },
      ]) {
        const response = await server()
          .patch(path)
          .set('Authorization', bearer(student))
          .send(body)
          .expect(400);
        expect(response.body).toMatchObject({ statusCode: 400, path });
        expect(response.body.timestamp).toEqual(expect.any(String));
      }
      await server()
        .patch('/v1/lessons/not-a-uuid/progress')
        .set('Authorization', bearer(student))
        .send({ watchedSec: 90 })
        .expect(400);
      const response = await server()
        .patch(path)
        .set('Authorization', bearer(student))
        .send({ watchedSec: 90 })
        .expect(200);
      expect(response.body).toEqual({
        data: {
          lessonId: lessons[0],
          watchedSec: 90,
          completed: true,
          completedAt: expect.any(String),
        },
      });
      const summary = await server()
        .get(`/v1/enrolments/${courseId}/progress`)
        .set('Authorization', bearer(student))
        .expect(200);
      expect(summary.body.data.progressPct).toBe(50);
      expect(summary.body.data.lessons).toHaveLength(2);
    });

    it('enforces quiz ownership and validates nested question/option input', async () => {
      const path = `/v1/lessons/${lessons[0]}/quiz`;
      await server()
        .post(path)
        .set('Authorization', bearer(student))
        .send(quizInput())
        .expect(403);
      await server()
        .post(path)
        .set('Authorization', bearer(otherTeacher))
        .send(quizInput())
        .expect(403);
      const input = quizInput();
      await server()
        .post(path)
        .set('Authorization', bearer(teacher))
        .send({
          ...input,
          questions: [
            { content: 'Q?', options: [{ content: 'Yes', isCorrect: 'true' }] },
          ],
        })
        .expect(400);
      const created = await server()
        .post(path)
        .set('Authorization', bearer(admin))
        .send(input)
        .expect(201);
      expect(created.body.data.questions).toHaveLength(2);
      expect(JSON.stringify(created.body)).not.toContain('isCorrect');
      await server()
        .put(path)
        .set('Authorization', bearer(teacher))
        .send({ ...input, passScore: 80 })
        .expect(200);
      await server()
        .post(path)
        .set('Authorization', bearer(teacher))
        .send(input)
        .expect(409);
    });

    it('allows draft preview only for the owner and admin', async () => {
      await createQuiz();
      await source.query(
        'UPDATE "lessons" SET "isPublished" = false WHERE "id" = $1',
        [lessons[0]],
      );
      const path = `/v1/lessons/${lessons[0]}/quiz`;
      await server().get(path).expect(401);
      await server()
        .get(path)
        .set('Authorization', bearer(student))
        .expect(404);
      await server()
        .get(path)
        .set('Authorization', bearer(otherTeacher))
        .expect(404);
      await server()
        .get(path)
        .set('Authorization', bearer(teacher))
        .expect(200);
      await server().get(path).set('Authorization', bearer(admin)).expect(200);
    });

    it('starts an enrolled student attempt without revealing correct options', async () => {
      await createQuiz();
      const path = `/v1/lessons/${lessons[0]}/quiz/attempts`;
      await server()
        .post(path)
        .set('Authorization', bearer(outsider))
        .expect(403);
      const response = await start();
      expect(response.body.data.attemptId).toEqual(expect.any(String));
      expect(response.body.data.questions).toHaveLength(2);
      expect(JSON.stringify(response.body)).not.toContain('isCorrect');
      await server()
        .post(path)
        .set('Authorization', bearer(student))
        .expect(409);
    });

    it('rejects forged results, duplicate question IDs, foreign options and other attempt owners', async () => {
      const quiz = (await createQuiz()).body.data;
      const attempt = (await start()).body.data;
      const path = `/v1/quiz-attempts/${attempt.attemptId}/submit`;
      await server()
        .post(path)
        .set('Authorization', bearer(outsider))
        .send({ answers: [] })
        .expect(403);
      await server()
        .post(path)
        .set('Authorization', bearer(student))
        .send({ answers: [], score: 100 })
        .expect(400);
      await server()
        .post(path)
        .set('Authorization', bearer(student))
        .send({
          answers: [
            { questionId: quiz.questions[0].id },
            { questionId: quiz.questions[0].id.toUpperCase() },
          ],
        })
        .expect(400);
      await server()
        .post(path)
        .set('Authorization', bearer(student))
        .send({
          answers: [
            {
              questionId: quiz.questions[0].id,
              optionId: quiz.questions[1].options[0].id,
            },
          ],
        })
        .expect(400);
      expect(await source.query('SELECT * FROM "quiz_answers"')).toHaveLength(
        0,
      );
    });

    it('returns a server-graded result once and freezes the question set', async () => {
      const quiz = (await createQuiz()).body.data;
      const attempt = (await start()).body.data;
      const path = `/v1/quiz-attempts/${attempt.attemptId}/submit`;
      const answers = quiz.questions.map(
        (question: { id: string; options: { id: string }[] }) => ({
          questionId: question.id,
          optionId: question.options[0].id,
        }),
      );
      const result = await server()
        .post(path)
        .set('Authorization', bearer(student))
        .send({ answers })
        .expect(200);
      expect(result.body).toEqual({
        data: {
          attemptId: attempt.attemptId,
          score: 100,
          passed: true,
          submittedAt: expect.any(String),
        },
      });
      await server()
        .post(path)
        .set('Authorization', bearer(student))
        .send({ answers })
        .expect(409);
      await server()
        .put(`/v1/lessons/${lessons[0]}/quiz`)
        .set('Authorization', bearer(teacher))
        .send(quizInput())
        .expect(409);
    });

    it('applies deadline and three-attempt limits through the controller', async () => {
      await createQuiz();
      for (let index = 0; index < 3; index++) {
        const attempt = (await start()).body.data;
        await source.query(
          'UPDATE "quiz_attempts" SET "startedAt" = now() - interval \'61 seconds\' WHERE "id" = $1',
          [attempt.attemptId],
        );
        await server()
          .post(`/v1/quiz-attempts/${attempt.attemptId}/submit`)
          .set('Authorization', bearer(student))
          .send({ answers: [] })
          .expect(400);
      }
      await server()
        .post(`/v1/lessons/${lessons[0]}/quiz/attempts`)
        .set('Authorization', bearer(student))
        .expect(409);
    });

    it('issues one certificate, lists only the current user certificates and verifies it publicly', async () => {
      for (const lesson of lessons.slice(0, 2))
        await server()
          .patch(`/v1/lessons/${lesson}/progress`)
          .set('Authorization', bearer(student))
          .send({ watchedSec: 90 })
          .expect(200);
      const response = await server()
        .get('/v1/certificates/me')
        .set('Authorization', bearer(student))
        .expect(200);
      expect(response.body.data).toHaveLength(1);
      const certificate = response.body.data[0];
      expect(certificate).toEqual({
        serialNo: expect.any(String),
        courseId,
        userId: student.id,
        issuedAt: expect.any(String),
      });
      await server()
        .patch(`/v1/lessons/${lessons[0]}/progress`)
        .set('Authorization', bearer(student))
        .send({ watchedSec: 0 })
        .expect(200);
      expect(
        (
          await server()
            .get('/v1/certificates/me')
            .set('Authorization', bearer(student))
            .expect(200)
        ).body.data,
      ).toEqual([certificate]);
      expect(
        (
          await server()
            .get('/v1/certificates/me')
            .set('Authorization', bearer(outsider))
            .expect(200)
        ).body.data,
      ).toEqual([]);
      await server().get('/v1/certificates/me').expect(401);
      const lookup = await server()
        .get(`/v1/certificates/${certificate.serialNo}`)
        .expect(200);
      expect(lookup.body.data).toEqual(certificate);
      const html = await server()
        .get(`/v1/certificates/${certificate.serialNo}/verify`)
        .expect(200)
        .expect('Content-Type', /html/);
      expect(html.text).toContain(certificate.serialNo);
      expect(html.headers['content-security-policy']).toContain(
        "frame-ancestors 'none'",
      );
      expect(html.text).not.toContain('passwordHash');
      await server().get('/v1/certificates/missing').expect(404);
    });

    it('retains public health routing and the standard 503 error shape', async () => {
      const ok = await server().get('/v1/health').expect(200);
      expect(ok.body.data.status).toBe('ok');
      health.mockRejectedValueOnce(
        new ServiceUnavailableException('Health check failed: redis'),
      );
      const failure = await server().get('/v1/health').expect(503);
      expect(failure.body).toMatchObject({
        statusCode: 503,
        message: 'Health check failed: redis',
        path: '/v1/health',
      });
    });
  },
);
