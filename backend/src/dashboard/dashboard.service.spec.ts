import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    enrollment: { count: jest.Mock };
    attendance: { findMany: jest.Mock; groupBy: jest.Mock };
    feePayment: { aggregate: jest.Mock; findMany: jest.Mock };
    feeVoucher: { findMany: jest.Mock };
    feeItem: { groupBy: jest.Mock };
    feePaymentAllocation: { groupBy: jest.Mock };
    $queryRaw: jest.Mock;
    notification: { findMany: jest.Mock };
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    application: { count: jest.Mock };
    leaveRequest: { count: jest.Mock };
    studentDocument: { count: jest.Mock };
    school: { findMany: jest.Mock };
    staff: { count: jest.Mock };
    section: { findMany: jest.Mock };
    assessmentCategory: { findMany: jest.Mock; findFirst: jest.Mock };
    mark: { findMany: jest.Mock };
  };
  const superAdmin = { id: 'super-1', role: 'SUPER_ADMIN' };
  /** Today's attendance comes from a groupBy on status; the week's from one on date+status. */
  const givenTodayCounts = (counts: Record<string, number>) =>
    prisma.attendance.groupBy.mockImplementation(({ by }: { by: string[] }) =>
      Promise.resolve(
        by.length === 1
          ? Object.entries(counts).map(([status, n]) => ({
              status,
              _count: { _all: n },
            }))
          : [],
      ),
    );
  const sums = (rows: [string, number][]) =>
    rows.map(([feeVoucherId, amount]) => ({
      feeVoucherId,
      _sum: { amount },
    }));

  beforeEach(async () => {
    prisma = {
      enrollment: { count: jest.fn().mockResolvedValue(0) },
      attendance: {
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      feePayment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      feeVoucher: { findMany: jest.fn().mockResolvedValue([]) },
      feeItem: { groupBy: jest.fn().mockResolvedValue([]) },
      feePaymentAllocation: { groupBy: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      notification: { findMany: jest.fn().mockResolvedValue([]) },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      application: { count: jest.fn().mockResolvedValue(0) },
      leaveRequest: { count: jest.fn().mockResolvedValue(0) },
      studentDocument: { count: jest.fn().mockResolvedValue(0) },
      school: { findMany: jest.fn().mockResolvedValue([]) },
      staff: { count: jest.fn().mockResolvedValue(0) },
      section: { findMany: jest.fn().mockResolvedValue([]) },
      assessmentCategory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      mark: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        OrgScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(DashboardService);
  });

  it('counts studentsTotal from active enrollments in the currently active academic session', async () => {
    prisma.enrollment.count.mockResolvedValue(42);

    const result = await service.getSummary(superAdmin);

    expect(result.studentsTotal).toBe(42);
    expect(prisma.enrollment.count).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', academicSession: { isActive: true } },
    });
  });

  it('computes presentTodayPercent excluding HOLIDAY from the denominator, and absentToday as a raw count', async () => {
    givenTodayCounts({ PRESENT: 3, ABSENT: 1, HOLIDAY: 1 });

    const result = await service.getSummary(superAdmin);

    // 3 present out of 4 countable (3 present + 1 absent; HOLIDAY excluded) = 75%
    expect(result.presentTodayPercent).toBe(75);
    expect(result.absentToday).toBe(1);
  });

  it('presentTodayPercent is 0 when nothing is countable today', async () => {
    givenTodayCounts({ HOLIDAY: 1 });

    const result = await service.getSummary(superAdmin);

    expect(result.presentTodayPercent).toBe(0);
  });

  it('feesCollectedPkr defaults to 0 when there are no completed payments this month', async () => {
    const result = await service.getSummary(superAdmin);

    expect(result.feesCollectedPkr).toBe(0);
  });

  it('feesCollectedPkr converts the summed paisa total to PKR', async () => {
    prisma.feePayment.aggregate.mockResolvedValue({ _sum: { amount: 500000 } });

    const result = await service.getSummary(superAdmin);

    expect(result.feesCollectedPkr).toBe(5000);
  });

  it('feesOutstandingPkr sums only vouchers whose amountDue is greater than 0', async () => {
    prisma.feeItem.groupBy.mockResolvedValue(
      sums([
        ['v1', 500000], // fully paid, due = 0, excluded
        ['v2', 300000], // due = 200000 paisa = 2000 PKR
        ['v3', 100000], // over-paid, due < 0, excluded
      ]),
    );
    prisma.feePaymentAllocation.groupBy.mockResolvedValue(
      sums([
        ['v1', 500000],
        ['v2', 100000],
        ['v3', 150000],
      ]),
    );

    const result = await service.getSummary(superAdmin);

    expect(result.feesOutstandingPkr).toBe(2000);
  });

  it('weeklyTrend returns exactly 7 points, ending with today', async () => {
    const result = await service.getSummary(superAdmin);

    expect(result.weeklyTrend).toHaveLength(7);
    const todayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][
      new Date().getUTCDay()
    ];
    expect(result.weeklyTrend[6].day).toBe(todayLabel);
  });

  it('weeklyTrend buckets one attendance groupBy and one payment read into days', async () => {
    const today = new Date();
    const day = (offset: number) => {
      const d = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        ),
      );
      d.setUTCDate(d.getUTCDate() - offset);
      return d;
    };
    prisma.attendance.groupBy.mockImplementation(({ by }: { by: string[] }) =>
      Promise.resolve(
        by.length === 2
          ? [
              { date: day(1), status: 'PRESENT', _count: { _all: 3 } },
              { date: day(1), status: 'ABSENT', _count: { _all: 1 } },
              { date: day(0), status: 'PRESENT', _count: { _all: 1 } },
            ]
          : [],
      ),
    );
    prisma.feePayment.findMany.mockResolvedValue([
      { amount: 150000, createdAt: new Date(day(1).getTime() + 3_600_000) },
      { amount: 50000, createdAt: new Date(day(1).getTime() + 7_200_000) },
    ]);

    const result = await service.getSummary(superAdmin);

    expect(result.weeklyTrend[5]).toEqual(
      expect.objectContaining({
        attendancePercent: 75,
        feesCollectedPkr: 2000,
      }),
    );
    expect(result.weeklyTrend[6]).toEqual(
      expect.objectContaining({ attendancePercent: 100, feesCollectedPkr: 0 }),
    );
    expect(result.weeklyTrend[0].attendancePercent).toBe(0);
  });

  // BL-15: the summary used to fire ~20 queries at once (the week was 14 of them, outstanding
  // fees loaded every voucher, alerts passed every school user id) and took the whole connection
  // pool under load. The query count no longer grows with days, vouchers or users.
  it('uses a fixed number of queries', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      schoolId: 'school-1',
    });

    await service.getSummary({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(prisma.attendance.groupBy).toHaveBeenCalledTimes(2); // today + the week
    expect(prisma.attendance.findMany).not.toHaveBeenCalled();
    expect(prisma.feePayment.aggregate).toHaveBeenCalledTimes(1); // this month
    expect(prisma.feePayment.findMany).toHaveBeenCalledTimes(1); // the week
    expect(prisma.feeVoucher.findMany).not.toHaveBeenCalled();
    expect(prisma.feeItem.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.feePaymentAllocation.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1); // recent alerts
  });

  it('recentAlerts maps the 5 most recent notifications to message/createdAt', async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        title: 'New circular published',
        createdAt: new Date('2026-09-04T10:00:00.000Z'),
      },
    ]);

    const result = await service.getSummary(superAdmin);

    expect(result.recentAlerts).toEqual([
      {
        id: 'n1',
        message: 'New circular published',
        createdAt: '2026-09-04T10:00:00.000Z',
      },
    ]);
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' }, take: 5 }),
    );
  });

  describe('school scoping', () => {
    it("scopes every sub-query to a SCHOOL_ADMIN's own school", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
      });
      await service.getSummary({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

      expect(prisma.enrollment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ campus: { schoolId: 'school-1' } }),
        }),
      );
      expect(prisma.attendance.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: {
              enrollments: { some: { campus: { schoolId: 'school-1' } } },
            },
          }),
        }),
      );
      expect(prisma.feePayment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            allocations: {
              some: {
                feeVoucher: {
                  student: {
                    enrollments: { some: { campus: { schoolId: 'school-1' } } },
                  },
                },
              },
            },
          }),
        }),
      );
      const voucherScope = {
        feeVoucher: {
          student: {
            enrollments: { some: { campus: { schoolId: 'school-1' } } },
          },
        },
      };
      expect(prisma.feeItem.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: voucherScope }),
      );
      expect(prisma.feePaymentAllocation.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: voucherScope }),
      );
      // Alerts join Notification to User in SQL, scoped by the school id.
      expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual([
        'school-1',
        null,
        null,
      ]);
      expect(prisma.notification.findMany).not.toHaveBeenCalled();
    });

    it("confines a campus principal's queries to their own campus", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'p1',
        schoolId: 's1',
        campusId: 'c1',
        isPrincipal: true,
      });
      await service.getSummary({ id: 'p1', role: 'SCHOOL_ADMIN' });

      expect(prisma.enrollment.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            campus: { id: 'c1', schoolId: 's1' },
          }),
        }),
      );
      expect(prisma.attendance.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            student: {
              enrollments: { some: { campus: { id: 'c1', schoolId: 's1' } } },
            },
          }),
        }),
      );
      expect(prisma.$queryRaw.mock.calls[0].slice(1)).toEqual([
        's1',
        'c1',
        'c1',
      ]);
    });

    it('returns a zeroed-out summary without querying anything else for a SCHOOL_ADMIN with no schoolId', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: null,
      });

      const result = await service.getSummary({
        id: 'admin-1',
        role: 'SCHOOL_ADMIN',
      });

      expect(result).toEqual({
        studentsTotal: 0,
        presentTodayPercent: 0,
        absentToday: 0,
        feesCollectedPkr: 0,
        feesOutstandingPkr: 0,
        weeklyTrend: [],
        recentAlerts: [],
      });
      expect(prisma.enrollment.count).not.toHaveBeenCalled();
      expect(prisma.attendance.groupBy).not.toHaveBeenCalled();
      expect(prisma.feePayment.aggregate).not.toHaveBeenCalled();
      expect(prisma.feeItem.groupBy).not.toHaveBeenCalled();
      expect(prisma.notification.findMany).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('getOperationsSummary', () => {
    const schoolAdmin = { id: 'admin-1', role: 'SCHOOL_ADMIN' };

    it('counts admissions pending, fee defaulters (distinct students), and pending leave/documents, scoped by school', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
      });
      prisma.application.count.mockResolvedValue(14);
      prisma.feeVoucher.findMany.mockResolvedValue([
        { studentId: 's1', items: [{ amount: 100 }], allocations: [] }, // due, defaulter
        { studentId: 's1', items: [{ amount: 200 }], allocations: [] }, // same student, second overdue voucher
        {
          studentId: 's2',
          items: [{ amount: 100 }],
          allocations: [{ amount: 100 }],
        }, // fully paid
      ]);
      prisma.leaveRequest.count.mockResolvedValue(5);
      prisma.studentDocument.count.mockResolvedValue(31);

      const result = await service.getOperationsSummary(schoolAdmin);

      expect(result.admissionsPending).toBe(14);
      expect(result.feeDefaulters).toBe(1); // s1 counted once despite two overdue vouchers
      expect(result.leaveRequestsPending).toBe(5);
      expect(result.documentsToVerify).toBe(31);
      expect(prisma.application.count).toHaveBeenCalledWith({
        where: {
          status: 'SUBMITTED',
          desiredClass: { campus: { schoolId: 'school-1' } },
        },
      });
      expect(prisma.leaveRequest.count).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          student: {
            enrollments: { some: { campus: { schoolId: 'school-1' } } },
          },
        },
      });
      expect(prisma.studentDocument.count).toHaveBeenCalledWith({
        where: {
          verificationStatus: 'PENDING',
          student: {
            enrollments: { some: { campus: { schoolId: 'school-1' } } },
          },
        },
      });
    });

    it('returns zeros without querying anything for a SCHOOL_ADMIN with no schoolId', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: null,
      });

      const result = await service.getOperationsSummary(schoolAdmin);

      expect(result).toEqual({
        admissionsPending: 0,
        feeDefaulters: 0,
        leaveRequestsPending: 0,
        documentsToVerify: 0,
        recentActivity: [],
      });
      expect(prisma.application.count).not.toHaveBeenCalled();
    });
  });

  describe('getNetworkOverview', () => {
    it('aggregates per-school campus/student counts and fee-collection percent, network-wide', async () => {
      prisma.school.findMany.mockResolvedValue([
        {
          id: 'school-1',
          name: 'Riverdale',
          status: 'ACTIVE',
          campuses: [{ id: 'c1' }, { id: 'c2' }],
        },
      ]);
      prisma.enrollment.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(120); // totalStudents, then per-school
      prisma.staff.count.mockResolvedValue(60);
      prisma.feePayment.aggregate.mockResolvedValue({
        _sum: { amount: 900000 },
      }); // 9000 PKR collected
      prisma.feeItem.groupBy.mockResolvedValue(sums([['v1', 300000]]));
      prisma.feePaymentAllocation.groupBy.mockResolvedValue(
        sums([['v1', 200000]]),
      ); // 1000 PKR due

      const result = await service.getNetworkOverview();

      expect(result.totalSchools).toBe(1);
      expect(result.totalStudents).toBe(500);
      expect(result.totalStaff).toBe(60);
      expect(result.schools).toEqual([
        {
          id: 'school-1',
          name: 'Riverdale',
          status: 'ACTIVE',
          campusesCount: 2,
          studentsCount: 120,
          feeCollectionPercent: 90, // 9000 / (9000 + 1000) = 90%
        },
      ]);
      expect(prisma.staff.count).toHaveBeenCalledWith({
        where: { employmentStatus: 'ACTIVE' },
      });
    });
  });

  describe('getPrincipalAcademicsSummary', () => {
    it('rejects a SCHOOL_ADMIN who is not flagged isPrincipal', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
        isPrincipal: false,
      });

      await expect(
        service.getPrincipalAcademicsSummary({
          id: 'admin-1',
          role: 'SCHOOL_ADMIN',
        }),
      ).rejects.toThrow('only available to a school Principal');
    });

    it("derives exam-schedule status from whether a category's assessments exist yet", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
        isPrincipal: true,
      });
      prisma.section.findMany.mockResolvedValue([]);
      prisma.assessmentCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1',
          name: 'Mid-term',
          class: { name: 'Grade 9' },
          term: { label: 'Term 1' },
          assessments: [{ id: 'a1' }],
        },
        {
          id: 'cat-2',
          name: 'Mid-term',
          class: { name: 'Grade 6' },
          term: { label: 'Term 1' },
          assessments: [],
        },
      ]);

      const result = await service.getPrincipalAcademicsSummary({
        id: 'admin-1',
        role: 'SCHOOL_ADMIN',
      });

      expect(result.examScheduleStatus).toEqual([
        {
          categoryId: 'cat-1',
          categoryName: 'Mid-term',
          className: 'Grade 9',
          termLabel: 'Term 1',
          status: 'ready',
        },
        {
          categoryId: 'cat-2',
          categoryName: 'Mid-term',
          className: 'Grade 6',
          termLabel: 'Term 1',
          status: 'pending',
        },
      ]);
    });

    it('computes per-section attendance% (HOLIDAY excluded) and average marks%', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
        isPrincipal: true,
      });
      prisma.section.findMany.mockResolvedValue([
        {
          id: 'sec-1',
          name: 'A',
          class: { id: 'class-1', name: '9' },
          classTeacher: { name: 'Ms. Iqbal' },
        },
      ]);
      prisma.attendance.findMany.mockResolvedValue([
        { status: 'PRESENT' },
        { status: 'ABSENT' },
        { status: 'HOLIDAY' },
      ]);
      prisma.assessmentCategory.findFirst.mockResolvedValue({ id: 'cat-1' });
      prisma.mark.findMany.mockResolvedValue([
        { obtainedMarks: 45, assessment: { maxMarks: 50 } }, // 90%
        { obtainedMarks: 30, assessment: { maxMarks: 50 } }, // 60%
      ]);

      const result = await service.getPrincipalAcademicsSummary({
        id: 'admin-1',
        role: 'SCHOOL_ADMIN',
      });

      expect(result.classHealth).toEqual([
        {
          sectionId: 'sec-1',
          className: '9',
          sectionName: 'A',
          teacherName: 'Ms. Iqbal',
          attendancePercent: 50, // 1 present of 2 countable, HOLIDAY excluded
          averageMarksPercent: 75, // average of 90% and 60%
        },
      ]);
    });
  });
});
