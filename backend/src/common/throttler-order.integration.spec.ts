import {
  CanActivate,
  Controller,
  ExecutionContext,
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

// Đóng vai guard xác thực: gắn req.user theo header, 401 nếu thiếu.
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

@Controller('probe')
class ProbeController {
  @Throttle({ default: { ttl: 60_000, limit: LIMIT } })
  @Get()
  probe() {
    return 'ok';
  }
}

@Module({
  imports: [ThrottlerModule.forRoot(throttlerRootOptions())],
  controllers: [ProbeController],
  providers: [
    { provide: APP_GUARD, useClass: StubAuthGuard },
    // Throttler đặt sau auth guard: chạy sau khi req.user đã có.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
class RootModule {}

describe('Thứ tự guard & key throttle (integration)', () => {
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

  const hit = (userId?: string) => {
    const req = request(app.getHttpServer()).get('/v1/probe');
    return userId ? req.set('x-user', userId) : req;
  };

  it('request bị auth từ chối (401) không tiêu bucket', async () => {
    // Nếu throttler chạy trước auth thì sớm muộn sẽ có 429; ở đây phải mãi là 401.
    for (let i = 0; i < LIMIT + 5; i++) {
      await hit().expect(401);
    }
  });

  it('đếm riêng theo từng tài khoản', async () => {
    for (let i = 0; i < LIMIT; i++) {
      await hit('user-a').expect(200);
    }
    await hit('user-a').expect(429);
    // Tài khoản khác có bucket riêng.
    await hit('user-b').expect(200);
  });
});
