import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';
import { PASSWORD_CHANGE_REQUIRED_CODE } from '../auth.constants';
import type { AuthenticatedUser } from '../strategies/jwt.strategy';

/**
 * Server-side enforcement of `mustChangePassword` (BL-21, KG-11). Runs after JwtAuthGuard, so
 * `request.user` reflects the database on this request. Before BL-21 only the console's router
 * enforced it, so any API client could skip the forced change.
 */
@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets) ||
      this.reflector.getAllAndOverride<boolean>(
        ALLOW_PENDING_PASSWORD_CHANGE_KEY,
        targets,
      )
    ) {
      return true;
    }
    const user = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>().user;
    if (user?.mustChangePassword) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: PASSWORD_CHANGE_REQUIRED_CODE,
        message: 'You must change your password before continuing.',
      });
    }
    return true;
  }
}
