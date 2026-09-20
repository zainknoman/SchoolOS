// backend/src/admissions/applications.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ApproveApplicationDto } from './dto/approve-application.dto';
import { createStudentWithEnrollment } from '../student/create-student-with-enrollment';
import { assertCreatable } from '../common/prisma-create-guard';
import type { RequestUser } from '../common/student-access.service';

export interface ApplicationSummary {
  id: string;
  applicantId: string;
  applicantName: string;
  desiredClassId: string;
  academicSessionId: string;
  status: string;
  decisionNotes: string | null;
  reviewedById: string | null;
  createdStudentId: string | null;
}

const TERMINAL_STATUSES = ['APPROVED', 'REJECTED'];
const WITH_APPLICANT = { applicant: { select: { name: true } } } as const;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(record: {
    id: string;
    applicantId: string;
    applicant: { name: string };
    desiredClassId: string;
    academicSessionId: string;
    status: string;
    decisionNotes: string | null;
    reviewedById: string | null;
    createdStudentId: string | null;
  }): ApplicationSummary {
    return {
      id: record.id,
      applicantId: record.applicantId,
      applicantName: record.applicant.name,
      desiredClassId: record.desiredClassId,
      academicSessionId: record.academicSessionId,
      status: record.status,
      decisionNotes: record.decisionNotes,
      reviewedById: record.reviewedById,
      createdStudentId: record.createdStudentId,
    };
  }

  async create(dto: CreateApplicationDto): Promise<ApplicationSummary> {
    const record = await this.prisma.application.create({
      data: {
        applicantId: dto.applicantId,
        desiredClassId: dto.desiredClassId,
        academicSessionId: dto.academicSessionId,
        status: 'SUBMITTED',
      },
      include: WITH_APPLICANT,
    });
    return this.toSummary(record);
  }

  async findOne(id: string): Promise<ApplicationSummary> {
    const existing = await this.getOrThrow(id);
    return this.toSummary(existing);
  }

  async findMany(
    actingUser: RequestUser,
    academicSessionId?: string,
    status?: string,
  ): Promise<ApplicationSummary[]> {
    let where: Prisma.ApplicationWhereInput = {
      ...(academicSessionId ? { academicSessionId } : {}),
      ...(status ? { status } : {}),
    };
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      // AcademicSession has no schoolId of its own — scope via the desired class's campus instead.
      where = { ...where, desiredClass: { campus: scope.campusWhere } };
    }
    const records = await this.prisma.application.findMany({
      where,
      include: WITH_APPLICANT,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  private async getOrThrow(id: string) {
    const existing = await this.prisma.application.findUnique({
      where: { id },
      include: WITH_APPLICANT,
    });
    if (!existing) {
      throw new NotFoundException('Application not found');
    }
    return existing;
  }

  async updateStatus(
    id: string,
    dto: UpdateApplicationDto,
  ): Promise<ApplicationSummary> {
    const existing = await this.getOrThrow(id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        `Application is already ${existing.status.toLowerCase()} and cannot be changed`,
      );
    }
    const record = await this.prisma.application.update({
      where: { id },
      include: WITH_APPLICANT,
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.decisionNotes !== undefined
          ? { decisionNotes: dto.decisionNotes }
          : {}),
      },
    });
    return this.toSummary(record);
  }

  async reject(
    id: string,
    decisionNotes: string,
    reviewedById: string,
  ): Promise<ApplicationSummary> {
    const existing = await this.getOrThrow(id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        `Application is already ${existing.status.toLowerCase()}`,
      );
    }
    const record = await this.prisma.application.update({
      where: { id },
      include: WITH_APPLICANT,
      data: { status: 'REJECTED', decisionNotes, reviewedById },
    });
    return this.toSummary(record);
  }

  async approve(
    id: string,
    dto: ApproveApplicationDto,
    reviewedById: string,
  ): Promise<ApplicationSummary> {
    const existing = await this.getOrThrow(id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(
        `Application is already ${existing.status.toLowerCase()}`,
      );
    }
    const hasExisting = dto.parentProfileId != null;
    const hasNew = dto.newParent != null;
    if (hasExisting === hasNew) {
      throw new BadRequestException(
        'Provide exactly one of parentProfileId or newParent',
      );
    }
    const section = await this.prisma.section.findUnique({
      where: { id: dto.sectionId },
      select: { id: true, class: { select: { campusId: true } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    let record: Parameters<ApplicationsService['toSummary']>[0];
    try {
      record = await this.prisma.$transaction(async (tx) => {
        // Enroll into the academic session this application actually targeted, not whichever
        // session happens to be globally "active" right now — those can differ.
        const { studentId } = await createStudentWithEnrollment(
          tx,
          {
            grNumber: dto.grNumber,
            name: existing.applicant.name,
            sectionId: section.id,
            campusId: section.class.campusId,
            academicSessionId: existing.academicSessionId,
            parentProfileId: dto.parentProfileId,
            newParent: dto.newParent,
          },
          reviewedById,
        );
        return tx.application.update({
          where: { id },
          include: WITH_APPLICANT,
          data: {
            status: 'APPROVED',
            reviewedById,
            createdStudentId: studentId,
          },
        });
      });
    } catch (error) {
      assertCreatable(
        error,
        'This GR number or parent identifier is already in use.',
      );
    }
    return this.toSummary(record);
  }
}
