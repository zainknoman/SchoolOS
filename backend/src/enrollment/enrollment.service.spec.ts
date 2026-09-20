import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let prisma: { enrollment: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { enrollment: { findFirst: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [
        EnrollmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(EnrollmentService);
  });

  it("returns the student's active enrollment", async () => {
    prisma.enrollment.findFirst.mockResolvedValue({
      id: 'enr-1',
      sectionId: 'sec-1',
    });

    const result = await service.getCurrentEnrollment('s1');

    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 's1', status: 'ACTIVE' } }),
    );
    expect(result).toEqual({ id: 'enr-1', sectionId: 'sec-1' });
  });

  it('throws NotFoundException when the student has no active enrollment', async () => {
    prisma.enrollment.findFirst.mockResolvedValue(null);

    await expect(service.getCurrentEnrollment('s1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('resolves the enrollment covering a given date, not the current one', async () => {
    prisma.enrollment.findFirst.mockResolvedValue({
      id: 'enr-old',
      sectionId: 'sec-old',
    });
    const date = new Date('2026-08-01T00:00:00.000Z');

    const result = await service.getEnrollmentForDate('s1', date);

    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId: 's1',
          startDate: { lte: date },
          OR: [{ endDate: null }, { endDate: { gte: date } }],
        },
      }),
    );
    expect(result).toEqual({ id: 'enr-old', sectionId: 'sec-old' });
  });

  it('throws NotFoundException when no enrollment covers the given date', async () => {
    prisma.enrollment.findFirst.mockResolvedValue(null);

    await expect(
      service.getEnrollmentForDate('s1', new Date('2020-01-01')),
    ).rejects.toThrow(NotFoundException);
  });

  it('widens the match to an overlap window when windowEnd is provided, for an enrollment that started after date but before windowEnd', async () => {
    prisma.enrollment.findFirst.mockResolvedValue({
      id: 'enr-mid-month',
      sectionId: 'sec-new',
    });
    const monthStart = new Date('2026-08-01T00:00:00.000Z');
    const monthEnd = new Date('2026-09-01T00:00:00.000Z');

    const result = await service.getEnrollmentForDate(
      's1',
      monthStart,
      monthEnd,
    );

    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId: 's1',
          startDate: { lt: monthEnd },
          OR: [{ endDate: null }, { endDate: { gte: monthStart } }],
        },
      }),
    );
    expect(result).toEqual({ id: 'enr-mid-month', sectionId: 'sec-new' });
  });
});
