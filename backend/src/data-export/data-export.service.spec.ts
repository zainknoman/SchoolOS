import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataExportService } from './data-export.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { OrgScopeService } from '../common/org-scope.service';

describe('DataExportService (BL-41)', () => {
  const prisma = {
    school: { findUnique: jest.fn() },
    campus: { findUnique: jest.fn() },
    academicSession: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    student: { findMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const orgScope = { resolve: jest.fn() };
  const service = new DataExportService(
    prisma as unknown as PrismaService,
    orgScope as unknown as OrgScopeService,
  );
  const admin = { id: 'u1', role: 'SCHOOL_ADMIN' };
  const superAdmin = { id: 'su', role: 'SUPER_ADMIN' };

  beforeEach(() => {
    jest.resetAllMocks();
    orgScope.resolve.mockResolvedValue({
      denied: false,
      schoolId: 'school-a',
      campusId: null,
    });
    prisma.student.findMany.mockResolvedValue([]);
    prisma.auditLog.create.mockResolvedValue({});
  });

  it('SUPER_ADMIN must name a school, and it must exist', async () => {
    await expect(service.export('students', {}, superAdmin)).rejects.toThrow(
      BadRequestException,
    );
    prisma.school.findUnique.mockResolvedValue(null);
    await expect(
      service.export('students', { schoolId: 'nope' }, superAdmin),
    ).rejects.toThrow(NotFoundException);
  });

  it('a school admin cannot name another school, and an account without a school is refused', async () => {
    await expect(
      service.export('students', { schoolId: 'school-b' }, admin),
    ).rejects.toThrow(ForbiddenException);
    orgScope.resolve.mockResolvedValue({
      denied: true,
      schoolId: null,
      campusId: null,
    });
    await expect(service.export('students', {}, admin)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('a campus-level admin cannot widen to another campus', async () => {
    orgScope.resolve.mockResolvedValue({
      denied: false,
      schoolId: 'school-a',
      campusId: 'campus-1',
    });
    await expect(
      service.export('students', { campusId: 'campus-2' }, admin),
    ).rejects.toThrow(ForbiddenException);
  });

  it('sensitive fields need the principal; the request is refused before any data is read', async () => {
    prisma.user.findUnique.mockResolvedValue({ isPrincipal: false });
    await expect(
      service.export('students', { includeSensitive: true }, admin),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.student.findMany).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('every export is audited with its scope and row count', async () => {
    const result = await service.export('students', {}, admin, '10.0.0.1');
    expect(result.rowCount).toBe(0);
    expect(result.filename).toMatch(/^students-\d{4}-\d{2}-\d{2}\.csv$/);
    const [[{ data }]] = prisma.auditLog.create.mock.calls as [
      [{ data: { metadata: string } }],
    ];
    expect(data).toMatchObject({
      userId: 'u1',
      action: 'data-export.students',
      entity: 'School',
      entityId: 'school-a',
      ip: '10.0.0.1',
    });
    expect(JSON.parse(data.metadata)).toMatchObject({
      includeSensitive: false,
      rowCount: 0,
    });
  });

  it('fails closed if a sensitive column is in a non-sensitive column list', () => {
    const svc = service as unknown as {
      out: (c: unknown[], r: unknown[], s?: boolean) => unknown;
    };
    const cols = [{ header: 'cnic', value: () => 'x' }];
    expect(() => svc.out(cols, [])).toThrow(/sensitive/);
    expect(() => svc.out(cols, [], true)).not.toThrow();
  });
});
