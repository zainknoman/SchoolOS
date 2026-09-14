import { Test } from '@nestjs/testing';
import { TeachersService } from './teachers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TeachersService', () => {
  let service: TeachersService;
  let prisma: { teacher: { findMany: jest.Mock }; user: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { teacher: { findMany: jest.fn() }, user: { findUnique: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [TeachersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TeachersService);
  });

  it('lists every teacher ordered by name for a SUPER_ADMIN', async () => {
    prisma.teacher.findMany.mockResolvedValue([{ id: 't-1', name: 'Ms. Sample Teacher' }]);

    const result = await service.listAll({ id: 'super-1', role: 'SUPER_ADMIN' });

    expect(prisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined, orderBy: { name: 'asc' } }),
    );
    expect(result).toEqual([{ id: 't-1', name: 'Ms. Sample Teacher' }]);
  });

  it("scopes a SCHOOL_ADMIN's teacher list to their own school", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: 'school-1' });
    prisma.teacher.findMany.mockResolvedValue([{ id: 't-1', name: 'Ms. Sample Teacher' }]);

    const result = await service.listAll({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(prisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campus: { schoolId: 'school-1' } } }),
    );
    expect(result).toEqual([{ id: 't-1', name: 'Ms. Sample Teacher' }]);
  });

  it('fails closed (returns an empty list) for a SCHOOL_ADMIN with no schoolId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: null });

    const result = await service.listAll({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(result).toEqual([]);
    expect(prisma.teacher.findMany).not.toHaveBeenCalled();
  });
});
