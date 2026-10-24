import { ForbiddenException, Inject, Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DB, type Database } from '../db/db.module.js';
import { AuthService } from './auth.service.js';
import { ALLOW_BEFORE_PASSWORD_CHANGE, IS_PUBLIC, REQUIRED_PERMISSION, type CurrentUser } from './current-user.js';
import { can, type Permission } from './permissions.js';
import { PROJECT_SCOPE, assertProjectAccess, projectIdFor, type ProjectScopeMeta } from './project-access.js';

/**
 * Runs before every route (registered as APP_GUARD in AuthModule).
 *
 * 1. `@Public()` routes pass.
 * 2. Otherwise the request needs `Authorization: Bearer <token>`. The token's
 *    signature proves we issued it; we still load the account, so a
 *    deactivated person or a changed role takes effect at once.
 * 3. `@Allow('permission')` on the route (or its controller) is checked against the role.
 * 4. `@ProjectScope(...)` checks the row's project is one this person may change.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(DB) private readonly db: Database,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; params: Record<string, string>; user?: CurrentUser }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Please sign in');

    let userId: string;
    try {
      userId = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again');
    }
    const user = await this.auth.findActive(userId);
    if (!user) throw new UnauthorizedException('Your account is not active');
    req.user = user;

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(REQUIRED_PERMISSION, targets);
    // Until a new password is set, the only thing a person can do is set it (and read who they are).
    if (user.mustChangePassword && !this.reflector.getAllAndOverride<boolean>(ALLOW_BEFORE_PASSWORD_CHANGE, targets)) {
      throw new ForbiddenException('Please choose a new password first');
    }
    if (permission && !can(user.role, permission)) throw new ForbiddenException("Your role doesn't allow this");

    const scope = this.reflector.getAllAndOverride<ProjectScopeMeta | undefined>(PROJECT_SCOPE, targets);
    const id = scope && req.params[scope.param];
    // A malformed id is left for ParseUUIDPipe to answer with 400.
    if (scope && id && UUID.test(id)) await assertProjectAccess(this.db, user, await projectIdFor(this.db, scope, id));
    return true;
  }
}
