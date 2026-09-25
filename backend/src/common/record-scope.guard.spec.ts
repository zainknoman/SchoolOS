import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RecordScopeGuard } from './record-scope.guard';
import { OrgScopeService } from './org-scope.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('RecordScopeGuard', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    student: { findUnique: jest.fn() },
    staff: { findUnique: jest.fn() },
    teacher: { findUnique: jest.fn() },
  };
  const reflector = { getAllAndOverride: jest.fn() } as unknown as Reflector;
  const guard = new RecordScopeGuard(
    reflector,
    prisma as unknown as PrismaService,
    new OrgScopeService(prisma as unknown as PrismaService),
  );
  const ctx = (params: Record<string, string>, user: object | undefined) =>
    ({
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ params, user }) }),
    }) as unknown as ExecutionContext;
  const admin = { id: 'a', role: 'SCHOOL_ADMIN' };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'a',
      schoolId: 's1',
      campusId: null,
    });
  });

  it('passes routes without the metadata or without the parameter', async () => {
    await expect(guard.canActivate(ctx({ id: 'x' }, admin))).resolves.toBe(
      true,
    );
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      kind: 'student',
      param: 'studentId',
    });
    await expect(guard.canActivate(ctx({}, admin))).resolves.toBe(true);
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });

  it('allows a student enrolled (now or before) in the caller’s school; refuses another school', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      kind: 'student',
      param: 'studentId',
    });
    prisma.student.findUnique.mockResolvedValueOnce({
      enrollments: [
        { campusId: 'c9', campus: { schoolId: 's9' } },
        { campusId: 'c1', campus: { schoolId: 's1' } },
      ],
    });
    await expect(
      guard.canActivate(ctx({ studentId: 'st' }, admin)),
    ).resolves.toBe(true);
    prisma.student.findUnique.mockResolvedValueOnce({
      enrollments: [{ campusId: 'c9', campus: { schoolId: 's9' } }],
    });
    await expect(
      guard.canActivate(ctx({ studentId: 'st' }, admin)),
    ).rejects.toThrow(ForbiddenException);
  });

  it('a missing record passes (the service answers 404); a super admin is never checked', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      kind: 'teacher',
      param: 'id',
    });
    prisma.teacher.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(ctx({ id: 't' }, admin))).resolves.toBe(
      true,
    );
    await expect(
      guard.canActivate(ctx({ id: 't' }, { id: 's', role: 'SUPER_ADMIN' })),
    ).resolves.toBe(true);
  });

  it('a campus principal is confined to their campus for staff', async () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue({
      kind: 'staff',
      param: 'staffId',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'p',
      schoolId: 's1',
      campusId: 'c1',
    });
    prisma.staff.findUnique.mockResolvedValue({
      campusId: 'c2',
      campus: { schoolId: 's1' },
    });
    await expect(
      guard.canActivate(ctx({ staffId: 'x' }, admin)),
    ).rejects.toThrow(ForbiddenException);
  });
});
