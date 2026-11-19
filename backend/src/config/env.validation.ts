import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

  // Danh sách origin cho CORS, phân tách bằng dấu phẩy; để trống dùng mặc định dev.
  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  // Số hop / 'loopback' / danh sách IP tin cậy cho Express `trust proxy`.
  // Cấm `true` trần vì nó cho phép client giả X-Forwarded-For để né rate limit.
  @IsOptional()
  @Matches(/^(?!\s*true\s*$).*$/i, {
    message:
      'TRUST_PROXY không được là "true"; dùng số hop, loopback hoặc danh sách IP tin cậy',
  })
  TRUST_PROXY?: string;

  @IsString() @IsNotEmpty() DB_HOST: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) DB_PORT: number;
  @IsString() @IsNotEmpty() DB_USERNAME: string;
  @IsString() @IsNotEmpty() DB_PASSWORD: string;
  @IsString() @IsNotEmpty() DB_NAME: string;

  @IsString() @IsNotEmpty() REDIS_PASSWORD: string;
  @IsString() @IsNotEmpty() REDIS_HOST: string;
  @IsString() REDIS_USERNAME: string = '';
  @Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) =>
    obj[key] === 'true' ? true : obj[key] === 'false' ? false : obj[key],
  )
  @IsBoolean()
  REDIS_TLS: boolean = false;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) REDIS_PORT: number;

  @IsString() @IsNotEmpty() MINIO_ROOT_USER: string;
  @IsString() @IsNotEmpty() MINIO_HOST: string;
  @IsString() @IsNotEmpty() MINIO_ROOT_PASSWORD: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) MINIO_API_PORT: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) MINIO_CONSOLE_PORT: number;

  @IsString() @IsNotEmpty() BULL_BOARD_PASSWORD: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(65535) BULL_BOARD_PORT: number;

  @IsString() @IsNotEmpty() JWT_ACCESS_SECRET: string;
  @IsString() @IsNotEmpty() JWT_REFRESH_SECRET: string;
  @Type(() => Number) @IsInt() @Min(1) JWT_ACCESS_TTL: number;
  @Type(() => Number) @IsInt() @Min(1) JWT_REFRESH_TTL: number;
}

export function validateEnv(raw: Record<string, unknown>): EnvVars {
  const env = plainToInstance(EnvVars, raw, { enableImplicitConversion: true });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length)
    throw new Error(`Invalid environment:\n${errors.toString()}`);
  return env;
}
