import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertValidReferences } from '../common/prisma-create-guard';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import type { RequestUser } from '../common/student-access.service';

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

  private toSummary(record: {
    id: string;
    name: string;
    schoolId: string;
    school: { name: string };
  }): CampusSummary {
    return {
      id: record.id,
      name: record.name,
      schoolId: record.schoolId,
      schoolName: record.school.name,
    };
  }

  async create(
    dto: CreateCampusDto,
    actingUserId: string,
  ): Promise<CampusSummary> {
    const record = await this.prisma.campus
      .create({
        data: { schoolId: dto.schoolId, name: dto.name },
        include: WITH_SCHOOL,
      })
      .catch((error: unknown) =>
        assertValidReferences(error, 'Invalid school reference.'),
      );
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

  async list(actingUser: RequestUser): Promise<CampusSummary[]> {
    let schoolId: string | undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        // Fail closed: a non-SUPER_ADMIN caller with no schoolId sees no campuses at all.
        return [];
      }
      schoolId = admin.schoolId;
    }
    const records = await this.prisma.campus.findMany({
      where: schoolId ? { schoolId } : undefined,
      include: WITH_SCHOOL,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(
    id: string,
    dto: UpdateCampusDto,
    actingUserId: string,
  ): Promise<CampusSummary> {
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
      data: {
        userId: actingUserId,
        action: 'campus.delete',
        entity: 'Campus',
        entityId: id,
      },
    });
  }
}
