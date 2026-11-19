import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../bootstrap.js';
import {
  LOGIN_THROTTLE,
  THROTTLE_ERROR_MESSAGE,
  throttlerRootOptions,
} from '../common/throttling.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('Login rate limit (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerRootOptions())],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: vi
              .fn()
              .mockResolvedValue({
                accessToken: 'access',
                refreshToken: 'refresh',
                user: { id: 'user-1' },
              }),
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

  it(`chặn bằng 429 "${THROTTLE_ERROR_MESSAGE}" sau ${LOGIN_THROTTLE.limit} lần login`, async () => {
    const body = { email: 'student@example.com', password: 'supersecret' };

    for (let attempt = 0; attempt < LOGIN_THROTTLE.limit; attempt++) {
      await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send(body)
        .expect(200);
    }

    const blocked = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send(body)
      .expect(429);

    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: THROTTLE_ERROR_MESSAGE,
    });
  });
});
