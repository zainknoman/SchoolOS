// backend/src/admissions/applicants.service.ts
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  /**
   * KG-16: staff see only applicants their school recorded or who applied to their school (campus,
   * for a campus principal) — a child's name and date of birth are PII.
   */
  private async visibleTo(
    user: RequestUser,
  ): Promise<Prisma.ApplicantWhereInput> {
    const scope = await this.orgScope.resolve(user);
    if (scope.unrestricted) return {};
    if (scope.denied || !scope.schoolId) return { id: '__no-access__' };
    return {
      OR: [
        { schoolId: scope.schoolId },
        {
          applications: {
            some: { desiredClass: { campus: scope.campusWhere } },
          },
        },
      ],
    };
  }

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

  async create(
    dto: CreateApplicantDto,
    user: RequestUser,
  ): Promise<{
    applicant: ApplicantSummary;
    possibleDuplicate: ApplicantSummary | null;
  }> {
    const existingMatch = await this.prisma.applicant.findFirst({
      where: {
        name: dto.name,
        guardianPhone: dto.guardianPhone,
        ...(await this.visibleTo(user)),
      },
    });
    const record = await this.prisma.applicant.create({
      data: {
        name: dto.name,
        dateOfBirth: new Date(dto.dateOfBirth),
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
        schoolId: (await this.orgScope.resolve(user)).schoolId,
      },
    });
    return {
      applicant: this.toSummary(record),
      possibleDuplicate: existingMatch ? this.toSummary(existingMatch) : null,
    };
  }

  async findByPhone(
    guardianPhone: string,
    user: RequestUser,
  ): Promise<ApplicantSummary[]> {
    const records = await this.prisma.applicant.findMany({
      where: { guardianPhone, ...(await this.visibleTo(user)) },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }
}
