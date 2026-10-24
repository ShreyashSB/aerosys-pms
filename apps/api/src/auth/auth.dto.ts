import { z } from 'zod';
import { PASSWORD_RULE } from './password.js';

export const LoginSchema = z.object({
  email: z.email('Enter your work email').trim().toLowerCase(),
  password: z.string().min(1, 'Enter your password').max(200),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password').max(200),
    newPassword: z.string().min(PASSWORD_RULE.min, PASSWORD_RULE.message).max(200),
  })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'Pick a password different from the current one' });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
