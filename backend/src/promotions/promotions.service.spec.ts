import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  PromotionsService,
  type PromotionDecisionInput,
} from './promotions.service';
import { OrgScopeService } from '../common/org-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_PROMOTION_POLICY,
  PromotionIndicatorsService,
  evaluateIndicators,
  type StudentIndicators,
} from './promotion-indicators';

const clean: StudentIndicators = evaluateIndicators(
  {
    attendance: { present: 9, late: 0, absent: 1, leave: 0 },
    results: { obtained: 80, max: 100, assessments: 2 },
    fees: { outstanding: 0, unpaidVouchers: 0 },
  },
  DEFAULT_PROMOTION_POLICY,
);
const feesDueBlocked: StudentIndicators = evaluateIndicators(
  {
    attendance: { present: 9, late: 0, absent: 1, leave: 0 },
    results: { obtained: 80, max: 100, assessments: 2 },
    fees: { outstanding: 5000, unpaidVouchers: 1 },
  },
  { ...DEFAULT_PROMOTION_POLICY, blockOnFees: true },
);

describe('PromotionsService', () => {
  let service: PromotionsService;
  let indicators: { policyFor: jest.Mock; forStudents: jest.Mock };
  let prisma: {
    enrollment: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
    };
    section: { findUnique: jest.Mock };
    academicSession: { findUnique: jest.Mock };
    student: { update: jest.Mock };
    studentPromotion: { create: jest.Mock; findMany: jest.Mock };
    user: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      enrollment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      section: { findUnique: jest.fn() },
      academicSession: { findUnique: jest.fn() },
      student: { update: jest.fn() },
      studentPromotion: { create: jest.fn(), findMany: jest.fn() },
      user: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    indicators = {
      policyFor: jest.fn().mockResolvedValue(DEFAULT_PROMOTION_POLICY),
      forStudents: jest.fn((_session: string, ids: string[]) =>
        Promise.resolve(new Map(ids.map((id) => [id, clean]))),
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PromotionsService,
        OrgScopeService,
        { provide: PrismaService, useValue: prisma },
        { provide: PromotionIndicatorsService, useValue: indicators },
      ],
    }).compile();
    service = moduleRef.get(PromotionsService);
  });

  describe('preview', () => {
    it('BL-05: lists every ACTIVE-enrolled student with indicators and no pre-selected decision', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
      });
      prisma.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        class: {
          academicSessionId: 'session-2025',
          campus: { schoolId: 'school-1' },
        },
      });
      prisma.enrollment.findMany.mockResolvedValue([
        {
          studentId: 'stu-1',
          rollNumber: '12',
          student: { name: 'Ali Ahmed', grNumber: 'GR-1001' },
        },
      ]);

      const result = await service.preview(
        { id: 'admin-1', role: 'SCHOOL_ADMIN' },
        'sec-1',
      );

      expect(result).toEqual({
        schoolId: 'school-1',
        sourceAcademicSessionId: 'session-2025',
        policy: DEFAULT_PROMOTION_POLICY,
        rows: [
          {
            studentId: 'stu-1',
            name: 'Ali Ahmed',
            grNumber: 'GR-1001',
            currentRollNumber: '12',
            indicators: clean,
          },
        ],
      });
      expect(result.rows[0]).not.toHaveProperty('suggestedDecision');
      expect(indicators.policyFor).toHaveBeenCalledWith('school-1');
      expect(indicators.forStudents).toHaveBeenCalledWith(
        'session-2025',
        ['stu-1'],
        DEFAULT_PROMOTION_POLICY,
      );
      expect(prisma.enrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sectionId: 'sec-1', status: 'ACTIVE' },
        }),
      );
    });

    it('rejects a SCHOOL_ADMIN previewing a section outside their own school', async () => {
      prisma.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        class: { campus: { schoolId: 'other-school' } },
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
      });

      await expect(
        service.preview({ id: 'admin-1', role: 'SCHOOL_ADMIN' }, 'sec-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a SUPER_ADMIN previewing a nonexistent section', async () => {
      prisma.section.findUnique.mockResolvedValue(null);

      await expect(
        service.preview(
          { id: 'super-1', role: 'SUPER_ADMIN' },
          'nonexistent-sec',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('execute', () => {
    const baseDto = {
      sourceAcademicSessionId: 'session-2025',
      targetAcademicSessionId: 'session-2026',
      confirmed: true,
      decisions: [
        {
          studentId: 'stu-1',
          decision: 'PROMOTED' as const,
          targetSectionId: 'sec-target',
          rollNumber: '5',
        },
      ],
    };

    it('BL-53: a concurrent promotion that hits the one-ACTIVE-enrolment index becomes a 409', async () => {
      prisma.enrollment.findFirst.mockResolvedValue({
        id: 'enr-old',
        studentId: 'stu-1',
        academicSessionId: 'session-2025',
        status: 'ACTIVE',
        section: { class: { campus: { schoolId: 'school-1' } } },
      });
      prisma.section.findUnique.mockResolvedValue({
        id: 'sec-target',
        class: {
          academicSessionId: 'session-2026',
          campusId: 'campus-1',
          campus: { schoolId: 'school-1' },
        },
      });
      prisma.academicSession.findUnique.mockResolvedValue({
        id: 'session-2026',
        startDate: new Date('2026-04-01'),
      });
      prisma.enrollment.update.mockResolvedValue({});
      prisma.enrollment.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(
        service.execute({ id: 'admin-1', role: 'SUPER_ADMIN' }, baseDto),
      ).rejects.toThrow(ConflictException);
    });

    it('closes the old enrollment as COMPLETED and creates a new ACTIVE enrollment for a PROMOTED decision', async () => {
      prisma.enrollment.findFirst.mockResolvedValue({
        id: 'enr-old',
        studentId: 'stu-1',
        academicSessionId: 'session-2025',
        status: 'ACTIVE',
        section: { class: { campus: { schoolId: 'school-1' } } },
      });
      prisma.section.findUnique.mockResolvedValue({
        id: 'sec-target',
        classId: 'class-target',
        class: {
          academicSessionId: 'session-2026',
          campusId: 'campus-1',
          campus: { schoolId: 'school-1' },
        },
      });
      prisma.academicSession.findUnique.mockResolvedValue({
        id: 'session-2026',
        startDate: new Date('2026-04-01'),
      });
      prisma.enrollment.update.mockResolvedValue({});
      prisma.enrollment.create.mockResolvedValue({ id: 'enr-new' });
      prisma.studentPromotion.create.mockResolvedValue({ id: 'promo-1' });

      const result = await service.execute(
        { id: 'admin-1', role: 'SUPER_ADMIN' },
        baseDto,
      );

      expect(result).toEqual({ processed: 1 });
      expect(prisma.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'enr-old' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
      expect(prisma.enrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 'stu-1',
            sectionId: 'sec-target',
            campusId: 'campus-1',
            academicSessionId: 'session-2026',
            status: 'ACTIVE',
            rollNumber: '5',
          }),
        }),
      );
      expect(prisma.studentPromotion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            studentId: 'stu-1',
            fromEnrollmentId: 'enr-old',
            toEnrollmentId: 'enr-new',
            decision: 'PROMOTED',
            decidedById: 'admin-1',
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'promotion.execute',
            entityId: 'stu-1',
          }),
        }),
      );
    });

    it('rejects the whole batch, writing nothing, when a student is not ACTIVE in the source session', async () => {
      prisma.enrollment.findFirst.mockResolvedValue({
        id: 'enr-old',
        studentId: 'stu-1',
        academicSessionId: 'session-2024', // wrong session — stale preview
        status: 'ACTIVE',
        section: { class: { campus: { schoolId: 'school-1' } } },
      });
      prisma.academicSession.findUnique.mockResolvedValue({
        id: 'session-2026',
        startDate: new Date('2026-04-01'),
      });

      await expect(
        service.execute({ id: 'admin-1', role: 'SUPER_ADMIN' }, baseDto),
      ).rejects.toThrow(
        'Student stu-1 has no ACTIVE enrollment in the source academic session',
      );
      expect(prisma.enrollment.update).not.toHaveBeenCalled();
      expect(prisma.enrollment.create).not.toHaveBeenCalled();
      expect(prisma.studentPromotion.create).not.toHaveBeenCalled();
    });

    it('rejects a PROMOTED decision missing targetSectionId', async () => {
      prisma.enrollment.findFirst.mockResolvedValue({
        id: 'enr-old',
        studentId: 'stu-1',
        academicSessionId: 'session-2025',
        status: 'ACTIVE',
        section: { class: { campus: { schoolId: 'school-1' } } },
      });
      const dto = {
        ...baseDto,
        decisions: [{ studentId: 'stu-1', decision: 'PROMOTED' as const }],
      };

      await expect(
        service.execute({ id: 'admin-1', role: 'SUPER_ADMIN' }, dto),
      ).rejects.toThrow('targetSectionId is required for decision PROMOTED');
    });

    it('closes the enrollment as WITHDRAWN and sets Student.status without creating a new enrollment', async () => {
      prisma.enrollment.findFirst.mockResolvedValue({
        id: 'enr-old',
        studentId: 'stu-2',
        academicSessionId: 'session-2025',
        status: 'ACTIVE',
        section: { class: { campus: { schoolId: 'school-1' } } },
      });
      prisma.academicSession.findUnique.mockResolvedValue({
        id: 'session-2026',
        startDate: new Date('2026-04-01'),
      });
      prisma.enrollment.update.mockResolvedValue({});
      prisma.studentPromotion.create.mockResolvedValue({ id: 'promo-2' });

      const dto = {
        ...baseDto,
        decisions: [
          {
            studentId: 'stu-2',
            decision: 'WITHDRAWN' as const,
            remarks: 'Family relocated',
          },
        ],
      };
      await service.execute({ id: 'admin-1', role: 'SUPER_ADMIN' }, dto);

      expect(prisma.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'WITHDRAWN' }),
        }),
      );
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'stu-2' },
          data: expect.objectContaining({
            status: 'WITHDRAWN',
            leavingReason: 'Family relocated',
          }),
        }),
      );
      expect(prisma.enrollment.create).not.toHaveBeenCalled();
    });

    it('BL-61: a TRANSFERRED decision sets Student.status TRANSFERRED (never LEFT)', async () => {
      prisma.enrollment.findFirst.mockResolvedValue({
        id: 'enr-old',
        studentId: 'stu-3',
        academicSessionId: 'session-2025',
        status: 'ACTIVE',
        section: { class: { campus: { schoolId: 'school-1' } } },
      });
      prisma.academicSession.findUnique.mockResolvedValue({
        id: 'session-2026',
        startDate: new Date('2026-04-01'),
      });
      prisma.enrollment.update.mockResolvedValue({});
      prisma.studentPromotion.create.mockResolvedValue({ id: 'promo-3' });

      await service.execute(
        { id: 'admin-1', role: 'SUPER_ADMIN' },
        {
          ...baseDto,
          decisions: [{ studentId: 'stu-3', decision: 'TRANSFERRED' as const }],
        },
      );

      expect(prisma.enrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'TRANSFERRED' }),
        }),
      );
      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'TRANSFERRED' }),
        }),
      );
    });
  });

  describe('execute — BL-05 confirmation, conditions, blocking', () => {
    const dto = (
      decision: Omit<PromotionDecisionInput, 'studentId'>,
      confirmed = true,
    ) => ({
      sourceAcademicSessionId: 'session-2025',
      targetAcademicSessionId: 'session-2026',
      confirmed,
      decisions: [{ studentId: 'stu-1', ...decision }],
    });
    const admin = { id: 'admin-1', role: 'SUPER_ADMIN' as const };

    beforeEach(() => {
      prisma.enrollment.findFirst.mockResolvedValue({
        id: 'enr-old',
        studentId: 'stu-1',
        academicSessionId: 'session-2025',
        status: 'ACTIVE',
        section: {
          class: { campusId: 'c-1', campus: { schoolId: 'school-1' } },
        },
      });
      prisma.section.findUnique.mockResolvedValue({
        id: 'sec-target',
        class: {
          academicSessionId: 'session-2026',
          campusId: 'c-1',
          campus: { schoolId: 'school-1' },
        },
      });
      prisma.academicSession.findUnique.mockResolvedValue({
        id: 'session-2026',
        startDate: new Date('2026-04-01'),
      });
      prisma.enrollment.update.mockResolvedValue({});
      prisma.enrollment.create.mockResolvedValue({ id: 'enr-new' });
      prisma.studentPromotion.create.mockResolvedValue({ id: 'p-1' });
    });

    it('refuses an unconfirmed batch and writes nothing', async () => {
      await expect(
        service.execute(
          admin,
          dto({ decision: 'PROMOTED', targetSectionId: 'sec-target' }, false),
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('requires conditions for PROMOTED_WITH_CONDITIONS and refuses them elsewhere', async () => {
      await expect(
        service.execute(
          admin,
          dto({
            decision: 'PROMOTED_WITH_CONDITIONS',
            targetSectionId: 'sec-target',
            conditions: '  ',
          }),
        ),
      ).rejects.toThrow(/conditions are required/);
      await expect(
        service.execute(
          admin,
          dto({
            decision: 'RETAINED',
            targetSectionId: 'sec-target',
            conditions: 'x',
          }),
        ),
      ).rejects.toThrow(/only recorded for PROMOTED_WITH_CONDITIONS/);
    });

    it('stores the conditions and the indicator snapshot with the decision', async () => {
      await service.execute(
        admin,
        dto({
          decision: 'PROMOTED_WITH_CONDITIONS',
          targetSectionId: 'sec-target',
          conditions: ' Clear fees by May ',
        }),
      );
      expect(prisma.studentPromotion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          decision: 'PROMOTED_WITH_CONDITIONS',
          conditions: 'Clear fees by May',
          indicators: clean,
        }),
      });
    });

    it('a school block stops a plain PROMOTED (409) but not PROMOTED_WITH_CONDITIONS or RETAINED', async () => {
      indicators.forStudents.mockResolvedValue(
        new Map([['stu-1', feesDueBlocked]]),
      );
      await expect(
        service.execute(
          admin,
          dto({ decision: 'PROMOTED', targetSectionId: 'sec-target' }),
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.enrollment.update).not.toHaveBeenCalled();

      await service.execute(
        admin,
        dto({
          decision: 'PROMOTED_WITH_CONDITIONS',
          targetSectionId: 'sec-target',
          conditions: 'Pay the dues',
        }),
      );
      await service.execute(
        admin,
        dto({ decision: 'RETAINED', targetSectionId: 'sec-target' }),
      );
      expect(prisma.studentPromotion.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('promotion policy', () => {
    beforeEach(() => {
      (prisma as unknown as Record<string, unknown>).school = {
        findUnique: jest.fn().mockResolvedValue({ id: 'school-1' }),
      };
      (prisma as unknown as Record<string, unknown>).promotionPolicy = {
        upsert: jest.fn().mockReturnValue('upsert'),
      };
      prisma.auditLog.create.mockReturnValue('audit');
      prisma.$transaction.mockImplementation((arg: unknown) =>
        Array.isArray(arg)
          ? Promise.resolve(arg)
          : (arg as (tx: unknown) => unknown)(prisma),
      );
    });
    const values = {
      minAttendancePercent: 80,
      minResultPercent: 50,
      blockOnAttendance: false,
      blockOnResults: true,
      blockOnFees: false,
    };

    it('a school admin reads and writes their own school; the change is audited', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
        campusId: null,
      });
      const out = await service.updatePolicy(
        { id: 'admin-1', role: 'SCHOOL_ADMIN' },
        values,
      );
      expect(out).toEqual({ schoolId: 'school-1', ...values });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'promotion-policy.update',
          entityId: 'school-1',
        }),
      });
    });

    it('another school, a campus principal writing, and a super admin without schoolId are refused', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
        campusId: null,
      });
      await expect(
        service.updatePolicy(
          { id: 'admin-1', role: 'SCHOOL_ADMIN' },
          { ...values, schoolId: 'school-2' },
        ),
      ).rejects.toThrow(ForbiddenException);
      prisma.user.findUnique.mockResolvedValue({
        id: 'p-1',
        schoolId: 'school-1',
        campusId: 'c-1',
      });
      await expect(
        service.updatePolicy({ id: 'p-1', role: 'SCHOOL_ADMIN' }, values),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.getPolicy({ id: 'p-1', role: 'SCHOOL_ADMIN' }),
      ).resolves.toEqual(expect.objectContaining({ schoolId: 'school-1' }));
      await expect(
        service.getPolicy({ id: 's-1', role: 'SUPER_ADMIN' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPromotionHistory', () => {
    it('returns promotions newest first with resolved section/class/session labels', async () => {
      prisma.studentPromotion.findMany.mockResolvedValue([
        {
          id: 'promo-1',
          decision: 'PROMOTED',
          decidedAt: new Date('2026-04-01'),
          remarks: null,
          fromEnrollment: {
            section: {
              name: '3A',
              class: {
                name: 'Grade 3',
                academicSession: { label: '2025-2026' },
              },
            },
          },
          toEnrollment: {
            section: {
              name: '4B',
              class: {
                name: 'Grade 4',
                academicSession: { label: '2026-2027' },
              },
            },
          },
        },
      ]);

      const result = await service.getPromotionHistory('stu-1');

      expect(result).toEqual([
        {
          id: 'promo-1',
          decision: 'PROMOTED',
          decidedAt: new Date('2026-04-01'),
          remarks: null,
          from: {
            sectionName: '3A',
            className: 'Grade 3',
            sessionLabel: '2025-2026',
          },
          to: {
            sectionName: '4B',
            className: 'Grade 4',
            sessionLabel: '2026-2027',
          },
        },
      ]);
      expect(prisma.studentPromotion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { studentId: 'stu-1' },
          orderBy: { decidedAt: 'desc' },
        }),
      );
    });
  });
});
