import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiaryEntryDto } from './dto/create-diary-entry.dto';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface DiaryEntrySummary {
  id: string;
  date: string;
  dueDate: string | null;
  subject: string;
  text: string;
  attachments: { id: string; originalName: string; mimeType: string }[];
}

@Injectable()
export class DiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Upsert on sectionId+subjectId+date so re-posting the same section/subject/day is idempotent
   * (edits an existing entry) instead of creating duplicates — mirrors Attendance's upsert-on-
   * studentId+date pattern.
   *
   * authorId is the caller's own User id (req.user.id) — no profile-table lookup needed, since
   * every role permitted to post (TEACHER, SCHOOL_ADMIN, SUPER_ADMIN) has a User row, and the
   * controller's @Roles guard has already confirmed the caller is one of those roles. Mirrors how
   * CircularsService.publish takes authorId directly.
   */
  async createEntry(dto: CreateDiaryEntryDto, creatingUserId: string) {
    const date = new Date(dto.date);
    const entry = await this.prisma.diaryEntry.upsert({
      where: {
        sectionId_subjectId_date: { sectionId: dto.sectionId, subjectId: dto.subjectId, date },
      },
      create: {
        sectionId: dto.sectionId,
        subjectId: dto.subjectId,
        authorId: creatingUserId,
        date,
        text: dto.text,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
      update: {
        authorId: creatingUserId,
        text: dto.text,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });

    if (dto.fileIds?.length) {
      // Clear any previous attachments, then attach the current set — keeps re-posting the same
      // section+subject+day idempotent instead of accumulating stale files.
      await this.prisma.diaryAttachment.deleteMany({ where: { diaryEntryId: entry.id } });
      await this.prisma.diaryAttachment.createMany({
        data: dto.fileIds.map((fileId) => ({ diaryEntryId: entry.id, fileId })),
      });
    }

    await this.prisma.auditLog.create({
      data: {
        userId: creatingUserId,
        action: 'diary.create',
        entity: 'DiaryEntry',
        entityId: entry.id,
        metadata: JSON.stringify({
          sectionId: dto.sectionId,
          subjectId: dto.subjectId,
          date: dto.date,
        }),
      },
    });

    const parents = await this.prisma.user.findMany({
      where: {
        role: 'PARENT',
        parentProfile: {
          children: {
            some: {
              student: { enrollments: { some: { sectionId: dto.sectionId, status: 'ACTIVE' } } },
            },
          },
        },
      },
      select: { id: true },
    });
    await Promise.all(
      parents.map((p) =>
        this.notifications.notify({
          userId: p.id,
          type: 'diary',
          title: 'New diary entry',
          body: dto.text,
          entityRef: entry.id,
        }),
      ),
    );

    return entry;
  }

  async getForSection(sectionId: string, month: string): Promise<DiaryEntrySummary[]> {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const entries = await this.prisma.diaryEntry.findMany({
      where: { sectionId, date: { gte: start, lt: end } },
      orderBy: { date: 'desc' },
      include: { subject: true, attachments: { include: { file: true } } },
    });

    return entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString().slice(0, 10),
      dueDate: e.dueDate ? e.dueDate.toISOString().slice(0, 10) : null,
      subject: e.subject.name,
      text: e.text,
      attachments: e.attachments.map((a) => ({
        id: a.file.id,
        originalName: a.file.originalName,
        mimeType: a.file.mimeType,
      })),
    }));
  }

  async getForStudent(studentId: string, month: string): Promise<DiaryEntrySummary[]> {
    const monthStart = new Date(`${month}-01T00:00:00.000Z`);
    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
    const enrollment = await this.enrollmentService.getEnrollmentForDate(studentId, monthStart, monthEnd);
    return this.getForSection(enrollment.sectionId, month);
  }
}
