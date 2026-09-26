import { assertSubjectUsable } from '../subjects/subject-guard';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertResultsNotPublished } from './result-publications.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { BulkMarksDto } from './dto/bulk-marks.dto';

export interface AssessmentSummary {
  id: string;
  assessmentCategoryId: string;
  subjectId: string;
  label: string;
  maxMarks: number;
}

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    assessmentCategoryId: string;
    subjectId: string;
    label: string;
    maxMarks: number;
  }): AssessmentSummary {
    return {
      id: record.id,
      assessmentCategoryId: record.assessmentCategoryId,
      subjectId: record.subjectId,
      label: record.label,
      maxMarks: record.maxMarks,
    };
  }

  /** Resolves the owning class id — used by the controller to run assertCanAccessClass. */
  async classIdForCategory(assessmentCategoryId: string): Promise<string> {
    const category = await this.prisma.assessmentCategory.findUnique({
      where: { id: assessmentCategoryId },
      select: { classId: true },
    });
    if (!category) {
      throw new NotFoundException('Assessment category not found');
    }
    return category.classId;
  }

  async classIdForAssessment(assessmentId: string): Promise<string> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { assessmentCategory: { select: { classId: true } } },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    return assessment.assessmentCategory.classId;
  }

  private async assertCategoryOpen(assessmentCategoryId: string) {
    const category = await this.prisma.assessmentCategory.findUnique({
      where: { id: assessmentCategoryId },
      select: { classId: true, termId: true },
    });
    if (category) {
      await assertResultsNotPublished(
        this.prisma,
        category.classId,
        category.termId,
      );
    }
  }

  async create(dto: CreateAssessmentDto): Promise<AssessmentSummary> {
    await this.assertCategoryOpen(dto.assessmentCategoryId);
    await assertSubjectUsable(this.prisma, dto.subjectId, {
      classId: await this.classIdForCategory(dto.assessmentCategoryId),
    });
    const record = await this.prisma.assessment.create({
      data: {
        assessmentCategoryId: dto.assessmentCategoryId,
        subjectId: dto.subjectId,
        label: dto.label,
        maxMarks: dto.maxMarks,
      },
    });
    return this.toSummary(record);
  }

  async findMany(assessmentCategoryId: string): Promise<AssessmentSummary[]> {
    const records = await this.prisma.assessment.findMany({
      where: { assessmentCategoryId },
      orderBy: { label: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(
    id: string,
    dto: UpdateAssessmentDto,
  ): Promise<AssessmentSummary> {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assessment not found');
    }
    if (dto.maxMarks !== undefined && dto.maxMarks !== existing.maxMarks) {
      await this.assertCategoryOpen(existing.assessmentCategoryId);
    }
    const record = await this.prisma.assessment.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.maxMarks !== undefined ? { maxMarks: dto.maxMarks } : {}),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assessment not found');
    }
    await this.assertCategoryOpen(existing.assessmentCategoryId);
    try {
      await this.prisma.assessment.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Assessment');
    }
  }

  async saveMarksBulk(
    assessmentId: string,
    dto: BulkMarksDto,
    enteredById: string,
  ) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: {
        maxMarks: true,
        assessmentCategory: { select: { classId: true } },
      },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    for (const mark of dto.marks) {
      if (mark.obtainedMarks > assessment.maxMarks) {
        throw new BadRequestException(
          `Student ${mark.studentId}: obtained marks (${mark.obtainedMarks}) exceed the maximum (${assessment.maxMarks}) for this assessment`,
        );
      }
    }

    const enrolled = await this.prisma.enrollment.findMany({
      where: {
        status: 'ACTIVE',
        section: { classId: assessment.assessmentCategory.classId },
      },
      select: { studentId: true },
    });
    const enrolledIds = new Set(enrolled.map((e) => e.studentId));
    for (const mark of dto.marks) {
      if (!enrolledIds.has(mark.studentId)) {
        throw new BadRequestException(
          `Student ${mark.studentId} is not enrolled in this assessment's class`,
        );
      }
    }

    const records = await this.prisma.$transaction(async (tx) => {
      const results: Awaited<ReturnType<typeof tx.mark.upsert>>[] = [];
      for (const mark of dto.marks) {
        const record = await tx.mark.upsert({
          where: {
            assessmentId_studentId: { assessmentId, studentId: mark.studentId },
          },
          create: {
            assessmentId,
            studentId: mark.studentId,
            obtainedMarks: mark.obtainedMarks,
            enteredById,
          },
          update: { obtainedMarks: mark.obtainedMarks, enteredById },
        });
        results.push(record);
      }
      await tx.auditLog.create({
        data: {
          userId: enteredById,
          action: 'gradebook.marks-bulk',
          entity: 'Assessment',
          entityId: assessmentId,
          metadata: JSON.stringify({
            count: dto.marks.length,
            studentIds: dto.marks.map((m) => m.studentId),
          }),
        },
      });
      return results;
    });

    return records.map((r) => ({
      id: r.id,
      assessmentId: r.assessmentId,
      studentId: r.studentId,
      obtainedMarks: r.obtainedMarks,
    }));
  }
}
