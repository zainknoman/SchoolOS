import { Injectable, NotFoundException } from '@nestjs/common';
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
  }): HolidaySummary {
    return {
      id: record.id,
      title: record.title,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
      campusId: record.campusId,
    };
  }

  async create(dto: CreateHolidayDto): Promise<HolidaySummary> {
    const record = await this.prisma.holiday.create({
      data: {
        title: dto.title,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        campusId: dto.campusId ?? null,
      },
    });
    return this.toSummary(record);
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
    let campusScope: Prisma.HolidayWhereInput | undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const allowedCampusIds = await this.resolveAllowedCampusIds(actingUser);
      if (allowedCampusIds === null) {
        return [];
      }
      campusScope = { OR: [{ campusId: null }, { campusId: { in: allowedCampusIds } }] };
    }
    const requestedCampusFilter: Prisma.HolidayWhereInput | undefined = params.campusId
      ? { OR: [{ campusId: params.campusId }, { campusId: null }] }
      : undefined;

    const where: Prisma.HolidayWhereInput = {
      ...(params.from ? { endDate: { gte: new Date(params.from) } } : {}),
      ...(params.to ? { startDate: { lte: new Date(params.to) } } : {}),
      ...(campusScope && requestedCampusFilter
        ? { AND: [campusScope, requestedCampusFilter] }
        : (campusScope ?? requestedCampusFilter ?? {})),
    };

    const records = await this.prisma.holiday.findMany({ where, orderBy: { startDate: 'asc' } });
    return records.map((r) => this.toSummary(r));
  }

  /** null means "no access at all" (fail closed), as distinct from an empty array (access to
   *  zero campuses but the null-campus rows still apply). */
  private async resolveAllowedCampusIds(actingUser: RequestUser): Promise<string[] | null> {
    if (actingUser.role === 'SCHOOL_ADMIN' || actingUser.role === 'ACCOUNTS') {
      const scope = await this.orgScope.resolve(actingUser);
      if (scope.denied) {
        return null;
      }
      const campuses = await this.prisma.campus.findMany({ where: scope.campusWhere, select: { id: true } });
      return campuses.map((c) => c.id);
    }
    if (actingUser.role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: actingUser.id } });
      if (!teacher) {
        return null;
      }
      return [teacher.campusId];
    }
    // PARENT (or any other authenticated role) — scoped to their own children's campuses.
    const enrollments = await this.prisma.enrollment.findMany({
      where: { student: { parents: { some: { parentProfile: { userId: actingUser.id } } } } },
      select: { campusId: true },
      distinct: ['campusId'],
    });
    return enrollments.map((e) => e.campusId);
  }

  async update(id: string, dto: UpdateHolidayDto): Promise<HolidaySummary> {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    const record = await this.prisma.holiday.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
        ...(dto.campusId !== undefined ? { campusId: dto.campusId } : {}),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.holiday.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    await this.prisma.holiday.delete({ where: { id } });
  }

  /**
   * A `campusId: null` Holiday row applies school-wide, so it counts for every campus in
   * addition to any campus-specific row — never dedupe/short-circuit on the first match's scope.
   */
  async isHoliday(date: Date, campusId: string): Promise<boolean> {
    const match = await this.prisma.holiday.findFirst({
      where: {
        startDate: { lte: date },
        endDate: { gte: date },
        OR: [{ campusId }, { campusId: null }],
      },
      select: { id: true },
    });
    return !!match;
  }
}
