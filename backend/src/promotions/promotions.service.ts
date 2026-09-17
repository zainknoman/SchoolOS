import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/student-access.service';
import type { PromotionDecision } from '@prisma/client';

export interface PromotionPreviewRow {
  studentId: string;
  name: string;
  grNumber: string;
  currentRollNumber: string | null;
  suggestedDecision: 'PROMOTED';
}

export interface PromotionDecisionInput {
  studentId: string;
  decision: PromotionDecision;
  targetSectionId?: string;
  rollNumber?: string;
  remarks?: string;
}

export interface ExecutePromotionDto {
  sourceAcademicSessionId: string;
  targetAcademicSessionId: string;
  decisions: PromotionDecisionInput[];
}

export interface PromotionHistoryRow {
  id: string;
  decision: PromotionDecision;
  decidedAt: Date;
  remarks: string | null;
  from: { sectionName: string; className: string; sessionLabel: string };
  to: { sectionName: string; className: string; sessionLabel: string } | null;
}

const CLOSED_STATUS: Record<
  PromotionDecision,
  'COMPLETED' | 'TRANSFERRED' | 'WITHDRAWN'
> = {
  PROMOTED: 'COMPLETED',
  RETAINED: 'COMPLETED',
  GRADUATED: 'COMPLETED',
  TRANSFERRED_OUT: 'TRANSFERRED',
  WITHDRAWN: 'WITHDRAWN',
};

const STUDENT_STATUS: Partial<
  Record<PromotionDecision, 'LEFT' | 'GRADUATED' | 'WITHDRAWN'>
> = {
  TRANSFERRED_OUT: 'LEFT',
  GRADUATED: 'GRADUATED',
  WITHDRAWN: 'WITHDRAWN',
};

const CREATES_NEW_ENROLLMENT: PromotionDecision[] = ['PROMOTED', 'RETAINED'];

const ENROLLMENT_LABEL_INCLUDE = {
  section: {
    select: {
      name: true,
      class: {
        select: { name: true, academicSession: { select: { label: true } } },
      },
    },
  },
} as const;

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertSectionInOwnSchool(
    actingUser: RequestUser,
    sectionId: string,
  ): Promise<void> {
    // Always check section exists first (for all roles)
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: { class: { select: { campus: { select: { schoolId: true } } } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    // Only check school ownership for non-SUPER_ADMIN users
    if (actingUser.role === 'SUPER_ADMIN') {
      return;
    }

    const admin = await this.prisma.user.findUnique({
      where: { id: actingUser.id },
    });
    if (!admin?.schoolId || section.class.campus.schoolId !== admin.schoolId) {
      throw new ForbiddenException(
        'Cannot access a section outside your own school',
      );
    }
  }

  async preview(
    actingUser: RequestUser,
    sourceSectionId: string,
  ): Promise<PromotionPreviewRow[]> {
    await this.assertSectionInOwnSchool(actingUser, sourceSectionId);
    const enrollments = await this.prisma.enrollment.findMany({
      where: { sectionId: sourceSectionId, status: 'ACTIVE' },
      include: { student: { select: { name: true, grNumber: true } } },
    });
    return enrollments.map((e) => ({
      studentId: e.studentId,
      name: e.student.name,
      grNumber: e.student.grNumber,
      currentRollNumber: e.rollNumber,
      suggestedDecision: 'PROMOTED' as const,
    }));
  }

  async execute(
    actingUser: RequestUser,
    dto: ExecutePromotionDto,
  ): Promise<{ processed: number }> {
    for (const item of dto.decisions) {
      if (
        CREATES_NEW_ENROLLMENT.includes(item.decision) &&
        !item.targetSectionId
      ) {
        throw new BadRequestException(
          `targetSectionId is required for decision ${item.decision}`,
        );
      }
      if (
        !CREATES_NEW_ENROLLMENT.includes(item.decision) &&
        item.targetSectionId
      ) {
        throw new BadRequestException(
          `targetSectionId must not be set for decision ${item.decision}`,
        );
      }
    }

    const targetSession = await this.prisma.academicSession.findUnique({
      where: { id: dto.targetAcademicSessionId },
    });
    if (!targetSession) {
      throw new NotFoundException('Target academic session not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const admin =
        actingUser.role !== 'SUPER_ADMIN'
          ? await tx.user.findUnique({ where: { id: actingUser.id } })
          : null;

      for (const item of dto.decisions) {
        const currentEnrollment = await tx.enrollment.findFirst({
          where: { studentId: item.studentId, status: 'ACTIVE' },
          include: {
            section: { include: { class: { include: { campus: true } } } },
          },
        });
        if (
          !currentEnrollment ||
          currentEnrollment.academicSessionId !== dto.sourceAcademicSessionId
        ) {
          throw new BadRequestException(
            `Student ${item.studentId} has no ACTIVE enrollment in the source academic session`,
          );
        }
        if (actingUser.role !== 'SUPER_ADMIN') {
          if (
            !admin?.schoolId ||
            currentEnrollment.section.class.campus.schoolId !== admin.schoolId
          ) {
            throw new ForbiddenException(
              `Cannot promote student ${item.studentId} outside your own school`,
            );
          }
        }

        await tx.enrollment.update({
          where: { id: currentEnrollment.id },
          data: { status: CLOSED_STATUS[item.decision], endDate: new Date() },
        });

        let newEnrollmentId: string | undefined;
        if (CREATES_NEW_ENROLLMENT.includes(item.decision)) {
          const targetSection = await tx.section.findUnique({
            where: { id: item.targetSectionId },
            include: { class: { include: { campus: true } } },
          });
          if (
            !targetSection ||
            targetSection.class.academicSessionId !==
              dto.targetAcademicSessionId
          ) {
            throw new BadRequestException(
              `targetSectionId ${item.targetSectionId} does not belong to the target academic session`,
            );
          }
          if (actingUser.role !== 'SUPER_ADMIN') {
            if (
              !admin?.schoolId ||
              targetSection.class.campus.schoolId !== admin.schoolId
            ) {
              throw new ForbiddenException(
                `Cannot promote student ${item.studentId} outside your own school`,
              );
            }
          }
          const created = await tx.enrollment.create({
            data: {
              studentId: item.studentId,
              campusId: targetSection.class.campusId,
              sectionId: targetSection.id,
              academicSessionId: dto.targetAcademicSessionId,
              startDate: targetSession.startDate,
              status: 'ACTIVE',
              rollNumber: item.rollNumber,
            },
          });
          newEnrollmentId = created.id;
        }

        const studentStatus = STUDENT_STATUS[item.decision];
        if (studentStatus) {
          await tx.student.update({
            where: { id: item.studentId },
            data: {
              status: studentStatus,
              leavingDate: new Date(),
              leavingReason: item.remarks,
            },
          });
        }

        await tx.studentPromotion.create({
          data: {
            studentId: item.studentId,
            fromEnrollmentId: currentEnrollment.id,
            toEnrollmentId: newEnrollmentId,
            decision: item.decision,
            remarks: item.remarks,
            decidedById: actingUser.id,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: actingUser.id,
            action: 'promotion.execute',
            entity: 'Student',
            entityId: item.studentId,
            metadata: JSON.stringify({
              decision: item.decision,
              targetSectionId: item.targetSectionId,
            }),
          },
        });
      }
      return { processed: dto.decisions.length };
    });
  }

  async getPromotionHistory(studentId: string): Promise<PromotionHistoryRow[]> {
    const rows = await this.prisma.studentPromotion.findMany({
      where: { studentId },
      orderBy: { decidedAt: 'desc' },
      include: {
        fromEnrollment: { include: ENROLLMENT_LABEL_INCLUDE },
        toEnrollment: { include: ENROLLMENT_LABEL_INCLUDE },
      },
    });
    const label = (e: {
      section: {
        name: string;
        class: { name: string; academicSession: { label: string } };
      };
    }) => ({
      sectionName: e.section.name,
      className: e.section.class.name,
      sessionLabel: e.section.class.academicSession.label,
    });
    return rows.map((r) => ({
      id: r.id,
      decision: r.decision,
      decidedAt: r.decidedAt,
      remarks: r.remarks,
      from: label(r.fromEnrollment),
      to: r.toEnrollment ? label(r.toEnrollment) : null,
    }));
  }
}
