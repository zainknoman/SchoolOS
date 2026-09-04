import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';

export interface LeaveRequestSummary {
  id: string;
  studentId: string;
  studentName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  createdAt: string;
}

const STUDENT_INCLUDE = { student: { select: { name: true } } } as const;

@Injectable()
export class LeaveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  async create(dto: CreateLeaveRequestDto): Promise<LeaveRequestSummary> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException('startDate must not be after endDate');
    }
    const record = await this.prisma.leaveRequest.create({
      data: { studentId: dto.studentId, startDate, endDate, reason: dto.reason },
      include: STUDENT_INCLUDE,
    });
    return this.toSummary(record);
  }

  async listForStudent(studentId: string): Promise<LeaveRequestSummary[]> {
    const records = await this.prisma.leaveRequest.findMany({
      where: { studentId },
      include: STUDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async listAll(status?: string): Promise<LeaveRequestSummary[]> {
    const records = await this.prisma.leaveRequest.findMany({
      where: status ? { status } : undefined,
      include: STUDENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  /**
   * Attendance.markedById is a required Teacher FK, so an admin approving leave (who has no
   * Teacher profile of their own) can't be the marker — the write is attributed to the student's
   * current class teacher instead. Any day in range already marked HOLIDAY is left untouched.
   */
  async approve(id: string, actingUserId: string): Promise<LeaveRequestSummary> {
    const record = await this.decide(id, 'approved');

    const enrollment = await this.enrollmentService.getCurrentEnrollment(record.studentId);
    const section = await this.prisma.section.findUnique({ where: { id: enrollment.sectionId } });
    if (!section?.classTeacherId) {
      throw new BadRequestException(
        "Cannot approve leave: this student's section has no class teacher assigned",
      );
    }

    const dates: Date[] = [];
    for (
      const cursor = new Date(record.startDate);
      cursor <= record.endDate;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      dates.push(new Date(cursor));
    }

    const existing = await this.prisma.attendance.findMany({
      where: { studentId: record.studentId, date: { in: dates } },
      select: { date: true, status: true },
    });
    const holidayDates = new Set(
      existing.filter((e) => e.status === 'HOLIDAY').map((e) => e.date.toISOString()),
    );

    for (const date of dates) {
      if (holidayDates.has(date.toISOString())) continue;
      await this.prisma.attendance.upsert({
        where: { studentId_date: { studentId: record.studentId, date } },
        create: { studentId: record.studentId, date, status: 'LEAVE', markedById: section.classTeacherId },
        update: { status: 'LEAVE', markedById: section.classTeacherId },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'leave-request.approve',
        entity: 'LeaveRequest',
        entityId: id,
        metadata: JSON.stringify({ studentId: record.studentId, dateCount: dates.length }),
      },
    });

    return this.toSummary(record);
  }

  async reject(id: string, actingUserId: string): Promise<LeaveRequestSummary> {
    const record = await this.decide(id, 'rejected');
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'leave-request.reject',
        entity: 'LeaveRequest',
        entityId: id,
      },
    });
    return this.toSummary(record);
  }

  private async decide(id: string, status: 'approved' | 'rejected') {
    const existing = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Leave request not found');
    }
    if (existing.status !== 'pending') {
      throw new BadRequestException('This leave request has already been decided');
    }
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status },
      include: STUDENT_INCLUDE,
    });
  }

  private toSummary(record: {
    id: string;
    studentId: string;
    startDate: Date;
    endDate: Date;
    reason: string;
    status: string;
    createdAt: Date;
    student: { name: string };
  }): LeaveRequestSummary {
    return {
      id: record.id,
      studentId: record.studentId,
      studentName: record.student.name,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
      reason: record.reason,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
