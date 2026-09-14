import { Test } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: { staff: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { staff: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [StaffService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(StaffService);
  });

  it('lists staff ordered by name, with campus name included', async () => {
    prisma.staff.findMany.mockResolvedValue([
      { id: 's1', name: 'Nazir Ahmed', employeeType: 'JANITORIAL', employmentStatus: 'ACTIVE', campus: { name: 'PECHS Campus' } },
    ]);

    const result = await service.list();

    expect(result).toEqual([
      { id: 's1', name: 'Nazir Ahmed', employeeType: 'JANITORIAL', employmentStatus: 'ACTIVE', campusName: 'PECHS Campus' },
    ]);
    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { name: 'asc' } }),
    );
  });

  it('filters by employeeType when provided', async () => {
    prisma.staff.findMany.mockResolvedValue([]);

    await service.list('GUARD');

    expect(prisma.staff.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { employeeType: 'GUARD' } }),
    );
  });
});