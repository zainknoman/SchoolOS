import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('StaffService — update / remove', () => {
  let service: StaffService;
  let prisma: {
    staff: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const staffRow = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    name: 'Nazir',
    employeeType: 'JANITORIAL',
    employmentStatus: 'ACTIVE',
    teacherId: null,
    userId: null,
    campus: { name: 'PECHS', schoolId: 'school-1' },
    ...over,
  });
  const superAdmin = { id: 'u0', role: 'SUPER_ADMIN' } as const;
  const schoolAdmin = { id: 'u1', role: 'SCHOOL_ADMIN' } as const;

  beforeEach(async () => {
    prisma = {
      staff: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({ schoolId: 'school-1' }),
      },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
        OrgScopeService,
      ],
    }).compile();
    service = moduleRef.get(StaffService);
  });

  it('404s for an unknown staff member', async () => {
    prisma.staff.findUnique.mockResolvedValue(null);
    await expect(
      service.update('nope', { name: 'X' }, superAdmin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a school admin editing staff from another school', async () => {
    prisma.staff.findUnique.mockResolvedValue(
      staffRow({ campus: { name: 'X', schoolId: 'school-2' } }),
    );
    await expect(
      service.update('s1', { name: 'X' }, schoolAdmin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.archive('s1', schoolAdmin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.staff.update).not.toHaveBeenCalled();
    expect(prisma.staff.delete).not.toHaveBeenCalled();
  });

  it('refuses a campus principal editing staff of another campus in the same school', async () => {
    prisma.user.findUnique.mockResolvedValue({
      schoolId: 'school-1',
      campusId: 'c1',
    });
    prisma.staff.findUnique.mockResolvedValue(staffRow({ campusId: 'c2' }));
    await expect(
      service.update('s1', { name: 'X' }, schoolAdmin),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.staff.update).not.toHaveBeenCalled();
  });

  it('updates only the supplied quick-edit fields and audits it', async () => {
    prisma.staff.findUnique.mockResolvedValue(staffRow());
    prisma.staff.update.mockResolvedValue(
      staffRow({ name: 'Nazir Ahmed', employmentStatus: 'ON_LEAVE' }),
    );
    const result = await service.update(
      's1',
      { name: ' Nazir Ahmed ', employmentStatus: 'ON_LEAVE' },
      schoolAdmin,
    );
    expect(prisma.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 's1' },
        data: { name: 'Nazir Ahmed', employmentStatus: 'ON_LEAVE' },
      }),
    );
    expect(result).toMatchObject({
      name: 'Nazir Ahmed',
      employmentStatus: 'ON_LEAVE',
      campusName: 'PECHS',
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  describe('BL-07 archive / erase', () => {
    let tx: Record<string, Record<string, jest.Mock>>;
    beforeEach(() => {
      tx = {
        staff: { update: jest.fn(), delete: jest.fn() },
        teacher: {
          update: jest.fn().mockResolvedValue({ userId: 'u9' }),
          delete: jest.fn().mockResolvedValue({ userId: 'u9' }),
        },
        section: { updateMany: jest.fn() },
        timetable: { updateMany: jest.fn() },
        user: { update: jest.fn(), delete: jest.fn() },
        refreshToken: { updateMany: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      (prisma as unknown as Record<string, unknown>).$transaction = jest.fn(
        (cb: (t: unknown) => unknown) => cb(tx),
      );
    });

    it('archives a staff member with a teacher login: teacher off every slot, login disabled, nothing deleted', async () => {
      prisma.staff.findUnique.mockResolvedValue(
        staffRow({ teacherId: 't1', userId: null, archivedAt: null }),
      );
      await service.archive('s1', superAdmin, 'Resigned');
      expect(tx.staff.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: expect.objectContaining({ archiveReason: 'Resigned' }),
      });
      expect(tx.section.updateMany).toHaveBeenCalledWith({
        where: { classTeacherId: 't1' },
        data: { classTeacherId: null },
      });
      expect(tx.timetable.updateMany).toHaveBeenCalledWith({
        where: { teacherId: 't1' },
        data: { teacherId: null },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: 'u9' },
        data: { isLocked: true, tokenVersion: { increment: 1 } },
      });
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'staff.archive' }),
      });
      expect(prisma.staff.delete).not.toHaveBeenCalled();
      expect(tx.staff.delete).not.toHaveBeenCalled();
    });

    it('refuses to archive twice, and to erase a record that is not archived', async () => {
      prisma.staff.findUnique.mockResolvedValue(
        staffRow({ archivedAt: new Date() }),
      );
      await expect(service.archive('s1', superAdmin)).rejects.toBeInstanceOf(
        ConflictException,
      );
      prisma.staff.findUnique.mockResolvedValue(staffRow({ archivedAt: null }));
      await expect(service.erase('s1', superAdmin)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('erases an archived staff member with their teacher and login, audited', async () => {
      prisma.staff.findUnique.mockResolvedValue(
        staffRow({ teacherId: 't1', archivedAt: new Date() }),
      );
      await service.erase('s1', superAdmin);
      expect(tx.staff.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
      expect(tx.teacher.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
      expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u9' } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'staff.erase' }),
      });
    });
  });
});
