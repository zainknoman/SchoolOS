import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  /**
   * KG-16: a school admin sees only candidates their school recorded or who applied to their school
   * (campus, for a campus principal) — CNIC and date of birth are PII.
   */
  private async visibleTo(
    user: RequestUser,
  ): Promise<Prisma.HiringCandidateWhereInput> {
    const scope = await this.orgScope.resolve(user);
    if (scope.unrestricted) return {};
    if (scope.denied || !scope.schoolId) return { id: '__no-access__' };
    return {
      OR: [
        { schoolId: scope.schoolId },
        { applications: { some: { campus: scope.campusWhere } } },
      ],
    };
  }

  private toSummary(record: {
    id: string;
    name: string;
    dateOfBirth: Date | null;
    cnic: string | null;
    contactPhone: string;
    contactEmail: string | null;
    resumeFileId: string | null;
  }): HiringCandidateSummary {
    return {
      id: record.id,
      name: record.name,
      dateOfBirth: record.dateOfBirth
        ? record.dateOfBirth.toISOString().slice(0, 10)
        : null,
      cnic: record.cnic,
      contactPhone: record.contactPhone,
      contactEmail: record.contactEmail,
      resumeFileId: record.resumeFileId,
    };
  }

  async create(
    dto: CreateHiringCandidateDto,
    user: RequestUser,
  ): Promise<{
    candidate: HiringCandidateSummary;
    possibleDuplicate: HiringCandidateSummary | null;
  }> {
    if (dto.resumeFileId) {
      const file = await this.prisma.file.findUnique({
        where: { id: dto.resumeFileId },
      });
      if (!file) {
        throw new BadRequestException(
          'Upload the résumé first via POST /api/v1/files, then link it here.',
        );
      }
      if (user.role !== 'SUPER_ADMIN' && file.uploadedById !== user.id) {
        throw new ForbiddenException('Link a résumé you uploaded yourself.');
      }
    }
    const existingMatch = await this.prisma.hiringCandidate.findFirst({
      where: {
        name: dto.name,
        contactPhone: dto.contactPhone,
        ...(await this.visibleTo(user)),
      },
    });
    const record = await this.prisma.hiringCandidate.create({
      data: {
        name: dto.name,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        cnic: dto.cnic,
        contactPhone: dto.contactPhone,
        contactEmail: dto.contactEmail,
        resumeFileId: dto.resumeFileId,
        schoolId: (await this.orgScope.resolve(user)).schoolId,
      },
    });
    return {
      candidate: this.toSummary(record),
      possibleDuplicate: existingMatch ? this.toSummary(existingMatch) : null,
    };
  }

  async findByPhone(
    contactPhone: string,
    user: RequestUser,
  ): Promise<HiringCandidateSummary[]> {
    const records = await this.prisma.hiringCandidate.findMany({
      where: { contactPhone, ...(await this.visibleTo(user)) },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }
}
