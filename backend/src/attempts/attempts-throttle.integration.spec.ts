import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  INestApplication,
  Injectable,
  Module,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../bootstrap.js';
import {
  QUIZ_START_THROTTLE,
  QUIZ_SUBMIT_THROTTLE,
  THROTTLE_ERROR_MESSAGE,
  throttlerRootOptions,
} from '../common/throttling.js';
import { AttemptsController } from './attempts.controller.js';
import { AttemptsService } from './attempts.service.js';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';

// Gắn req.user theo header x-user để mô phỏng route đã xác thực.
@Injectable()
class StubAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: { userId: string };
    }>();
    const userId = req.headers['x-user'];
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    req.user = { userId };
    return true;
  }
}

@Module({
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
    { provide: APP_GUARD, useClass: StubAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
class TestModule {}

describe('Quiz attempt rate limit (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const start = (userId: string) =>
    request(app.getHttpServer())
      .post(`/v1/lessons/${LESSON_ID}/quiz/attempts`)
      .set('x-user', userId);

  const submit = (userId: string) =>
    request(app.getHttpServer())
      .post(`/v1/quiz-attempts/${ATTEMPT_ID}/submit`)
      .set('x-user', userId)
      .send({ answers: [] });

  it(`start: 429 "${THROTTLE_ERROR_MESSAGE}" sau ${QUIZ_START_THROTTLE.limit} lần mỗi tài khoản`, async () => {
    for (let attempt = 0; attempt < QUIZ_START_THROTTLE.limit; attempt++) {
      await start('student-a').expect(201);
    }
    const blocked = await start('student-a').expect(429);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: THROTTLE_ERROR_MESSAGE,
    });
    // Tài khoản khác có bucket riêng.
    await start('student-b').expect(201);
  });

  it(`submit: 429 sau ${QUIZ_SUBMIT_THROTTLE.limit} lần mỗi tài khoản`, async () => {
    for (let attempt = 0; attempt < QUIZ_SUBMIT_THROTTLE.limit; attempt++) {
      await submit('student-a').expect(200);
    }
    await submit('student-a').expect(429);
  });
});
