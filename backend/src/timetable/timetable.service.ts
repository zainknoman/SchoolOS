import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { UpdateTimetableEntryDto } from './dto/update-timetable-entry.dto';
import { BulkTimetableEntryDto } from './dto/bulk-timetable-entry.dto';
import { EnrollmentService } from '../enrollment/enrollment.service';

export interface TimetableEntrySummary {
  id: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string | null;
  room: string | null;
}

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  async getForStudent(studentId: string): Promise<TimetableEntrySummary[]> {
    const enrollment =
      await this.enrollmentService.getCurrentEnrollment(studentId);
    return this.getForSection(enrollment.sectionId);
  }

  async getForSection(sectionId: string): Promise<TimetableEntrySummary[]> {
    const entries = await this.prisma.timetable.findMany({
      where: { sectionId },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      include: { subject: true, teacher: true },
    });

    return entries.map((e) => ({
      id: e.id,
      dayOfWeek: e.dayOfWeek,
      period: e.period,
      startTime: e.startTime,
      endTime: e.endTime,
      subject: e.subject.name,
      teacher: e.teacher?.name ?? null,
      room: e.room,
    }));
  }

  /**
   * Blocks on both `teacherId` and `room` — a double-booked teacher and a double-booked room are
   * both real scheduling failures. `teacherId`/`room` are optional on Timetable, so a slot with
   * neither set is never flagged as conflicting with another slot that also has neither set.
   */
  private async assertNoConflict(
    dto: { dayOfWeek: number; period: number; teacherId?: string | null; room?: string | null },
    excludeId?: string,
  ): Promise<void> {
    const or: Array<Record<string, unknown>> = [];
    if (dto.teacherId) or.push({ teacherId: dto.teacherId });
    if (dto.room) or.push({ room: dto.room });
    if (or.length === 0) return;

    const conflict = await this.prisma.timetable.findFirst({
      where: {
        dayOfWeek: dto.dayOfWeek,
        period: dto.period,
        id: excludeId ? { not: excludeId } : undefined,
        OR: or,
      },
    });
    if (conflict) {
      throw new ConflictException(
        dto.teacherId && conflict.teacherId === dto.teacherId
          ? 'This teacher is already scheduled for this period.'
          : 'This room is already booked for this period.',
      );
    }
  }

  async getForTeacher(teacherId: string): Promise<TimetableEntrySummary[]> {
    const entries = await this.prisma.timetable.findMany({
      where: { teacherId },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      include: { subject: true, teacher: true },
    });

    return entries.map((e) => ({
      id: e.id,
      dayOfWeek: e.dayOfWeek,
      period: e.period,
      startTime: e.startTime,
      endTime: e.endTime,
      subject: e.subject.name,
      teacher: e.teacher?.name ?? null,
      room: e.room,
    }));
  }

  async createEntry(dto: CreateTimetableEntryDto, actingUserId: string) {
    await this.assertNoConflict(dto);
    const entry = await this.prisma.timetable.create({ data: dto });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'timetable.create',
        entity: 'Timetable',
        entityId: entry.id,
        metadata: JSON.stringify(dto),
      },
    });
    return entry;
  }

  async updateEntry(id: string, dto: UpdateTimetableEntryDto, actingUserId: string) {
    const existing = await this.prisma.timetable.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Timetable entry not found');
    }
    await this.assertNoConflict(
      {
        dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek,
        period: dto.period ?? existing.period,
        teacherId: dto.teacherId !== undefined ? dto.teacherId : existing.teacherId,
        room: dto.room !== undefined ? dto.room : existing.room,
      },
      id,
    );
    const entry = await this.prisma.timetable.update({ where: { id }, data: dto });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'timetable.update',
        entity: 'Timetable',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return entry;
  }

  async deleteEntry(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.timetable.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Timetable entry not found');
    }
    await this.prisma.timetable.delete({ where: { id } });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'timetable.delete',
        entity: 'Timetable',
        entityId: id,
      },
    });
  }

  /**
   * The grid composer's "Save Timetable" — defines the section's ENTIRE weekly timetable in one
   * call. Every existing row for the section is replaced (deleted, then the new set inserted),
   * not merged with what was there — this matches what the composer's UI shows the admin (the
   * complete grid, not an incremental add). Wrapped in one transaction so a mid-save failure never
   * leaves the section with a half-deleted timetable.
   */
  private assertNoSelfConflict(entries: BulkTimetableEntryDto[]): void {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i];
        const b = entries[j];
        if (a.dayOfWeek !== b.dayOfWeek || a.period !== b.period) continue;
        if (a.teacherId && a.teacherId === b.teacherId) {
          throw new ConflictException(
            'This teacher is double-booked within the submitted timetable.',
          );
        }
        if (a.room && a.room === b.room) {
          throw new ConflictException('This room is double-booked within the submitted timetable.');
        }
      }
    }
  }

  async replaceForSection(
    sectionId: string,
    entries: BulkTimetableEntryDto[],
    actingUserId: string,
  ): Promise<TimetableEntrySummary[]> {
    this.assertNoSelfConflict(entries);
    for (const entry of entries) {
      const or: Array<Record<string, unknown>> = [];
      if (entry.teacherId) or.push({ teacherId: entry.teacherId });
      if (entry.room) or.push({ room: entry.room });
      if (or.length === 0) continue;

      const conflict = await this.prisma.timetable.findFirst({
        where: {
          dayOfWeek: entry.dayOfWeek,
          period: entry.period,
          sectionId: { not: sectionId },
          OR: or,
        },
      });
      if (conflict) {
        throw new ConflictException(
          entry.teacherId && conflict.teacherId === entry.teacherId
            ? 'This teacher is already scheduled for this period in another section.'
            : 'This room is already booked for this period in another section.',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.timetable.deleteMany({ where: { sectionId } }),
      ...(entries.length
        ? [this.prisma.timetable.createMany({ data: entries.map((e) => ({ ...e, sectionId })) })]
        : []),
    ]);

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'timetable.replace',
        entity: 'Timetable',
        entityId: sectionId,
        metadata: JSON.stringify({ sectionId, count: entries.length }),
      },
    });

    return this.getForSection(sectionId);
  }
}
