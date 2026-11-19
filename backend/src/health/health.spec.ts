import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { PublishedLessonCache } from '../learning/published-lesson-cache.service.js';
import { HealthService } from './health.service.js';

describe('Health probes', () => {
  const query = vi.fn();
  const ping = vi.fn();
  const fetchProbe = vi.fn();
  const service = new HealthService(
    { query } as unknown as DataSource,
    new ConfigService(),
    { ping } as unknown as PublishedLessonCache,
  );
  beforeEach(() => {
    query.mockResolvedValue([{ ok: 1 }]);
    ping.mockResolvedValue(true);
    fetchProbe.mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetchProbe);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('reports all three healthy services', async () => {
    expect(await service.check()).toEqual({
      status: 'ok',
      checks: { postgres: true, redis: true, minio: true },
    });
    expect(fetchProbe.mock.calls.at(-1)?.[0]).toBe(
      'http://localhost:9000/minio/health/live',
    );
  });
  it('reports PostgreSQL failures as 503', async () => {
    query.mockRejectedValue(new Error('offline'));
    await expect(service.check()).rejects.toMatchObject({
      status: 503,
      message: 'Health check failed: postgres',
    });
  });
  it('reports Redis and MinIO failures as 503', async () => {
    ping.mockResolvedValue(false);
    fetchProbe.mockRejectedValue(new Error('offline'));
    await expect(service.check()).rejects.toMatchObject({
      status: 503,
      message: 'Health check failed: redis, minio',
    });
  });
  it('bounds a stalled PostgreSQL probe', async () => {
    vi.useFakeTimers();
    query.mockReturnValue(new Promise(() => {}));
    const result = expect(service.check()).rejects.toMatchObject({
      status: 503,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await result;
  });
});
