import { z } from 'zod';
import { PASSWORD_RULE } from '../auth/password.js';
import { ROLES } from '../auth/permissions.js';

const password = z.string().min(PASSWORD_RULE.min, PASSWORD_RULE.message).max(200);

/** Body for POST /api/users: give an employee a login. They change the password at first sign-in. */
export const CreateUserSchema = z.object({ employeeId: z.uuid(), role: z.enum(ROLES), password });
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

/** Body for PUT /api/users/:id. */
export const UpdateUserSchema = z.object({ role: z.enum(ROLES), active: z.boolean() });
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/** Body for POST /api/users/:id/reset-password. */
export const ResetPasswordSchema = z.object({ password });
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

/** An account as the web app sees it. Never includes the password hash. */
export interface UserDto {
  id: string;
  employeeId: string;
  role: string;
  email: string;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}
