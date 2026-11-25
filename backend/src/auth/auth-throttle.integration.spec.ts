import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../bootstrap.js';
import {
  LOGIN_THROTTLE,
  REFRESH_THROTTLE,
  REGISTER_THROTTLE,
  THROTTLE_ERROR_MESSAGE,
  throttlerRootOptions,
} from '../common/throttling.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

describe('Auth rate limit (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlerRootOptions())],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: vi.fn().mockResolvedValue({
              accessToken: 'access',
              refreshToken: 'refresh',
              user: { id: 'user-1' },
            }),
            register: vi.fn().mockResolvedValue({
              accessToken: 'access',
              refreshToken: 'refresh',
              user: { id: 'user-1' },
            }),
            refresh: vi.fn().mockResolvedValue({
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

  const server = () => request(app.getHttpServer());
  const login = (email: string) =>
    server()
      .post('/v1/auth/login')
      .send({ email, password: 'supersecret' });

  it(`login: 429 "${THROTTLE_ERROR_MESSAGE}" sau ${LOGIN_THROTTLE.limit} lần`, async () => {
    for (let attempt = 0; attempt < LOGIN_THROTTLE.limit; attempt++) {
      await login('login-limit@example.com').expect(200);
    }

    const blocked = await login('login-limit@example.com').expect(429);
    expect(blocked.body).toMatchObject({
      statusCode: 429,
      message: THROTTLE_ERROR_MESSAGE,
    });
  });

  it('login: đếm theo tài khoản nên email khác không bị khoá lây', async () => {
    await login('another-account@example.com').expect(200);
  });

  it(`register: 429 sau ${REGISTER_THROTTLE.limit} lần`, async () => {
    const body = {
      email: 'register@example.com',
      password: 'supersecret',
      fullName: 'Register',
    };
    for (let attempt = 0; attempt < REGISTER_THROTTLE.limit; attempt++) {
      await server().post('/v1/auth/register').send(body).expect(201);
    }

    await server().post('/v1/auth/register').send(body).expect(429);
  });

  it(`refresh: 429 sau ${REFRESH_THROTTLE.limit} lần`, async () => {
    for (let attempt = 0; attempt < REFRESH_THROTTLE.limit; attempt++) {
      await server()
        .post('/v1/auth/refresh')
        .send({ refreshToken: 'token' })
        .expect(200);
    }

    await server()
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'token' })
      .expect(429);
  });
});
