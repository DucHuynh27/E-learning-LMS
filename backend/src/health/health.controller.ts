import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}
  @Public()
  @Get()
  check() {
    return this.health.check();
  }
}
