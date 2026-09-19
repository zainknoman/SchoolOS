import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertValidReferences } from '../common/prisma-create-guard';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { StudentAccessService, type RequestUser } from '../common/student-access.service';

export interface SectionSummary {
  id: string;
  name: string;
  className: string;
  campusName: string;
  academicSessionId?: string;
  classTeacherId?: string | null;
  classTeacherName?: string | null;
}

const WITH_PARENTS = {
  class: { include: { campus: true } },
  classTeacher: { select: { name: true } },
} as const;

@Injectable()
export class SectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  private toSummary(record: {
    id: string;
    name: string;
    classTeacherId: string | null;
    class: { name: string; academicSessionId: string; campus: { name: string } };
    classTeacher: { name: string } | null;
  }): SectionSummary {
    return {
      id: record.id,
      name: record.name,
      className: record.class.name,
      campusName: record.class.campus.name,
      academicSessionId: record.class.academicSessionId,
      classTeacherId: record.classTeacherId,
      classTeacherName: record.classTeacher?.name ?? null,
    };
  }

  // Scoped like ClassService.list(): SUPER_ADMIN sees everything, SCHOOL_ADMIN/ACCOUNTS see only
  // their own school's sections, and TEACHER sees only sections they're actually assigned to
  // teach (Timetable or classTeacher) — not every section in their campus.
  async listAll(actingUser: RequestUser): Promise<SectionSummary[]> {
    let where: Prisma.SectionWhereInput | undefined;
    if (actingUser.role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: actingUser.id } });
      if (!teacher) {
        return [];
      }
      const sectionIds = await this.studentAccess.getTeacherSectionIds(teacher.id);
      where = { id: { in: [...sectionIds] } };
    } else if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        return [];
      }
      where = { class: { campus: { schoolId: admin.schoolId } } };
    }
    const sections = await this.prisma.section.findMany({
      where,
      include: WITH_PARENTS,
      orderBy: { name: 'asc' },
    });
    return sections.map((s) => this.toSummary(s));
  }

  async getStudents(sectionId: string) {
    const rows = await this.prisma.enrollment.findMany({
      where: { sectionId, status: 'ACTIVE' },
      orderBy: { student: { name: 'asc' } },
      select: { student: { select: { id: true, name: true, grNumber: true } } },
    });
    return rows.map((r) => r.student);
  }

  async create(
    dto: CreateSectionDto,
    actingUserId: string,
  ): Promise<SectionSummary> {
    const record = await this.prisma.section
      .create({
        data: {
          classId: dto.classId,
          name: dto.name,
          classTeacherId: dto.classTeacherId,
        },
        include: WITH_PARENTS,
      })
      .catch((error: unknown) =>
        assertValidReferences(
          error,
          'Invalid class or class-teacher reference.',
        ),
      );
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'section.create',
        entity: 'Section',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async update(
    id: string,
    dto: UpdateSectionDto,
    actingUserId: string,
  ): Promise<SectionSummary> {
    const existing = await this.prisma.section.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Section not found');
    }
    const record = await this.prisma.section
      .update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.classTeacherId !== undefined
            ? { classTeacherId: dto.classTeacherId }
            : {}),
        },
        include: WITH_PARENTS,
      })
      .catch((error: unknown) =>
        assertValidReferences(error, 'Invalid class-teacher reference.'),
      );
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'section.update',
        entity: 'Section',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.section.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Section not found');
    }
    try {
      await this.prisma.section.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Section');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'section.delete',
        entity: 'Section',
        entityId: id,
      },
    });
  }
}
