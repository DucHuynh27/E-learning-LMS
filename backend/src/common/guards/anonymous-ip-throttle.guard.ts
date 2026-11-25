import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import {
  getStorageToken,
  ThrottlerException,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import {
  ANONYMOUS_IP_THROTTLE,
  THROTTLE_ERROR_MESSAGE,
  type AnonymousIpThrottleOptions,
} from '../throttling.js';

// Cho phép test ghi đè ngưỡng mà không phải bắn hàng trăm request.
export const ANONYMOUS_IP_THROTTLE_OPTIONS = Symbol(
  'ANONYMOUS_IP_THROTTLE_OPTIONS',
);

interface RequestWithIp {
  ip?: string;
}

/**
 * Lớp throttle thô theo IP, chạy TRƯỚC guard xác thực (issue #31).
 *
 * `ThrottlerGuard` theo tài khoản (issue #37) phải chạy SAU auth để đọc `req.user`,
 * nên request ẩn danh bị 401 không đi qua nó. Guard này bù lại: đếm theo IP trước khi
 * tốn CPU verify JWT, nhờ đó spam ẩn danh vẫn bị chặn (429). Bucket tách riêng khỏi
 * throttler theo tài khoản nên không đếm trùng.
 */
@Injectable()
export class AnonymousIpThrottleGuard implements CanActivate {
  constructor(
    @Inject(getStorageToken()) private readonly storage: ThrottlerStorage,
    @Optional()
    @Inject(ANONYMOUS_IP_THROTTLE_OPTIONS)
    private readonly options?: AnonymousIpThrottleOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const { ttl, limit } = this.options ?? ANONYMOUS_IP_THROTTLE;
    const request = context.switchToHttp().getRequest<RequestWithIp>();
    const key = `anonymous-ip:${request.ip ?? 'unknown'}`;

    const { isBlocked } = await this.storage.increment(
      key,
      ttl,
      limit,
      ttl,
      'anonymous-ip',
    );
    if (isBlocked) throw new ThrottlerException(THROTTLE_ERROR_MESSAGE);

    return true;
  }
}
