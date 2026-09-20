import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';

export interface ReportCardSummary {
  id: string;
  studentId: string;
  academicSessionId: string;
  fileId: string;
  createdAt: string;
}

@Injectable()
export class ReportCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  private toSummary(record: {
    id: string;
    studentId: string;
    academicSessionId: string;
    fileId: string;
    createdAt: Date;
  }): ReportCardSummary {
    return {
      id: record.id,
      studentId: record.studentId,
      academicSessionId: record.academicSessionId,
      fileId: record.fileId,
      createdAt: record.createdAt.toISOString(),
    };
  }

  async upload(
    studentId: string,
    academicSessionId: string,
    file: Express.Multer.File,
    uploadedById: string,
  ): Promise<ReportCardSummary> {
    const existing = await this.prisma.reportCard.findUnique({
      where: { studentId_academicSessionId: { studentId, academicSessionId } },
    });
    if (existing) {
      throw new ConflictException(
        'A report card already exists for this student and session',
      );
    }

    const uploaded = await this.filesService.upload(file, uploadedById);
    const record = await this.prisma.reportCard.create({
      data: { studentId, academicSessionId, fileId: uploaded.id, uploadedById },
    });
    return this.toSummary(record);
  }

  async findForStudent(studentId: string): Promise<ReportCardSummary[]> {
    const records = await this.prisma.reportCard.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async getFileIdForDownload(reportCardId: string): Promise<string | null> {
    const record = await this.prisma.reportCard.findUnique({
      where: { id: reportCardId },
    });
    return record?.fileId ?? null;
  }
}
