import { Test } from '@nestjs/testing';
import { SubjectsService } from './subjects.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SubjectsService', () => {
  let service: SubjectsService;
  let prisma: { subject: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { subject: { findMany: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubjectsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(SubjectsService);
  });

  it('lists every subject ordered by name', async () => {
    prisma.subject.findMany.mockResolvedValue([{ id: 'sub-1', name: 'Urdu' }]);

    const result = await service.listAll();

    expect(prisma.subject.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([{ id: 'sub-1', name: 'Urdu' }]);
  });
});
