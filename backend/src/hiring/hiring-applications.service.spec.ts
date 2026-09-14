import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HiringApplicationsService } from './hiring-applications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HiringApplicationsService', () => {
  let service: HiringApplicationsService;
  let prisma: {
    hiringApplication: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };

  const withCandidate = (overrides: Record<string, unknown> = {}) => ({
    id: 'app1', candidateId: 'c1', candidate: { name: 'Bilal Hussain' },
    employeeType: 'GUARD', campusId: 'cam1', status: 'SUBMITTED',
    decisionNotes: null, reviewedById: null, createdStaffId: null, createStaffId: null,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      hiringApplication: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [HiringApplicationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(HiringApplicationsService);
  });

  it('creates an application in SUBMITTED status', async () => {
    prisma.hiringApplication.create.mockResolvedValue(withCandidate());

    const result = await service.create({ candidateId: 'c1', employeeType: 'GUARD', campusId: 'cam1' });

    expect(result.status).toBe('SUBMITTED');
    expect(prisma.hiringApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUBMITTED' }) }),
    );
  });

  it('moves a SUBMITTED application to SHORTLISTED', async () => {
    prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate());
    prisma.hiringApplication.update.mockResolvedValue(withCandidate({ status: 'SHORTLISTED' }));

    const result = await service.updateStatus('app1', { status: 'SHORTLISTED' });

    expect(result.status).toBe('SHORTLISTED');
  });

  it('rejects changing status on an already-APPROVED application', async () => {
    prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate({ status: 'APPROVED' }));

    await expect(service.updateStatus('app1', { status: 'SHORTLISTED' })).rejects.toThrow(BadRequestException);
  });

  it('rejects an application with decision notes', async () => {
    prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate());
    prisma.hiringApplication.update.mockResolvedValue(withCandidate({ status: 'REJECTED', decisionNotes: 'Not a fit', reviewedById: 'admin-1' }));

    const result = await service.reject('app1', 'Not a fit', 'admin-1');

    expect(result.status).toBe('REJECTED');
    expect(result.reviewedById).toBe('admin-1');
  });

  it('throws NotFoundException for an unknown application id', async () => {
    prisma.hiringApplication.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  describe('approve', () => {
    it('rejects approving a TEACHER application with no login supplied', async () => {
        prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate({ employeeType: 'TEACHER' }));

        await expect(service.approve('app1', {}, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects approving an application that is already terminal', async () => {
        prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate({ status: 'REJECTED' }));

        await expect(service.approve('app1', {}, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('creates the Staff record and marks the application APPROVED on success', async () => {
        prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate());
        prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
            staff: { create: jest.fn().mockResolvedValue({ id: 'st1', name: 'Bilal Hussain' }) },
            hiringApplication: {
            update: jest.fn().mockResolvedValue(withCandidate({ status: 'APPROVED', createdStaffId: 'st1', reviewedById: 'admin-1' })),
            },
        }),
        );

        const result = await service.approve('app1', {}, 'admin-1');

        expect(result.status).toBe('APPROVED');
        expect(result.createdStaffId).toBe('st1');
    });
  });

});
