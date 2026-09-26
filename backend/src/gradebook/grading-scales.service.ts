import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import { normaliseBands, type Band } from './grade-bands';
import type {
  CreateGradingScaleDto,
  UpdateGradingScaleDto,
} from './dto/grading-scale.dto';

export interface GradingScaleView {
  id: string;
  schoolId: string;
  name: string;
  isDefault: boolean;
  /** highest band first */
  bands: Band[];
  updatedAt: Date;
}

const INCLUDE = {
  bands: { orderBy: { minPercent: 'desc' } },
} satisfies Prisma.GradingScaleInclude;

type ScaleRow = Prisma.GradingScaleGetPayload<{ include: typeof INCLUDE }>;

function toView(row: ScaleRow): GradingScaleView {
  return {
    id: row.id,
    schoolId: row.schoolId,
    name: row.name,
    isDefault: row.isDefault,
    bands: row.bands.map((b) => ({
      minPercent: b.minPercent,
      letter: b.letter,
      remark: b.remark,
      gradePoint: b.gradePoint,
    })),
    updatedAt: row.updatedAt,
  };
}

/**
 * BL-27 (Q6): per-school grading scales. Read by the school's staff; written — audited — by a
 * school-wide SCHOOL_ADMIN (campus-level admins read only) or SUPER_ADMIN (naming the school).
 * At most one scale per school is the default; the first scale of a school becomes it.
 */
@Injectable()
export class GradingScalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  async list(
    user: RequestUser,
    schoolId?: string,
  ): Promise<GradingScaleView[]> {
    let where: Prisma.GradingScaleWhereInput;
    if (user.role === 'SUPER_ADMIN') {
      where = schoolId ? { schoolId } : {};
    } else {
      const scope = await this.orgScope.resolve(user);
      if (scope.denied || !scope.schoolId) return [];
      where = { schoolId: scope.schoolId };
    }
    const rows = await this.prisma.gradingScale.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: INCLUDE,
    });
    return rows.map(toView);
  }

  async create(
    user: RequestUser,
    dto: CreateGradingScaleDto,
  ): Promise<GradingScaleView> {
    const schoolId = await this.writableSchool(user, dto.schoolId);
    const bands = normaliseBands(dto.bands);
    const existing = await this.prisma.gradingScale.count({
      where: { schoolId },
    });
    const isDefault = dto.isDefault === true || existing === 0;
    const row = await this.write(() =>
      this.prisma.$transaction(async (tx) => {
        if (isDefault) {
          await tx.gradingScale.updateMany({
            where: { schoolId, isDefault: true },
            data: { isDefault: false },
          });
        }
        const created = await tx.gradingScale.create({
          data: {
            schoolId,
            name: dto.name.trim(),
            isDefault,
            updatedById: user.id,
            bands: { create: bands },
          },
          include: INCLUDE,
        });
        await this.audit(tx, user, 'grading-scale.create', created.id, {
          schoolId,
          name: created.name,
          isDefault,
          bands,
        });
        return created;
      }),
    );
    return toView(row);
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateGradingScaleDto,
  ): Promise<GradingScaleView> {
    const existing = await this.prisma.gradingScale.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!existing) throw new NotFoundException('Grading scale not found');
    await this.writableSchool(user, existing.schoolId);
    const bands = dto.bands ? normaliseBands(dto.bands) : null;
    if (dto.isDefault === false && existing.isDefault) {
      throw new BadRequestException(
        'Make another scale the default instead of turning this one off',
      );
    }
    const row = await this.write(() =>
      this.prisma.$transaction(async (tx) => {
        if (dto.isDefault === true && !existing.isDefault) {
          await tx.gradingScale.updateMany({
            where: { schoolId: existing.schoolId, isDefault: true },
            data: { isDefault: false },
          });
        }
        if (bands) {
          await tx.gradeBand.deleteMany({ where: { gradingScaleId: id } });
        }
        const updated = await tx.gradingScale.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.isDefault === true ? { isDefault: true } : {}),
            updatedById: user.id,
            ...(bands ? { bands: { create: bands } } : {}),
          },
          include: INCLUDE,
        });
        await this.audit(tx, user, 'grading-scale.update', id, {
          before: toView(existing),
          after: toView(updated),
        });
        return updated;
      }),
    );
    return toView(row);
  }

  /** Published results keep their own copy of the bands, so a scale can always be removed. */
  async delete(user: RequestUser, id: string): Promise<void> {
    const existing = await this.prisma.gradingScale.findUnique({
      where: { id },
      include: INCLUDE,
    });
    if (!existing) throw new NotFoundException('Grading scale not found');
    await this.writableSchool(user, existing.schoolId);
    await this.prisma.$transaction(async (tx) => {
      await tx.gradingScale.delete({ where: { id } });
      await this.audit(tx, user, 'grading-scale.delete', id, toView(existing));
    });
  }

  /** The school's default scale (null when it has none). */
  async defaultFor(schoolId: string): Promise<GradingScaleView | null> {
    const row = await this.prisma.gradingScale.findFirst({
      where: { schoolId, isDefault: true },
      include: INCLUDE,
    });
    return row ? toView(row) : null;
  }

  private async writableSchool(
    user: RequestUser,
    schoolId: string | undefined,
  ): Promise<string> {
    if (user.role === 'SUPER_ADMIN') {
      if (!schoolId) throw new BadRequestException('schoolId is required');
      const school = await this.prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true },
      });
      if (!school) throw new NotFoundException('School not found');
      return school.id;
    }
    const scope = await this.orgScope.resolve(user);
    if (scope.denied || !scope.schoolId) {
      throw new ForbiddenException('Your account is not linked to a school');
    }
    if (schoolId && schoolId !== scope.schoolId) {
      throw new ForbiddenException(
        "You may only manage your own school's grading scales",
      );
    }
    if (scope.campusId) {
      throw new ForbiddenException(
        'Grading scales apply to the whole school; ask a school-wide admin',
      );
    }
    return scope.schoolId;
  }

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'This school already has a grading scale with that name',
        );
      }
      throw err;
    }
  }

  private audit(
    tx: Prisma.TransactionClient,
    user: RequestUser,
    action: string,
    entityId: string,
    metadata: unknown,
  ) {
    return tx.auditLog.create({
      data: {
        userId: user.id,
        action,
        entity: 'GradingScale',
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  }
}
