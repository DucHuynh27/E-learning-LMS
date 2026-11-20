import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { createClient } from 'redis';

// ThrottlerStorageRecord không được re-export từ package; lấy từ kiểu trả về.
type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

// Tăng bộ đếm và đặt TTL trong một lệnh Lua để nhiều instance không đọc/ghi chen nhau.
// Đơn vị ttl/blockDuration của @nestjs/throttler là mili giây nên dùng PEXPIRE/PTTL.
// Trả về [totalHits, timeToExpire (giây), isBlocked, timeToBlockExpire (giây)].
const INCREMENT_SCRIPT = `
local key = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local totalHits = redis.call('INCR', key)
if totalHits == 1 then
  redis.call('PEXPIRE', key, ttl)
end
local pttl = redis.call('PTTL', key)
if pttl < 0 then
  redis.call('PEXPIRE', key, ttl)
  pttl = ttl
end

if blockDuration > 0 then
  local blockPttl = redis.call('PTTL', blockKey)
  if blockPttl > 0 then
    return { totalHits, math.ceil(pttl / 1000), 1, math.ceil(blockPttl / 1000) }
  end
  if totalHits > limit then
    redis.call('SET', blockKey, '1', 'PX', blockDuration)
    return { totalHits, math.ceil(pttl / 1000), 1, math.ceil(blockDuration / 1000) }
  end
end

return { totalHits, math.ceil(pttl / 1000), 0, 0 }
`;

// Tối thiểu những gì storage cần từ node-redis; tách interface để test không cần Redis thật.
export interface RedisThrottlerClient {
  readonly isReady: boolean;
  readonly isOpen: boolean;
  connect(): Promise<unknown>;
  eval(
    script: string,
    options: { keys: string[]; arguments: string[] },
  ): Promise<unknown>;
  quit(): Promise<unknown>;
  on(event: 'error', listener: (error: Error) => void): unknown;
}

export interface RedisThrottlerStorageOptions {
  url?: string;
  keyPrefix?: string;
  // Cho phép inject client giả trong test.
  client?: RedisThrottlerClient;
}

function createRedisClient(url: string): RedisThrottlerClient {
  return createClient({
    url,
    // Khi Redis chết, đừng treo request: thử kết nối lại ở lần increment kế tiếp.
    socket: { connectTimeout: 500, reconnectStrategy: false },
    disableOfflineQueue: true,
  }) as unknown as RedisThrottlerClient;
}

/**
 * Throttler storage dùng Redis để nhiều instance backend chia sẻ cùng bộ đếm.
 * Nếu Redis không sẵn sàng, tạm rơi về storage in-memory để không chặn request
 * (mất tính chia sẻ nhưng giữ ứng dụng hoạt động) và ghi cảnh báo.
 */
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnModuleDestroy
{
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly keyPrefix: string;
  private readonly client: RedisThrottlerClient;
  private readonly fallback = new ThrottlerStorageService();
  private connecting?: Promise<void>;

  constructor(options: RedisThrottlerStorageOptions) {
    if (!options.client && !options.url) {
      throw new Error('RedisThrottlerStorage cần `url` hoặc `client`');
    }
    this.keyPrefix = options.keyPrefix ?? 'throttle';
    this.client =
      options.client ?? createRedisClient(options.url as string);
    this.client.on('error', (error) => {
      this.logger.warn(`Redis throttler storage error: ${error.message}`);
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      await this.ensureConnected();
      const result = (await this.client.eval(INCREMENT_SCRIPT, {
        keys: [
          this.dataKey(key, throttlerName),
          this.blockKey(key, throttlerName),
        ],
        arguments: [String(ttl), String(limit), String(blockDuration)],
      })) as [number | string, number | string, number | string, number | string];

      return {
        totalHits: Number(result[0]),
        timeToExpire: Number(result[1]),
        isBlocked: Number(result[2]) === 1,
        timeToBlockExpire: Number(result[3]),
      };
    } catch (error) {
      this.logger.warn(
        `Redis throttler storage không khả dụng, dùng in-memory: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }

  private dataKey(key: string, throttlerName: string): string {
    return `${this.keyPrefix}:${throttlerName}:${key}`;
  }

  private blockKey(key: string, throttlerName: string): string {
    return `${this.dataKey(key, throttlerName)}:block`;
  }

  private async ensureConnected(): Promise<void> {
    if (this.client.isReady) return;
    if (!this.connecting) {
      this.connecting = this.client
        .connect()
        .then(() => undefined)
        .finally(() => {
          this.connecting = undefined;
        });
    }
    await this.connecting;
  }

  async onModuleDestroy(): Promise<void> {
    this.fallback.onApplicationShutdown();
    if (!this.client.isOpen) return;
    try {
      await this.client.quit();
    } catch {
      // Đang đóng kết nối, lỗi ở bước này không ảnh hưởng ứng dụng.
    }
  }
}
