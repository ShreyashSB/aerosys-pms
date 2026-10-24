import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ChangePasswordSchema, LoginSchema, type ChangePasswordInput, type LoginInput } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { AllowBeforePasswordChange, Public, User, type CurrentUser } from './current-user.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/login → { token, user }. The web app sends the token as `Authorization: Bearer …`. */
  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(LoginSchema)) body: LoginInput) {
    return this.auth.login(body);
  }

  /** GET /api/auth/me → who the token belongs to. */
  @AllowBeforePasswordChange()
  @Get('me')
  me(@User() user: CurrentUser): CurrentUser {
    return user;
  }

  /** POST /api/auth/change-password */
  @AllowBeforePasswordChange()
  @Post('change-password')
  @HttpCode(200)
  changePassword(@User() user: CurrentUser, @Body(new ZodValidationPipe(ChangePasswordSchema)) body: ChangePasswordInput): Promise<CurrentUser> {
    return this.auth.changePassword(user.id, body);
  }
}
