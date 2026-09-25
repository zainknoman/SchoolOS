import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { GRANT_KEY } from '../decorators/requires-grant.decorator';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; grants?: string[] };
}

/**
 * Runs AFTER JwtAuthGuard (see AuthModule provider order) so `request.user` is already populated.
 * This is the server-side enforcement point — the frontend may also hide a nav item for UX, but this
 * guard is what actually stops the request; it is never optional.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    const requiredRoles = this.reflector.getAllAndOverride<
      string[] | undefined
    >(ROLES_KEY, targets);
    const requiredGrant = this.reflector.getAllAndOverride<string | undefined>(
      GRANT_KEY,
      targets,
    );
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;

    if (requiredRoles && requiredRoles.length > 0) {
      if (!user || !requiredRoles.includes(user.role)) {
        throw new ForbiddenException('Insufficient role for this action');
      }
    }

    // BL-32 (Q18): ACCOUNTS is finance-only unless an admin granted this module.
    if (
      requiredGrant &&
      user?.role === 'ACCOUNTS' &&
      !(user.grants ?? []).includes(requiredGrant)
    ) {
      throw new ForbiddenException(
        'Your account has no access to this module; ask a school admin to grant it.',
      );
    }

    return true;
  }
}
