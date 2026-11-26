import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Role, User } from '../../user/user.entity.js';
import type { UsersService } from '../../user/users.service.js';
import { JwtStrategy } from './jwt.strategy.js';

function makeConfig(): ConfigService {
  return {
    getOrThrow: (key: string) => `secret:${key}`,
  } as unknown as ConfigService;
}

function makeUsers(user: User | null): UsersService {
  return {
    findById: vi.fn().mockResolvedValue(user),
  } as unknown as UsersService;
}

describe('JwtStrategy', () => {
  it('trả user hiện tại (role mới), không dùng role cũ trong token', async () => {
    const user = Object.assign(new User(), {
      id: 'u1',
      email: 'a@x.com',
      role: Role.INSTRUCTOR,
    });
    const strategy = new JwtStrategy(makeConfig(), makeUsers(user));

    await expect(
      strategy.validate({ sub: 'u1', email: 'old@x.com', role: Role.STUDENT }),
    ).resolves.toEqual({ userId: 'u1', email: 'a@x.com', role: Role.INSTRUCTOR });
  });

  it('401 khi tài khoản không còn tồn tại', async () => {
    const strategy = new JwtStrategy(makeConfig(), makeUsers(null));

    await expect(
      strategy.validate({ sub: 'u1', email: 'a@x.com', role: Role.STUDENT }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
