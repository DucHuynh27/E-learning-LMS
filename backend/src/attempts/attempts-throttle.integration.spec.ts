import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../bootstrap.js';
import {
  QUIZ_ATTEMPT_THROTTLE,
  THROTTLE_ERROR_MESSAGE,
  throttlerRootOptions,
} from '../common/throttling.js';
import { AttemptsController } from './attempts.controller.js';
import { AttemptsService } from './attempts.service.js';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';

describe('Quiz attempt rate limit (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerRootOptions())],
      controllers: [AttemptsController],
      providers: [
        {
          provide: AttemptsService,
          useValue: {
            start: vi.fn().mockResolvedValue({ attemptId: ATTEMPT_ID }),
            submit: vi.fn().mockResolvedValue({ score: 0 }),
          },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => request(app.getHttpServer());

  it(`start attempt: 429 "${THROTTLE_ERROR_MESSAGE}" sau ${QUIZ_ATTEMPT_THROTTLE.limit} lần`, async () => {
    for (let attempt = 0; attempt < QUIZ_ATTEMPT_THROTTLE.limit; attempt++) {
      await server()
        .post(`/v1/lessons/${LESSON_ID}/quiz/attempts`)
        .expect(201);
    }

    const blocked = await server()
      .post(`/v1/lessons/${LESSON_ID}/quiz/attempts`)
      .expect(429);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: THROTTLE_ERROR_MESSAGE,
    });
  });

  it(`submit attempt: 429 "${THROTTLE_ERROR_MESSAGE}" sau ${QUIZ_ATTEMPT_THROTTLE.limit} lần`, async () => {
    const submit = () =>
      server()
        .post(`/v1/quiz-attempts/${ATTEMPT_ID}/submit`)
        .send({ answers: [] });

    for (let attempt = 0; attempt < QUIZ_ATTEMPT_THROTTLE.limit; attempt++) {
      await submit().expect(200);
    }

    await submit().expect(429);
  });
});
