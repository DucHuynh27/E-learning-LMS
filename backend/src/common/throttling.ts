import type { ThrottlerModuleOptions } from '@nestjs/throttler';

// Ngưỡng mặc định cho toàn API: rộng rãi để không chặn nhầm luồng học bình thường.
export const GLOBAL_THROTTLE = { ttl: 60_000, limit: 100 } as const;

// Login siết chặt hơn hẳn để chặn dò mật khẩu (brute force) trên từng IP.
export const LOGIN_THROTTLE = { ttl: 60_000, limit: 5 } as const;

export const THROTTLE_ERROR_MESSAGE = 'Too many requests';

// Dùng chung cho runtime và test để test kiểm chứng đúng cấu hình thật.
export function throttlerRootOptions(): ThrottlerModuleOptions {
  return {
    errorMessage: THROTTLE_ERROR_MESSAGE,
    throttlers: [{ ...GLOBAL_THROTTLE }],
  };
}
