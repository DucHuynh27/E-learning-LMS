import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';
import { Role } from './user.entity.js';
import { CreateManagedUserDto } from './dto/create-managed-user.dto.js';
import { ManageUsersQueryDto } from './dto/manage-users-query.dto.js';
import { UpdateManagedUserDto } from './dto/update-managed-user.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@Roles(Role.ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('manage')
  async findAll(@Query() query: ManageUsersQueryDto) {
    const result = await this.users.findAll(query.page, query.limit);
    return {
      ...result,
      items: result.items.map(({ id, email, fullName, role, createdAt }) => ({
        id,
        email,
        fullName,
        role,
        createdAt,
      })),
    };
  }

  @Post('manage')
  async create(@Body() dto: CreateManagedUserDto) {
    const user = await this.users.create(dto, dto.role);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  @Patch(':id/manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    const user = await this.users.updateManaged(id, dto);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  @Delete(':id/manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.users.removeManaged(id, actor.userId);
  }
}
