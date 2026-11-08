import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, mergeMap, type Observable } from 'rxjs';
import type { CurrentUser } from '../auth/current-user.js';
import { AUDIT, type AuditMeta } from './audit.js';
import { AuditService } from './audit.service.js';

/**
 * Runs around every route (registered as APP_INTERCEPTOR) but only acts on
 * routes marked `@Audit(...)`: snapshot the record, let the route run, snapshot
 * it again, save the difference. A route that fails saves nothing.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT, ctx.getHandler());
    if (!meta) return next.handle();
    const req = ctx.switchToHttp().getRequest<{ params: Record<string, string>; user?: CurrentUser }>();
    const id = meta.fixedId ?? (meta.param ? req.params[meta.param] : undefined);

    return from(this.audit.snapshot(meta.entity, id)).pipe(
      mergeMap((before) =>
        next.handle().pipe(
          mergeMap(async (result: unknown) => {
            const recordId = id ?? idOf(result);
            if (req.user && recordId) {
              const after = await this.audit.snapshot(meta.entity, recordId);
              await this.audit.record(meta, req.user, recordId, before, after);
            }
            return result;
          }),
        ),
      ),
    );
  }
}

function idOf(result: unknown): string | undefined {
  const id = (result as { id?: unknown } | null)?.id;
  return typeof id === 'string' ? id : undefined;
}
