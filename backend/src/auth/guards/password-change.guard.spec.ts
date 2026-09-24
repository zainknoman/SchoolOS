import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PasswordChangeGuard } from './password-change.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';

describe('PasswordChangeGuard (BL-21, KG-11)', () => {
  const ctx = (user: unknown) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;
  const guard = (meta: Record<string, boolean> = {}) =>
    new PasswordChangeGuard({
      getAllAndOverride: (key: string) => meta[key] ?? false,
    } as unknown as Reflector);

  it('blocks a user who must change their password with PASSWORD_CHANGE_REQUIRED', () => {
    let thrown: unknown;
    try {
      guard().canActivate(ctx({ id: 'u1', mustChangePassword: true }));
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ForbiddenException);
    expect((thrown as ForbiddenException).getResponse()).toMatchObject({
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
  });

  it('lets that user reach routes marked @AllowPendingPasswordChange and public routes', () => {
    const pending = ctx({ id: 'u1', mustChangePassword: true });
    expect(
      guard({ [ALLOW_PENDING_PASSWORD_CHANGE_KEY]: true }).canActivate(pending),
    ).toBe(true);
    expect(guard({ [IS_PUBLIC_KEY]: true }).canActivate(pending)).toBe(true);
  });

  it('passes everyone else', () => {
    expect(
      guard().canActivate(ctx({ id: 'u1', mustChangePassword: false })),
    ).toBe(true);
    expect(guard().canActivate(ctx(undefined))).toBe(true);
  });
});
