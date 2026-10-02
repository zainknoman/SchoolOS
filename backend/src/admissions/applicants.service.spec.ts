import { Test } from '@nestjs/testing';
import { ApplicantsService } from './applicants.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('ApplicantsService', () => {
  let service: ApplicantsService;
  const prisma = {
    applicant: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn() },
  };
  const admin = { id: 'admin-1', role: 'SCHOOL_ADMIN' };
  const ownSchool = {
    OR: [
      { schoolId: 's1' },
      {
        applications: {
          some: { desiredClass: { campus: { schoolId: 's1' } } },
        },
      },
    ],
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      schoolId: 's1',
      campusId: null,
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ApplicantsService,
        { provide: PrismaService, useValue: prisma },
        OrgScopeService,
      ],
    }).compile();
    service = moduleRef.get(ApplicantsService);
  });

  // KG-16: applicants have no school of their own; staff see only those who applied to their school.
  it('a school admin finds only applicants with an application to their school', async () => {
    prisma.applicant.findMany.mockResolvedValue([]);
    await service.findByPhone('0300-1', admin);
    expect(prisma.applicant.findMany).toHaveBeenCalledWith({
      where: { guardianPhone: '0300-1', ...ownSchool },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('a super admin searches every applicant', async () => {
    prisma.applicant.findMany.mockResolvedValue([]);
    await service.findByPhone('0300-1', { id: 'sa', role: 'SUPER_ADMIN' });
    expect(prisma.applicant.findMany).toHaveBeenCalledWith({
      where: { guardianPhone: '0300-1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('the possible-duplicate hint never reveals another school’s applicant', async () => {
    prisma.applicant.findFirst.mockResolvedValue(null);
    prisma.applicant.create.mockResolvedValue({
      id: 'a1',
      name: 'Child',
      dateOfBirth: new Date('2018-01-01'),
      guardianName: 'G',
      guardianPhone: '0300-1',
    });
    const result = await service.create(
      {
        name: 'Child',
        dateOfBirth: '2018-01-01',
        guardianName: 'G',
        guardianPhone: '0300-1',
      },
      admin,
    );
    expect(prisma.applicant.findFirst).toHaveBeenCalledWith({
      where: { name: 'Child', guardianPhone: '0300-1', ...ownSchool },
    });
    expect(result.possibleDuplicate).toBeNull();
    // The applicant belongs to the school that recorded it, so its own duplicate check finds it.
    expect(prisma.applicant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ schoolId: 's1' }),
    });
  });
});
