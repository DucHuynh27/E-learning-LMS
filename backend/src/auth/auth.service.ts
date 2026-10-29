import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import { CreateUserDto } from '../user/dto/create-user.dto.js';
import { User } from '../user/user.entity.js';
import { UsersService } from '../user/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtPayload } from './interfaces/jwt-payload.interface.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: CreateUserDto) {
    if (await this.users.findByEmail(dto.email)) {
      throw new ConflictException('Email already registered');
    }
    return this.issueTokens(await this.users.create(dto));
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailForAuth(dto.email);
    // Một thông báo lỗi chung cho cả hai trường hợp để không lộ email nào tồn tại.
    if (!user || !(await verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string) {
    const payload = await this.verifyRefreshToken(refreshToken);
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    return this.issueTokens(user);
  }

  private async verifyRefreshToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async issueTokens(user: User) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: Number(this.config.get('JWT_ACCESS_TTL') ?? 900),
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: Number(this.config.get('JWT_REFRESH_TTL') ?? 604800),
      }),
    ]);
    return { accessToken, refreshToken, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
