import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { HiringCandidatesService } from './hiring-candidates.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('HiringCandidatesService', () => {
  let service: HiringCandidatesService;
  let prisma: {
    hiringCandidate: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
    file: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  const admin = { id: 'admin-1', role: 'SCHOOL_ADMIN' };
  const superAdmin = { id: 'sa', role: 'SUPER_ADMIN' };

  beforeEach(async () => {
    prisma = {
      hiringCandidate: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      file: { findUnique: jest.fn() },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'admin-1', schoolId: 's1', campusId: null }),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        HiringCandidatesService,
        { provide: PrismaService, useValue: prisma },
        OrgScopeService,
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

    const result = await service.create(
      {
        name: 'Bilal Hussain',
        contactPhone: '0333-4445566',
      },
      admin,
    );

    expect(result.candidate.id).toBe('c-new');
    expect(result.possibleDuplicate?.id).toBe('c-old');
  });

  it('rejects a resumeFileId that was never uploaded', async () => {
    prisma.file.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: 'Bilal Hussain',
          contactPhone: '0333-4445566',
          resumeFileId: 'missing',
        },
        admin,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('finds candidates by contact phone, most recent first', async () => {
    prisma.hiringCandidate.findMany.mockResolvedValue([]);

    await service.findByPhone('0333-4445566', superAdmin);

    expect(prisma.hiringCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contactPhone: '0333-4445566' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  // KG-16: candidates have no school of their own; a school admin sees only candidates who applied
  // to their school/campus (CNIC and date of birth are PII).
  it('a school admin finds only candidates with an application in their school', async () => {
    prisma.hiringCandidate.findMany.mockResolvedValue([]);
    await service.findByPhone('0333-4445566', admin);
    expect(prisma.hiringCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          contactPhone: '0333-4445566',
          OR: [
            { schoolId: 's1' },
            { applications: { some: { campus: { schoolId: 's1' } } } },
          ],
        },
      }),
    );
  });

  it('the possible-duplicate hint never reveals another school’s candidate', async () => {
    prisma.hiringCandidate.findFirst.mockResolvedValue(null);
    prisma.hiringCandidate.create.mockResolvedValue({
      id: 'c-new',
      name: 'A',
      dateOfBirth: null,
      cnic: null,
      contactPhone: '1',
      contactEmail: null,
      resumeFileId: null,
    });
    await service.create({ name: 'A', contactPhone: '1' }, admin);
    expect(prisma.hiringCandidate.findFirst).toHaveBeenCalledWith({
      where: {
        name: 'A',
        contactPhone: '1',
        OR: [
          { schoolId: 's1' },
          { applications: { some: { campus: { schoolId: 's1' } } } },
        ],
      },
    });
  });

  it('refuses a résumé uploaded by someone else', async () => {
    prisma.file.findUnique.mockResolvedValue({
      id: 'f1',
      uploadedById: 'other',
    });
    await expect(
      service.create(
        { name: 'A', contactPhone: '1', resumeFileId: 'f1' },
        admin,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
