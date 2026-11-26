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
import { CoursesService } from './courses.service.js';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { CourseQueryDto } from './dto/course-query.dto.js';
import {
  CourseDetailResponse,
  CourseResponse,
} from './dto/course.response.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Role } from '../user/user.entity.js';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface.js';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post()
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  async create(
    @Body() dto: CreateCourseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourseResponse> {
    return this.coursesService.create(dto, user.userId);
  }

  @Get()
  @Public()
  async findAll(
    @Query() query: CourseQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ): Promise<{ items: CourseResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    return this.coursesService.findAll(query, user);
  }

  @Get('manage')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  async findManaged(
    @Query() query: CourseQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ items: CourseResponse[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const filters =
      user.role === Role.INSTRUCTOR
        ? { ...query, instructorId: user.userId }
        : query;
    return this.coursesService.findAll(filters, user);
  }

  @Get(':id')
  @Public()
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourseDetailResponse> {
    return this.coursesService.findOne(id, user);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourseResponse> {
    return this.coursesService.update(id, dto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.coursesService.remove(id, user);
  }

  @Post(':id/publish')
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourseResponse> {
    return this.coursesService.publish(id, user);
  }

  @Post(':id/unpublish')
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CourseResponse> {
    return this.coursesService.unpublish(id, user);
  }
}
