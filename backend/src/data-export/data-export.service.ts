import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import { SENSITIVE_FIELDS } from '../common/sensitive-fields';
import { toCsv, type CsvValue } from './csv-writer';

export const EXPORT_DATASETS = [
  'students',
  'guardians',
  'enrolments',
  'attendance',
  'results',
  'fees',
] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];

export interface ExportRequest {
  /** SUPER_ADMIN only (required for them): the one school to export. */
  schoolId?: string;
  campusId?: string;
  academicSessionId?: string;
  /** attendance: inclusive date window (YYYY-MM-DD) */
  from?: string;
  to?: string;
  includeSensitive?: boolean;
}

export interface ExportResult {
  filename: string;
  csv: string;
  rowCount: number;
}

interface ExportScope {
  schoolId: string;
  campusId: string | null;
  campusWhere: Prisma.CampusWhereInput;
}

type Column<T> = { header: string; value: (row: T) => CsvValue };

const SENSITIVE_HEADERS: ReadonlySet<string> = new Set(
  Object.values(SENSITIVE_FIELDS).flat(),
);

/** Only the datasets that carry sensitive columns honour `includeSensitive`. */
const HAS_SENSITIVE: ReadonlySet<ExportDataset> = new Set([
  'students',
  'guardians',
]);

/**
 * BL-41 (Q7, Q22): controlled data export for authorised school admins. Every export is confined
 * to ONE school (a campus-level admin to their campus), is written to the audit log before it is
 * returned, and leaves out the columns named in `SENSITIVE_FIELDS` unless the caller explicitly
 * asked for them AND may receive them (the principal of the school, or SUPER_ADMIN).
 */
@Injectable()
export class DataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  async export(
    dataset: ExportDataset,
    req: ExportRequest,
    actor: RequestUser,
    ip?: string,
  ): Promise<ExportResult> {
    const scope = await this.resolveScope(actor, req);
    const includeSensitive =
      req.includeSensitive === true && HAS_SENSITIVE.has(dataset);
    if (includeSensitive) await this.assertMaySeeSensitive(actor);

    const csv = await this.build(dataset, scope, req, includeSensitive);
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action: `data-export.${dataset}`,
        entity: 'School',
        entityId: scope.schoolId,
        ip: ip ?? null,
        metadata: JSON.stringify({
          dataset,
          campusId: scope.campusId,
          academicSessionId: req.academicSessionId ?? null,
          from: req.from ?? null,
          to: req.to ?? null,
          includeSensitive,
          rowCount: csv.rowCount,
        }),
      },
    });
    const day = new Date().toISOString().slice(0, 10);
    return {
      filename: `${dataset}-${day}.csv`,
      csv: csv.text,
      rowCount: csv.rowCount,
    };
  }

  private async resolveScope(
    actor: RequestUser,
    req: ExportRequest,
  ): Promise<ExportScope> {
    let schoolId: string;
    let campusId: string | null;
    if (actor.role === 'SUPER_ADMIN') {
      if (!req.schoolId) {
        throw new BadRequestException(
          'schoolId is required: an export covers exactly one school',
        );
      }
      const school = await this.prisma.school.findUnique({
        where: { id: req.schoolId },
        select: { id: true },
      });
      if (!school) throw new NotFoundException('School not found');
      schoolId = school.id;
      campusId = null;
    } else {
      const scope = await this.orgScope.resolve(actor);
      if (scope.denied || !scope.schoolId) {
        throw new ForbiddenException('Your account is not linked to a school');
      }
      if (req.schoolId && req.schoolId !== scope.schoolId) {
        throw new ForbiddenException('You may only export your own school');
      }
      schoolId = scope.schoolId;
      campusId = scope.campusId;
    }
    if (req.campusId && req.campusId !== campusId) {
      if (campusId !== null) {
        throw new ForbiddenException('You may only export your own campus');
      }
      const campus = await this.prisma.campus.findUnique({
        where: { id: req.campusId },
        select: { schoolId: true },
      });
      if (!campus || campus.schoolId !== schoolId) {
        throw new ForbiddenException('That campus is not in this school');
      }
      campusId = req.campusId;
    }
    if (req.academicSessionId) {
      const session = await this.prisma.academicSession.findUnique({
        where: { id: req.academicSessionId },
        select: { schoolId: true },
      });
      if (!session || session.schoolId !== schoolId) {
        throw new ForbiddenException('That session is not in this school');
      }
    }
    return {
      schoolId,
      campusId,
      campusWhere: campusId ? { id: campusId, schoolId } : { schoolId },
    };
  }

  private async assertMaySeeSensitive(actor: RequestUser): Promise<void> {
    if (actor.role === 'SUPER_ADMIN') return;
    const account = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: { isPrincipal: true },
    });
    if (!account?.isPrincipal) {
      throw new ForbiddenException(
        'Sensitive fields (national identifiers, medical information) may only be exported by the principal or a super admin',
      );
    }
  }

  private async build(
    dataset: ExportDataset,
    scope: ExportScope,
    req: ExportRequest,
    includeSensitive: boolean,
  ): Promise<{ text: string; rowCount: number }> {
    const enrolWhere: Prisma.EnrollmentWhereInput = {
      campus: scope.campusWhere,
      ...(req.academicSessionId
        ? { academicSessionId: req.academicSessionId }
        : {}),
    };
    switch (dataset) {
      case 'students':
        return this.students(enrolWhere, includeSensitive);
      case 'guardians':
        return this.guardians(enrolWhere, includeSensitive);
      case 'enrolments':
        return this.enrolments(enrolWhere);
      case 'attendance':
        return this.attendance(enrolWhere, req);
      case 'results':
        return this.results(scope, req);
      case 'fees':
        return this.fees(enrolWhere);
    }
  }

  /**
   * Fail closed: a sensitive column reaches the CSV only when the caller was allowed it, even if a
   * later edit adds one to a dataset's base column list by mistake.
   */
  private out<T>(columns: Column<T>[], rows: T[], includeSensitive = false) {
    const leaked = columns.find((c) => SENSITIVE_HEADERS.has(c.header));
    if (leaked && !includeSensitive) {
      throw new Error(`Export column "${leaked.header}" is sensitive`);
    }
    return { text: toCsv(columns, rows), rowCount: rows.length };
  }

  private async students(
    enrolWhere: Prisma.EnrollmentWhereInput,
    includeSensitive: boolean,
  ) {
    const rows = await this.prisma.student.findMany({
      where: { enrollments: { some: enrolWhere } },
      orderBy: { grNumber: 'asc' },
      include: {
        enrollments: {
          where: enrolWhere,
          orderBy: { startDate: 'desc' },
          take: 1,
          include: {
            campus: { select: { name: true } },
            academicSession: { select: { label: true } },
            section: {
              select: { name: true, class: { select: { name: true } } },
            },
          },
        },
        medicalInfo: includeSensitive,
      },
    });
    type Row = (typeof rows)[number];
    const latest = (r: Row) => r.enrollments[0];
    const columns: Column<Row>[] = [
      { header: 'studentId', value: (r) => r.id },
      { header: 'grNumber', value: (r) => r.grNumber },
      { header: 'name', value: (r) => r.name },
      { header: 'gender', value: (r) => r.gender },
      { header: 'dateOfBirth', value: (r) => day(r.dateOfBirth) },
      { header: 'status', value: (r) => r.status },
      { header: 'admissionDate', value: (r) => day(r.admissionDate) },
      { header: 'leavingDate', value: (r) => day(r.leavingDate) },
      { header: 'leavingReason', value: (r) => r.leavingReason },
      { header: 'studentMobile', value: (r) => r.studentMobile },
      { header: 'studentEmail', value: (r) => r.studentEmail },
      { header: 'campus', value: (r) => latest(r)?.campus.name },
      { header: 'session', value: (r) => latest(r)?.academicSession.label },
      { header: 'class', value: (r) => latest(r)?.section.class.name },
      { header: 'section', value: (r) => latest(r)?.section.name },
      { header: 'enrolmentStatus', value: (r) => latest(r)?.status },
      { header: 'archivedAt', value: (r) => r.archivedAt },
      { header: 'archiveReason', value: (r) => r.archiveReason },
    ];
    if (includeSensitive) {
      for (const field of SENSITIVE_FIELDS.Student) {
        columns.push({ header: field, value: (r) => r[field] });
      }
      for (const field of SENSITIVE_FIELDS.StudentMedicalInfo) {
        columns.push({ header: field, value: (r) => r.medicalInfo?.[field] });
      }
    }
    return this.out(columns, rows, includeSensitive);
  }

  /** One row per student–guardian link; a guardian's links to other schools never appear. */
  private async guardians(
    enrolWhere: Prisma.EnrollmentWhereInput,
    includeSensitive: boolean,
  ) {
    const rows = await this.prisma.studentParent.findMany({
      where: { student: { enrollments: { some: enrolWhere } } },
      orderBy: [{ student: { grNumber: 'asc' } }, { primarySlot: 'asc' }],
      include: {
        student: { select: { grNumber: true, name: true } },
        parentProfile: true,
      },
    });
    type Row = (typeof rows)[number];
    const columns: Column<Row>[] = [
      { header: 'grNumber', value: (r) => r.student.grNumber },
      { header: 'studentName', value: (r) => r.student.name },
      { header: 'guardianId', value: (r) => r.parentProfileId },
      { header: 'guardianName', value: (r) => r.parentProfile.name },
      { header: 'relationship', value: (r) => r.relationshipType },
      { header: 'relationshipNote', value: (r) => r.relationshipNote },
      { header: 'primarySlot', value: (r) => r.primarySlot },
      { header: 'isEmergencyContact', value: (r) => r.isEmergencyContact },
      { header: 'phone', value: (r) => r.parentProfile.phone },
      {
        header: 'alternatePhone',
        value: (r) => r.parentProfile.alternatePhone,
      },
      {
        header: 'whatsappNumber',
        value: (r) => r.parentProfile.whatsappNumber,
      },
      { header: 'email', value: (r) => r.parentProfile.email },
      { header: 'occupation', value: (r) => r.parentProfile.occupation },
    ];
    if (includeSensitive) {
      for (const field of SENSITIVE_FIELDS.ParentProfile) {
        columns.push({ header: field, value: (r) => r.parentProfile[field] });
      }
    }
    return this.out(columns, rows, includeSensitive);
  }

  private async enrolments(enrolWhere: Prisma.EnrollmentWhereInput) {
    const rows = await this.prisma.enrollment.findMany({
      where: enrolWhere,
      orderBy: [{ student: { grNumber: 'asc' } }, { startDate: 'asc' }],
      include: {
        student: { select: { grNumber: true, name: true } },
        campus: { select: { name: true } },
        academicSession: { select: { label: true } },
        section: { select: { name: true, class: { select: { name: true } } } },
      },
    });
    type Row = (typeof rows)[number];
    return this.out<Row>(
      [
        { header: 'grNumber', value: (r) => r.student.grNumber },
        { header: 'studentName', value: (r) => r.student.name },
        { header: 'session', value: (r) => r.academicSession.label },
        { header: 'campus', value: (r) => r.campus.name },
        { header: 'class', value: (r) => r.section.class.name },
        { header: 'section', value: (r) => r.section.name },
        { header: 'rollNumber', value: (r) => r.rollNumber },
        { header: 'status', value: (r) => r.status },
        { header: 'startDate', value: (r) => day(r.startDate) },
        { header: 'endDate', value: (r) => day(r.endDate) },
        { header: 'remarks', value: (r) => r.remarks },
      ],
      rows,
    );
  }

  /**
   * Attendance has no school column, so a row is exported only when it falls inside one of the
   * student's enrolments in scope — a student who moved schools does not carry their old school's
   * attendance into this export.
   */
  private async attendance(
    enrolWhere: Prisma.EnrollmentWhereInput,
    req: ExportRequest,
  ) {
    const from = parseDay(req.from, 'from');
    const to = parseDay(req.to, 'to');
    if (from && to && from > to) {
      throw new BadRequestException('from must not be after to');
    }
    const enrolments = await this.prisma.enrollment.findMany({
      where: enrolWhere,
      select: {
        studentId: true,
        startDate: true,
        endDate: true,
        section: { select: { name: true, class: { select: { name: true } } } },
      },
    });
    const byStudent = new Map<string, typeof enrolments>();
    for (const e of enrolments) {
      byStudent.set(e.studentId, [...(byStudent.get(e.studentId) ?? []), e]);
    }
    const rows = await this.prisma.attendance.findMany({
      where: {
        studentId: { in: [...byStudent.keys()] },
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ date: 'asc' }, { student: { grNumber: 'asc' } }],
      include: { student: { select: { grNumber: true, name: true } } },
    });
    const inScope = rows.flatMap((r) => {
      const e = byStudent
        .get(r.studentId)
        ?.find(
          (x) => x.startDate <= r.date && (!x.endDate || r.date <= x.endDate),
        );
      return e ? [{ ...r, enrolment: e }] : [];
    });
    return this.out(
      [
        { header: 'date', value: (r) => day(r.date) },
        { header: 'grNumber', value: (r) => r.student.grNumber },
        { header: 'studentName', value: (r) => r.student.name },
        { header: 'class', value: (r) => r.enrolment.section.class.name },
        { header: 'section', value: (r) => r.enrolment.section.name },
        { header: 'status', value: (r) => r.status },
      ],
      inScope,
    );
  }

  private async results(scope: ExportScope, req: ExportRequest) {
    const rows = await this.prisma.mark.findMany({
      where: {
        assessment: {
          assessmentCategory: {
            class: {
              campus: scope.campusWhere,
              ...(req.academicSessionId
                ? { academicSessionId: req.academicSessionId }
                : {}),
            },
          },
        },
      },
      orderBy: [{ student: { grNumber: 'asc' } }, { createdAt: 'asc' }],
      include: {
        student: { select: { grNumber: true, name: true } },
        assessment: {
          select: {
            label: true,
            maxMarks: true,
            subject: { select: { name: true } },
            assessmentCategory: {
              select: {
                name: true,
                term: { select: { label: true } },
                class: {
                  select: {
                    name: true,
                    academicSession: { select: { label: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    type Row = (typeof rows)[number];
    const cat = (r: Row) => r.assessment.assessmentCategory;
    return this.out<Row>(
      [
        { header: 'grNumber', value: (r) => r.student.grNumber },
        { header: 'studentName', value: (r) => r.student.name },
        { header: 'session', value: (r) => cat(r).class.academicSession.label },
        { header: 'class', value: (r) => cat(r).class.name },
        { header: 'term', value: (r) => cat(r).term.label },
        { header: 'subject', value: (r) => r.assessment.subject.name },
        { header: 'category', value: (r) => cat(r).name },
        { header: 'assessment', value: (r) => r.assessment.label },
        { header: 'maxMarks', value: (r) => r.assessment.maxMarks },
        { header: 'obtainedMarks', value: (r) => r.obtainedMarks },
      ],
      rows,
    );
  }

  /**
   * A voucher is in scope when its student has an in-scope enrolment in the voucher's session.
   * Amounts are in paisa, as stored; `paid` counts completed payments only.
   */
  private async fees(enrolWhere: Prisma.EnrollmentWhereInput) {
    const enrolments = await this.prisma.enrollment.findMany({
      where: enrolWhere,
      select: { studentId: true, academicSessionId: true },
    });
    const keys = new Set(
      enrolments.map((e) => `${e.studentId}|${e.academicSessionId}`),
    );
    const vouchers = await this.prisma.feeVoucher.findMany({
      where: {
        studentId: { in: [...new Set(enrolments.map((e) => e.studentId))] },
        academicSessionId: {
          in: [...new Set(enrolments.map((e) => e.academicSessionId))],
        },
      },
      orderBy: [{ student: { grNumber: 'asc' } }, { month: 'asc' }],
      include: {
        student: { select: { grNumber: true, name: true } },
        academicSession: { select: { label: true } },
        items: { select: { amount: true } },
        allocations: {
          select: { amount: true, feePayment: { select: { status: true } } },
        },
      },
    });
    const rows = vouchers
      .filter((v) => keys.has(`${v.studentId}|${v.academicSessionId}`))
      .map((v) => {
        const total = v.items.reduce((s, i) => s + i.amount, 0);
        const paid = v.allocations
          .filter((a) => a.feePayment.status === 'completed')
          .reduce((s, a) => s + a.amount, 0);
        return { v, total, paid };
      });
    return this.out(
      [
        { header: 'voucherId', value: (r) => r.v.id },
        { header: 'grNumber', value: (r) => r.v.student.grNumber },
        { header: 'studentName', value: (r) => r.v.student.name },
        { header: 'session', value: (r) => r.v.academicSession.label },
        { header: 'month', value: (r) => r.v.month },
        { header: 'issueDate', value: (r) => day(r.v.issueDate) },
        { header: 'dueDate', value: (r) => day(r.v.dueDate) },
        { header: 'totalPaisa', value: (r) => r.total },
        { header: 'paidPaisa', value: (r) => r.paid },
        { header: 'balancePaisa', value: (r) => r.total - r.paid },
      ],
      rows,
    );
  }
}

function day(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function parseDay(value: string | undefined, name: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new BadRequestException(`${name} must be a date (YYYY-MM-DD)`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}
