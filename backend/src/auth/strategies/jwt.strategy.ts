import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../user/users.service.js';
import {
  AuthenticatedUser,
  JwtPayload,
} from '../interfaces/jwt-payload.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  // Tra user hiện tại mỗi request để role/hiệu lực phản ánh ngay (issue #74): token còn hạn
  // nhưng tài khoản đã bị xoá → 401; role đổi → áp dụng role mới, không dùng role cũ trong token.
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user) throw new UnauthorizedException('Account is no longer active');
    return { userId: user.id, email: user.email, role: user.role };
  }
}
