import { Injectable, NotFoundException } from '@nestjs/common';
import type { AssessmentCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertCreatable } from '../common/prisma-create-guard';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateAssessmentCategoryDto } from './dto/create-assessment-category.dto';
import { UpdateAssessmentCategoryDto } from './dto/update-assessment-category.dto';

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
      : `Category weights for this class/term total ${total}%, not 100% — grades will be understated or overstated until this is corrected.`;
  }

  async create(
    dto: CreateAssessmentCategoryDto,
  ): Promise<AssessmentCategoryWithWarning> {
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
    try {
      await this.prisma.assessmentCategory.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Assessment category');
    }
  }
}
