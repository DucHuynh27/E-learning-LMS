import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RedisHealthProbe } from './redis-health-probe.service.js';

const redis = vi.hoisted(() => ({
  isReady: false,
  isOpen: false,
  on: vi.fn(),
  connect: vi.fn(),
  ping: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('redis', () => ({ createClient: vi.fn(() => redis) }));

describe('Redis health connection lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redis.isReady = false;
    redis.isOpen = false;
    redis.connect.mockImplementation(async () => {
      redis.isOpen = true;
      redis.isReady = true;
    });
    redis.ping.mockResolvedValue('PONG');
    redis.destroy.mockImplementation(() => {
      redis.isOpen = false;
      redis.isReady = false;
    });
  });
  afterEach(() => vi.useRealTimers());
  const probe = () => new RedisHealthProbe(new ConfigService());

  it('reuses the authenticated connection across health requests', async () => {
    const service = probe();
    expect(await service.ping()).toBe(true);
    expect(await service.ping()).toBe(true);
    expect(redis.connect).toHaveBeenCalledTimes(1);
    service.onModuleDestroy();
    expect(redis.destroy).toHaveBeenCalledTimes(1);
  });
  it('shares an in-flight probe between concurrent callers', async () => {
    const service = probe();
    const first = service.ping();
    expect(service.ping()).toBe(first);
    expect(await first).toBe(true);
    service.onModuleDestroy();
  });
  it('supports TLS and ACL configuration without an offline command queue', () => {
    new RedisHealthProbe(
      new ConfigService({
        REDIS_HOST: 'redis.internal',
        REDIS_TLS: 'true',
        REDIS_USERNAME: 'health',
        REDIS_PASSWORD: 'test-only',
      }),
    );
    expect(createClient).toHaveBeenLastCalledWith(
      expect.objectContaining({
        socket: expect.objectContaining({ host: 'redis.internal', tls: true }),
        username: 'health',
        password: 'test-only',
        disableOfflineQueue: true,
      }),
    );
  });
  it('closes an unhealthy connection and can retry on the next request', async () => {
    const service = probe();
    redis.ping.mockRejectedValueOnce(new Error('offline'));
    expect(await service.ping()).toBe(false);
    expect(await service.ping()).toBe(true);
    expect(redis.connect).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
  });
  it('bounds a stalled connection handshake', async () => {
    vi.useFakeTimers();
    redis.connect.mockImplementation(() => {
      redis.isOpen = true;
      return new Promise(() => {});
    });
    const result = probe().ping();
    await vi.advanceTimersByTimeAsync(501);
    expect(await result).toBe(false);
    expect(redis.destroy).toHaveBeenCalledTimes(1);
  });
  it('bounds a stalled PING and closes the pending socket', async () => {
    vi.useFakeTimers();
    redis.ping.mockReturnValueOnce(new Promise(() => {}));
    const result = probe().ping();
    await vi.advanceTimersByTimeAsync(501);
    expect(await result).toBe(false);
    expect(redis.destroy).toHaveBeenCalledTimes(1);
  });
});
