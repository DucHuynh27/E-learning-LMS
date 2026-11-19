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
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../bootstrap.js';
import { throttlerRootOptions } from './throttling.js';

const LIMIT = 2;

// Đóng vai guard xác thực ở module con: chặn request chưa đăng nhập bằng 401.
@Injectable()
class RejectGuard implements CanActivate {
  canActivate(): boolean {
    throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
  }
}

@Module({ providers: [{ provide: APP_GUARD, useClass: RejectGuard }] })
class ChildGuardModule {}

@Controller('probe')
class ProbeController {
  @Throttle({ default: { ttl: 60_000, limit: LIMIT } })
  @Get()
  probe() {
    return 'ok';
  }
}

@Module({
  imports: [ChildGuardModule, ThrottlerModule.forRoot(throttlerRootOptions())],
  controllers: [ProbeController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class RootModule {}

describe('Thứ tự guard toàn cục (integration)', () => {
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

  it('đếm cả request bị guard module con từ chối (throttler chạy trước)', async () => {
    for (let i = 0; i < LIMIT; i++) {
      await request(app.getHttpServer()).get('/v1/probe').expect(401);
    }
    // Nếu throttler chạy sau guard 401 thì request này sẽ mãi là 401, không bao giờ 429.
    await request(app.getHttpServer()).get('/v1/probe').expect(429);
  });
});
