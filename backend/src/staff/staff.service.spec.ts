import { Test } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: {
    staff: { findMany: jest.Mock; create: jest.Mock };
    user: { findUnique: jest.Mock };
    teacher: { create: jest.Mock; findUniqueOrThrow: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      staff: { findMany: jest.fn(), create: jest.fn() },
      user: { findUnique: jest.fn() },
      teacher: { create: jest.fn(), findUniqueOrThrow: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [StaffService, { provide: PrismaService, useValue: prisma }, OrgScopeService],
    }).compile();
    service = moduleRef.get(StaffService);
  });

  it('lists every staff member for a SUPER_ADMIN, ordered by name with campus name included', async () => {
    prisma.staff.findMany.mockResolvedValue([
      { id: 's1', name: 'Nazir Ahmed', employeeType: 'JANITORIAL', employmentStatus: 'ACTIVE', campus: { name: 'PECHS Campus' } },
    ]);

    const result = await service.list({ id: 'super-1', role: 'SUPER_ADMIN' });

    expect(result).toEqual([
      { id: 's1', name: 'Nazir Ahmed', employeeType: 'JANITORIAL', employmentStatus: 'ACTIVE', campusName: 'PECHS Campus' },
    ]);
    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined, orderBy: { name: 'asc' } }),
    );
  });

  it('filters by employeeType when provided, for a SUPER_ADMIN', async () => {
    prisma.staff.findMany.mockResolvedValue([]);

    await service.list({ id: 'super-1', role: 'SUPER_ADMIN' }, 'GUARD');

    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeType: 'GUARD' } }),
    );
  });

  it("scopes a SCHOOL_ADMIN's staff list to their own school, combined with an employeeType filter", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: 'school-1' });
    prisma.staff.findMany.mockResolvedValue([]);

    await service.list({ id: 'admin-1', role: 'SCHOOL_ADMIN' }, 'GUARD');

    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeType: 'GUARD', campus: { schoolId: 'school-1' } } }),
    );
  });

  it('fails closed (returns an empty list) for a SCHOOL_ADMIN with no schoolId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: null });

    const result = await service.list({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(result).toEqual([]);
    expect(prisma.staff.findMany).not.toHaveBeenCalled();
  });

  describe('create', () => {
    it('creates a non-teacher staff member with no login/Teacher row', async () => {
      prisma.staff.create.mockResolvedValue({ id: 'st1', name: 'Nazir Ahmed' });

      const result = await service.create(
        { name: 'Nazir Ahmed', employeeType: 'JANITORIAL', campusId: 'cam1' },
        'admin-1',
      );

      expect(result).toEqual({ id: 'st1', name: 'Nazir Ahmed' });
      expect(prisma.teacher.create).not.toHaveBeenCalled();
      expect(prisma.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ teacherId: undefined, userId: undefined }) }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'staff.create', entityId: 'st1' }) }),
      );
    });

    it('rejects a TEACHER hire with no login', async () => {
      await expect(
        service.create({ name: 'Ayesha Khan', employeeType: 'TEACHER', campusId: 'cam1' }, 'admin-1'),
      ).rejects.toThrow('A login identifier/password is required for a Teacher.');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('creates a linked Teacher+User when employeeType is TEACHER with a login', async () => {
      prisma.teacher.create.mockResolvedValue({ id: 't1', userId: 'u1', name: 'Ayesha Khan' });
      prisma.teacher.findUniqueOrThrow.mockResolvedValue({ id: 't1', userId: 'u1' });
      prisma.staff.create.mockResolvedValue({ id: 'st1', name: 'Ayesha Khan' });
      (prisma as unknown as { user: { create: jest.Mock } }).user = { create: jest.fn().mockResolvedValue({ id: 'u1' }) };

      const result = await service.create(
        {
          name: 'Ayesha Khan',
          employeeType: 'TEACHER',
          campusId: 'cam1',
          login: { identifier: 'ayesha.khan', password: 'a-strong-password' },
        },
        'admin-1',
      );

      expect(result).toEqual({ id: 'st1', name: 'Ayesha Khan' });
      expect(prisma.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ teacherId: 't1', userId: 'u1' }) }),
      );
    });
  });
});