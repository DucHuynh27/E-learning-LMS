import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hash } from '@node-rs/argon2';
import { QueryFailedError, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
import { Role, User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async create(dto: CreateUserDto, role = Role.STUDENT): Promise<User> {
    const passwordHash = await hash(dto.password);
    try {
      return await this.users.save(
        this.users.create({
          email: dto.email,
          fullName: dto.fullName,
          passwordHash,
          role,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
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

  async findAll(page: number, limit: number) {
    const [items, total] = await this.users.findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async updateManaged(
    id: string,
    values: { email?: string; fullName?: string; role?: Role; password?: string },
  ): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    if (values.role && values.role !== user.role && user.role === Role.ADMIN) {
      await this.assertAnotherAdminExists(id);
    }
    if (values.email !== undefined) user.email = values.email;
    if (values.fullName !== undefined) user.fullName = values.fullName;
    if (values.role !== undefined) user.role = values.role;
    if (values.password) user.passwordHash = await hash(values.password);
    try {
      return await this.users.save(user);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async removeManaged(id: string, actorId: string): Promise<void> {
    if (id === actorId) throw new ConflictException('You cannot delete your own account');
    const user = await this.users.findOneBy({ id });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === Role.ADMIN) await this.assertAnotherAdminExists(id);
    try {
      if (user.role === Role.INSTRUCTOR) {
        // Preserve owned course content by transferring it to the acting administrator.
        await this.users.manager.query(
          'UPDATE "courses" SET "instructorId" = $1 WHERE "instructorId" = $2',
          [actorId, id],
        );
      }
      await this.users.remove(user);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23503') {
        throw new ConflictException('User owns courses or records that must be reassigned before deletion');
      }
      throw error;
    }
  }

  private async assertAnotherAdminExists(excludeId: string): Promise<void> {
    const admins = await this.users.countBy({ role: Role.ADMIN });
    const target = await this.users.findOneBy({ id: excludeId });
    if (target?.role === Role.ADMIN && admins <= 1) {
      throw new ConflictException('At least one administrator must remain');
    }
  }
}
