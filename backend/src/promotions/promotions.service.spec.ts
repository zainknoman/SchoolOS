import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { OrgScopeService } from '../common/org-scope.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PromotionsService', () => {
  let service: PromotionsService;
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
    const moduleRef = await Test.createTestingModule({
      providers: [
        PromotionsService,
        OrgScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(PromotionsService);
  });

  describe('preview', () => {
    it('lists every ACTIVE-enrolled student in the source section with a default PROMOTED suggestion', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
      });
      prisma.section.findUnique.mockResolvedValue({
        id: 'sec-1',
        class: { campus: { schoolId: 'school-1' } },
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

      expect(result).toEqual([
        {
          studentId: 'stu-1',
          name: 'Ali Ahmed',
          grNumber: 'GR-1001',
          currentRollNumber: '12',
          suggestedDecision: 'PROMOTED',
        },
      ]);
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
      decisions: [
        {
          studentId: 'stu-1',
          decision: 'PROMOTED' as const,
          targetSectionId: 'sec-target',
          rollNumber: '5',
        },
      ],
    };

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
