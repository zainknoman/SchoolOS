import {
  PagedResult,
  pageArgs,
  toPageRequest,
  type PageRequest,
} from '../common/pagination';
import {
  BadRequestException,
  ConflictException,
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
import {
  archiveTeacherTx,
  assertArchivedForErasure,
  disableLoginTx,
} from '../common/archive';
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

  /** Paged/searchable (BL-40): `q` matches name or e-mail. */
  async list(
    actingUser: RequestUser,
    employeeType?: EmployeeType,
    page: PageRequest = toPageRequest(),
    archived = false,
  ): Promise<PagedResult<StaffSummary>> {
    // BL-07: archived staff are left out unless `archived` is true (then only archived ones).
    let where: Prisma.StaffWhereInput = {
      archivedAt: archived ? { not: null } : null,
      ...(employeeType ? { employeeType } : {}),
    };
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return PagedResult.of([], 0, page);
    }
    if (scope.campusWhere) {
      where = { ...where, campus: scope.campusWhere };
    }
    // Only wrap when searching, so an unfiltered query is exactly the scope query.
    const filtered: Prisma.StaffWhereInput | undefined = page.q
      ? {
          AND: [
            where,
            {
              OR: [
                { name: { contains: page.q, mode: 'insensitive' as const } },
                { email: { contains: page.q, mode: 'insensitive' as const } },
              ],
            },
          ],
        }
      : where;
    const [records, total] = await Promise.all([
      this.prisma.staff.findMany({
        where: filtered,
        include: WITH_CAMPUS,
        orderBy: page.paged
          ? [{ name: 'asc' }, { id: 'asc' }]
          : { name: 'asc' },
        ...pageArgs(page),
      }),
      this.prisma.staff.count({ where: filtered }),
    ]);
    return PagedResult.of(
      records.map((r) => this.toSummary(r)),
      total,
      page,
    );
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
  /**
   * BL-07 (Q7): "deleting" a staff member archives them. A linked teacher is archived too (leaves
   * class-teacher and timetable slots; teaching history is end-dated) and any login is disabled
   * with its sessions revoked. Records stay readable; `erase` is the super-admin hard delete.
   */
  async archive(
    id: string,
    actingUser: RequestUser,
    reason?: string,
  ): Promise<{ id: string; archivedAt: Date }> {
    const staff = await this.getScopedStaff(id, actingUser);
    if (staff.archivedAt) {
      throw new ConflictException('This staff member is already archived');
    }
    const now = new Date();
    const note = reason?.trim() || null;
    await this.prisma.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id },
        data: {
          archivedAt: now,
          archivedById: actingUser.id,
          archiveReason: note,
        },
      });
      if (staff.teacherId) await archiveTeacherTx(tx, staff.teacherId, now);
      if (staff.userId) await disableLoginTx(tx, staff.userId, now);
      await tx.auditLog.create({
        data: {
          userId: actingUser.id,
          action: 'staff.archive',
          entity: 'Staff',
          entityId: id,
          metadata: JSON.stringify({
            reason: note,
            teacherId: staff.teacherId,
          }),
        },
      });
    });
    return { id, archivedAt: now };
  }

  /** Back into the lists. Logins stay disabled until re-enabled on purpose (account access). */
  async unarchive(id: string, actingUser: RequestUser): Promise<void> {
    const staff = await this.getScopedStaff(id, actingUser);
    if (!staff.archivedAt) {
      throw new ConflictException('This staff member is not archived');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id },
        data: { archivedAt: null, archivedById: null, archiveReason: null },
      });
      if (staff.teacherId) {
        await tx.teacher.update({
          where: { id: staff.teacherId },
          data: { archivedAt: null },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: actingUser.id,
          action: 'staff.unarchive',
          entity: 'Staff',
          entityId: id,
        },
      });
    });
  }

  /** BL-07: SUPER_ADMIN-only hard delete of an archived staff member (and their teacher + login). */
  async erase(id: string, actingUser: RequestUser): Promise<void> {
    const staff = await this.getScopedStaff(id, actingUser);
    assertArchivedForErasure(staff.archivedAt, 'staff member');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.staff.delete({ where: { id } });
        if (staff.teacherId) {
          const teacher = await tx.teacher.delete({
            where: { id: staff.teacherId },
          });
          await tx.user.delete({ where: { id: teacher.userId } });
        } else if (staff.userId) {
          await tx.user.delete({ where: { id: staff.userId } });
        }
      });
    } catch (error) {
      assertDeletable(error, 'staff member');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'staff.erase',
        entity: 'Staff',
        entityId: id,
        metadata: JSON.stringify({ archivedAt: staff.archivedAt }),
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
