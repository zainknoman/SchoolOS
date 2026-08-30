import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { UpdateTimetableEntryDto } from './dto/update-timetable-entry.dto';
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

  async createEntry(dto: CreateTimetableEntryDto, actingUserId: string) {
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
}
