import { Test } from '@nestjs/testing';
import { TeachersService } from './teachers.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TeachersService', () => {
  let service: TeachersService;
  let prisma: { teacher: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { teacher: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [TeachersService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TeachersService);
  });

  it('lists every teacher ordered by name', async () => {
    prisma.teacher.findMany.mockResolvedValue([{ id: 't-1', name: 'Ms. Sample Teacher' }]);

    const result = await service.listAll();

    expect(prisma.teacher.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
    expect(result).toEqual([{ id: 't-1', name: 'Ms. Sample Teacher' }]);
  });
});
