import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { PublishedLessonCache } from '../learning/published-lesson-cache.service.js';
import { LearningInfrastructureDto } from '../learning/dto/learning-infrastructure.dto.js';

@Injectable()
export class HealthService {
  private readonly config: LearningInfrastructureDto;
  constructor(
    @Inject(DataSource) private readonly source: DataSource,
    @Inject(ConfigService) config: ConfigService,
    @Inject(PublishedLessonCache) private readonly redis: PublishedLessonCache,
  ) {
    this.config = LearningInfrastructureDto.from(config);
  }

  async check(): Promise<{
    status: 'ok';
    checks: { postgres: boolean; redis: boolean; minio: boolean };
  }> {
    const [postgres, redis, minio] = await Promise.all([
      this.postgres(),
      this.redis.ping(),
      fetch(
        `http://${this.config.minioHost}:${this.config.minioPort}/minio/health/live`,
        { signal: AbortSignal.timeout(1000) },
      )
        .then((response) => response.ok)
        .catch(() => false),
    ]);
    const checks = { postgres, redis, minio };
    if (!postgres || !redis || !minio)
      throw new ServiceUnavailableException(
        `Health check failed: ${Object.entries(checks)
          .filter(([, ok]) => !ok)
          .map(([name]) => name)
          .join(', ')}`,
      );
    return { status: 'ok', checks };
  }

  private async postgres(): Promise<boolean> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.source
          .query('SELECT 1')
          .then(() => true)
          .catch(() => false),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 1000);
          timer.unref();
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
}
