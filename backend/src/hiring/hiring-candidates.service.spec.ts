import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { HiringCandidatesService } from './hiring-candidates.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HiringCandidatesService', () => {
  let service: HiringCandidatesService;
  let prisma: {
    hiringCandidate: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    file: { findUnique: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      hiringCandidate: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      file: { findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        HiringCandidatesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(HiringCandidatesService);
  });

  it('creates a candidate and flags a possible duplicate by name+phone', async () => {
    prisma.hiringCandidate.findFirst.mockResolvedValue({
      id: 'c-old',
      name: 'Bilal Hussain',
      dateOfBirth: null,
      cnic: null,
      contactPhone: '0333-4445566',
      contactEmail: null,
      resumeFileId: null,
    });
    prisma.hiringCandidate.create.mockResolvedValue({
      id: 'c-new',
      name: 'Bilal Hussain',
      dateOfBirth: null,
      cnic: null,
      contactPhone: '0333-4445566',
      contactEmail: null,
      resumeFileId: null,
    });

    const result = await service.create({
      name: 'Bilal Hussain',
      contactPhone: '0333-4445566',
    });

    expect(result.candidate.id).toBe('c-new');
    expect(result.possibleDuplicate?.id).toBe('c-old');
  });

  it('rejects a resumeFileId that was never uploaded', async () => {
    prisma.file.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'Bilal Hussain',
        contactPhone: '0333-4445566',
        resumeFileId: 'missing',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('finds candidates by contact phone, most recent first', async () => {
    prisma.hiringCandidate.findMany.mockResolvedValue([]);

    await service.findByPhone('0333-4445566');

    expect(prisma.hiringCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contactPhone: '0333-4445566' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});
