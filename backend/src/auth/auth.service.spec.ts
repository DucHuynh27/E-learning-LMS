import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import { Role, User } from '../user/user.entity.js';
import { UsersService } from '../user/users.service.js';
import { AuthService } from './auth.service.js';

vi.mock('@node-rs/argon2', () => ({ verify: vi.fn() }));

const verifyMock = vi.mocked(verify);

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'student@example.com',
    passwordHash: 'stored-hash',
    fullName: 'Student',
    role: Role.STUDENT,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...overrides,
  } as User;
}

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    findByEmail: ReturnType<typeof vi.fn>;
    findByEmailForAuth: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let jwt: {
    signAsync: ReturnType<typeof vi.fn>;
    verifyAsync: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    users = {
      findByEmail: vi.fn(),
      findByEmailForAuth: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };
    jwt = {
      signAsync: vi.fn().mockResolvedValue('signed-token'),
      verifyAsync: vi.fn(),
    };
    const config = {
      getOrThrow: vi.fn((key: string) => `secret:${key}`),
      get: vi.fn(),
    };
    service = new AuthService(
      users as unknown as UsersService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('từ chối khi email đã tồn tại', async () => {
      users.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register({
          email: 'student@example.com',
          password: 'supersecret',
          fullName: 'Student',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('cấp token nhưng không lộ passwordHash', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.create.mockResolvedValue(makeUser());

      const result = await service.register({
        email: 'student@example.com',
        password: 'supersecret',
        fullName: 'Student',
      });

      expect(result).toMatchObject({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'student@example.com',
        fullName: 'Student',
        role: Role.STUDENT,
      });
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    it('trả 401 khi email không tồn tại', async () => {
      users.findByEmailForAuth.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'missing@example.com',
          password: 'supersecret',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('trả 401 khi sai mật khẩu', async () => {
      users.findByEmailForAuth.mockResolvedValue(makeUser());
      verifyMock.mockResolvedValue(false);

      await expect(
        service.login({
          email: 'student@example.com',
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('cấp token khi đăng nhập đúng', async () => {
      users.findByEmailForAuth.mockResolvedValue(makeUser());
      verifyMock.mockResolvedValue(true);

      const result = await service.login({
        email: 'student@example.com',
        password: 'supersecret',
      });

      expect(verifyMock).toHaveBeenCalledWith('stored-hash', 'supersecret');
      expect(result.accessToken).toBe('signed-token');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('refresh', () => {
    it('trả 401 khi refresh token không hợp lệ', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('bad signature'));

      await expect(service.refresh('broken')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('trả 401 khi user không còn tồn tại', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'student@example.com',
        role: Role.STUDENT,
      });
      users.findById.mockResolvedValue(null);

      await expect(service.refresh('valid-signature')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('cấp token mới khi refresh token hợp lệ', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'student@example.com',
        role: Role.STUDENT,
      });
      users.findById.mockResolvedValue(makeUser());

      await expect(service.refresh('valid-signature')).resolves.toMatchObject({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
    });
  });
});
