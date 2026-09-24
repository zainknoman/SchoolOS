import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeeStructureStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import { CreateFeeStructureDto } from './dto/create-fee-structure.dto';

export interface UpdateFeeStructureInput {
  name?: string;
  amount?: number;
  status?: FeeStructureStatus;
}

/**
 * Fee structures (BL-03, Q3): per school, with a lifecycle —
 *   DRAFT    prepared, editable, not yet issuable
 *   ACTIVE   issuable; still editable until first invoiced
 *   LOCKED   has been invoiced: name/amount frozen (vouchers keep their own copy anyway)
 *   ARCHIVED hidden from new vouchers; history kept; can be restored
 * A structure is never hard-deleted.
 */
@Injectable()
export class FeeStructuresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  async create(dto: CreateFeeStructureDto, actor: RequestUser) {
    const schoolId = await this.managedSchool(actor, dto.schoolId);
    const structure = await this.prisma.feeStructure.create({
      data: {
        name: dto.name.trim(),
        amount: dto.amount,
        schoolId,
        status: 'DRAFT',
      },
    });
    await this.audit(actor, 'fee-structure.create', structure.id, {
      name: structure.name,
      amount: dto.amount,
      schoolId,
    });
    return structure;
  }

  /** The caller's school's structures (+ legacy school-less ones until M5 is backfilled). */
  async list(
    actor: RequestUser,
    options: { schoolId?: string; includeArchived?: boolean } = {},
  ) {
    const scope = await this.orgScope.resolve(actor);
    if (scope.denied) return [];
    const where: Prisma.FeeStructureWhereInput = {
      ...(options.includeArchived ? {} : { status: { not: 'ARCHIVED' } }),
      ...(scope.unrestricted
        ? options.schoolId
          ? { schoolId: options.schoolId }
          : {}
        : { OR: [{ schoolId: scope.schoolId }, { schoolId: null }] }),
    };
    return this.prisma.feeStructure.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, dto: UpdateFeeStructureInput, actor: RequestUser) {
    const existing = await this.prisma.feeStructure.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Fee structure not found');
    await this.assertCanManage(existing.schoolId, actor);
    const invoiced =
      (await this.prisma.feeItem.count({ where: { feeStructureId: id } })) > 0;

    if (dto.name !== undefined || dto.amount !== undefined) {
      const editable =
        existing.status === 'DRAFT' ||
        (existing.status === 'ACTIVE' && !invoiced);
      if (!editable) {
        throw new BadRequestException(
          'This fee structure has been invoiced (or archived) and can no longer be edited — archive it and create a new one.',
        );
      }
    }
    let status: FeeStructureStatus | undefined;
    if (dto.status !== undefined && dto.status !== existing.status) {
      status = this.transition(existing.status, dto.status, invoiced);
    }
    const updated = await this.prisma.feeStructure.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(status ? { status } : {}),
      },
    });
    await this.audit(actor, 'fee-structure.update', id, dto);
    return updated;
  }

  /** Allowed lifecycle moves; LOCKED is only ever reached by issuing a voucher. */
  private transition(
    from: FeeStructureStatus,
    to: FeeStructureStatus,
    invoiced: boolean,
  ): FeeStructureStatus {
    if (to === 'ARCHIVED') return 'ARCHIVED';
    if (from === 'DRAFT' && to === 'ACTIVE') return 'ACTIVE';
    if (from === 'ACTIVE' && to === 'DRAFT' && !invoiced) return 'DRAFT';
    // Restoring an archived structure: it comes back LOCKED if it was ever invoiced.
    if (from === 'ARCHIVED' && (to === 'ACTIVE' || to === 'LOCKED')) {
      return invoiced ? 'LOCKED' : 'ACTIVE';
    }
    throw new BadRequestException(
      `A fee structure cannot move from ${from} to ${to}.`,
    );
  }

  private async managedSchool(
    actor: RequestUser,
    requested?: string,
  ): Promise<string> {
    const scope = await this.orgScope.resolve(actor);
    if (scope.unrestricted) {
      if (!requested) throw new BadRequestException('schoolId is required');
      const school = await this.prisma.school.findUnique({
        where: { id: requested },
        select: { id: true },
      });
      if (!school) throw new BadRequestException('School not found');
      return school.id;
    }
    if (scope.denied || !scope.schoolId) {
      throw new ForbiddenException('No school is linked to this account');
    }
    if (requested && requested !== scope.schoolId) {
      throw new ForbiddenException(
        'You can only manage your own school’s fee structures',
      );
    }
    return scope.schoolId;
  }

  private async assertCanManage(schoolId: string | null, actor: RequestUser) {
    const scope = await this.orgScope.resolve(actor);
    if (scope.unrestricted) return;
    if (scope.denied || !schoolId || schoolId !== scope.schoolId) {
      throw new ForbiddenException('You cannot manage this fee structure');
    }
  }

  private async audit(
    actor: RequestUser,
    action: string,
    entityId: string,
    metadata: object,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entity: 'FeeStructure',
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  }
}
