import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';

export interface AcademicSessionSummary {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

@Injectable()
export class AcademicSessionService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    label: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  }): AcademicSessionSummary {
    return {
      id: record.id,
      label: record.label,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
      isActive: record.isActive,
    };
  }

  async create(
    dto: CreateAcademicSessionDto,
    actingUserId: string,
  ): Promise<AcademicSessionSummary> {
    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        await tx.academicSession.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }
      return tx.academicSession.create({
        data: {
          label: dto.label,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          isActive: dto.isActive,
        },
      });
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'academic-session.create',
        entity: 'AcademicSession',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async list(): Promise<AcademicSessionSummary[]> {
    const records = await this.prisma.academicSession.findMany({
      orderBy: { startDate: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(
    id: string,
    dto: UpdateAcademicSessionDto,
    actingUserId: string,
  ): Promise<AcademicSessionSummary> {
    const existing = await this.prisma.academicSession.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Academic session not found');
    }
    if (dto.isActive === false && existing.isActive) {
      throw new BadRequestException(
        'Cannot deactivate the only active academic session — activate a different session instead.',
      );
    }
    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        await tx.academicSession.updateMany({
          where: { isActive: true, id: { not: id } },
          data: { isActive: false },
        });
      }
      return tx.academicSession.update({
        where: { id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.startDate !== undefined
            ? { startDate: new Date(dto.startDate) }
            : {}),
          ...(dto.endDate !== undefined
            ? { endDate: new Date(dto.endDate) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'academic-session.update',
        entity: 'AcademicSession',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.academicSession.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Academic session not found');
    }
    if (existing.isActive) {
      throw new BadRequestException(
        'Cannot delete the active academic session — activate a different session first.',
      );
    }
    try {
      await this.prisma.academicSession.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Academic session');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'academic-session.delete',
        entity: 'AcademicSession',
        entityId: id,
      },
    });
  }
}
