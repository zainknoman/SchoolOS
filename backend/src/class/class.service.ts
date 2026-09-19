import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertValidReferences } from '../common/prisma-create-guard';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { StudentAccessService, type RequestUser } from '../common/student-access.service';

export interface ClassSummary {
  id: string;
  name: string;
  campusId: string;
  campusName: string;
  academicSessionId: string;
  academicSessionLabel: string;
}

const WITH_PARENTS = {
  campus: { select: { name: true } },
  academicSession: { select: { label: true } },
} as const;

@Injectable()
export class ClassService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  private toSummary(record: {
    id: string;
    name: string;
    campusId: string;
    academicSessionId: string;
    campus: { name: string };
    academicSession: { label: string };
  }): ClassSummary {
    return {
      id: record.id,
      name: record.name,
      campusId: record.campusId,
      campusName: record.campus.name,
      academicSessionId: record.academicSessionId,
      academicSessionLabel: record.academicSession.label,
    };
  }

  async create(
    dto: CreateClassDto,
    actingUserId: string,
  ): Promise<ClassSummary> {
    const record = await this.prisma.class
      .create({
        data: {
          campusId: dto.campusId,
          academicSessionId: dto.academicSessionId,
          name: dto.name,
        },
        include: WITH_PARENTS,
      })
      .catch((error: unknown) =>
        assertValidReferences(
          error,
          'Invalid campus or academic session reference.',
        ),
      );
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'class.create',
        entity: 'Class',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  // Scoped the same way CampusService.list() scopes campuses: SUPER_ADMIN sees everything,
  // SCHOOL_ADMIN/ACCOUNTS see only their own school's classes, and TEACHER sees only classes
  // with at least one section they're actually assigned to teach (via StudentAccessService's
  // shared Timetable/classTeacher resolution) — not every class in their campus.
  async list(actingUser: RequestUser): Promise<ClassSummary[]> {
    let where: Prisma.ClassWhereInput | undefined;
    if (actingUser.role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: actingUser.id } });
      if (!teacher) {
        return [];
      }
      const sectionIds = await this.studentAccess.getTeacherSectionIds(teacher.id);
      where = { sections: { some: { id: { in: [...sectionIds] } } } };
    } else {
      const scope = await this.orgScope.resolve(actingUser);
      if (scope.denied) {
        return [];
      }
      if (scope.campusWhere) {
        where = { campus: scope.campusWhere };
      }
    }
    const records = await this.prisma.class.findMany({
      where,
      include: WITH_PARENTS,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(
    id: string,
    dto: UpdateClassDto,
    actingUserId: string,
  ): Promise<ClassSummary> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class not found');
    }
    const record = await this.prisma.class.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}) },
      include: WITH_PARENTS,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'class.update',
        entity: 'Class',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class not found');
    }
    try {
      await this.prisma.class.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Class');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'class.delete',
        entity: 'Class',
        entityId: id,
      },
    });
  }
}
