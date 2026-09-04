import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    enrollment: { count: jest.Mock };
    attendance: { findMany: jest.Mock };
    feePayment: { aggregate: jest.Mock };
    feeVoucher: { findMany: jest.Mock };
    notification: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      enrollment: { count: jest.fn().mockResolvedValue(0) },
      attendance: { findMany: jest.fn().mockResolvedValue([]) },
      feePayment: { aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }) },
      feeVoucher: { findMany: jest.fn().mockResolvedValue([]) },
      notification: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [DashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(DashboardService);
  });

  it('counts studentsTotal from active enrollments in the currently active academic session', async () => {
    prisma.enrollment.count.mockResolvedValue(42);

    const result = await service.getSummary();

    expect(result.studentsTotal).toBe(42);
    expect(prisma.enrollment.count).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', academicSession: { isActive: true } },
    });
  });

  it('computes presentTodayPercent excluding HOLIDAY from the denominator, and absentToday as a raw count', async () => {
    prisma.attendance.findMany.mockResolvedValue([
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'PRESENT' },
      { status: 'ABSENT' },
      { status: 'HOLIDAY' },
    ]);

    const result = await service.getSummary();

    // 3 present out of 4 countable (3 present + 1 absent; HOLIDAY excluded) = 75%
    expect(result.presentTodayPercent).toBe(75);
    expect(result.absentToday).toBe(1);
  });

  it('presentTodayPercent is 0 when nothing is countable today', async () => {
    prisma.attendance.findMany.mockResolvedValue([{ status: 'HOLIDAY' }]);

    const result = await service.getSummary();

    expect(result.presentTodayPercent).toBe(0);
  });

  it('feesCollectedPkr defaults to 0 when there are no completed payments this month', async () => {
    const result = await service.getSummary();

    expect(result.feesCollectedPkr).toBe(0);
  });

  it('feesCollectedPkr converts the summed paisa total to PKR', async () => {
    prisma.feePayment.aggregate.mockResolvedValue({ _sum: { amount: 500000 } });

    const result = await service.getSummary();

    expect(result.feesCollectedPkr).toBe(5000);
  });

  it('feesOutstandingPkr sums only vouchers whose amountDue is greater than 0', async () => {
    prisma.feeVoucher.findMany.mockResolvedValue([
      { items: [{ amount: 500000 }], allocations: [{ amount: 500000 }] }, // fully paid, due = 0, excluded
      { items: [{ amount: 300000 }], allocations: [{ amount: 100000 }] }, // due = 200000 paisa = 2000 PKR
    ]);

    const result = await service.getSummary();

    expect(result.feesOutstandingPkr).toBe(2000);
  });

  it('weeklyTrend returns exactly 7 points, ending with today', async () => {
    const result = await service.getSummary();

    expect(result.weeklyTrend).toHaveLength(7);
    const todayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getUTCDay()];
    expect(result.weeklyTrend[6].day).toBe(todayLabel);
  });

  it('recentAlerts maps the 5 most recent notifications to message/createdAt', async () => {
    prisma.notification.findMany.mockResolvedValue([
      { id: 'n1', title: 'New circular published', createdAt: new Date('2026-09-04T10:00:00.000Z') },
    ]);

    const result = await service.getSummary();

    expect(result.recentAlerts).toEqual([
      { id: 'n1', message: 'New circular published', createdAt: '2026-09-04T10:00:00.000Z' },
    ]);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 5 }),
    );
  });
});
