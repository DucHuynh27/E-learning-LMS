import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import type { RedisHealthProbe } from './redis-health-probe.service.js';
import { HealthService } from './health.service.js';

describe('Health probes', () => {
  const query = vi.fn();
  const ping = vi.fn();
  const fetchProbe = vi.fn();
  let service: HealthService;
  beforeEach(() => {
    vi.resetAllMocks();
    service = new HealthService(
      { query } as unknown as DataSource,
      new ConfigService(),
      { ping } as unknown as RedisHealthProbe,
    );
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
  it('shares a pending PostgreSQL query between concurrent health requests', async () => {
    let finish!: (value: unknown[]) => void;
    query.mockReturnValueOnce(
      new Promise<unknown[]>((resolve) => {
        finish = resolve;
      }),
    );
    const first = service.check();
    const second = service.check();
    finish([{ ok: 1 }]);
    expect(await Promise.all([first, second])).toEqual([
      { status: 'ok', checks: { postgres: true, redis: true, minio: true } },
      { status: 'ok', checks: { postgres: true, redis: true, minio: true } },
    ]);
    expect(query).toHaveBeenCalledTimes(1);
  });
  it.each(['success', 'failure'])(
    'keeps one PostgreSQL query across response timeouts and retries after late %s',
    async (outcome) => {
      vi.useFakeTimers();
      let finish!: () => void;
      const pending = new Promise<unknown[]>((resolve, reject) => {
        finish = () =>
          outcome === 'success'
            ? resolve([{ ok: 1 }])
            : reject(new Error('offline'));
      });
      query.mockReturnValue(pending);
      for (let request = 0; request < 3; request++) {
        const result = expect(service.check()).rejects.toMatchObject({
          status: 503,
          message: 'Health check failed: postgres',
        });
        await vi.advanceTimersByTimeAsync(1000);
        await result;
      }
      expect(query).toHaveBeenCalledTimes(1);
      finish();
      await vi.advanceTimersByTimeAsync(0);
      query.mockResolvedValue([{ ok: 1 }]);
      expect(await service.check()).toMatchObject({ status: 'ok' });
      expect(query).toHaveBeenCalledTimes(2);
    },
  );
});
