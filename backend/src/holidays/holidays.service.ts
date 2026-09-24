import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';
import type { RequestUser } from '../common/student-access.service';
import { OrgScopeService } from '../common/org-scope.service';

export interface HolidaySummary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  campusId: string | null;
  schoolId: string | null;
}

@Injectable()
export class HolidaysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(record: {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    campusId: string | null;
    schoolId: string | null;
  }): HolidaySummary {
    return {
      id: record.id,
      title: record.title,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
      campusId: record.campusId,
      schoolId: record.schoolId,
    };
  }

  /**
   * BL-20: every holiday belongs to one school. A campus holiday takes the campus's school; a
   * school-wide one (no campus) is the caller's school — or, for SUPER_ADMIN, the given schoolId.
   * A campus principal may only add holidays for their own campus.
   */
  async create(
    dto: CreateHolidayDto,
    actor: RequestUser,
  ): Promise<HolidaySummary> {
    const { schoolId, campusId } = await this.resolveTarget(
      actor,
      dto.campusId ?? null,
      dto.schoolId,
    );
    const record = await this.prisma.holiday.create({
      data: {
        title: dto.title,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        campusId,
        schoolId,
      },
    });
    return this.toSummary(record);
  }

  private async resolveTarget(
    actor: RequestUser,
    campusId: string | null,
    requestedSchoolId?: string,
  ): Promise<{ schoolId: string; campusId: string | null }> {
    const scope = await this.orgScope.resolve(actor);
    if (scope.denied) {
      throw new ForbiddenException('No school is linked to this account');
    }
    if (campusId) {
      const campus = await this.prisma.campus.findUnique({
        where: { id: campusId },
        select: { id: true, schoolId: true },
      });
      if (!campus) throw new BadRequestException('Campus not found');
      if (!scope.allows({ campusId: campus.id, schoolId: campus.schoolId })) {
        throw new ForbiddenException('You do not have access to this campus');
      }
      if (requestedSchoolId && requestedSchoolId !== campus.schoolId) {
        throw new BadRequestException(
          'The campus belongs to a different school',
        );
      }
      return { schoolId: campus.schoolId, campusId: campus.id };
    }
    if (scope.unrestricted) {
      if (!requestedSchoolId) {
        throw new BadRequestException(
          'schoolId is required for a school-wide holiday created by a super admin',
        );
      }
      const school = await this.prisma.school.findUnique({
        where: { id: requestedSchoolId },
        select: { id: true },
      });
      if (!school) throw new BadRequestException('School not found');
      return { schoolId: school.id, campusId: null };
    }
    if (scope.campusId) {
      throw new ForbiddenException(
        'A campus principal can only add holidays for their own campus',
      );
    }
    if (requestedSchoolId && requestedSchoolId !== scope.schoolId) {
      throw new ForbiddenException(
        'You can only add holidays for your own school',
      );
    }
    return { schoolId: scope.schoolId as string, campusId: null };
  }

  /** A holiday may be changed only by someone whose scope covers it entirely. */
  private async assertCanManage(
    holiday: { campusId: string | null; schoolId: string | null },
    actor: RequestUser,
  ): Promise<void> {
    const scope = await this.orgScope.resolve(actor);
    if (scope.unrestricted) return;
    if (scope.denied || !holiday.schoolId) {
      throw new ForbiddenException('You cannot manage this holiday');
    }
    const ok = holiday.campusId
      ? scope.allows({ campusId: holiday.campusId, schoolId: holiday.schoolId })
      : scope.schoolId === holiday.schoolId && scope.campusId === null;
    if (!ok) throw new ForbiddenException('You cannot manage this holiday');
  }

  // Holiday has no schoolId of its own (only an optional campusId — null means "applies to every
  // campus"), and this endpoint has no @Roles restriction, so a caller-supplied campusId alone
  // was never validated against what the caller can actually see. Resolves the caller's own
  // reachable campus set (their school's campuses, their own campus, or their children's
  // campuses) and ANDs it with any explicit campusId filter, rather than trusting the param.
  async findMany(
    actingUser: RequestUser,
    params: { campusId?: string; from?: string; to?: string },
  ): Promise<HolidaySummary[]> {
    // BL-20: a campus-less holiday is school-wide WITHIN its own school, never across schools.
    let campusScope: Prisma.HolidayWhereInput | undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const allowed = await this.resolveAllowedCampuses(actingUser);
      if (allowed === null) {
        return [];
      }
      campusScope = {
        OR: [
          { campusId: { in: allowed.map((c) => c.id) } },
          {
            campusId: null,
            schoolId: { in: [...new Set(allowed.map((c) => c.schoolId))] },
          },
        ],
      };
    }
    let requestedCampusFilter: Prisma.HolidayWhereInput | undefined;
    if (params.campusId) {
      const campus = await this.prisma.campus.findUnique({
        where: { id: params.campusId },
        select: { schoolId: true },
      });
      requestedCampusFilter = {
        OR: [
          { campusId: params.campusId },
          { campusId: null, schoolId: campus?.schoolId ?? '__none__' },
        ],
      };
    }

    const where: Prisma.HolidayWhereInput = {
      ...(params.from ? { endDate: { gte: new Date(params.from) } } : {}),
      ...(params.to ? { startDate: { lte: new Date(params.to) } } : {}),
      ...(campusScope && requestedCampusFilter
        ? { AND: [campusScope, requestedCampusFilter] }
        : (campusScope ?? requestedCampusFilter ?? {})),
    };

    const records = await this.prisma.holiday.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  /** null means "no access at all" (fail closed), as distinct from an empty array. */
  private async resolveAllowedCampuses(
    actingUser: RequestUser,
  ): Promise<{ id: string; schoolId: string }[] | null> {
    const select = { id: true, schoolId: true } as const;
    if (actingUser.role === 'SCHOOL_ADMIN' || actingUser.role === 'ACCOUNTS') {
      const scope = await this.orgScope.resolve(actingUser);
      if (scope.denied) {
        return null;
      }
      return this.prisma.campus.findMany({ where: scope.campusWhere, select });
    }
    if (actingUser.role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findUnique({
        where: { userId: actingUser.id },
        select: { campus: { select } },
      });
      return teacher ? [teacher.campus] : null;
    }
    // PARENT (or any other authenticated role) — scoped to their own children's campuses.
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        student: {
          parents: { some: { parentProfile: { userId: actingUser.id } } },
        },
      },
      select: { campus: { select } },
      distinct: ['campusId'],
    });
    return enrollments.map((e) => e.campus);
  }

  async update(
    id: string,
    dto: UpdateHolidayDto,
    actor: RequestUser,
  ): Promise<HolidaySummary> {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    await this.assertCanManage(existing, actor);
    let target: { schoolId: string; campusId: string | null } | undefined;
    if (dto.campusId !== undefined) {
      target = await this.resolveTarget(
        actor,
        dto.campusId || null,
        existing.schoolId ?? undefined,
      );
      if (existing.schoolId && target.schoolId !== existing.schoolId) {
        throw new BadRequestException(
          'A holiday cannot move to another school',
        );
      }
    }
    const record = await this.prisma.holiday.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.startDate !== undefined
          ? { startDate: new Date(dto.startDate) }
          : {}),
        ...(dto.endDate !== undefined
          ? { endDate: new Date(dto.endDate) }
          : {}),
        ...(target
          ? { campusId: target.campusId, schoolId: target.schoolId }
          : {}),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actor: RequestUser): Promise<void> {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    await this.assertCanManage(existing, actor);
    await this.prisma.holiday.delete({ where: { id } });
  }

  /**
   * A campus-specific holiday applies to that campus; a campus-less one applies to every campus
   * of ITS OWN school (BL-20) — never to another school's campuses.
   */
  async isHoliday(date: Date, campusId: string): Promise<boolean> {
    const campus = await this.prisma.campus.findUnique({
      where: { id: campusId },
      select: { schoolId: true },
    });
    const match = await this.prisma.holiday.findFirst({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
        OR: [
          { campusId },
          ...(campus ? [{ campusId: null, schoolId: campus.schoolId }] : []),
        ],
      },
      select: { id: true },
    });
    return !!match;
  }
}
