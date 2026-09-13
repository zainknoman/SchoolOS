// backend/src/admissions/applicants.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';

export interface ApplicantSummary {
  id: string;
  name: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
}

@Injectable()
export class ApplicantsService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    name: string;
    dateOfBirth: Date;
    guardianName: string;
    guardianPhone: string;
  }): ApplicantSummary {
    return {
      id: record.id,
      name: record.name,
      dateOfBirth: record.dateOfBirth.toISOString().slice(0, 10),
      guardianName: record.guardianName,
      guardianPhone: record.guardianPhone,
    };
  }

  async create(dto: CreateApplicantDto): Promise<{ applicant: ApplicantSummary; possibleDuplicate: ApplicantSummary | null }> {
    const existingMatch = await this.prisma.applicant.findFirst({
      where: { name: dto.name, guardianPhone: dto.guardianPhone },
    });
    const record = await this.prisma.applicant.create({
      data: {
        name: dto.name,
        dateOfBirth: new Date(dto.dateOfBirth),
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
      },
    });
    return {
      applicant: this.toSummary(record),
      possibleDuplicate: existingMatch ? this.toSummary(existingMatch) : null,
    };
  }

  async findByPhone(guardianPhone: string): Promise<ApplicantSummary[]> {
    const records = await this.prisma.applicant.findMany({
      where: { guardianPhone },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }
}
