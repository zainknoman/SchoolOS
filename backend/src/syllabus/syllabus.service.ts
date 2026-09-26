import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import {
  StudentAccessService,
  type RequestUser,
} from '../common/student-access.service';
import type {
  CreateSyllabusDto,
  ListSyllabiQueryDto,
  SyllabusUnitDto,
  UpdateSyllabusDto,
} from './dto/syllabus.dto';

export interface SyllabusSummary {
  id: string;
  classId: string;
  className: string;
  academicSessionId: string;
  subjectId: string;
  subjectName: string;
  unitCount: number;
  updatedAt: Date;
}

export interface SyllabusDetail {
  id: string;
  classId: string;
  className: string;
  academicSessionId: string;
  sessionLabel: string;
  /** false once the session has ended: the syllabus is kept as history and cannot change */
  editable: boolean;
  subjectId: string;
  subjectName: string;
  overview: string | null;
  units: {
    id: string;
    order: number;
    title: string;
    topics: string | null;
    termId: string | null;
    termLabel: string | null;
    plannedStart: Date | null;
    plannedEnd: Date | null;
  }[];
  updatedAt: Date;
}

const DETAIL_INCLUDE = {
  class: {
    select: {
      id: true,
      name: true,
      academicSessionId: true,
      academicSession: { select: { label: true, endDate: true } },
    },
  },
  subject: { select: { name: true } },
  units: {
    orderBy: { order: 'asc' },
    include: { term: { select: { label: true } } },
  },
} satisfies Prisma.SyllabusInclude;

type SyllabusWithDetail = Prisma.SyllabusGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

/**
 * BL-26 (Q2, Q19): the yearly syllabus of a subject in a class (and so in that class's session).
 * School admins of the class's school (a campus-level admin: their campus) and SUPER_ADMIN write;
 * teachers of the class read. Every write is audited. A session that has ended is history: its
 * syllabi are read-only. Copied into a new session by copy-structure (BL-33).
 */
@Injectable()
export class SyllabusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
    private readonly access: StudentAccessService,
  ) {}

  async list(
    user: RequestUser,
    query: ListSyllabiQueryDto,
  ): Promise<SyllabusSummary[]> {
    if (!query.classId && !query.academicSessionId) {
      throw new BadRequestException('classId or academicSessionId is required');
    }
    const classWhere: Prisma.ClassWhereInput = {
      ...(query.classId ? { id: query.classId } : {}),
      ...(query.academicSessionId
        ? { academicSessionId: query.academicSessionId }
        : {}),
    };
    if (user.role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      if (!teacher) return [];
      const sectionIds = [
        ...(await this.access.getTeacherSectionIds(teacher.id)),
      ];
      classWhere.sections = { some: { id: { in: sectionIds } } };
    } else if (user.role !== 'SUPER_ADMIN') {
      const scope = await this.orgScope.resolve(user);
      if (scope.denied) return [];
      classWhere.campus = scope.campusWhere;
    }
    const rows = await this.prisma.syllabus.findMany({
      where: { class: classWhere },
      orderBy: [{ class: { name: 'asc' } }, { subject: { name: 'asc' } }],
      include: {
        class: { select: { name: true, academicSessionId: true } },
        subject: { select: { name: true } },
        _count: { select: { units: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      classId: r.classId,
      className: r.class.name,
      academicSessionId: r.class.academicSessionId,
      subjectId: r.subjectId,
      subjectName: r.subject.name,
      unitCount: r._count.units,
      updatedAt: r.updatedAt,
    }));
  }

  async get(user: RequestUser, id: string): Promise<SyllabusDetail> {
    const row = await this.prisma.syllabus.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Syllabus not found');
    await this.access.assertCanAccessClass(user, row.classId);
    return toDetail(row);
  }

  async create(
    user: RequestUser,
    dto: CreateSyllabusDto,
  ): Promise<SyllabusDetail> {
    const klass = await this.writableClass(user, dto.classId);
    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
      select: { schoolId: true, isActive: true },
    });
    if (!subject || subject.schoolId !== klass.campus.schoolId) {
      throw new BadRequestException(
        "The subject is not one of this school's subjects",
      );
    }
    if (!subject.isActive) {
      throw new BadRequestException('The subject is inactive');
    }
    const units = await this.checkUnits(
      dto.units ?? [],
      klass.academicSessionId,
    );
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.syllabus.create({
          data: {
            classId: klass.id,
            subjectId: dto.subjectId,
            overview: dto.overview?.trim() || null,
            updatedById: user.id,
            units: { create: units },
          },
          include: DETAIL_INCLUDE,
        });
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'syllabus.create',
            entity: 'Syllabus',
            entityId: created.id,
            metadata: JSON.stringify({
              classId: klass.id,
              subjectId: dto.subjectId,
              units: units.length,
            }),
          },
        });
        return created;
      });
      return toDetail(row);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'This class already has a syllabus for this subject',
        );
      }
      throw err;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateSyllabusDto,
  ): Promise<SyllabusDetail> {
    const existing = await this.prisma.syllabus.findUnique({
      where: { id },
      include: { _count: { select: { units: true } } },
    });
    if (!existing) throw new NotFoundException('Syllabus not found');
    const klass = await this.writableClass(user, existing.classId);
    const units = await this.checkUnits(dto.units, klass.academicSessionId);
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.syllabusUnit.deleteMany({ where: { syllabusId: id } });
      const updated = await tx.syllabus.update({
        where: { id },
        data: {
          ...(dto.overview !== undefined
            ? { overview: dto.overview?.trim() || null }
            : {}),
          updatedById: user.id,
          units: { create: units },
        },
        include: DETAIL_INCLUDE,
      });
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'syllabus.update',
          entity: 'Syllabus',
          entityId: id,
          metadata: JSON.stringify({
            unitsBefore: existing._count.units,
            unitsAfter: units.length,
            overviewChanged:
              dto.overview !== undefined &&
              (dto.overview?.trim() || null) !== existing.overview,
          }),
        },
      });
      return updated;
    });
    return toDetail(row);
  }

  async delete(user: RequestUser, id: string): Promise<void> {
    const existing = await this.prisma.syllabus.findUnique({
      where: { id },
      select: { classId: true, subjectId: true },
    });
    if (!existing) throw new NotFoundException('Syllabus not found');
    await this.writableClass(user, existing.classId);
    await this.prisma.$transaction([
      this.prisma.syllabus.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'syllabus.delete',
          entity: 'Syllabus',
          entityId: id,
          metadata: JSON.stringify(existing),
        },
      }),
    ]);
  }

  /** The class exists, is in the caller's scope, and its session has not ended. */
  private async writableClass(user: RequestUser, classId: string) {
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        campus: { select: { schoolId: true } },
        academicSession: { select: { endDate: true } },
      },
    });
    if (!klass) throw new NotFoundException('Class not found');
    if (user.role !== 'SUPER_ADMIN') {
      const scope = await this.orgScope.resolve(user);
      if (
        !scope.allows({
          campusId: klass.campusId,
          schoolId: klass.campus.schoolId,
        })
      ) {
        throw new ForbiddenException('You do not have access to this class');
      }
    }
    if (hasEnded(klass.academicSession.endDate)) {
      throw new BadRequestException(
        'This session has ended; its syllabus is kept as history and cannot be changed',
      );
    }
    return klass;
  }

  /** Units in the given order; a term must belong to the class's session; dates in order. */
  private async checkUnits(
    units: SyllabusUnitDto[],
    academicSessionId: string,
  ): Promise<Prisma.SyllabusUnitCreateWithoutSyllabusInput[]> {
    const termIds = [
      ...new Set(units.map((u) => u.termId).filter((t): t is string => !!t)),
    ];
    if (termIds.length) {
      const found = await this.prisma.term.count({
        where: { id: { in: termIds }, academicSessionId },
      });
      if (found !== termIds.length) {
        throw new BadRequestException(
          "A unit's term is not a term of this class's session",
        );
      }
    }
    return units.map((u, i) => {
      const start = u.plannedStart ? new Date(u.plannedStart) : null;
      const end = u.plannedEnd ? new Date(u.plannedEnd) : null;
      if (start && end && start > end) {
        throw new BadRequestException(
          `Unit ${i + 1}: the planned start is after the planned end`,
        );
      }
      return {
        order: i + 1,
        title: u.title.trim(),
        topics: u.topics?.trim() || null,
        plannedStart: start,
        plannedEnd: end,
        ...(u.termId ? { term: { connect: { id: u.termId } } } : {}),
      };
    });
  }
}

function hasEnded(endDate: Date, now = new Date()): boolean {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  return endDate < today;
}

function toDetail(row: SyllabusWithDetail): SyllabusDetail {
  return {
    id: row.id,
    classId: row.classId,
    className: row.class.name,
    academicSessionId: row.class.academicSessionId,
    sessionLabel: row.class.academicSession.label,
    editable: !hasEnded(row.class.academicSession.endDate),
    subjectId: row.subjectId,
    subjectName: row.subject.name,
    overview: row.overview,
    units: row.units.map((u) => ({
      id: u.id,
      order: u.order,
      title: u.title,
      topics: u.topics,
      termId: u.termId,
      termLabel: u.term?.label ?? null,
      plannedStart: u.plannedStart,
      plannedEnd: u.plannedEnd,
    })),
    updatedAt: row.updatedAt,
  };
}
