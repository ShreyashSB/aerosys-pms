import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CreateUserSchema,
  ResetPasswordSchema,
  UpdateUserSchema,
  type CreateUserInput,
  type ResetPasswordInput,
  type UpdateUserInput,
  type UserDto,
} from './users.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** GET /api/users: every signed-in person needs this to show names and roles. */
  @Get()
  list(): Promise<UserDto[]> {
    return this.users.list();
  }

  /** POST /api/users */
  @Allow('employee.manage')
  @Post()
  create(@User() actor: CurrentUser, @Body(new ZodValidationPipe(CreateUserSchema)) body: CreateUserInput): Promise<UserDto> {
    return this.users.create(actor, body);
  }

  /** PUT /api/users/:id → change role or switch the login on/off */
  @Allow('employee.manage')
  @Put(':id')
  update(@User() actor: CurrentUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateUserSchema)) body: UpdateUserInput): Promise<UserDto> {
    return this.users.update(actor, id, body);
  }

  /** POST /api/users/:id/reset-password */
  @Allow('employee.manage')
  @Post(':id/reset-password')
  resetPassword(
    @User() actor: CurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResetPasswordSchema)) body: ResetPasswordInput,
  ): Promise<UserDto> {
    return this.users.resetPassword(actor, id, body);
  }
}
