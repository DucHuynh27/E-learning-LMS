import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AnonymousIpThrottleGuard } from '../common/guards/anonymous-ip-throttle.guard.js';
import { throttlerRootOptions } from '../common/throttling.js';
import { UserModule } from '../user/user.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({}),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => throttlerRootOptions(config),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Lớp throttle IP thô chạy TRƯỚC auth (issue #31): request ẩn danh (401) vẫn bị
    // đếm và có thể 429, không né được rate limit. Bucket tách khỏi lớp theo tài khoản.
    { provide: APP_GUARD, useClass: AnonymousIpThrottleGuard },
    // Mặc định mọi route đều yêu cầu đăng nhập; route công khai đánh dấu @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Throttler đặt SAU auth guard (thứ tự provider được tôn trọng) để tracker đọc
    // được req.user → đếm rate limit theo tài khoản thay vì chỉ theo IP.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AuthModule {}
