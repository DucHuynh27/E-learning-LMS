import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from '@node-rs/argon2';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const passwordHash = await hash(dto.password);
    return this.users.save(
      this.users.create({
        email: dto.email,
        fullName: dto.fullName,
        passwordHash,
      }),
    );
  }

  findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email } });
  }

  // `passwordHash` để `select: false` nên phải addSelect tường minh khi cần xác thực.
  findByEmailForAuth(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }
}
