import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertValidReferences } from '../common/prisma-create-guard';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';

export interface ClassSummary {
  id: string;
  name: string;
  campusId: string;
  campusName: string;
  academicSessionId: string;
  academicSessionLabel: string;
}

const WITH_PARENTS = {
  campus: { select: { name: true } },
  academicSession: { select: { label: true } },
} as const;

@Injectable()
export class ClassService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    name: string;
    campusId: string;
    academicSessionId: string;
    campus: { name: string };
    academicSession: { label: string };
  }): ClassSummary {
    return {
      id: record.id,
      name: record.name,
      campusId: record.campusId,
      campusName: record.campus.name,
      academicSessionId: record.academicSessionId,
      academicSessionLabel: record.academicSession.label,
    };
  }

  async create(
    dto: CreateClassDto,
    actingUserId: string,
  ): Promise<ClassSummary> {
    const record = await this.prisma.class
      .create({
        data: {
          campusId: dto.campusId,
          academicSessionId: dto.academicSessionId,
          name: dto.name,
        },
        include: WITH_PARENTS,
      })
      .catch((error: unknown) =>
        assertValidReferences(
          error,
          'Invalid campus or academic session reference.',
        ),
      );
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'class.create',
        entity: 'Class',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async list(): Promise<ClassSummary[]> {
    const records = await this.prisma.class.findMany({
      include: WITH_PARENTS,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(
    id: string,
    dto: UpdateClassDto,
    actingUserId: string,
  ): Promise<ClassSummary> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class not found');
    }
    const record = await this.prisma.class.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}) },
      include: WITH_PARENTS,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'class.update',
        entity: 'Class',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class not found');
    }
    try {
      await this.prisma.class.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Class');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'class.delete',
        entity: 'Class',
        entityId: id,
      },
    });
  }
}
