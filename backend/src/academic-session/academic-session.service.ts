import { Prisma } from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateAcademicSessionDto } from './dto/create-academic-session.dto';
import { UpdateAcademicSessionDto } from './dto/update-academic-session.dto';

export interface AcademicSessionSummary {
  id: string;
  schoolId: string | null;
  label: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

@Injectable()
export class AcademicSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(record: {
    id: string;
    label: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    schoolId: string | null;
  }): AcademicSessionSummary {
    return {
      id: record.id,
      schoolId: record.schoolId,
      label: record.label,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
      isActive: record.isActive,
    };
  }

  async create(
    dto: CreateAcademicSessionDto,
    actingUserId: string,
  ): Promise<AcademicSessionSummary> {
    const school = await this.prisma.school.findUnique({
      where: { id: dto.schoolId },
      select: { id: true },
    });
    if (!school) {
      throw new BadRequestException('School not found');
    }
    const record = await this.prisma.$transaction(async (tx) => {
      // BL-01: activation is per school — other schools' calendars are untouched.
      if (dto.isActive) {
        await tx.academicSession.updateMany({
          where: { isActive: true, schoolId: dto.schoolId },
          data: { isActive: false },
        });
      }
      return tx.academicSession.create({
        data: {
          schoolId: dto.schoolId,
          label: dto.label,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          isActive: dto.isActive,
        },
      });
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'academic-session.create',
        entity: 'AcademicSession',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  // Rollover helper (BL-33): copies the source session's structure into the target — classes and
  // sections (names only, no class teachers), terms (dates shifted by the gap between the session
  // starts), assessment categories and timetable templates. It only CREATES rows in the target:
  // the source and every historical session are never updated or deleted. Idempotent — anything
  // already present in the target is left alone. A school admin works within their own school.
  async copyStructure(
    targetSessionId: string,
    sourceSessionId: string,
    actingUser: RequestUser,
  ): Promise<{
    classesCreated: number;
    sectionsCreated: number;
    termsCreated: number;
    assessmentCategoriesCreated: number;
    timetableEntriesCreated: number;
    timetableEntriesSkipped: number;
  }> {
    if (targetSessionId === sourceSessionId) {
      throw new BadRequestException('Source and target sessions must differ');
    }
    const [target, source] = await Promise.all([
      this.prisma.academicSession.findUnique({
        where: { id: targetSessionId },
      }),
      this.prisma.academicSession.findUnique({
        where: { id: sourceSessionId },
      }),
    ]);
    if (!target || !source) {
      throw new NotFoundException('Academic session not found');
    }
    // BL-01: sessions are per school, so a rollover stays inside one school's calendar.
    if (target.schoolId !== source.schoolId) {
      throw new BadRequestException(
        'Source and target sessions belong to different schools',
      );
    }
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      throw new BadRequestException('No school is linked to this account');
    }
    // BL-33: a school admin copies only within their own school's sessions.
    if (
      !scope.unrestricted &&
      target.schoolId !== null &&
      target.schoolId !== scope.schoolId
    ) {
      throw new ForbiddenException(
        'This academic session belongs to another school',
      );
    }
    // Terms keep their place in the year: dates move by the gap between the session starts.
    const shiftMs = target.startDate.getTime() - source.startDate.getTime();
    const shift = (d: Date) => new Date(d.getTime() + shiftMs);

    const result = await this.prisma.$transaction(async (tx) => {
      const counts = {
        classesCreated: 0,
        sectionsCreated: 0,
        termsCreated: 0,
        assessmentCategoriesCreated: 0,
        timetableEntriesCreated: 0,
        timetableEntriesSkipped: 0,
      };

      // Terms (session-level): created in the target only when that label is missing.
      const targetTermByLabel = new Map(
        (
          await tx.term.findMany({
            where: { academicSessionId: targetSessionId },
          })
        ).map((t) => [t.label, t.id]),
      );
      const sourceTerms = await tx.term.findMany({
        where: { academicSessionId: sourceSessionId },
        orderBy: { order: 'asc' },
      });
      const termMap = new Map<string, string>(); // source term id -> target term id
      for (const t of sourceTerms) {
        let id = targetTermByLabel.get(t.label);
        if (!id) {
          id = (
            await tx.term.create({
              data: {
                academicSessionId: targetSessionId,
                label: t.label,
                order: t.order,
                startDate: shift(t.startDate),
                endDate: shift(t.endDate),
              },
            })
          ).id;
          counts.termsCreated += 1;
        }
        termMap.set(t.id, id);
      }

      const sourceClasses = await tx.class.findMany({
        where: {
          academicSessionId: sourceSessionId,
          ...(scope.campusWhere ? { campus: scope.campusWhere } : {}),
        },
        include: {
          sections: { include: { timetables: true } },
          assessmentCategories: true,
        },
      });
      for (const src of sourceClasses) {
        let dest = await tx.class.findFirst({
          where: {
            academicSessionId: targetSessionId,
            campusId: src.campusId,
            name: src.name,
          },
          include: { sections: true, assessmentCategories: true },
        });
        if (!dest) {
          dest = await tx.class.create({
            data: {
              academicSessionId: targetSessionId,
              campusId: src.campusId,
              name: src.name,
            },
            include: { sections: true, assessmentCategories: true },
          });
          counts.classesCreated += 1;
        }

        // Assessment categories: same name + mapped term, only when missing.
        const haveCategory = new Set(
          dest.assessmentCategories.map((c) => `${c.termId}|${c.name}`),
        );
        for (const cat of src.assessmentCategories) {
          const termId = termMap.get(cat.termId);
          if (!termId || haveCategory.has(`${termId}|${cat.name}`)) continue;
          await tx.assessmentCategory.create({
            data: {
              classId: dest.id,
              termId,
              name: cat.name,
              weightPercent: cat.weightPercent,
            },
          });
          counts.assessmentCategoriesCreated += 1;
        }

        const destSections = new Map(dest.sections.map((s) => [s.name, s.id]));
        for (const section of src.sections) {
          let destSectionId = destSections.get(section.name);
          if (!destSectionId) {
            destSectionId = (
              await tx.section.create({
                data: { classId: dest.id, name: section.name },
              })
            ).id;
            counts.sectionsCreated += 1;
          }
          // Timetable template: only into a section that has no timetable yet (idempotent), and
          // never an entry that would double-book a teacher or room in the target session.
          if (section.timetables.length === 0) continue;
          const hasTimetable = await tx.timetable.count({
            where: { sectionId: destSectionId },
          });
          if (hasTimetable > 0) continue;
          for (const e of section.timetables) {
            const clashOn = [
              ...(e.teacherId ? [{ teacherId: e.teacherId }] : []),
              ...(e.room
                ? [
                    {
                      room: e.room,
                      section: { class: { campusId: src.campusId } },
                    },
                  ]
                : []),
            ];
            const clash = clashOn.length
              ? await tx.timetable.findFirst({
                  where: {
                    dayOfWeek: e.dayOfWeek,
                    period: e.period,
                    section: { class: { academicSessionId: targetSessionId } },
                    OR: clashOn,
                  },
                  select: { id: true },
                })
              : null;
            if (clash) {
              counts.timetableEntriesSkipped += 1;
              continue;
            }
            await tx.timetable.create({
              data: {
                sectionId: destSectionId,
                subjectId: e.subjectId,
                teacherId: e.teacherId,
                dayOfWeek: e.dayOfWeek,
                period: e.period,
                startTime: e.startTime,
                endTime: e.endTime,
                room: e.room,
              },
            });
            counts.timetableEntriesCreated += 1;
          }
        }
      }
      return counts;
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'academic-session.copy-structure',
        entity: 'AcademicSession',
        entityId: targetSessionId,
        metadata: JSON.stringify({ sourceSessionId, ...result }),
      },
    });
    return result;
  }

  /**
   * BL-01: a school's own sessions (plus, until the M3 backfill has run, legacy school-less ones);
   * SUPER_ADMIN sees every school's, optionally filtered by `schoolId`.
   */
  async list(
    actor: RequestUser,
    schoolId?: string,
  ): Promise<AcademicSessionSummary[]> {
    const scope = await this.orgScope.resolve(actor);
    if (scope.denied) return [];
    const where: Prisma.AcademicSessionWhereInput = scope.unrestricted
      ? schoolId
        ? { schoolId }
        : {}
      : { OR: [{ schoolId: scope.schoolId }, { schoolId: null }] };
    const records = await this.prisma.academicSession.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(
    id: string,
    dto: UpdateAcademicSessionDto,
    actingUserId: string,
  ): Promise<AcademicSessionSummary> {
    const existing = await this.prisma.academicSession.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Academic session not found');
    }
    if (dto.isActive === false && existing.isActive) {
      throw new BadRequestException(
        'Cannot deactivate the only active academic session — activate a different session instead.',
      );
    }
    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        // BL-01: only this school's other sessions (legacy school-less ones among themselves).
        await tx.academicSession.updateMany({
          where: {
            isActive: true,
            id: { not: id },
            schoolId: existing.schoolId,
          },
          data: { isActive: false },
        });
      }
      return tx.academicSession.update({
        where: { id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.startDate !== undefined
            ? { startDate: new Date(dto.startDate) }
            : {}),
          ...(dto.endDate !== undefined
            ? { endDate: new Date(dto.endDate) }
            : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'academic-session.update',
        entity: 'AcademicSession',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.academicSession.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Academic session not found');
    }
    if (existing.isActive) {
      throw new BadRequestException(
        'Cannot delete the active academic session — activate a different session first.',
      );
    }
    try {
      await this.prisma.academicSession.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Academic session');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'academic-session.delete',
        entity: 'AcademicSession',
        entityId: id,
      },
    });
  }
}
