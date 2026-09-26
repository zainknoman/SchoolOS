import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AssessmentCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCreatable } from '../common/prisma-create-guard';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateAssessmentCategoryDto } from './dto/create-assessment-category.dto';
import { UpdateAssessmentCategoryDto } from './dto/update-assessment-category.dto';
import { assertResultsNotPublished } from './result-publications.service';

export interface AssessmentCategorySummary {
  id: string;
  classId: string;
  termId: string;
  name: string;
  weightPercent: number;
}

export interface AssessmentCategoryWithWarning extends AssessmentCategorySummary {
  weightTotalWarning: string | null;
}

@Injectable()
export class AssessmentCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    classId: string;
    termId: string;
    name: string;
    weightPercent: number;
  }): AssessmentCategorySummary {
    return {
      id: record.id,
      classId: record.classId,
      termId: record.termId,
      name: record.name,
      weightPercent: record.weightPercent,
    };
  }

  private async weightWarning(
    classId: string,
    termId: string,
  ): Promise<string | null> {
    const siblings = await this.prisma.assessmentCategory.findMany({
      where: { classId, termId },
      select: { weightPercent: true },
    });
    const total = siblings.reduce((sum, s) => sum + s.weightPercent, 0);
    return total === 100
      ? null
      : `Category weights for this class/term total ${total}%, not 100% — results cannot be published until they total 100%.`;
  }

  /** The owning class — the controller checks the caller's access to it. */
  async classIdOf(id: string): Promise<string> {
    const category = await this.prisma.assessmentCategory.findUnique({
      where: { id },
      select: { classId: true },
    });
    if (!category) throw new NotFoundException('Assessment category not found');
    return category.classId;
  }

  async create(
    dto: CreateAssessmentCategoryDto,
  ): Promise<AssessmentCategoryWithWarning> {
    const [klass, term] = await Promise.all([
      this.prisma.class.findUnique({
        where: { id: dto.classId },
        select: { academicSessionId: true },
      }),
      this.prisma.term.findUnique({
        where: { id: dto.termId },
        select: { academicSessionId: true },
      }),
    ]);
    if (!klass) throw new NotFoundException('Class not found');
    if (!term || term.academicSessionId !== klass.academicSessionId) {
      throw new BadRequestException("The term is not in this class's session");
    }
    await assertResultsNotPublished(this.prisma, dto.classId, dto.termId);
    let record: AssessmentCategory;
    try {
      record = await this.prisma.assessmentCategory.create({
        data: {
          classId: dto.classId,
          termId: dto.termId,
          name: dto.name,
          weightPercent: dto.weightPercent,
        },
      });
    } catch (error) {
      assertCreatable(
        error,
        'A category with this name already exists for this class and term.',
      );
    }
    const weightTotalWarning = await this.weightWarning(
      record.classId,
      record.termId,
    );
    return { ...this.toSummary(record), weightTotalWarning };
  }

  async findMany(
    classId: string,
    termId: string,
  ): Promise<AssessmentCategorySummary[]> {
    const records = await this.prisma.assessmentCategory.findMany({
      where: { classId, termId },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(
    id: string,
    dto: UpdateAssessmentCategoryDto,
  ): Promise<AssessmentCategoryWithWarning> {
    const existing = await this.prisma.assessmentCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Assessment category not found');
    }
    await assertResultsNotPublished(
      this.prisma,
      existing.classId,
      existing.termId,
    );
    const record = await this.prisma.assessmentCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.weightPercent !== undefined
          ? { weightPercent: dto.weightPercent }
          : {}),
      },
    });
    const weightTotalWarning = await this.weightWarning(
      record.classId,
      record.termId,
    );
    return { ...this.toSummary(record), weightTotalWarning };
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.assessmentCategory.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Assessment category not found');
    }
    await assertResultsNotPublished(
      this.prisma,
      existing.classId,
      existing.termId,
    );
    try {
      await this.prisma.assessmentCategory.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Assessment category');
    }
  }
}
