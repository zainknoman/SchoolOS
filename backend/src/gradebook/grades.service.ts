import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../common/student-access.service';
import { GradingScalesService } from './grading-scales.service';
import { bandFor, type Band } from './grade-bands';

export interface SubjectGrade {
  subjectId: string;
  subjectName: string;
  categories: {
    name: string;
    weightPercent: number;
    obtainedPercent: number;
  }[];
  /** BL-27: raw marks across the term's assessments of this subject */
  obtainedMarks: number;
  maxMarks: number;
  finalPercent: number;
  /** BL-27: from the published scale snapshot, else the school's default scale; null without one */
  letter: string | null;
  remark: string | null;
  gradePoint: number | null;
  /** whether the class's results for this term are published */
  published: boolean;
}

@Injectable()
export class GradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scales: GradingScalesService,
  ) {}

  /**
   * Final grade per subject = Σ(category weight % × obtained %) over the categories of the
   * student's OWN class for the term (BL-27 fixed this to ignore other classes' categories).
   * Parents see a term only once its results are published.
   */
  async forStudent(
    studentId: string,
    termId: string,
    user?: RequestUser,
  ): Promise<SubjectGrade[]> {
    if (!termId) return [];
    const term = await this.prisma.term.findUnique({
      where: { id: termId },
      select: { academicSessionId: true },
    });
    if (!term) return [];
    const enrolment = await this.prisma.enrollment.findFirst({
      where: { studentId, academicSessionId: term.academicSessionId },
      orderBy: { startDate: 'desc' },
      select: {
        campus: { select: { schoolId: true } },
        section: { select: { classId: true } },
      },
    });
    if (!enrolment) return [];
    const classId = enrolment.section.classId;

    const publication = await this.prisma.resultPublication.findUnique({
      where: { classId_termId: { classId, termId } },
      select: { bands: true },
    });
    if (!publication && user?.role === 'PARENT') return [];
    const bands: Band[] | null = publication
      ? (publication.bands as unknown as Band[])
      : ((await this.scales.defaultFor(enrolment.campus.schoolId))?.bands ??
        null);

    const categories = await this.prisma.assessmentCategory.findMany({
      where: { termId, classId },
      orderBy: { name: 'asc' },
      include: {
        assessments: {
          include: {
            subject: { select: { id: true, name: true } },
            marks: { where: { studentId }, select: { obtainedMarks: true } },
          },
        },
      },
    });

    const bySubject = new Map<
      string,
      Omit<SubjectGrade, 'letter' | 'remark' | 'gradePoint' | 'published'>
    >();
    for (const category of categories) {
      const bySubjectInCategory = new Map<
        string,
        { obtained: number; max: number; subjectName: string }
      >();
      for (const assessment of category.assessments) {
        const entry = bySubjectInCategory.get(assessment.subjectId) ?? {
          obtained: 0,
          max: 0,
          subjectName: assessment.subject.name,
        };
        entry.max += assessment.maxMarks;
        entry.obtained += assessment.marks[0]?.obtainedMarks ?? 0;
        bySubjectInCategory.set(assessment.subjectId, entry);
      }

      for (const [
        subjectId,
        { obtained, max, subjectName },
      ] of bySubjectInCategory) {
        const obtainedPercent = max > 0 ? (obtained / max) * 100 : 0;
        const grade = bySubject.get(subjectId) ?? {
          subjectId,
          subjectName,
          categories: [],
          obtainedMarks: 0,
          maxMarks: 0,
          finalPercent: 0,
        };
        grade.categories.push({
          name: category.name,
          weightPercent: category.weightPercent,
          obtainedPercent,
        });
        grade.obtainedMarks += obtained;
        grade.maxMarks += max;
        grade.finalPercent += (category.weightPercent / 100) * obtainedPercent;
        bySubject.set(subjectId, grade);
      }
    }

    return [...bySubject.values()].map((g) => {
      const finalPercent = Math.round(g.finalPercent * 10) / 10;
      const band = bands ? bandFor(finalPercent, bands) : null;
      return {
        ...g,
        finalPercent,
        categories: g.categories.map((c) => ({
          ...c,
          obtainedPercent: Math.round(c.obtainedPercent * 10) / 10,
        })),
        letter: band?.letter ?? null,
        remark: band?.remark ?? null,
        gradePoint: band?.gradePoint ?? null,
        published: !!publication,
      };
    });
  }
}
