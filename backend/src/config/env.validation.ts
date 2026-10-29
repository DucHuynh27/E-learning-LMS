import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export class EnvVars {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number;

  @IsString() @IsNotEmpty() DB_HOST: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) DB_PORT: number;
  @IsString() @IsNotEmpty() DB_USERNAME: string;
  @IsString() @IsNotEmpty() DB_PASSWORD: string;
  @IsString() @IsNotEmpty() DB_NAME: string;

  @IsString() @IsNotEmpty() REDIS_PASSWORD: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) REDIS_PORT: number;

  @IsString() @IsNotEmpty() MINIO_ROOT_USER: string;
  @IsString() @IsNotEmpty() MINIO_ROOT_PASSWORD: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) MINIO_API_PORT: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) MINIO_CONSOLE_PORT: number;

  @IsString() @IsNotEmpty() BULL_BOARD_PASSWORD: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) BULL_BOARD_PORT: number;
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const env = plainToInstance(EnvVars, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length)
    throw new Error(`Invalid environment:\n${errors.toString()}`);
  return env;
}
