import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

export interface SchoolSummary {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  campusCount: number;
  studentCount: number;
  staffCount: number;
}

@Injectable()
export class SchoolService {
  constructor(private readonly prisma: PrismaService) {}

  // Enrollment/Staff have no direct schoolId — both only reach it through Campus — so these
  // counts go via campusId scoped to this school's own campuses, the same indirection
  // DashboardService already uses for its own cross-relation school-scoped counts.
  private async withStats(record: { id: string; name: string; address: string | null; phone: string | null; email: string | null }): Promise<SchoolSummary> {
    const [campusCount, studentCount, staffCount] = await Promise.all([
      this.prisma.campus.count({ where: { schoolId: record.id } }),
      this.prisma.enrollment.count({ where: { status: 'ACTIVE', campus: { schoolId: record.id } } }),
      this.prisma.staff.count({ where: { campus: { schoolId: record.id } } }),
    ]);
    return { ...record, campusCount, studentCount, staffCount };
  }

  async create(dto: CreateSchoolDto, actingUserId: string): Promise<SchoolSummary> {
    const record = await this.prisma.school.create({
      data: { name: dto.name, address: dto.address, phone: dto.phone, email: dto.email },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'school.create',
        entity: 'School',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.withStats(record);
  }

  async list(): Promise<SchoolSummary[]> {
    const records = await this.prisma.school.findMany({ orderBy: { name: 'asc' } });
    return Promise.all(records.map((r) => this.withStats(r)));
  }

  async update(id: string, dto: UpdateSchoolDto, actingUserId: string): Promise<SchoolSummary> {
    const existing = await this.prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('School not found');
    }
    const record = await this.prisma.school.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.address !== undefined ? { address: dto.address } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
      },
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
    return this.withStats(record);
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
