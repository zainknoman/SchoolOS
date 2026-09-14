import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHiringCandidateDto } from './dto/create-hiring-candidate.dto';

export interface HiringCandidateSummary {
  id: string;
  name: string;
  dateOfBirth: string | null;
  cnic: string | null;
  contactPhone: string;
  contactEmail: string | null;
  resumeFileId: string | null;
}

@Injectable()
export class HiringCandidatesService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string; name: string; dateOfBirth: Date | null; cnic: string | null;
    contactPhone: string; contactEmail: string | null; resumeFileId: string | null;
  }): HiringCandidateSummary {
    return {
      id: record.id,
      name: record.name,
      dateOfBirth: record.dateOfBirth ? record.dateOfBirth.toISOString().slice(0, 10) : null,
      cnic: record.cnic,
      contactPhone: record.contactPhone,
      contactEmail: record.contactEmail,
      resumeFileId: record.resumeFileId,
    };
  }

  async create(
    dto: CreateHiringCandidateDto,
  ): Promise<{ candidate: HiringCandidateSummary; possibleDuplicate: HiringCandidateSummary | null }> {
    if (dto.resumeFileId) {
      const file = await this.prisma.file.findUnique({ where: { id: dto.resumeFileId } });
      if (!file) {
        throw new BadRequestException('Upload the résumé first via POST /api/v1/files, then link it here.');
      }
    }
    const existingMatch = await this.prisma.hiringCandidate.findFirst({
      where: { name: dto.name, contactPhone: dto.contactPhone },
    });
    const record = await this.prisma.hiringCandidate.create({
      data: {
        name: dto.name,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        cnic: dto.cnic,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        resumeFileId: dto.resumeFileId,
      },
    });
    return {
      candidate: this.toSummary(record),
      possibleDuplicate: existingMatch ? this.toSummary(existingMatch) : null,
    };
  }

  async findByPhone(contactPhone: string): Promise<HiringCandidateSummary[]> {
    const records = await this.prisma.hiringCandidate.findMany({
      where: { contactPhone },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }
}