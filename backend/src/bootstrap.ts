import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:3100'];

// CORS_ORIGIN là danh sách origin phân tách bằng dấu phẩy; để trống dùng mặc định dev.
export function resolveCorsOrigins(raw = process.env.CORS_ORIGIN): string[] {
  const origins = raw
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins?.length ? origins : DEFAULT_CORS_ORIGINS;
}

// Dùng chung cho runtime (main.ts) và e2e test, để test phản ánh đúng cấu hình thật.
export function configureApp(app: INestApplication): void {
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new TransformInterceptor(),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
}
