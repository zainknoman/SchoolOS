import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmployeeType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { createStaffWithOptionalTeacher } from '../hiring/create-staff-with-optional-teacher';
import { assertCreatable } from '../common/prisma-create-guard';
import { assertDeletable } from '../common/prisma-delete-guard';
import { UpdateStaffDto } from './dto/update-staff.dto';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(record: {
    id: string;
    name: string;
    employeeType: EmployeeType;
    employmentStatus: string;
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

  async list(
    actingUser: RequestUser,
    employeeType?: EmployeeType,
  ): Promise<StaffSummary[]> {
    let where: Prisma.StaffWhereInput | undefined = employeeType
      ? { employeeType }
      : undefined;
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      where = { ...where, campus: scope.campusWhere };
    }
    const records = await this.prisma.staff.findMany({
      where,
      include: WITH_CAMPUS,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  private async getScopedStaff(id: string, actingUser: RequestUser) {
    const staff = await this.prisma.staff.findUnique({
      where: { id },
      include: { campus: { select: { name: true, schoolId: true } } },
    });
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }
    const scope = await this.orgScope.resolve(actingUser);
    if (
      !scope.allows({
        campusId: staff.campusId,
        schoolId: staff.campus.schoolId,
      })
    ) {
      throw new ForbiddenException(
        'Cannot access staff outside your own school',
      );
    }
    return staff;
  }

  async update(
    id: string,
    dto: UpdateStaffDto,
    actingUser: RequestUser,
  ): Promise<StaffSummary> {
    await this.getScopedStaff(id, actingUser);
    const data: Prisma.StaffUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.mobile !== undefined) data.mobile = dto.mobile.trim() || null;
    if (dto.email !== undefined) data.email = dto.email.trim() || null;
    if (dto.employmentStatus !== undefined)
      data.employmentStatus = dto.employmentStatus;
    const record = await this.prisma.staff.update({
      where: { id },
      data,
      include: WITH_CAMPUS,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'staff.update',
        entity: 'Staff',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  /**
   * Teachers own a Teacher row and a login User that this endpoint does not remove, so deleting only
   * the Staff row would orphan a working login — those are refused and should be marked Terminated
   * or Resigned instead. Everyone else (support/admin staff) is deleted outright.
   */
  async remove(id: string, actingUser: RequestUser): Promise<void> {
    const staff = await this.getScopedStaff(id, actingUser);
    if (staff.teacherId || staff.userId) {
      throw new BadRequestException(
        'This staff member has a login. Set their employment status to Terminated or Resigned instead of deleting.',
      );
    }
    try {
      await this.prisma.staff.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'staff member');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'staff.delete',
        entity: 'Staff',
        entityId: id,
      },
    });
  }

  async create(
    dto: CreateStaffDto,
    actingUser: RequestUser,
  ): Promise<{ id: string; name: string }> {
    await this.orgScope.assertCampusAccess(actingUser, dto.campusId);
    if (dto.employeeType === 'TEACHER' && !dto.login) {
      throw new BadRequestException(
        'A login identifier/password is required for a Teacher.',
      );
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
      assertCreatable(
        error,
        'This CNIC or login identifier is already in use.',
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'staff.create',
        entity: 'Staff',
        entityId: created.id,
        metadata: JSON.stringify({
          ...dto,
          login: dto.login ? { identifier: dto.login.identifier } : undefined,
        }),
      },
    });
    return created;
  }
}
