import { INestApplication } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { configureApp, resolveCorsOrigins } from './bootstrap.js';

function createAppStub() {
  const enableCors = vi.fn();
  const app = {
    enableCors,
    useGlobalPipes: vi.fn(),
    useGlobalInterceptors: vi.fn(),
    useGlobalFilters: vi.fn(),
    enableVersioning: vi.fn(),
    get: vi.fn(() => new Reflector()),
  } as unknown as INestApplication;
  return { app, enableCors };
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

describe('configureApp', () => {
  it('bật CORS với origin mặc định (CORS_ORIGIN trống)', () => {
    const { app, enableCors } = createAppStub();

    configureApp(app);

    expect(enableCors).toHaveBeenCalledWith({
      origin: resolveCorsOrigins(''),
      credentials: true,
    });
  });
});
