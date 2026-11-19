import {
  ClassSerializerInterceptor,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:3100'];

// CORS_ORIGIN là danh sách origin phân tách bằng dấu phẩy; để trống dùng mặc định dev.
export function resolveCorsOrigins(raw?: string | null): string[] {
  const origins = raw
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return origins?.length ? origins : DEFAULT_CORS_ORIGINS;
}

// Giá trị cho Express `trust proxy`: chỉ tin X-Forwarded-For khi request đến từ proxy
// thật. Trả về `undefined` để tắt hẳn (mặc định an toàn). KHÔNG bao giờ bật `true` trần
// vì như vậy client tự giả X-Forwarded-For để né rate limit.
export function parseTrustProxy(
  raw?: string | null,
): string | number | string[] | undefined {
  const value = raw?.trim();
  if (!value || /^(true|false)$/i.test(value)) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts : parts[0];
}

function applyTrustProxy(
  app: INestApplication,
  value: string | number | string[] | undefined,
): void {
  if (value === undefined) return;
  const instance = app.getHttpAdapter().getInstance() as {
    set?: (key: string, val: unknown) => void;
  };
  instance.set?.('trust proxy', value);
}

// Ứng dụng test tối giản có thể không nạp ConfigModule; khi đó coi như không có config.
function optionalConfig(app: INestApplication): ConfigService | undefined {
  try {
    return app.get(ConfigService, { strict: false });
  } catch {
    return undefined;
  }
}

// Dùng chung cho runtime (main.ts) và e2e test, để test phản ánh đúng cấu hình thật.
export function configureApp(app: INestApplication): void {
  const config = optionalConfig(app);
  applyTrustProxy(app, parseTrustProxy(config?.get<string>('TRUST_PROXY')));
  app.enableCors({
    origin: resolveCorsOrigins(config?.get<string>('CORS_ORIGIN')),
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
