import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';

export interface CampusSummary {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
}

const WITH_SCHOOL = { school: { select: { name: true } } } as const;

@Injectable()
export class CampusService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: { id: string; name: string; schoolId: string; school: { name: string } }): CampusSummary {
    return { id: record.id, name: record.name, schoolId: record.schoolId, schoolName: record.school.name };
  }

  async create(dto: CreateCampusDto, actingUserId: string): Promise<CampusSummary> {
    const record = await this.prisma.campus.create({
      data: { schoolId: dto.schoolId, name: dto.name },
      include: WITH_SCHOOL,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'campus.create',
        entity: 'Campus',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async list(): Promise<CampusSummary[]> {
    const records = await this.prisma.campus.findMany({ include: WITH_SCHOOL, orderBy: { name: 'asc' } });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateCampusDto, actingUserId: string): Promise<CampusSummary> {
    const existing = await this.prisma.campus.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Campus not found');
    }
    const record = await this.prisma.campus.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}) },
      include: WITH_SCHOOL,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'campus.update',
        entity: 'Campus',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.campus.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Campus not found');
    }
    try {
      await this.prisma.campus.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Campus');
    }
    await this.prisma.auditLog.create({
      data: { userId: actingUserId, action: 'campus.delete', entity: 'Campus', entityId: id },
    });
  }
}
