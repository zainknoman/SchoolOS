import { Injectable, NotFoundException } from '@nestjs/common';
import { OrgStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import {
  assertCreatable,
  assertValidReferences,
} from '../common/prisma-create-guard';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

export interface SchoolSummary {
  id: string;
  name: string;
  code: string | null;
  registrationNumber: string | null;
  website: string | null;
  logoFileId: string | null;
  principalName: string | null;
  principalPhone: string | null;
  principalEmail: string | null;
  establishedDate: Date | null;
  schoolType: string | null;
  educationBoard: string | null;
  status: OrgStatus;
  timezone: string | null;
  currency: string | null;
  alternatePhone: string | null;
  addressId: string | null;
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
  private async withStats(
    record: Omit<SchoolSummary, 'campusCount' | 'studentCount' | 'staffCount'>,
  ): Promise<SchoolSummary> {
    const [campusCount, studentCount, staffCount] = await Promise.all([
      this.prisma.campus.count({ where: { schoolId: record.id } }),
      this.prisma.enrollment.count({
        where: { status: 'ACTIVE', campus: { schoolId: record.id } },
      }),
      this.prisma.staff.count({ where: { campus: { schoolId: record.id } } }),
    ]);
    return { ...record, campusCount, studentCount, staffCount };
  }

  async create(
    dto: CreateSchoolDto,
    actingUserId: string,
  ): Promise<SchoolSummary> {
    let record: Parameters<SchoolService['withStats']>[0];
    try {
      record = await this.prisma.school.create({
        data: {
          ...dto,
          establishedDate: dto.establishedDate
            ? new Date(dto.establishedDate)
            : undefined,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        assertCreatable(error, 'This school code is already in use.');
      }
      assertValidReferences(error, 'Invalid logo or address reference.');
    }
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
    const records = await this.prisma.school.findMany({
      orderBy: { name: 'asc' },
    });
    return Promise.all(records.map((r) => this.withStats(r)));
  }

  async update(
    id: string,
    dto: UpdateSchoolDto,
    actingUserId: string,
  ): Promise<SchoolSummary> {
    const existing = await this.prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('School not found');
    }
    const { establishedDate, ...rest } = dto;
    let record: Parameters<SchoolService['withStats']>[0];
    try {
      record = await this.prisma.school.update({
        where: { id },
        data: {
          ...rest,
          ...(establishedDate !== undefined
            ? { establishedDate: new Date(establishedDate) }
            : {}),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        assertCreatable(error, 'This school code is already in use.');
      }
      assertValidReferences(error, 'Invalid logo or address reference.');
    }
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
      data: {
        userId: actingUserId,
        action: 'school.delete',
        entity: 'School',
        entityId: id,
      },
    });
  }
}
