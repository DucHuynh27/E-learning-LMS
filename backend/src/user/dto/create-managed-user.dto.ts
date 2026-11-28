import { IsEnum } from 'class-validator';
import { CreateUserDto } from './create-user.dto.js';
import { Role } from '../user.entity.js';

export class CreateManagedUserDto extends CreateUserDto {
  @IsEnum(Role)
  role: Role;
}
