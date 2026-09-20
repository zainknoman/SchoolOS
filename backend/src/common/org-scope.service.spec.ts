import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrgScopeService } from './org-scope.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrgScopeService', () => {
  let service: OrgScopeService;
  let prisma: {
    user: { findUnique: jest.Mock };
    campus: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      campus: { findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(OrgScopeService);
  });

  it('is unrestricted for SUPER_ADMIN and never queries the user', async () => {
    const scope = await service.resolve({ id: 'u1', role: 'SUPER_ADMIN' });
    expect(scope.unrestricted).toBe(true);
    expect(scope.denied).toBe(false);
    expect(scope.campusWhere).toBeUndefined();
    expect(scope.allows({ campusId: 'c1', schoolId: 's9' })).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed for a non-super user with no schoolId', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      schoolId: null,
      campusId: null,
    });
    const scope = await service.resolve({ id: 'u1', role: 'SCHOOL_ADMIN' });
    expect(scope.denied).toBe(true);
    expect(scope.allows({ campusId: 'c1', schoolId: 's1' })).toBe(false);
  });

  it('scopes a school-wide admin to { schoolId } and allows any campus of that school', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      schoolId: 's1',
      campusId: null,
    });
    const scope = await service.resolve({ id: 'u1', role: 'SCHOOL_ADMIN' });
    expect(scope.campusWhere).toEqual({ schoolId: 's1' });
    expect(scope.allows({ campusId: 'cX', schoolId: 's1' })).toBe(true);
    expect(scope.allows({ campusId: 'cX', schoolId: 's2' })).toBe(false);
  });

  it('scopes a campus principal to their own campus only', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      schoolId: 's1',
      campusId: 'c1',
    });
    const scope = await service.resolve({ id: 'u1', role: 'SCHOOL_ADMIN' });
    expect(scope.campusWhere).toEqual({ id: 'c1', schoolId: 's1' });
    expect(scope.allows({ campusId: 'c1', schoolId: 's1' })).toBe(true);
    expect(scope.allows({ campusId: 'c2', schoolId: 's1' })).toBe(false);
  });

  it('assertCampusAccess throws Forbidden for a campus outside the scope and for a missing campus', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      schoolId: 's1',
      campusId: 'c1',
    });
    prisma.campus.findUnique.mockResolvedValue({ id: 'c2', schoolId: 's1' });
    await expect(
      service.assertCampusAccess({ id: 'u1', role: 'SCHOOL_ADMIN' }, 'c2'),
    ).rejects.toThrow(ForbiddenException);
    prisma.campus.findUnique.mockResolvedValue(null);
    await expect(
      service.assertCampusAccess({ id: 'u1', role: 'SCHOOL_ADMIN' }, 'nope'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('assertCampusAccess passes for SUPER_ADMIN without a lookup', async () => {
    await expect(
      service.assertCampusAccess({ id: 'u1', role: 'SUPER_ADMIN' }, 'c9'),
    ).resolves.toBeUndefined();
    expect(prisma.campus.findUnique).not.toHaveBeenCalled();
  });
});
