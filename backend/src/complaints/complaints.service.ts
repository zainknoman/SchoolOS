import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';

export interface ComplaintSummary {
  id: string;
  studentId: string;
  raisedById: string;
  subject: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    studentId: string;
    raisedById: string;
    subject: string;
    description: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): ComplaintSummary {
    return {
      id: record.id,
      studentId: record.studentId,
      raisedById: record.raisedById,
      subject: record.subject,
      description: record.description,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  async create(dto: CreateComplaintDto, raisedById: string): Promise<ComplaintSummary> {
    const record = await this.prisma.complaint.create({
      data: {
        studentId: dto.studentId,
        raisedById,
        subject: dto.subject,
        description: dto.description,
        status: 'open',
      },
    });
    return this.toSummary(record);
  }

  async findForStudent(studentId: string): Promise<ComplaintSummary[]> {
    const records = await this.prisma.complaint.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async updateStatus(id: string, status: string): Promise<ComplaintSummary> {
    const existing = await this.prisma.complaint.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Complaint not found');
    }
    const record = await this.prisma.complaint.update({ where: { id }, data: { status } });
    return this.toSummary(record);
  }
}
