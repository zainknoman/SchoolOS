import {
  BadRequestException,
  ConflictException,
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
import { GradingScalesService } from './grading-scales.service';
import { weightsTotal100 } from './grade-bands';

export interface PublicationStatus {
  classId: string;
  termId: string;
  published: boolean;
  publishedAt: Date | null;
  scaleName: string | null;
  categoryCount: number;
  weightTotal: number;
  /** why publishing is refused right now (empty = it may be published) */
  blockers: string[];
}

/**
 * Anything that changes how a class/term's grades are computed — its categories and assessments —
 * is frozen while its results are published (BL-27). Marks stay editable (BL-06 versions cards).
 */
export async function assertResultsNotPublished(
  prisma: PrismaService | Prisma.TransactionClient,
  classId: string,
  termId: string,
): Promise<void> {
  const published = await prisma.resultPublication.findUnique({
    where: { classId_termId: { classId, termId } },
    select: { id: true },
  });
  if (published) {
    throw new ConflictException(
      "This class's results for the term are published; unpublish them before changing categories or assessments",
    );
  }
}

/**
 * BL-27 (Q6, KI-16): results of a class for a term are published — made visible to parents and
 * fixed to the school's default grading scale at that moment — only when the class's category
 * weights for the term total 100 %. Publishing and unpublishing are audited, by the class's
 * school admins or SUPER_ADMIN.
 */
@Injectable()
export class ResultPublicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
    private readonly access: StudentAccessService,
    private readonly scales: GradingScalesService,
  ) {}

  async status(
    user: RequestUser,
    classId: string,
    termId: string,
  ): Promise<PublicationStatus> {
    await this.access.assertCanAccessClass(user, classId);
    const { klass } = await this.classAndTerm(classId, termId);
    return this.computeStatus(klass.campus.schoolId, classId, termId);
  }

  async publish(
    user: RequestUser,
    classId: string,
    termId: string,
  ): Promise<PublicationStatus> {
    const { klass } = await this.writable(user, classId, termId);
    const status = await this.computeStatus(
      klass.campus.schoolId,
      classId,
      termId,
    );
    if (status.published) {
      throw new ConflictException('These results are already published');
    }
    if (status.blockers.length) {
      throw new BadRequestException(status.blockers.join(' '));
    }
    const scale = await this.scales.defaultFor(klass.campus.schoolId);
    if (!scale) throw new BadRequestException('No default grading scale');
    await this.prisma.$transaction(async (tx) => {
      const created = await tx.resultPublication.create({
        data: {
          classId,
          termId,
          gradingScaleId: scale.id,
          scaleName: scale.name,
          bands: scale.bands as unknown as Prisma.InputJsonValue,
          publishedById: user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'results.publish',
          entity: 'ResultPublication',
          entityId: created.id,
          metadata: JSON.stringify({
            classId,
            termId,
            gradingScaleId: scale.id,
            weightTotal: status.weightTotal,
          }),
        },
      });
    });
    return this.computeStatus(klass.campus.schoolId, classId, termId);
  }

  async unpublish(
    user: RequestUser,
    classId: string,
    termId: string,
  ): Promise<PublicationStatus> {
    const { klass } = await this.writable(user, classId, termId);
    const existing = await this.prisma.resultPublication.findUnique({
      where: { classId_termId: { classId, termId } },
    });
    if (!existing)
      throw new NotFoundException('These results are not published');
    await this.prisma.$transaction([
      this.prisma.resultPublication.delete({ where: { id: existing.id } }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'results.unpublish',
          entity: 'ResultPublication',
          entityId: existing.id,
          metadata: JSON.stringify({
            classId,
            termId,
            publishedAt: existing.publishedAt,
          }),
        },
      }),
    ]);
    return this.computeStatus(klass.campus.schoolId, classId, termId);
  }

  private async computeStatus(
    schoolId: string,
    classId: string,
    termId: string,
  ): Promise<PublicationStatus> {
    const [categories, publication, scale] = await Promise.all([
      this.prisma.assessmentCategory.findMany({
        where: { classId, termId },
        select: { weightPercent: true },
      }),
      this.prisma.resultPublication.findUnique({
        where: { classId_termId: { classId, termId } },
      }),
      this.scales.defaultFor(schoolId),
    ]);
    const weightTotal =
      Math.round(categories.reduce((s, c) => s + c.weightPercent, 0) * 100) /
      100;
    const blockers: string[] = [];
    if (!publication) {
      if (categories.length === 0) {
        blockers.push('This class has no assessment categories for the term.');
      } else if (!weightsTotal100(weightTotal)) {
        blockers.push(
          `Category weights total ${weightTotal}%, not 100%; correct them before publishing.`,
        );
      }
      if (!scale) {
        blockers.push('The school has no default grading scale yet.');
      }
    }
    return {
      classId,
      termId,
      published: !!publication,
      publishedAt: publication?.publishedAt ?? null,
      scaleName: publication?.scaleName ?? scale?.name ?? null,
      categoryCount: categories.length,
      weightTotal,
      blockers,
    };
  }

  private async classAndTerm(classId: string, termId: string) {
    const [klass, term] = await Promise.all([
      this.prisma.class.findUnique({
        where: { id: classId },
        include: { campus: { select: { schoolId: true } } },
      }),
      this.prisma.term.findUnique({ where: { id: termId } }),
    ]);
    if (!klass) throw new NotFoundException('Class not found');
    if (!term || term.academicSessionId !== klass.academicSessionId) {
      throw new BadRequestException("The term is not in this class's session");
    }
    return { klass, term };
  }

  private async writable(user: RequestUser, classId: string, termId: string) {
    const found = await this.classAndTerm(classId, termId);
    if (user.role !== 'SUPER_ADMIN') {
      const scope = await this.orgScope.resolve(user);
      if (
        !scope.allows({
          campusId: found.klass.campusId,
          schoolId: found.klass.campus.schoolId,
        })
      ) {
        throw new ForbiddenException('You do not have access to this class');
      }
    }
    return found;
  }
}
