import { BadRequestException, Injectable } from '@nestjs/common';
import { EmployeeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createStaffWithOptionalTeacher } from '../hiring/create-staff-with-optional-teacher';
import { assertCreatable } from '../common/prisma-create-guard';
import { CreateStaffDto } from './dto/create-staff.dto';
import type { RequestUser } from '../common/student-access.service';

export interface StaffSummary {
  id: string;
  name: string;
  employeeType: EmployeeType;
  employmentStatus: string;
  campusName: string;
}

const WITH_CAMPUS = { campus: { select: { name: true } } } as const;

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string; name: string; employeeType: EmployeeType; employmentStatus: string;
    campus: { name: string };
  }): StaffSummary {
    return {
      id: record.id,
      name: record.name,
      employeeType: record.employeeType,
      employmentStatus: record.employmentStatus,
      campusName: record.campus.name,
    };
  }

  async list(actingUser: RequestUser, employeeType?: EmployeeType): Promise<StaffSummary[]> {
    let where: Prisma.StaffWhereInput | undefined = employeeType ? { employeeType } : undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        return [];
      }
      where = { ...where, campus: { schoolId: admin.schoolId } };
    }
    const records = await this.prisma.staff.findMany({
      where,
      include: WITH_CAMPUS,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async create(dto: CreateStaffDto, actingUserId: string): Promise<{ id: string; name: string }> {
    if (dto.employeeType === 'TEACHER' && !dto.login) {
      throw new BadRequestException('A login identifier/password is required for a Teacher.');
    }

    let created: { id: string; name: string };
    try {
      created = await this.prisma.$transaction((tx) =>
        createStaffWithOptionalTeacher(tx, {
          name: dto.name,
          employeeType: dto.employeeType,
          campusId: dto.campusId,
          dateOfBirth: dto.dateOfBirth,
          cnic: dto.cnic,
          mobile: dto.mobile,
          email: dto.email,
          joiningDate: dto.joiningDate,
          login: dto.login,
        }),
      );
    } catch (error) {
      assertCreatable(error, 'This CNIC or login identifier is already in use.');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'staff.create',
        entity: 'Staff',
        entityId: created.id,
        metadata: JSON.stringify({ ...dto, login: dto.login ? { identifier: dto.login.identifier } : undefined }),
      },
    });
    return created;
  }
}