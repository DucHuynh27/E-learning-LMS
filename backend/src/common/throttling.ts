import type {
  ThrottlerGetTrackerFunction,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';

// Ngưỡng mặc định cho toàn API: rộng rãi để không chặn nhầm luồng học bình thường.
export const GLOBAL_THROTTLE = { ttl: 60_000, limit: 100 } as const;

// Login siết chặt hơn hẳn để chặn dò mật khẩu (brute force).
export const LOGIN_THROTTLE = { ttl: 60_000, limit: 5 } as const;

// Register tạo tài khoản: đủ rộng cho người dùng thật, đủ chặt để chặn spam/đoán email.
export const REGISTER_THROTTLE = { ttl: 60_000, limit: 10 } as const;

// Refresh access token xảy ra định kỳ nên rộng hơn login.
export const REFRESH_THROTTLE = { ttl: 60_000, limit: 20 } as const;

export const THROTTLE_ERROR_MESSAGE = 'Too many requests';

// Login đếm theo tài khoản thay vì chỉ theo IP: chặn dò mật khẩu phân tán nhiều IP
// vào cùng một email, đồng thời không khoá lây người dùng chung NAT.
export const loginTracker: ThrottlerGetTrackerFunction = (req) => {
  const email =
    typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
  return email ? `login:${email}` : `login:ip:${String(req.ip)}`;
};

// Dùng chung cho runtime và test để test kiểm chứng đúng cấu hình thật.
export function throttlerRootOptions(): ThrottlerModuleOptions {
  return {
    errorMessage: THROTTLE_ERROR_MESSAGE,
    throttlers: [{ ...GLOBAL_THROTTLE }],
  };
}
