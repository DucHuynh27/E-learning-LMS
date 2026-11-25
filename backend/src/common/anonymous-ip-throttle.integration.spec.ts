import {
  CanActivate,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  INestApplication,
  Injectable,
  Module,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../bootstrap.js';
import {
  ANONYMOUS_IP_THROTTLE_OPTIONS,
  AnonymousIpThrottleGuard,
} from './guards/anonymous-ip-throttle.guard.js';
import { throttlerRootOptions } from './throttling.js';

const LIMIT = 2;

// Đóng vai guard xác thực: luôn 401, đứng SAU lớp throttle IP.
@Injectable()
class RejectGuard implements CanActivate {
  canActivate(): boolean {
    throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
  }
}

@Controller('anon-probe')
class ProbeController {
  @Get()
  probe() {
    return 'ok';
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      ignoreEnvVars: true,
      load: [() => ({ TRUST_PROXY: 'loopback' })],
    }),
    ThrottlerModule.forRoot(throttlerRootOptions()),
  ],
  controllers: [ProbeController],
  providers: [
    {
      provide: ANONYMOUS_IP_THROTTLE_OPTIONS,
      useValue: { ttl: 60_000, limit: LIMIT },
    },
    // Thứ tự: throttle IP thô TRƯỚC, rồi guard xác thực (401).
    { provide: APP_GUARD, useClass: AnonymousIpThrottleGuard },
    { provide: APP_GUARD, useClass: RejectGuard },
  ],
})
class RootModule {}

describe('Throttle IP ẩn danh trước auth (integration)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RootModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const hit = (ip: string) =>
    request(app.getHttpServer()).get('/v1/anon-probe').set('X-Forwarded-For', ip);

  it('request ẩn danh bị 401 vẫn bị đếm và bị chặn 429', async () => {
    for (let i = 0; i < LIMIT; i++) {
      await hit('9.9.9.1').expect(401);
    }
    // Vượt ngưỡng → lớp throttle IP chặn trước khi tới guard xác thực.
    await hit('9.9.9.1').expect(429);
    // IP khác có bucket riêng, vẫn tới được guard xác thực (401).
    await hit('9.9.9.2').expect(401);
  });
});
