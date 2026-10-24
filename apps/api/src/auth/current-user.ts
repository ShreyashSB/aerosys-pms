import { createParamDecorator, SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { Permission, Role } from './permissions.js';

/** The signed-in person, attached to the request by AuthGuard. */
export interface CurrentUser {
  id: string;
  employeeId: string;
  role: Role;
  email: string;
  name: string;
  mustChangePassword: boolean;
}

/** In a controller: `me(@User() user: CurrentUser)`. */
export const User = createParamDecorator((_: unknown, ctx: ExecutionContext): CurrentUser => ctx.switchToHttp().getRequest().user);

export const IS_PUBLIC = 'isPublic';
/** Lets a route through without signing in (health check, login). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const REQUIRED_PERMISSION = 'requiredPermission';
/** `@Allow('expense.approve')`: only roles with this permission get past AuthGuard. */
export const Allow = (permission: Permission) => SetMetadata(REQUIRED_PERMISSION, permission);

export const ALLOW_BEFORE_PASSWORD_CHANGE = 'allowBeforePasswordChange';
/** Reachable while the person still has to replace an admin-set password. */
export const AllowBeforePasswordChange = () => SetMetadata(ALLOW_BEFORE_PASSWORD_CHANGE, true);
