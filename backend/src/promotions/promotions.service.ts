import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rethrowUniqueAsConflict } from '../common/prisma-create-guard';
import type { RequestUser } from '../common/student-access.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { Prisma, PromotionDecision } from '@prisma/client';
import {
  PromotionIndicatorsService,
  type PromotionPolicyValues,
  type StudentIndicators,
} from './promotion-indicators';

/**
 * BL-05 (Q5): the preview carries the indicators and warnings for each student and deliberately
 * no pre-selected decision — every outcome is the admin's explicit choice.
 */
export interface PromotionPreviewRow {
  studentId: string;
  name: string;
  grNumber: string;
  currentRollNumber: string | null;
  indicators: StudentIndicators;
}

export interface PromotionPreview {
  schoolId: string;
  sourceAcademicSessionId: string;
  policy: PromotionPolicyValues;
  rows: PromotionPreviewRow[];
}

export interface PromotionDecisionInput {
  studentId: string;
  decision: PromotionDecision;
  targetSectionId?: string;
  rollNumber?: string;
  remarks?: string;
  conditions?: string;
}

export interface ExecutePromotionDto {
  sourceAcademicSessionId: string;
  targetAcademicSessionId: string;
  confirmed: boolean;
  decisions: PromotionDecisionInput[];
}

export interface PromotionHistoryRow {
  id: string;
  decision: PromotionDecision;
  decidedAt: Date;
  remarks: string | null;
  conditions: string | null;
  indicators: StudentIndicators | null;
  from: { sectionName: string; className: string; sessionLabel: string };
  to: { sectionName: string; className: string; sessionLabel: string } | null;
}

const CLOSED_STATUS: Record<
  PromotionDecision,
  'COMPLETED' | 'TRANSFERRED' | 'WITHDRAWN'
> = {
  PROMOTED: 'COMPLETED',
  PROMOTED_WITH_CONDITIONS: 'COMPLETED',
  RETAINED: 'COMPLETED',
  GRADUATED: 'COMPLETED',
  TRANSFERRED: 'TRANSFERRED',
  WITHDRAWN: 'WITHDRAWN',
};

// BL-61 (RD-10): the final lifecycle terms; `LEFT` is retired and never written.
const STUDENT_STATUS: Partial<
  Record<PromotionDecision, 'TRANSFERRED' | 'GRADUATED' | 'WITHDRAWN'>
> = {
  TRANSFERRED: 'TRANSFERRED',
  GRADUATED: 'GRADUATED',
  WITHDRAWN: 'WITHDRAWN',
};

const CREATES_NEW_ENROLLMENT: PromotionDecision[] = [
  'PROMOTED',
  'PROMOTED_WITH_CONDITIONS',
  'RETAINED',
];

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
    private readonly indicators: PromotionIndicatorsService,
  ) {}

  private async assertSectionInOwnSchool(
    actingUser: RequestUser,
    sectionId: string,
  ): Promise<{ schoolId: string; academicSessionId: string }> {
    // Always check section exists first (for all roles)
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      select: {
        class: {
          select: {
            campusId: true,
            academicSessionId: true,
            campus: { select: { schoolId: true } },
          },
        },
      },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    const scope = await this.orgScope.resolve(actingUser);
    if (
      !scope.allows({
        campusId: section.class.campusId,
        schoolId: section.class.campus.schoolId,
      })
    ) {
      throw new ForbiddenException(
        'Cannot access a section outside your own school',
      );
    }
    return {
      schoolId: section.class.campus.schoolId,
      academicSessionId: section.class.academicSessionId,
    };
  }

  async preview(
    actingUser: RequestUser,
    sourceSectionId: string,
  ): Promise<PromotionPreview> {
    const { schoolId, academicSessionId } = await this.assertSectionInOwnSchool(
      actingUser,
      sourceSectionId,
    );
    const enrollments = await this.prisma.enrollment.findMany({
      where: { sectionId: sourceSectionId, status: 'ACTIVE' },
      include: { student: { select: { name: true, grNumber: true } } },
      orderBy: { student: { name: 'asc' } },
    });
    const policy = await this.indicators.policyFor(schoolId);
    const byStudent = await this.indicators.forStudents(
      academicSessionId,
      enrollments.map((e) => e.studentId),
      policy,
    );
    return {
      schoolId,
      sourceAcademicSessionId: academicSessionId,
      policy,
      rows: enrollments.map((e) => ({
        studentId: e.studentId,
        name: e.student.name,
        grNumber: e.student.grNumber,
        currentRollNumber: e.rollNumber,
        indicators: byStudent.get(e.studentId)!,
      })),
    };
  }

  async execute(
    actingUser: RequestUser,
    dto: ExecutePromotionDto,
  ): Promise<{ processed: number }> {
    // Q5: nothing is promoted without an explicit confirmation of the whole batch.
    if (dto.confirmed !== true) {
      throw new BadRequestException(
        'Promotion decisions must be explicitly confirmed (confirmed: true)',
      );
    }
    for (const item of dto.decisions) {
      const conditions = item.conditions?.trim();
      if (item.decision === 'PROMOTED_WITH_CONDITIONS' && !conditions) {
        throw new BadRequestException(
          `conditions are required for decision PROMOTED_WITH_CONDITIONS (student ${item.studentId})`,
        );
      }
      if (item.decision !== 'PROMOTED_WITH_CONDITIONS' && conditions) {
        throw new BadRequestException(
          `conditions are only recorded for PROMOTED_WITH_CONDITIONS (student ${item.studentId})`,
        );
      }
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

    // BL-53: two promotions of the same student racing each other cannot both leave an ACTIVE
    // enrolment — the partial unique index (M12) rejects the second, which becomes a 409.
    const promoted = this.prisma.$transaction(async (tx) => {
      const scope = await this.orgScope.resolve(actingUser);
      const policies = new Map<string, PromotionPolicyValues>();

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
        if (
          !scope.allows({
            campusId: currentEnrollment.section.class.campusId,
            schoolId: currentEnrollment.section.class.campus.schoolId,
          })
        ) {
          throw new ForbiddenException(
            `Cannot promote student ${item.studentId} outside your own school`,
          );
        }

        // BL-05: the indicators are recomputed here (not trusted from the preview) and stored with
        // the decision; a school-configured block stops only a plain PROMOTED decision.
        const schoolId = currentEnrollment.section.class.campus.schoolId;
        if (!policies.has(schoolId)) {
          policies.set(schoolId, await this.indicators.policyFor(schoolId, tx));
        }
        const indicators = (
          await this.indicators.forStudents(
            dto.sourceAcademicSessionId,
            [item.studentId],
            policies.get(schoolId)!,
            tx,
          )
        ).get(item.studentId)!;
        if (item.decision === 'PROMOTED' && indicators.blocked) {
          throw new ConflictException(
            `Student ${item.studentId} cannot be promoted under this school's promotion rules (${indicators.warnings
              .filter((w) => w.blocking)
              .map((w) => w.message)
              .join(
                '; ',
              )}) — choose Promoted with conditions, Retained or another outcome`,
          );
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
          if (
            !scope.allows({
              campusId: targetSection.class.campusId,
              schoolId: targetSection.class.campus.schoolId,
            })
          ) {
            throw new ForbiddenException(
              `Cannot promote student ${item.studentId} outside your own school`,
            );
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
            conditions: item.conditions?.trim() || null,
            indicators: indicators as unknown as Prisma.InputJsonValue,
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
              confirmed: true,
              warnings: indicators.warnings.map((w) => w.code),
            }),
          },
        });
      }
      return { processed: dto.decisions.length };
    });
    return promoted.catch((error: unknown) =>
      rethrowUniqueAsConflict(
        error,
        'One of these students was promoted by someone else at the same time; nothing was changed — reload and try again',
      ),
    );
  }

  /** The school whose promotion policy the caller may read (`write`: change) — the pattern of subjects. */
  private async policySchool(
    actor: RequestUser,
    requestedSchoolId: string | undefined,
    write: boolean,
  ): Promise<string> {
    const scope = await this.orgScope.resolve(actor);
    if (scope.unrestricted) {
      if (!requestedSchoolId) {
        throw new BadRequestException('schoolId is required');
      }
      const school = await this.prisma.school.findUnique({
        where: { id: requestedSchoolId },
        select: { id: true },
      });
      if (!school) throw new NotFoundException('School not found');
      return school.id;
    }
    if (scope.denied || !scope.schoolId) {
      throw new ForbiddenException('No school is assigned to this account');
    }
    if (requestedSchoolId && requestedSchoolId !== scope.schoolId) {
      throw new ForbiddenException(
        'You can only see or change your own school’s promotion rules',
      );
    }
    if (write && scope.campusId !== null) {
      throw new ForbiddenException(
        'Only a school-wide administrator can change the promotion rules',
      );
    }
    return scope.schoolId;
  }

  async getPolicy(
    actor: RequestUser,
    schoolId?: string,
  ): Promise<PromotionPolicyValues & { schoolId: string }> {
    const id = await this.policySchool(actor, schoolId, false);
    return { schoolId: id, ...(await this.indicators.policyFor(id)) };
  }

  async updatePolicy(
    actor: RequestUser,
    dto: PromotionPolicyValues & { schoolId?: string },
  ): Promise<PromotionPolicyValues & { schoolId: string }> {
    const schoolId = await this.policySchool(actor, dto.schoolId, true);
    const values: PromotionPolicyValues = {
      minAttendancePercent: dto.minAttendancePercent,
      minResultPercent: dto.minResultPercent,
      blockOnAttendance: dto.blockOnAttendance,
      blockOnResults: dto.blockOnResults,
      blockOnFees: dto.blockOnFees,
    };
    await this.prisma.$transaction([
      this.prisma.promotionPolicy.upsert({
        where: { schoolId },
        create: { schoolId, ...values, updatedById: actor.id },
        update: { ...values, updatedById: actor.id },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actor.id,
          action: 'promotion-policy.update',
          entity: 'School',
          entityId: schoolId,
          metadata: JSON.stringify(values),
        },
      }),
    ]);
    return { schoolId, ...values };
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
      conditions: r.conditions,
      indicators: r.indicators as unknown as StudentIndicators | null,
      from: label(r.fromEnrollment),
      to: r.toEnrollment ? label(r.toEnrollment) : null,
    }));
  }
}
