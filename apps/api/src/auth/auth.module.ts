import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { ReadScopeService } from './read-scope.js';

/**
 * Sign-in and the guard that protects every route. APP_GUARD makes AuthGuard
 * run for all controllers in the app, so a new route is protected by default;
 * only `@Public()` opens one up.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_SECRET, signOptions: { expiresIn: env.JWT_EXPIRES_IN as `${number}h` } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ReadScopeService, { provide: APP_GUARD, useClass: AuthGuard }],
  exports: [AuthService, ReadScopeService],
})
export class AuthModule {}
