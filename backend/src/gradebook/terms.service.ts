import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertCreatable } from '../common/prisma-create-guard';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';

export interface TermSummary {
  id: string;
  academicSessionId: string;
  label: string;
  order: number;
  startDate: string;
  endDate: string;
}

@Injectable()
export class TermsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  /**
   * BL-03: a term belongs to its session's school. Staff may read/write only their school's
   * terms, a parent those of their children's schools. A legacy school-less session (before the
   * M3 backfill) stays open as before.
   */
  private async assertSessionInScope(
    academicSessionId: string,
    actor: RequestUser,
    mode: 'read' | 'write',
  ): Promise<void> {
    const session = await this.prisma.academicSession.findUnique({
      where: { id: academicSessionId },
      select: { schoolId: true },
    });
    if (!session) throw new NotFoundException('Academic session not found');
    if (!session.schoolId) return;
    const scope = await this.orgScope.resolve(actor);
    if (scope.unrestricted) return;
    if (!scope.denied && scope.schoolId === session.schoolId) return;
    if (mode === 'read' && actor.role === 'PARENT') {
      const linked = await this.prisma.studentParent.findFirst({
        where: {
          parentProfile: { userId: actor.id },
          student: {
            enrollments: { some: { campus: { schoolId: session.schoolId } } },
          },
        },
        select: { id: true },
      });
      if (linked) return;
    }
    throw new ForbiddenException(
      'This academic session belongs to another school',
    );
  }

  private toSummary(record: {
    id: string;
    academicSessionId: string;
    label: string;
    order: number;
    startDate: Date;
    endDate: Date;
  }): TermSummary {
    return {
      id: record.id,
      academicSessionId: record.academicSessionId,
      label: record.label,
      order: record.order,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
    };
  }

  async create(dto: CreateTermDto, actor: RequestUser): Promise<TermSummary> {
    await this.assertSessionInScope(dto.academicSessionId, actor, 'write');
    let record;
    try {
      record = await this.prisma.term.create({
        data: {
          academicSessionId: dto.academicSessionId,
          label: dto.label,
          order: dto.order,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      });
    } catch (error) {
      assertCreatable(
        error,
        'A term with this label already exists for this academic session.',
      );
    }
    return this.toSummary(record);
  }

  async findMany(
    academicSessionId: string,
    actor: RequestUser,
  ): Promise<TermSummary[]> {
    await this.assertSessionInScope(academicSessionId, actor, 'read');
    const records = await this.prisma.term.findMany({
      where: { academicSessionId },
      orderBy: { order: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(
    id: string,
    dto: UpdateTermDto,
    actor: RequestUser,
  ): Promise<TermSummary> {
    const existing = await this.prisma.term.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Term not found');
    }
    await this.assertSessionInScope(existing.academicSessionId, actor, 'write');
    const record = await this.prisma.term.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: new Date(dto.startDate) }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: new Date(dto.endDate) }
          : {}),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actor: RequestUser): Promise<void> {
    const existing = await this.prisma.term.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Term not found');
    }
    await this.assertSessionInScope(existing.academicSessionId, actor, 'write');
    try {
      await this.prisma.term.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Term');
    }
  }
}
