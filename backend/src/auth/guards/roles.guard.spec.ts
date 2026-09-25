import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { GRANT_KEY } from '../decorators/requires-grant.decorator';

function makeContext(
  role: string | undefined,
  requiredRoles: string[] | undefined,
  requiredGrant?: string,
  grants: string[] = [],
) {
  const reflector = {
    getAllAndOverride: jest.fn((key: string) =>
      key === ROLES_KEY
        ? requiredRoles
        : key === GRANT_KEY
          ? requiredGrant
          : undefined,
    ),
  } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({
        user: role ? { id: 'u1', role, grants } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
  return { reflector, context };
}

describe('RolesGuard', () => {
  it('allows the request when no @Roles metadata is set on the route (public within auth)', () => {
    const { reflector, context } = makeContext('PARENT', undefined);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when the user role is in the required list', () => {
    const { reflector, context } = makeContext('TEACHER', [
      'TEACHER',
      'SCHOOL_ADMIN',
    ]);
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies a PARENT-role token calling an admin-only route (403, not a hidden button)', () => {
    const { reflector, context } = makeContext('PARENT', [
      'SCHOOL_ADMIN',
      'SUPER_ADMIN',
    ]);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow();
  });

  it('denies a request with no authenticated user at all when roles are required', () => {
    const { reflector, context } = makeContext(undefined, ['TEACHER']);
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(context)).toThrow();
  });

  describe('module grants (BL-32)', () => {
    const roles = ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];

    it('denies ACCOUNTS without the grant the route requires', () => {
      const { reflector, context } = makeContext(
        'ACCOUNTS',
        roles,
        'ADMISSIONS',
        ['COMPLAINTS'],
      );
      expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(
        /no access to this module/,
      );
    });

    it('allows ACCOUNTS holding the grant', () => {
      const { reflector, context } = makeContext(
        'ACCOUNTS',
        roles,
        'ADMISSIONS',
        ['ADMISSIONS'],
      );
      expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
    });

    it('never restricts other roles by grant', () => {
      for (const role of ['SCHOOL_ADMIN', 'SUPER_ADMIN']) {
        const { reflector, context } = makeContext(role, roles, 'ADMISSIONS');
        expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
      }
      const { reflector, context } = makeContext(
        'PARENT',
        undefined,
        'MESSAGES',
      );
      expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
    });

    it('applies on routes without @Roles too (e.g. conversations)', () => {
      const { reflector, context } = makeContext(
        'ACCOUNTS',
        undefined,
        'MESSAGES',
      );
      expect(() => new RolesGuard(reflector).canActivate(context)).toThrow();
    });
  });
});
