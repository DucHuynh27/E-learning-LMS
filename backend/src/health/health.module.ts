import { Module } from '@nestjs/common';
import { LearningSupportModule } from '../learning/learning-support.module.js';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

@Module({
  imports: [LearningSupportModule],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
