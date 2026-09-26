import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import {
  StudentAccessService,
  type RequestUser,
} from '../common/student-access.service';

export interface LeaveRequestSummary {
  id: string;
  studentId: string;
  studentName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  createdAt: string;
  /** BL-29: a teacher's recommendation — staff only (left out for parents) */
  recommendation?: {
    by: string | null;
    at: string;
    approve: boolean | null;
    note: string | null;
  } | null;
  /** BL-29: the final decision (parents see the note, not who decided) */
  decision?: {
    by?: string | null;
    at: string;
    note: string | null;
  } | null;
}

const ACTOR = {
  select: { identifier: true, teacher: { select: { name: true } } },
} as const;

const STUDENT_INCLUDE = {
  student: { select: { name: true } },
  recommendedBy: ACTOR,
  decidedBy: ACTOR,
} as const;

type LeaveRow = Prisma.LeaveRequestGetPayload<{
  include: typeof STUDENT_INCLUDE;
}>;

const actorName = (
  u: { identifier: string; teacher: { name: string } | null } | null,
) => (u ? (u.teacher?.name ?? u.identifier) : null);

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
    private readonly enrollmentService: EnrollmentService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  /**
   * BL-29 (Q12): a teacher of the student recommends approving or rejecting a pending request. It
   * never changes the status and can be revised until the decision; each one is audited under the
   * teacher's own account.
   */
  async recommend(
    id: string,
    actingUserId: string,
    input: { approve: boolean; note?: string | null },
  ): Promise<LeaveRequestSummary> {
    const note = input.note?.trim() || null;
    const record = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.leaveRequest.updateMany({
        where: { id, status: 'pending' },
        data: {
          recommendedById: actingUserId,
          recommendedAt: new Date(),
          recommendsApproval: input.approve,
          recommendationNote: note,
        },
      });
      if (count === 0) await this.assertPending(tx, id);
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'leave-request.recommend',
          entity: 'LeaveRequest',
          entityId: id,
          metadata: JSON.stringify({ approve: input.approve, note }),
        },
      });
      return tx.leaveRequest.findUniqueOrThrow({
        where: { id },
        include: STUDENT_INCLUDE,
      });
    });
    return this.toSummary(record);
  }

  /** Throws the right error for a request that is missing or no longer pending. */
  private async assertPending(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<never> {
    const existing = await tx.leaveRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Leave request not found');
    throw new BadRequestException(
      'This leave request has already been decided',
    );
  }

  async create(
    dto: CreateLeaveRequestDto,
    actingUserId: string,
  ): Promise<LeaveRequestSummary> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException('startDate must not be after endDate');
    }
    const record = await this.prisma.leaveRequest.create({
      data: {
        studentId: dto.studentId,
        startDate,
        endDate,
        reason: dto.reason,
      },
      include: STUDENT_INCLUDE,
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'leave-request.create',
        entity: 'LeaveRequest',
        entityId: record.id,
        metadata: JSON.stringify({
          studentId: dto.studentId,
          startDate: dto.startDate,
          endDate: dto.endDate,
        }),
      },
    });

    return this.toSummary(record);
  }

  async listForStudent(
    studentId: string,
    viewer?: RequestUser,
  ): Promise<LeaveRequestSummary[]> {
    const records = await this.prisma.leaveRequest.findMany({
      where: { studentId },
      include: STUDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r, viewer?.role === 'PARENT'));
  }

  async listAll(
    actingUser: RequestUser,
    status?: string,
  ): Promise<LeaveRequestSummary[]> {
    let where: Prisma.LeaveRequestWhereInput | undefined = status
      ? { status }
      : undefined;
    if (actingUser.role === 'TEACHER') {
      // BL-29: a teacher sees requests of students actively enrolled in sections they teach.
      const teacher = await this.prisma.teacher.findUnique({
        where: { userId: actingUser.id },
        select: { id: true },
      });
      if (!teacher) return [];
      const sectionIds = [
        ...(await this.studentAccess.getTeacherSectionIds(teacher.id)),
      ];
      const records = await this.prisma.leaveRequest.findMany({
        where: {
          ...where,
          student: {
            enrollments: {
              some: { status: 'ACTIVE', sectionId: { in: sectionIds } },
            },
          },
        },
        include: STUDENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
      });
      return records.map((r) => this.toSummary(r));
    }
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      where = {
        ...where,
        student: {
          enrollments: {
            some: { section: { class: { campus: scope.campusWhere } } },
          },
        },
      };
    }
    const records = await this.prisma.leaveRequest.findMany({
      where,
      include: STUDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  /**
   * The LEAVE rows are attributed to the approver (BL-60, M1): `markedByUserId` = the acting user,
   * `markedById` only if that user is a Teacher — never the class teacher as a stand-in, and a class
   * teacher is not required. Any day in range already marked HOLIDAY is left untouched.
   *
   * Every precondition (must exist, must be pending, must have an active enrollment) is resolved
   * BEFORE any write — and the status update, the attendance upserts, and the audit-log write are
   * wrapped in one $transaction. So a failure anywhere here (missing enrollment, or a mid-loop attendance write
   * failure) leaves the LeaveRequest row untouched at 'pending' — never stuck in a broken
   * 'approved' state with no attendance rows and no audit trail. Mirrors
   * FeePaymentsService.confirm()'s pattern: preconditions/reads resolved first, the transaction
   * wraps only the state-mutating write sequence.
   */
  async approve(
    id: string,
    actingUserId: string,
    note?: string | null,
  ): Promise<LeaveRequestSummary> {
    const existing = await this.prisma.leaveRequest.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Leave request not found');
    }
    if (existing.status !== 'pending') {
      throw new BadRequestException(
        'This leave request has already been decided',
      );
    }

    // A leave request only makes sense for an enrolled student (throws otherwise).
    await this.enrollmentService.getCurrentEnrollment(existing.studentId);
    const approverTeacher = await this.prisma.teacher.findUnique({
      where: { userId: actingUserId },
      select: { id: true },
    });
    const markedBy = {
      markedByUserId: actingUserId,
      markedById: approverTeacher?.id ?? null,
    };

    const record = await this.prisma.$transaction(async (tx) => {
      // Conditional on 'pending', so two simultaneous decisions cannot both win (BL-29).
      const { count } = await tx.leaveRequest.updateMany({
        where: { id, status: 'pending' },
        data: {
          status: 'approved',
          decidedById: actingUserId,
          decidedAt: new Date(),
          decisionNote: note?.trim() || null,
        },
      });
      if (count === 0) await this.assertPending(tx, id);
      const updated = await tx.leaveRequest.findUniqueOrThrow({
        where: { id },
        include: STUDENT_INCLUDE,
      });

      const dates: Date[] = [];
      for (
        const cursor = new Date(updated.startDate);
        cursor <= updated.endDate;
        cursor.setUTCDate(cursor.getUTCDate() + 1)
      ) {
        dates.push(new Date(cursor));
      }

      const existingAttendance = await tx.attendance.findMany({
        where: { studentId: updated.studentId, date: { in: dates } },
        select: { date: true, status: true },
      });
      const holidayDates = new Set(
        existingAttendance
          .filter((e) => e.status === 'HOLIDAY')
          .map((e) => e.date.toISOString()),
      );

      for (const date of dates) {
        if (holidayDates.has(date.toISOString())) continue;
        await tx.attendance.upsert({
          where: { studentId_date: { studentId: updated.studentId, date } },
          create: {
            studentId: updated.studentId,
            date,
            status: 'LEAVE',
            ...markedBy,
          },
          update: { status: 'LEAVE', ...markedBy },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'leave-request.approve',
          entity: 'LeaveRequest',
          entityId: id,
          metadata: JSON.stringify({
            studentId: updated.studentId,
            dateCount: dates.length,
            note: updated.decisionNote,
          }),
        },
      });

      return updated;
    });

    return this.toSummary(record);
  }

  async reject(
    id: string,
    actingUserId: string,
    note?: string | null,
  ): Promise<LeaveRequestSummary> {
    const decisionNote = note?.trim() || null;
    const record = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.leaveRequest.updateMany({
        where: { id, status: 'pending' },
        data: {
          status: 'rejected',
          decidedById: actingUserId,
          decidedAt: new Date(),
          decisionNote,
        },
      });
      if (count === 0) await this.assertPending(tx, id);
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'leave-request.reject',
          entity: 'LeaveRequest',
          entityId: id,
          metadata: JSON.stringify({ note: decisionNote }),
        },
      });
      return tx.leaveRequest.findUniqueOrThrow({
        where: { id },
        include: STUDENT_INCLUDE,
      });
    });
    return this.toSummary(record);
  }

  /** BL-29 (KG-27): the caller administers the school/campus of the student's latest enrolment. */
  async assertAdminScope(user: RequestUser, studentId: string): Promise<void> {
    const scope = await this.orgScope.resolve(user);
    if (scope.unrestricted) return;
    const latest = await this.prisma.enrollment.findFirst({
      where: { studentId },
      orderBy: { startDate: 'desc' },
      select: { campusId: true, campus: { select: { schoolId: true } } },
    });
    if (
      !latest ||
      !scope.allows({
        campusId: latest.campusId,
        schoolId: latest.campus.schoolId,
      })
    ) {
      throw new ForbiddenException('You do not have access to this student');
    }
  }

  /** The student a request is for — the controller checks the caller may act for that student. */
  async studentIdOf(id: string): Promise<string> {
    const existing = await this.prisma.leaveRequest.findUnique({
      where: { id },
      select: { studentId: true },
    });
    if (!existing) throw new NotFoundException('Leave request not found');
    return existing.studentId;
  }

  private toSummary(record: LeaveRow, forParent = false): LeaveRequestSummary {
    return {
      id: record.id,
      studentId: record.studentId,
      studentName: record.student.name,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
      reason: record.reason,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      ...(forParent
        ? {}
        : {
            recommendation: record.recommendedAt
              ? {
                  by: actorName(record.recommendedBy),
                  at: record.recommendedAt.toISOString(),
                  approve: record.recommendsApproval,
                  note: record.recommendationNote,
                }
              : null,
          }),
      decision: record.decidedAt
        ? {
            ...(forParent ? {} : { by: actorName(record.decidedBy) }),
            at: record.decidedAt.toISOString(),
            note: record.decisionNote,
          }
        : null,
    };
  }
}
