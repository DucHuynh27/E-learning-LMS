import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisHealthProbe } from './redis-health-probe.service.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
  providers: [HealthService, RedisHealthProbe],
  exports: [HealthService],
})
export class HealthModule {}
