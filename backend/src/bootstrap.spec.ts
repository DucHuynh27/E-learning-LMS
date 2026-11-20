import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  configureApp,
  parseTrustProxy,
  resolveCorsOrigins,
} from './bootstrap.js';

function createAppStub(env: Record<string, string | undefined> = {}) {
  const enableCors = vi.fn();
  const set = vi.fn();
  const configService = {
    get: vi.fn((key: string) => env[key]),
  };
  const app = {
    enableCors,
    useGlobalPipes: vi.fn(),
    useGlobalInterceptors: vi.fn(),
    useGlobalFilters: vi.fn(),
    enableVersioning: vi.fn(),
    get: vi.fn((token: unknown) =>
      token === ConfigService ? configService : new Reflector(),
    ),
    getHttpAdapter: vi.fn(() => ({ getInstance: () => ({ set }) })),
  } as unknown as INestApplication;
  return { app, enableCors, set, configService };
}

describe('resolveCorsOrigins', () => {
  it('tách danh sách, cắt khoảng trắng và bỏ phần rỗng', () => {
    expect(resolveCorsOrigins('http://a.com, http://b.com ,')).toEqual([
      'http://a.com',
      'http://b.com',
    ]);
  });

  it('dùng origin mặc định của dev khi không cấu hình', () => {
    expect(resolveCorsOrigins('')).toEqual([
      'http://localhost:3000',
      'http://localhost:3100',
    ]);
  });
});

describe('parseTrustProxy', () => {
  it('tắt khi để trống hoặc false', () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy('')).toBeUndefined();
    expect(parseTrustProxy('false')).toBeUndefined();
  });

  it('không nhận `true` trần (cho phép giả X-Forwarded-For)', () => {
    expect(parseTrustProxy('true')).toBeUndefined();
    expect(parseTrustProxy('TRUE')).toBeUndefined();
  });

  it('nhận số hop, một giá trị, hoặc danh sách proxy', () => {
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback')).toBe('loopback');
    expect(parseTrustProxy('10.0.0.1, 10.0.0.2')).toEqual([
      '10.0.0.1',
      '10.0.0.2',
    ]);
  });
});

describe('configureApp', () => {
  it('bật CORS với origin lấy từ config đã validate', () => {
    const { app, enableCors } = createAppStub({
      CORS_ORIGIN: 'https://app.example.com',
    });

    configureApp(app);

    expect(enableCors).toHaveBeenCalledWith({
      origin: ['https://app.example.com'],
      credentials: true,
    });
  });

  it('áp `trust proxy` khi được cấu hình', () => {
    const { app, set } = createAppStub({ TRUST_PROXY: 'loopback' });

    configureApp(app);

    expect(set).toHaveBeenCalledWith('trust proxy', 'loopback');
  });

  it('không đụng `trust proxy` khi không cấu hình', () => {
    const { app, set } = createAppStub();

    configureApp(app);

    expect(set).not.toHaveBeenCalled();
  });
});
