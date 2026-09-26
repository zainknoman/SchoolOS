import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import {
  StudentAccessService,
  type RequestUser,
} from '../common/student-access.service';
import { GradesService, type SubjectGrade } from '../gradebook/grades.service';
import { bandFor, type Band } from '../gradebook/grade-bands';
import type { GenerateReportCardsDto } from './dto/generate-report-cards.dto';

/** Everything a generated card shows — frozen at issue. */
export interface ReportCardSnapshot {
  school: string;
  campus: string;
  session: string;
  term: string;
  className: string;
  section: string;
  student: { name: string; grNumber: string };
  scaleName: string;
  subjects: Pick<
    SubjectGrade,
    | 'subjectName'
    | 'obtainedMarks'
    | 'maxMarks'
    | 'finalPercent'
    | 'letter'
    | 'remark'
    | 'gradePoint'
    | 'categories'
  >[];
  overall: {
    percent: number;
    letter: string | null;
    remark: string | null;
    /** mean grade point when every subject has one */
    gpa: number | null;
  };
  remark: string | null;
}

export interface GeneratedReportCardSummary {
  id: string;
  studentId: string;
  termId: string;
  term: string;
  session: string;
  className: string;
  version: number;
  current: boolean;
  overallPercent: number;
  overallLetter: string | null;
  issuedAt: Date;
  supersededAt: Date | null;
}

export interface GenerateResult {
  generated: number;
  unchanged: number;
  skipped: { studentId: string; reason: string }[];
}

type CardRow = Prisma.GeneratedReportCardGetPayload<object>;

function summary(row: CardRow): GeneratedReportCardSummary {
  const snap = row.snapshot as unknown as ReportCardSnapshot;
  return {
    id: row.id,
    studentId: row.studentId,
    termId: row.termId,
    term: snap.term,
    session: snap.session,
    className: snap.className,
    version: row.version,
    current: row.supersededAt === null,
    overallPercent: row.overallPercent,
    overallLetter: row.overallLetter,
    issuedAt: row.issuedAt,
    supersededAt: row.supersededAt,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** JSON with object keys sorted at every level — JSONB does not keep key order. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([x], [y]) =>
            x < y ? -1 : x > y ? 1 : 0,
          ),
        )
      : v,
  );
}

/**
 * BL-06 (Q6): report cards generated from the gradebook. A class's cards for a term can be
 * generated only after its results are published (BL-27), from the published scale. Issued cards
 * never change (DB trigger): a regeneration that finds different results issues version n+1 and
 * marks the previous one superseded; one that finds the same results issues nothing. Staff with
 * access to the student see every version; parents see the current one while the results are
 * published. Generation is audited.
 */
@Injectable()
export class GeneratedReportCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
    private readonly access: StudentAccessService,
    private readonly grades: GradesService,
  ) {}

  async generate(
    user: RequestUser,
    dto: GenerateReportCardsDto,
  ): Promise<GenerateResult> {
    const klass = await this.prisma.class.findUnique({
      where: { id: dto.classId },
      include: {
        campus: { select: { name: true, schoolId: true, school: true } },
        academicSession: { select: { label: true } },
      },
    });
    if (!klass) throw new NotFoundException('Class not found');
    if (user.role !== 'SUPER_ADMIN') {
      const scope = await this.orgScope.resolve(user);
      if (
        !scope.allows({
          campusId: klass.campusId,
          schoolId: klass.campus.schoolId,
        })
      ) {
        throw new ForbiddenException('You do not have access to this class');
      }
    }
    const term = await this.prisma.term.findUnique({
      where: { id: dto.termId },
    });
    if (!term || term.academicSessionId !== klass.academicSessionId) {
      throw new BadRequestException("The term is not in this class's session");
    }
    const publication = await this.prisma.resultPublication.findUnique({
      where: { classId_termId: { classId: klass.id, termId: term.id } },
    });
    if (!publication) {
      throw new BadRequestException(
        "Publish the class's results for this term before generating report cards",
      );
    }
    const bands = publication.bands as unknown as Band[];

    const enrolments = await this.prisma.enrollment.findMany({
      where: {
        academicSessionId: klass.academicSessionId,
        section: { classId: klass.id },
        ...(dto.studentIds?.length
          ? { studentId: { in: dto.studentIds } }
          : {}),
      },
      orderBy: { startDate: 'desc' },
      include: {
        student: { select: { name: true, grNumber: true } },
        section: { select: { name: true } },
      },
    });
    const byStudent = new Map<string, (typeof enrolments)[number]>();
    for (const e of enrolments) {
      if (!byStudent.has(e.studentId)) byStudent.set(e.studentId, e);
    }
    const remarks = new Map(
      (dto.remarks ?? []).map((r) => [r.studentId, r.remark.trim() || null]),
    );
    const result: GenerateResult = { generated: 0, unchanged: 0, skipped: [] };
    for (const id of dto.studentIds ?? []) {
      if (!byStudent.has(id)) {
        result.skipped.push({
          studentId: id,
          reason: 'not enrolled in this class this session',
        });
      }
    }
    const issuedIds: string[] = [];

    for (const [studentId, enrolment] of byStudent) {
      const subjects = await this.grades.forStudent(studentId, term.id);
      if (subjects.length === 0) {
        result.skipped.push({ studentId, reason: 'no assessments or marks' });
        continue;
      }
      const current = await this.prisma.generatedReportCard.findFirst({
        where: { studentId, termId: term.id, supersededAt: null },
        orderBy: { version: 'desc' },
      });
      const remark = remarks.has(studentId)
        ? (remarks.get(studentId) ?? null)
        : (current?.remark ?? null);
      const percent = round1(
        subjects.reduce((s, g) => s + g.finalPercent, 0) / subjects.length,
      );
      const overallBand = bandFor(percent, bands);
      const points = subjects.map((g) => g.gradePoint);
      const snapshot: ReportCardSnapshot = {
        school: klass.campus.school.name,
        campus: klass.campus.name,
        session: klass.academicSession.label,
        term: term.label,
        className: klass.name,
        section: enrolment.section.name,
        student: enrolment.student,
        scaleName: publication.scaleName,
        subjects: subjects.map((g) => ({
          subjectName: g.subjectName,
          obtainedMarks: g.obtainedMarks,
          maxMarks: g.maxMarks,
          finalPercent: g.finalPercent,
          letter: g.letter,
          remark: g.remark,
          gradePoint: g.gradePoint,
          categories: g.categories,
        })),
        overall: {
          percent,
          letter: overallBand?.letter ?? null,
          remark: overallBand?.remark ?? null,
          gpa: points.every((p): p is number => p !== null)
            ? Math.round(
                (points.reduce((s, p) => s + p, 0) / points.length) * 100,
              ) / 100
            : null,
        },
        remark,
      };
      if (current && canonical(current.snapshot) === canonical(snapshot)) {
        result.unchanged += 1;
        continue;
      }
      const issued = await this.prisma.$transaction(async (tx) => {
        if (current) {
          await tx.generatedReportCard.update({
            where: { id: current.id },
            data: { supersededAt: new Date() },
          });
        }
        return tx.generatedReportCard.create({
          data: {
            studentId,
            classId: klass.id,
            termId: term.id,
            version: (current?.version ?? 0) + 1,
            snapshot: snapshot as unknown as Prisma.InputJsonValue,
            overallPercent: percent,
            overallLetter: snapshot.overall.letter,
            remark,
            issuedById: user.id,
          },
        });
      });
      issuedIds.push(issued.id);
      result.generated += 1;
    }

    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'report-card.generate',
        entity: 'Class',
        entityId: klass.id,
        metadata: JSON.stringify({
          termId: term.id,
          generated: result.generated,
          unchanged: result.unchanged,
          skipped: result.skipped.length,
          issuedIds,
        }),
      },
    });
    return result;
  }

  async listForStudent(
    user: RequestUser,
    studentId: string,
  ): Promise<GeneratedReportCardSummary[]> {
    await this.access.assertCanAccessStudent(user, studentId);
    const rows = await this.prisma.generatedReportCard.findMany({
      where: {
        studentId,
        ...(user.role === 'PARENT' ? { supersededAt: null } : {}),
      },
      orderBy: [{ issuedAt: 'desc' }, { version: 'desc' }],
    });
    const visible =
      user.role === 'PARENT' ? await this.publishedOnly(rows) : rows;
    return visible.map(summary);
  }

  async get(
    user: RequestUser,
    id: string,
  ): Promise<GeneratedReportCardSummary & { snapshot: ReportCardSnapshot }> {
    const row = await this.prisma.generatedReportCard.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Report card not found');
    await this.access.assertCanAccessStudent(user, row.studentId);
    if (
      user.role === 'PARENT' &&
      (row.supersededAt !== null ||
        (await this.publishedOnly([row])).length === 0)
    ) {
      throw new NotFoundException('Report card not found');
    }
    return {
      ...summary(row),
      snapshot: row.snapshot as unknown as ReportCardSnapshot,
    };
  }

  /** Parents see a card only while its class/term results are published. */
  private async publishedOnly(rows: CardRow[]): Promise<CardRow[]> {
    if (rows.length === 0) return rows;
    const published = await this.prisma.resultPublication.findMany({
      where: {
        OR: rows.map((r) => ({ classId: r.classId, termId: r.termId })),
      },
      select: { classId: true, termId: true },
    });
    const keys = new Set(published.map((p) => `${p.classId}|${p.termId}`));
    return rows.filter((r) => keys.has(`${r.classId}|${r.termId}`));
  }
}
