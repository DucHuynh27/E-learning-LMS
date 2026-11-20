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
  QUIZ_READ_THROTTLE,
  THROTTLE_ERROR_MESSAGE,
  throttlerRootOptions,
} from '../common/throttling.js';
import { QuizzesController } from './quizzes.controller.js';
import { QuizzesService } from './quizzes.service.js';

const LESSON_ID = '33333333-3333-4333-8333-333333333333';

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
  controllers: [QuizzesController],
  providers: [
    { provide: QuizzesService, useValue: { get: vi.fn().mockResolvedValue({}) } },
    { provide: APP_GUARD, useClass: StubAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
class TestModule {}

describe('Quiz read rate limit (integration)', () => {
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

  const read = (userId: string) =>
    request(app.getHttpServer())
      .get(`/v1/lessons/${LESSON_ID}/quiz`)
      .set('x-user', userId);

  it(`GET quiz: 429 "${THROTTLE_ERROR_MESSAGE}" sau ${QUIZ_READ_THROTTLE.limit} lần mỗi tài khoản`, async () => {
    for (let attempt = 0; attempt < QUIZ_READ_THROTTLE.limit; attempt++) {
      await read('student-a').expect(200);
    }
    const blocked = await read('student-a').expect(429);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: THROTTLE_ERROR_MESSAGE,
    });
    await read('student-b').expect(200);
  });
});
