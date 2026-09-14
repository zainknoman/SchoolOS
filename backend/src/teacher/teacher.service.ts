import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertCreatable } from '../common/prisma-create-guard';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import type { RequestUser } from '../common/student-access.service';
import { createTeacherWithUser, type CreatedTeacher } from './create-teacher-with-user';

export interface TeacherAdminSummary {
  id: string;
  identifier: string;
  name: string;
}

const WITH_USER = { user: { select: { identifier: true } } } as const;

@Injectable()
export class TeacherService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: { id: string; name: string; user: { identifier: string } }): TeacherAdminSummary {
    return { id: record.id, identifier: record.user.identifier, name: record.name };
  }

  async create(dto: CreateTeacherDto, actingUser: RequestUser): Promise<TeacherAdminSummary> {
    if (actingUser.role !== 'SUPER_ADMIN') {
      const [admin, campus] = await Promise.all([
        this.prisma.user.findUnique({ where: { id: actingUser.id } }),
        this.prisma.campus.findUnique({ where: { id: dto.campusId } }),
      ]);
      if (!admin?.schoolId || !campus || admin.schoolId !== campus.schoolId) {
        throw new ForbiddenException('You do not have access to this campus');
      }
    }
    let created: CreatedTeacher;
    try {
      created = await this.prisma.$transaction((tx) => createTeacherWithUser(tx, dto));
    } catch (error) {
      assertCreatable(error, 'This identifier is already in use.');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'teacher.create',
        entity: 'Teacher',
        entityId: created.id,
        metadata: JSON.stringify({ identifier: dto.identifier, name: dto.name }),
      },
    });
    return created;
  }

  async list(actingUser: RequestUser): Promise<TeacherAdminSummary[]> {
    let where: Prisma.TeacherWhereInput | undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        return [];
      }
      where = { campus: { schoolId: admin.schoolId } };
    }
    const records = await this.prisma.teacher.findMany({ where, include: WITH_USER, orderBy: { name: 'asc' } });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateTeacherDto, actingUserId: string): Promise<TeacherAdminSummary> {
    const existing = await this.prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Teacher not found');
    }
    if (dto.password !== undefined) {
      const passwordHash = await argon2.hash(dto.password);
      await this.prisma.user.update({ where: { id: existing.userId }, data: { passwordHash } });
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
        metadata: JSON.stringify({ name: dto.name, passwordChanged: dto.password !== undefined }),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Teacher not found');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.teacher.delete({ where: { id } });
        await tx.user.delete({ where: { id: existing.userId } });
      });
    } catch (error) {
      assertDeletable(error, 'Teacher');
    }
    await this.prisma.auditLog.create({
      data: { userId: actingUserId, action: 'teacher.delete', entity: 'Teacher', entityId: id },
    });
  }
}
