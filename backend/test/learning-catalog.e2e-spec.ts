import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getStorageToken, ThrottlerStorageService } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { AppDataSource } from '../src/database/data-source.js';
import { Init1793276497913 } from '../src/database/migrations/1793276497913-Init.js';
import { Learning1794050000000 } from '../src/database/migrations/1794050000000-Learning.js';
import { Catalog1794100000000 } from '../src/database/migrations/1794100000000-Catalog.js';
import { CreateQnaAndNotifications1795083911581 } from '../src/database/migrations/1795083911581-CreateQnaAndNotifications.js';
import { LinkLearningToCatalog1795200000000 } from '../src/database/migrations/1795200000000-LinkLearningToCatalog.js';
import { Role, User } from '../src/user/user.entity.js';

describe('Learning with the migrated Catalog (e2e)', () => {
  const database = `lms_learning_e2e_${randomUUID().replaceAll('-', '')}`;
  let admin: DataSource | undefined;
  let source: DataSource | undefined;
  let app: INestApplication<App> | undefined;
  let created = false;

  beforeAll(async () => {
    const options = AppDataSource.options;
    if (options.type !== 'postgres')
      throw new Error('Learning E2E requires PostgreSQL');
    admin = new DataSource({ ...options, entities: [], migrations: [] });
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    created = true;
    source = new DataSource({
      ...options,
      database,
      migrations: [
        Init1793276497913,
        Learning1794050000000,
        Catalog1794100000000,
        CreateQnaAndNotifications1795083911581,
        LinkLearningToCatalog1795200000000,
      ],
    });
    await source.initialize();
    await source.runMigrations({ transaction: 'all' });

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DataSource)
      .useValue(source)
      .overrideProvider(getStorageToken())
      .useClass(ThrottlerStorageService)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  }, 30_000);

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      try {
        if (source?.isInitialized) await source.destroy();
        if (created && admin?.isInitialized) {
          await admin.query(`DROP DATABASE "${database}"`);
        }
      } finally {
        if (admin?.isInitialized) await admin.destroy();
      }
    }
  }, 30_000);

  it('publishes real content, resumes a quiz, issues a certificate and enforces data integrity', async () => {
    const server = request(app!.getHttpServer());
    const password = 'LearningE2e!2026';
    const teacherEmail = 'teacher@learning-e2e.example';
    const registeredTeacher = await server
      .post('/v1/auth/register')
      .send({ email: teacherEmail, fullName: 'Test teacher', password })
      .expect(201);
    await source!
      .getRepository(User)
      .update(registeredTeacher.body.data.user.id, { role: Role.INSTRUCTOR });
    const loggedIn = await server
      .post('/v1/auth/login')
      .send({ email: teacherEmail, password })
      .expect(200);
    const registeredStudent = await server
      .post('/v1/auth/register')
      .send({
        email: 'student@learning-e2e.example',
        fullName: 'Test student',
        password,
      })
      .expect(201);
    const registeredPeer = await server
      .post('/v1/auth/register')
      .send({
        email: 'peer@learning-e2e.example',
        fullName: 'Test peer',
        password,
      })
      .expect(201);
    const teacher = `Bearer ${loggedIn.body.data.accessToken}`;
    const student = `Bearer ${registeredStudent.body.data.accessToken}`;
    const peer = `Bearer ${registeredPeer.body.data.accessToken}`;

    const createdCourse = await server
      .post('/v1/courses')
      .set('Authorization', teacher)
      .send({ title: 'Learning integration course' })
      .expect(201);
    const courseId: string = createdCourse.body.data.id;
    const course = `/v1/courses/${courseId}`;
    const section = await server
      .post(`${course}/sections`)
      .set('Authorization', teacher)
      .send({ title: 'First chapter' })
      .expect(201);
    const lessons = `/v1/sections/${section.body.data.id}/lessons`;
    const article = await server
      .post(lessons)
      .set('Authorization', teacher)
      .send({
        type: 'ARTICLE',
        title: 'Read first',
        durationSec: 100,
        isPublished: true,
      })
      .expect(201);
    const quizLesson = await server
      .post(lessons)
      .set('Authorization', teacher)
      .send({
        type: 'QUIZ',
        title: 'Knowledge check',
        durationSec: 100,
        isPublished: true,
      })
      .expect(201);
    const articleId: string = article.body.data.id;
    const quizLessonId: string = quizLesson.body.data.id;
    const quiz = `/v1/lessons/${quizLessonId}/quiz`;
    await server
      .post(quiz)
      .set('Authorization', teacher)
      .send({
        passScore: 70,
        timeLimitSec: 0,
        questions: [
          {
            content: 'Which option is correct?',
            options: [
              { content: 'First', isCorrect: true },
              { content: 'Second', isCorrect: false },
            ],
          },
        ],
      })
      .expect(201);
    await server
      .post(`${course}/publish`)
      .set('Authorization', teacher)
      .expect(201);
    await server
      .get(`${quiz}/attempts/active`)
      .set('Authorization', student)
      .expect(403);
    await server
      .post(`${course}/enroll`)
      .set('Authorization', student)
      .expect(201);
    await server
      .get(`${quiz}/attempts/active`)
      .set('Authorization', student)
      .expect(200, { data: null });

    const attempt = await server
      .post(`${quiz}/attempts`)
      .set('Authorization', student)
      .expect(201);
    await server
      .post(`${course}/enroll`)
      .set('Authorization', peer)
      .expect(201);
    await server
      .get(`${quiz}/attempts/active`)
      .set('Authorization', peer)
      .expect(200, { data: null });
    const resumed = await server
      .get(`${quiz}/attempts/active`)
      .set('Authorization', student)
      .expect(200);
    expect(resumed.body.data).toEqual(attempt.body.data);
    expect(resumed.body.data.expiresAt).toBeNull();
    expect(JSON.stringify(resumed.body)).not.toContain('isCorrect');
    const question = resumed.body.data.questions[0];
    const submitted = await server
      .post(`/v1/quiz-attempts/${attempt.body.data.attemptId}/submit`)
      .set('Authorization', student)
      .send({
        answers: [
          { questionId: question.id, optionId: question.options[0].id },
        ],
      })
      .expect(200);
    expect(submitted.body.data).toMatchObject({ score: 100, passed: true });
    await server
      .get(`${quiz}/attempts/active`)
      .set('Authorization', student)
      .expect(200, { data: null });

    const progress = `/v1/enrolments/${courseId}/progress`;
    await server
      .patch(`/v1/lessons/${articleId}/progress`)
      .set('Authorization', student)
      .send({ watchedSec: 90 })
      .expect(200);
    expect(
      (await server.get(progress).set('Authorization', student).expect(200))
        .body.data.progressPct,
    ).toBe(50);
    await server
      .get('/v1/certificates/me')
      .set('Authorization', student)
      .expect(200, { data: [] });
    for (const watchedSec of [90, 100]) {
      await server
        .patch(`/v1/lessons/${quizLessonId}/progress`)
        .set('Authorization', student)
        .send({ watchedSec })
        .expect(200);
    }
    expect(
      (await server.get(progress).set('Authorization', student).expect(200))
        .body.data.progressPct,
    ).toBe(100);
    const certificates = await server
      .get('/v1/certificates/me')
      .set('Authorization', student)
      .expect(200);
    expect(certificates.body.data).toHaveLength(1);
    const serial = certificates.body.data[0].serialNo;
    await server
      .get(`/v1/certificates/${serial}/verify`)
      .expect('Content-Type', /html/)
      .expect(200);
    await server.delete(course).set('Authorization', teacher).expect(409);

    await server
      .delete(`/v1/lessons/${quizLessonId}`)
      .set('Authorization', teacher)
      .expect(204);
    expect(
      await source!.query('SELECT id FROM "quizzes" WHERE "lessonId" = $1', [
        quizLessonId,
      ]),
    ).toEqual([]);
    expect(
      await source!.query(
        'SELECT id FROM "lesson_progress" WHERE "lessonId" = $1',
        [quizLessonId],
      ),
    ).toEqual([]);
    expect(
      await source!.query('SELECT id FROM "quiz_attempts" WHERE id = $1', [
        attempt.body.data.attemptId,
      ]),
    ).toEqual([]);
    await server.get(`/v1/certificates/${serial}`).expect(200);
  }, 30_000);
});
