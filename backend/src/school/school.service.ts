import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

export interface SchoolSummary {
  id: string;
  name: string;
}

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSchoolDto, actingUserId: string): Promise<SchoolSummary> {
    const record = await this.prisma.school.create({ data: { name: dto.name } });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'school.create',
        entity: 'School',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return { id: record.id, name: record.name };
  }

  async list(): Promise<SchoolSummary[]> {
    const records = await this.prisma.school.findMany({ orderBy: { name: 'asc' } });
    return records.map((r) => ({ id: r.id, name: r.name }));
  }

  async update(id: string, dto: UpdateSchoolDto, actingUserId: string): Promise<SchoolSummary> {
    const existing = await this.prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('School not found');
    }
    const record = await this.prisma.school.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}) },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'school.update',
        entity: 'School',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return { id: record.id, name: record.name };
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('School not found');
    }
    try {
      await this.prisma.school.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'School');
    }
    await this.prisma.auditLog.create({
      data: { userId: actingUserId, action: 'school.delete', entity: 'School', entityId: id },
    });
  }
}
