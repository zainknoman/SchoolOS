import { Test } from '@nestjs/testing';
import { FeeStructuresService } from './fee-structures.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FeeStructuresService', () => {
  let service: FeeStructuresService;
  let prisma: {
    feeStructure: { create: jest.Mock; findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      feeStructure: { create: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [FeeStructuresService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(FeeStructuresService);
  });

  it('creates a fee structure and writes an AuditLog row', async () => {
    prisma.feeStructure.create.mockResolvedValue({ id: 'fs-1', name: 'Tuition Fee', amount: 500000 });

    const result = await service.create({ name: 'Tuition Fee', amount: 500000 }, 'admin-1');

    expect(prisma.feeStructure.create).toHaveBeenCalledWith({
      data: { name: 'Tuition Fee', amount: 500000 },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'admin-1',
        action: 'fee-structure.create',
        entity: 'FeeStructure',
        entityId: 'fs-1',
      }),
    });
    expect(result).toEqual({ id: 'fs-1', name: 'Tuition Fee', amount: 500000 });
  });

  it('lists fee structures newest first', async () => {
    prisma.feeStructure.findMany.mockResolvedValue([{ id: 'fs-1', name: 'Tuition Fee', amount: 500000 }]);

    const result = await service.list();

    expect(prisma.feeStructure.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } });
    expect(result).toHaveLength(1);
  });
});
