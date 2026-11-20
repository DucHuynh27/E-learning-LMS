import type { ThrottlerStorage } from '@nestjs/throttler';
import {
  RedisThrottlerStorage,
  type RedisThrottlerClient,
} from './throttler-redis.storage.js';
import { throttlerRootOptions } from './throttling.js';

function makeClient(
  evalMock: ReturnType<typeof vi.fn>,
): RedisThrottlerClient {
  return {
    isReady: true,
    isOpen: true,
    connect: vi.fn().mockResolvedValue(undefined),
    eval: evalMock,
    quit: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };
}

function config(values: Record<string, string>) {
  return { get: <T = unknown>(key: string) => values[key] as T | undefined };
}

describe('RedisThrottlerStorage', () => {
  it('map kết quả Lua sang ThrottlerStorageRecord', async () => {
    const evalMock = vi.fn().mockResolvedValue([3, 30, 1, 20]);
    const storage = new RedisThrottlerStorage({
      url: 'redis://localhost:6379',
      client: makeClient(evalMock),
    });

    const record = await storage.increment('abc', 60_000, 5, 60_000, 'default');

    expect(record).toEqual({
      totalHits: 3,
      timeToExpire: 30,
      isBlocked: true,
      timeToBlockExpire: 20,
    });
    expect(evalMock).toHaveBeenCalledWith(expect.any(String), {
      keys: ['throttle:default:abc', 'throttle:default:abc:block'],
      arguments: ['60000', '5', '60000'],
    });
  });

  it('rơi về in-memory khi Redis lỗi', async () => {
    const storage = new RedisThrottlerStorage({
      url: 'redis://localhost:6379',
      client: makeClient(vi.fn().mockRejectedValue(new Error('down'))),
    });

    const record = await storage.increment('abc', 60_000, 5, 60_000, 'default');

    expect(record.isBlocked).toBe(false);
    expect(record.totalHits).toBe(1);
    await storage.onModuleDestroy();
  });
});

describe('throttlerRootOptions storage', () => {
  it('mặc định dùng storage in-memory', () => {
    const options = throttlerRootOptions();
    expect((options as { storage?: ThrottlerStorage }).storage).toBeUndefined();
  });

  it('báo lỗi khi bật redis mà thiếu URL', () => {
    expect(() =>
      throttlerRootOptions(config({ THROTTLE_STORAGE: 'redis' })),
    ).toThrow(/THROTTLE_REDIS_URL/);
  });

  it('tạo Redis storage khi THROTTLE_STORAGE=redis', () => {
    const options = throttlerRootOptions(
      config({
        THROTTLE_STORAGE: 'redis',
        THROTTLE_REDIS_URL: 'redis://localhost:6379',
      }),
    );
    expect((options as { storage?: ThrottlerStorage }).storage).toBeInstanceOf(
      RedisThrottlerStorage,
    );
  });
});
