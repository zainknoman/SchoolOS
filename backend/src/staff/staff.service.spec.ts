import { Test } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StaffService', () => {
  let service: StaffService;
  let prisma: { staff: { findMany: jest.Mock }; user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { staff: { findMany: jest.fn() }, user: { findUnique: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [StaffService, { provide: PrismaService, useValue: prisma }],
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
});