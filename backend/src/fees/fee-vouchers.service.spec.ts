import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeeVouchersService } from './fee-vouchers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FeeVouchersService', () => {
  let service: FeeVouchersService;
  let prisma: {
    academicSession: { findFirst: jest.Mock };
    feeStructure: { findMany: jest.Mock; updateMany: jest.Mock };
    enrollment: { findMany: jest.Mock };
    school: { findMany: jest.Mock };
    feeVoucher: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
    };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      academicSession: { findFirst: jest.fn() },
      feeStructure: { findMany: jest.fn(), updateMany: jest.fn() },
      enrollment: { findMany: jest.fn() },
      // BL-01: the students' school decides the session.
      school: { findMany: jest.fn().mockResolvedValue([{ id: 'school-1' }]) },
      feeVoucher: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeeVouchersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(FeeVouchersService);
  });

  it('rejects issue() when neither or both of studentIds/sectionId are given', async () => {
    await expect(
      service.issue(
        { month: '2026-09', dueDate: '2026-09-10', feeStructureIds: ['fs-1'] },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.issue(
        {
          studentIds: ['s1'],
          sectionId: 'sec-1',
          month: '2026-09',
          dueDate: '2026-09-10',
          feeStructureIds: ['fs-1'],
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("rejects issue() when the students' school has no active academic session", async () => {
    prisma.academicSession.findFirst.mockResolvedValue(null);
    prisma.feeStructure.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        name: 'Tuition Fee',
        amount: 500000,
        status: 'ACTIVE',
        schoolId: 'school-1',
      },
    ]);

    await expect(
      service.issue(
        {
          studentIds: ['s1'],
          month: '2026-09',
          dueDate: '2026-09-10',
          feeStructureIds: ['fs-1'],
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("resolves sectionId into the section's active enrollments, issues one voucher per student, and rejects a duplicate month", async () => {
    prisma.academicSession.findFirst.mockResolvedValue({ id: 'session-1' });
    prisma.feeStructure.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        name: 'Tuition Fee',
        amount: 500000,
        status: 'ACTIVE',
        schoolId: 'school-1',
      },
    ]);
    prisma.enrollment.findMany.mockResolvedValue([
      { studentId: 's1' },
      { studentId: 's2' },
    ]);
    prisma.feeVoucher.findMany.mockResolvedValue([]); // no existing vouchers this month
    prisma.feeVoucher.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: `v-${data.studentId}`,
        studentId: data.studentId,
        month: data.month,
        dueDate: data.dueDate,
        items: [{ label: 'Tuition Fee', amount: 500000 }],
      }),
    );

    const result = await service.issue(
      {
        sectionId: 'sec-1',
        month: '2026-09',
        dueDate: '2026-09-10',
        feeStructureIds: ['fs-1'],
      },
      'admin-1',
    );

    expect(result).toHaveLength(2);
    expect(prisma.feeVoucher.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects issuing a voucher when one already exists for that student and month', async () => {
    prisma.academicSession.findFirst.mockResolvedValue({ id: 'session-1' });
    prisma.feeStructure.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        name: 'Tuition Fee',
        amount: 500000,
        status: 'ACTIVE',
        schoolId: 'school-1',
      },
    ]);
    prisma.feeVoucher.findMany.mockResolvedValue([{ studentId: 's1' }]);

    await expect(
      service.issue(
        {
          studentIds: ['s1'],
          month: '2026-09',
          dueDate: '2026-09-10',
          feeStructureIds: ['fs-1'],
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.feeVoucher.create).not.toHaveBeenCalled();
  });

  it('getForStudent computes amountDue and status from items minus allocations', async () => {
    prisma.feeVoucher.findMany.mockResolvedValue([
      {
        id: 'v1',
        studentId: 's1',
        month: '2026-09',
        dueDate: new Date('2026-09-10'),
        items: [{ label: 'Tuition Fee', amount: 500000 }],
        allocations: [{ amount: 200000 }],
      },
      {
        id: 'v2',
        studentId: 's1',
        month: '2026-08',
        dueDate: new Date('2020-01-01'), // long past — overdue
        items: [{ label: 'Tuition Fee', amount: 500000 }],
        allocations: [],
      },
    ]);

    const result = await service.getForStudent('s1');

    expect(result[0]).toEqual(
      expect.objectContaining({
        amountPaid: 200000,
        amountDue: 300000,
        status: 'partial',
      }),
    );
    expect(result[1]).toEqual(
      expect.objectContaining({
        amountPaid: 0,
        amountDue: 500000,
        status: 'overdue',
      }),
    );
  });

  it('a voucher due today is unpaid, not overdue (status flips the day AFTER the due date, not on it)', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    prisma.feeVoucher.findMany.mockResolvedValue([
      {
        id: 'v-today',
        studentId: 's1',
        month: '2026-09',
        dueDate: today,
        items: [{ label: 'Tuition Fee', amount: 500000 }],
        allocations: [],
      },
    ]);

    const result = await service.getForStudent('s1');

    expect(result[0]).toEqual(
      expect.objectContaining({
        amountPaid: 0,
        amountDue: 500000,
        status: 'unpaid',
      }),
    );
  });

  it('getById throws NotFoundException for a missing voucher', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
  });

  it('refuses to issue for students of two schools in one call (BL-01)', async () => {
    prisma.feeStructure.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        name: 'Tuition Fee',
        amount: 500000,
        status: 'ACTIVE',
        schoolId: 'school-1',
      },
    ]);
    prisma.school.findMany.mockResolvedValue([
      { id: 'school-1' },
      { id: 'school-2' },
    ]);
    await expect(
      service.issue(
        {
          studentIds: ['s1', 's9'],
          month: '2026-09',
          dueDate: '2026-09-10',
          feeStructureIds: ['fs-1'],
        },
        'admin-1',
      ),
    ).rejects.toThrow(/one school at a time/);
  });

  it("uses the active session of the students' school", async () => {
    prisma.feeStructure.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        name: 'Tuition Fee',
        amount: 500000,
        status: 'ACTIVE',
        schoolId: 'school-1',
      },
    ]);
    prisma.academicSession.findFirst.mockResolvedValue({ id: 'session-1' });
    prisma.feeVoucher.findMany.mockResolvedValue([{ studentId: 's1' }]);
    await expect(
      service.issue(
        {
          studentIds: ['s1'],
          month: '2026-09',
          dueDate: '2026-09-10',
          feeStructureIds: ['fs-1'],
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.academicSession.findFirst).toHaveBeenCalledWith({
      where: { isActive: true, schoolId: 'school-1' },
    });
  });

  it('refuses draft/archived structures and structures of another school (BL-03)', async () => {
    prisma.feeStructure.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        name: 'Draft Fee',
        amount: 1,
        status: 'DRAFT',
        schoolId: 'school-1',
      },
    ]);
    await expect(
      service.issue(
        {
          studentIds: ['s1'],
          month: '2026-09',
          dueDate: '2026-09-10',
          feeStructureIds: ['fs-1'],
        },
        'admin-1',
      ),
    ).rejects.toThrow(/not issuable/);
    prisma.feeStructure.findMany.mockResolvedValue([
      {
        id: 'fs-1',
        name: 'B Fee',
        amount: 1,
        status: 'ACTIVE',
        schoolId: 'school-2',
      },
    ]);
    await expect(
      service.issue(
        {
          studentIds: ['s1'],
          month: '2026-09',
          dueDate: '2026-09-10',
          feeStructureIds: ['fs-1'],
        },
        'admin-1',
      ),
    ).rejects.toThrow(/another school/);
  });
});
