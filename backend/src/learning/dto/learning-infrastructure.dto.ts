import type { ConfigService } from '@nestjs/config';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class LearningInfrastructureDto {
  @IsString() @IsNotEmpty() redisHost: string;
  @IsInt() @Min(1) @Max(65535) redisPort: number;
  @IsString() redisPassword: string;
  @IsString() @IsNotEmpty() minioHost: string;
  @IsInt() @Min(1) @Max(65535) minioPort: number;

  static from(config: ConfigService): LearningInfrastructureDto {
    const value = Object.assign(new LearningInfrastructureDto(), {
      redisHost: config.get<string>('REDIS_HOST') ?? 'localhost',
      redisPort: Number(config.get('REDIS_PORT') ?? 6379),
      redisPassword: config.get<string>('REDIS_PASSWORD') ?? '',
      minioHost: config.get<string>('MINIO_HOST') ?? 'localhost',
      minioPort: Number(config.get('MINIO_API_PORT') ?? 9000),
    });
    if (validateSync(value).length)
      throw new Error('Invalid Learning infrastructure configuration');
    return value;
  }
}
