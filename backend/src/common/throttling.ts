import type {
  ThrottlerGetTrackerFunction,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { RedisThrottlerStorage } from './throttler-redis.storage.js';

// Ngưỡng mặc định cho toàn API: rộng rãi để không chặn nhầm luồng học bình thường.
export const GLOBAL_THROTTLE = { ttl: 60_000, limit: 100 } as const;

// Login siết chặt hơn hẳn để chặn dò mật khẩu (brute force).
export const LOGIN_THROTTLE = { ttl: 60_000, limit: 5 } as const;

// Register tạo tài khoản: đủ rộng cho người dùng thật, đủ chặt để chặn spam/đoán email.
export const REGISTER_THROTTLE = { ttl: 60_000, limit: 10 } as const;

// Refresh access token xảy ra định kỳ nên rộng hơn login.
export const REFRESH_THROTTLE = { ttl: 60_000, limit: 20 } as const;

// Bắt attempt rẻ và có thể lặp; submit là điểm nhạy cảm nên siết chặt hơn.
export const QUIZ_START_THROTTLE = { ttl: 60_000, limit: 10 } as const;
export const QUIZ_SUBMIT_THROTTLE = { ttl: 60_000, limit: 5 } as const;

export const THROTTLE_ERROR_MESSAGE = 'Too many requests';

type RequestWithUser = {
  user?: { userId?: string };
  ip?: string;
};

// Tracker mặc định: đếm theo tài khoản khi request đã xác thực, ngược lại theo IP.
// ThrottlerGuard chạy sau guard xác thực nên `req.user` đã sẵn có — nhờ vậy nhiều
// học viên chung một IP (NAT, proxy) vẫn có bucket riêng.
export const accountOrIpTracker: ThrottlerGetTrackerFunction = (req) => {
  const userId = (req as RequestWithUser).user?.userId;
  return userId ? `user:${userId}` : `ip:${String((req as RequestWithUser).ip)}`;
};

// Login là route công khai (chưa có user): đếm theo tài khoản đang nhắm tới qua email,
// chặn dò mật khẩu phân tán nhiều IP vào cùng account.
export const loginTracker: ThrottlerGetTrackerFunction = (req) => {
  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
  return email ? `login:${email}` : `login:ip:${String(req.ip)}`;
};

// Chỉ cần `get` để đọc cấu hình; ConfigService thỏa interface này.
export interface ThrottlerConfigReader {
  get<T = unknown>(key: string): T | undefined;
}

// Mặc định in-memory cho dev (một instance). Bật `THROTTLE_STORAGE=redis` khi chạy
// nhiều instance để mọi instance dùng chung bộ đếm.
export function createThrottlerStorage(
  config?: ThrottlerConfigReader,
): ThrottlerStorage | undefined {
  if (config?.get<string>('THROTTLE_STORAGE') !== 'redis') return undefined;
  const url = config.get<string>('THROTTLE_REDIS_URL');
  if (!url) {
    throw new Error(
      'THROTTLE_STORAGE=redis yêu cầu THROTTLE_REDIS_URL (vd redis://:password@localhost:6379)',
    );
  }
  return new RedisThrottlerStorage({ url });
}

// Dùng chung cho runtime và test để test kiểm chứng đúng cấu hình thật.
export function throttlerRootOptions(
  config?: ThrottlerConfigReader,
): ThrottlerModuleOptions {
  const storage = createThrottlerStorage(config);
  return {
    errorMessage: THROTTLE_ERROR_MESSAGE,
    getTracker: accountOrIpTracker,
    throttlers: [{ ...GLOBAL_THROTTLE }],
    ...(storage ? { storage } : {}),
  };
}
