import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FeeStructuresService } from './fee-structures.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

/** BL-03: fee structures are per school and follow DRAFT -> ACTIVE -> LOCKED -> ARCHIVED. */
describe('FeeStructuresService', () => {
  let service: FeeStructuresService;
  let prisma: {
    feeStructure: Record<
      'create' | 'findMany' | 'findUnique' | 'update',
      jest.Mock
    >;
    feeItem: { count: jest.Mock };
    school: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  const accounts = { id: 'acc-1', role: 'ACCOUNTS' };
  const superAdmin = { id: 'super-1', role: 'SUPER_ADMIN' };
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'fs-1',
    name: 'Tuition',
    amount: 500000,
    schoolId: 'school-a',
    status: 'DRAFT',
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      feeStructure: {
        create: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Record<string, unknown> }) => ({
              id: 'fs-1',
              ...data,
            }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest
          .fn()
          .mockImplementation(
            ({ data }: { data: Record<string, unknown> }) => ({
              ...row(),
              ...data,
            }),
          ),
      },
      feeItem: { count: jest.fn().mockResolvedValue(0) },
      school: { findUnique: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'acc-1',
          schoolId: 'school-a',
          campusId: null,
        }),
      },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeeStructuresService,
        OrgScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(FeeStructuresService);
  });

  it("creates a DRAFT structure for the caller's school and audits it", async () => {
    const created = await service.create(
      { name: ' Tuition ', amount: 500000 },
      accounts,
    );
    expect(prisma.feeStructure.create).toHaveBeenCalledWith({
      data: {
        name: 'Tuition',
        amount: 500000,
        schoolId: 'school-a',
        status: 'DRAFT',
      },
    });
    expect(created.status).toBe('DRAFT');
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'fee-structure.create',
        entityId: 'fs-1',
      }),
    });
  });

  it('a super admin must name the school', async () => {
    await expect(
      service.create({ name: 'x', amount: 1 }, superAdmin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists the caller's school's non-archived structures (+ legacy)", async () => {
    await service.list(accounts);
    expect(prisma.feeStructure.findMany).toHaveBeenCalledWith({
      where: {
        status: { not: 'ARCHIVED' },
        OR: [{ schoolId: 'school-a' }, { schoolId: null }],
      },
      orderBy: { createdAt: 'desc' },
    });
    await service.list(accounts, { includeArchived: true });
    expect(prisma.feeStructure.findMany.mock.calls[1][0].where).toEqual({
      OR: [{ schoolId: 'school-a' }, { schoolId: null }],
    });
  });

  it('edits a draft, and an active one that was never invoiced', async () => {
    prisma.feeStructure.findUnique.mockResolvedValue(row());
    await service.update('fs-1', { amount: 450000 }, accounts);
    prisma.feeStructure.findUnique.mockResolvedValue(row({ status: 'ACTIVE' }));
    await service.update('fs-1', { name: 'Tuition 2027' }, accounts);
    expect(prisma.feeStructure.update).toHaveBeenCalledTimes(2);
  });

  it('refuses to edit a locked, archived or invoiced structure', async () => {
    prisma.feeStructure.findUnique.mockResolvedValue(row({ status: 'LOCKED' }));
    await expect(
      service.update('fs-1', { amount: 1 }, accounts),
    ).rejects.toThrow(/can no longer be edited/);
    prisma.feeStructure.findUnique.mockResolvedValue(row({ status: 'ACTIVE' }));
    prisma.feeItem.count.mockResolvedValue(2);
    await expect(
      service.update('fs-1', { amount: 1 }, accounts),
    ).rejects.toThrow(/can no longer be edited/);
    expect(prisma.feeStructure.update).not.toHaveBeenCalled();
  });

  it('moves through the lifecycle; a restored invoiced structure comes back LOCKED', async () => {
    prisma.feeStructure.findUnique.mockResolvedValue(row());
    await service.update('fs-1', { status: 'ACTIVE' }, accounts);
    expect(prisma.feeStructure.update.mock.calls[0][0].data).toEqual({
      status: 'ACTIVE',
    });

    prisma.feeStructure.findUnique.mockResolvedValue(row({ status: 'LOCKED' }));
    await service.update('fs-1', { status: 'ARCHIVED' }, accounts);
    expect(prisma.feeStructure.update.mock.calls[1][0].data).toEqual({
      status: 'ARCHIVED',
    });

    prisma.feeStructure.findUnique.mockResolvedValue(
      row({ status: 'ARCHIVED' }),
    );
    prisma.feeItem.count.mockResolvedValue(5);
    await service.update('fs-1', { status: 'ACTIVE' }, accounts);
    expect(prisma.feeStructure.update.mock.calls[2][0].data).toEqual({
      status: 'LOCKED',
    });

    prisma.feeStructure.findUnique.mockResolvedValue(row());
    await expect(
      service.update('fs-1', { status: 'LOCKED' }, accounts),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("cannot touch another school's structure", async () => {
    prisma.feeStructure.findUnique.mockResolvedValue(
      row({ schoolId: 'school-b' }),
    );
    await expect(
      service.update('fs-1', { status: 'ARCHIVED' }, accounts),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
