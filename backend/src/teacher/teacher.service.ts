import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { archiveTeacherTx, assertArchivedForErasure } from '../common/archive';
import { assertCreatable } from '../common/prisma-create-guard';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import type { RequestUser } from '../common/student-access.service';
import {
  createTeacherWithUser,
  type CreatedTeacher,
} from './create-teacher-with-user';

export interface TeacherAdminSummary {
  id: string;
  identifier: string;
  name: string;
}

const WITH_USER = { user: { select: { identifier: true } } } as const;

@Injectable()
export class TeacherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(record: {
    id: string;
    name: string;
    user: { identifier: string };
  }): TeacherAdminSummary {
    return {
      id: record.id,
      identifier: record.user.identifier,
      name: record.name,
    };
  }

  async create(
    dto: CreateTeacherDto,
    actingUser: RequestUser,
  ): Promise<TeacherAdminSummary> {
    const scope = await this.orgScope.resolve(actingUser);
    if (!scope.unrestricted) {
      const campus = await this.prisma.campus.findUnique({
        where: { id: dto.campusId },
      });
      if (
        !campus ||
        !scope.allows({ campusId: campus.id, schoolId: campus.schoolId })
      ) {
        throw new ForbiddenException('You do not have access to this campus');
      }
    }
    let created: CreatedTeacher;
    try {
      created = await this.prisma.$transaction((tx) =>
        createTeacherWithUser(tx, dto),
      );
    } catch (error) {
      assertCreatable(error, 'This identifier is already in use.');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'teacher.create',
        entity: 'Teacher',
        entityId: created.id,
        metadata: JSON.stringify({
          identifier: dto.identifier,
          name: dto.name,
        }),
      },
    });
    return created;
  }

  async list(actingUser: RequestUser): Promise<TeacherAdminSummary[]> {
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    // BL-07: archived teachers are no longer offered for class-teacher/timetable assignment.
    const where: Prisma.TeacherWhereInput = {
      archivedAt: null,
      ...(scope.campusWhere ? { campus: scope.campusWhere } : {}),
    };
    const records = await this.prisma.teacher.findMany({
      where,
      include: WITH_USER,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(
    id: string,
    dto: UpdateTeacherDto,
    actingUserId: string,
  ): Promise<TeacherAdminSummary> {
    const existing = await this.prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Teacher not found');
    }
    if (dto.password !== undefined) {
      const passwordHash = await argon2.hash(dto.password);
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { passwordHash },
      });
    }
    const record = await this.prisma.teacher.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}) },
      include: WITH_USER,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'teacher.update',
        entity: 'Teacher',
        entityId: id,
        metadata: JSON.stringify({
          name: dto.name,
          passwordChanged: dto.password !== undefined,
        }),
      },
    });
    return this.toSummary(record);
  }

  /**
   * BL-07 (Q7): "deleting" a teacher archives them (and their staff record, if any): out of the
   * teacher list, off every class-teacher/timetable slot, login disabled. `erase` is the
   * super-admin hard delete.
   */
  async archive(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.teacher.findUnique({
      where: { id },
      include: { staff: { select: { id: true } } },
    });
    if (!existing) {
      throw new NotFoundException('Teacher not found');
    }
    if (existing.archivedAt) {
      throw new ConflictException('This teacher is already archived');
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await archiveTeacherTx(tx, id, now);
      if (existing.staff) {
        await tx.staff.update({
          where: { id: existing.staff.id },
          data: { archivedAt: now, archivedById: actingUserId },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'teacher.archive',
          entity: 'Teacher',
          entityId: id,
        },
      });
    });
  }

  async erase(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Teacher not found');
    }
    assertArchivedForErasure(existing.archivedAt, 'teacher');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.staff.deleteMany({ where: { teacherId: id } });
        await tx.teacher.delete({ where: { id } });
        await tx.user.delete({ where: { id: existing.userId } });
      });
    } catch (error) {
      assertDeletable(error, 'Teacher');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'teacher.erase',
        entity: 'Teacher',
        entityId: id,
        metadata: JSON.stringify({ archivedAt: existing.archivedAt }),
      },
    });
  }
}
