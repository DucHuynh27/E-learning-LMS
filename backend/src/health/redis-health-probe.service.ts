import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { LearningInfrastructureDto } from '../learning/dto/learning-infrastructure.dto.js';

@Injectable()
export class RedisHealthProbe implements OnModuleDestroy {
  private readonly client: ReturnType<typeof createClient>;
  private pending?: Promise<boolean>;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const settings = LearningInfrastructureDto.from(config);
    this.client = createClient({
      socket: {
        host: settings.redisHost,
        port: settings.redisPort,
        connectTimeout: 500,
        reconnectStrategy: false,
        ...(settings.redisTls
          ? { tls: true as const }
          : { tls: false as const }),
      },
      username: settings.redisUsername || undefined,
      password: settings.redisPassword || undefined,
      disableOfflineQueue: true,
    });
    this.client.on('error', () => {});
  }

  ping(): Promise<boolean> {
    if (!this.pending) {
      this.pending = this.probe().finally(() => {
        this.pending = undefined;
      });
    }
    return this.pending;
  }

  private async probe(): Promise<boolean> {
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        (async () => {
          if (!this.client.isReady) await this.client.connect();
          return (await this.client.ping()) === 'PONG';
        })(),
        new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error('Redis probe timed out')),
            500,
          );
          deadline.unref();
        }),
      ]);
    } catch {
      this.onModuleDestroy();
      return false;
    } finally {
      clearTimeout(deadline);
    }
  }

  onModuleDestroy(): void {
    if (this.client.isOpen) this.client.destroy();
  }
}
