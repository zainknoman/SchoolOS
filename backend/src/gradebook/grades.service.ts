import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SubjectGrade {
  subjectId: string;
  subjectName: string;
  categories: { name: string; weightPercent: number; obtainedPercent: number }[];
  finalPercent: number;
}

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async forStudent(studentId: string, termId: string): Promise<SubjectGrade[]> {
    const categories = await this.prisma.assessmentCategory.findMany({
      where: { termId },
      include: {
        assessments: {
          include: {
            subject: { select: { id: true, name: true } },
            marks: { where: { studentId }, select: { obtainedMarks: true } },
          },
        },
      },
    });

    const bySubject = new Map<string, SubjectGrade>();
    for (const category of categories) {
      const bySubjectInCategory = new Map<string, { obtained: number; max: number; subjectName: string }>();
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

      for (const [subjectId, { obtained, max, subjectName }] of bySubjectInCategory) {
        const obtainedPercent = max > 0 ? (obtained / max) * 100 : 0;
        const grade = bySubject.get(subjectId) ?? { subjectId, subjectName, categories: [], finalPercent: 0 };
        grade.categories.push({ name: category.name, weightPercent: category.weightPercent, obtainedPercent });
        grade.finalPercent += (category.weightPercent / 100) * obtainedPercent;
        bySubject.set(subjectId, grade);
      }
    }

    return [...bySubject.values()].map((g) => ({
      ...g,
      finalPercent: Math.round(g.finalPercent * 10) / 10,
      categories: g.categories.map((c) => ({ ...c, obtainedPercent: Math.round(c.obtainedPercent * 10) / 10 })),
    }));
  }
}
