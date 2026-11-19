import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../bootstrap.js';
import { throttlerRootOptions } from './throttling.js';

const PROBE_LIMIT = 2;

@Controller('probe')
class ProbeController {
  @Throttle({ default: { ttl: 60_000, limit: PROBE_LIMIT } })
  @Get()
  probe() {
    return 'ok';
  }
}

async function createApp(trustProxy?: string): Promise<INestApplication<App>> {
  @Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        ignoreEnvVars: true,
        load: [() => ({ TRUST_PROXY: trustProxy })],
      }),
      ThrottlerModule.forRoot(throttlerRootOptions()),
    ],
    controllers: [ProbeController],
    providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  })
  class TestModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [TestModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

const probe = (app: INestApplication<App>, forwardedFor: string) =>
  request(app.getHttpServer())
    .get('/v1/probe')
    .set('X-Forwarded-For', forwardedFor);

describe('Rate limit và trust proxy (integration)', () => {
  it('đếm riêng theo từng client khi tin proxy', async () => {
    const app = await createApp('loopback');
    try {
      for (let i = 0; i < PROBE_LIMIT; i++) {
        await probe(app, '1.1.1.1').expect(200);
      }
      await probe(app, '1.1.1.1').expect(429);
      // Client khác có bucket riêng nhờ X-Forwarded-For được tin.
      await probe(app, '2.2.2.2').expect(200);
    } finally {
      await app.close();
    }
  });

  it('bỏ qua X-Forwarded-For khi không tin proxy (không giả được IP)', async () => {
    const app = await createApp(undefined);
    try {
      for (let i = 0; i < PROBE_LIMIT; i++) {
        await probe(app, '1.1.1.1').expect(200);
      }
      // Header giả không tạo bucket mới: vẫn chung bucket của socket (loopback).
      await probe(app, '2.2.2.2').expect(429);
    } finally {
      await app.close();
    }
  });
});
