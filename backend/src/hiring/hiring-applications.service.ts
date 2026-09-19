import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { CreateHiringApplicationDto } from './dto/create-hiring-application.dto';
import { UpdateHiringApplicationDto } from './dto/update-hiring-application.dto';
import { ApproveHiringApplicationDto } from './dto/approve-hiring-application.dto';
import { createStaffWithOptionalTeacher } from './create-staff-with-optional-teacher';
import { assertCreatable } from '../common/prisma-create-guard';
import type { EmployeeType, Prisma } from '@prisma/client';
import type { RequestUser } from '../common/student-access.service';

export interface HiringApplicationSummary {
  id: string;
  candidateId: string;
  candidateName: string;
  employeeType: EmployeeType;
  campusId: string;
  status: string;
  decisionNotes: string | null;
  reviewedById: string | null;
  createdStaffId: string | null;
}

export const TERMINAL_STATUSES = ['APPROVED', 'REJECTED'];
const WITH_CANDIDATE = { candidate: { select: { name: true } } } as const;

@Injectable()
export class HiringApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(record: {
    id: string; candidateId: string; candidate: { name: string }; employeeType: EmployeeType;
    campusId: string; status: string; decisionNotes: string | null; reviewedById: string | null;
    createdStaffId: string | null;
  }): HiringApplicationSummary {
    return {
      id: record.id,
      candidateId: record.candidateId,
      candidateName: record.candidate.name,
      employeeType: record.employeeType,
      campusId: record.campusId,
      status: record.status,
      decisionNotes: record.decisionNotes,
      reviewedById: record.reviewedById,
      createdStaffId: record.createdStaffId,
    };
  }

  async create(dto: CreateHiringApplicationDto): Promise<HiringApplicationSummary> {
    const record = await this.prisma.hiringApplication.create({
      data: {
        candidateId: dto.candidateId,
        employeeType: dto.employeeType,
        campusId: dto.campusId,
        status: 'SUBMITTED',
      },
      include: WITH_CANDIDATE,
    });
    return this.toSummary(record);
  }

  async findOne(id: string): Promise<HiringApplicationSummary> {
    const existing = await this.getOrThrow(id);
    return this.toSummary(existing);
  }

  async findMany(actingUser: RequestUser, campusId?: string, status?: string): Promise<HiringApplicationSummary[]> {
    let where: Prisma.HiringApplicationWhereInput = {
      ...(campusId ? { campusId } : {}),
      ...(status ? { status } : {}),
    };
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      where = { ...where, campus: scope.campusWhere };
    }
    const records = await this.prisma.hiringApplication.findMany({
      where,
      include: WITH_CANDIDATE,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  private async getOrThrow(id: string) {
    const existing = await this.prisma.hiringApplication.findUnique({ where: { id }, include: WITH_CANDIDATE });
    if (!existing) {
      throw new NotFoundException('Hiring application not found');
    }
    return existing;
  }

  async updateStatus(id: string, dto: UpdateHiringApplicationDto): Promise<HiringApplicationSummary> {
    const existing = await this.getOrThrow(id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(`Application is already ${existing.status.toLowerCase()} and cannot be changed`);
    }
    const record = await this.prisma.hiringApplication.update({
      where: { id },
      include: WITH_CANDIDATE,
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.decisionNotes !== undefined ? { decisionNotes: dto.decisionNotes } : {}),
      },
    });
    return this.toSummary(record);
  }

  async reject(id: string, decisionNotes: string, reviewedById: string): Promise<HiringApplicationSummary> {
    const existing = await this.getOrThrow(id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(`Application is already ${existing.status.toLowerCase()}`);
    }
    const record = await this.prisma.hiringApplication.update({
      where: { id },
      include: WITH_CANDIDATE,
      data: { status: 'REJECTED', decisionNotes, reviewedById },
    });
    return this.toSummary(record);
  }

  async approve(id: string, dto: ApproveHiringApplicationDto, reviewedById: string): Promise<HiringApplicationSummary> {
    const existing = await this.getOrThrow(id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(`Application is already ${existing.status.toLowerCase()}`);
    }
    if (existing.employeeType === 'TEACHER' && !dto.login) {
      throw new BadRequestException('A login identifier/password is required to hire a teacher.');
    }

    let record: Parameters<HiringApplicationsService['toSummary']>[0];
    try {
      record = await this.prisma.$transaction(async (tx) => {
        const { id: staffId } = await createStaffWithOptionalTeacher(tx, {
          name: existing.candidate.name,
          employeeType: existing.employeeType,
          campusId: existing.campusId,
          dateOfBirth: dto.dateOfBirth,
          cnic: dto.cnic,
          mobile: dto.mobile,
          email: dto.email,
          joiningDate: dto.joiningDate,
          login: dto.login,
        });
        return tx.hiringApplication.update({
          where: { id },
          include: WITH_CANDIDATE,
          data: { status: 'APPROVED', reviewedById, createdStaffId: staffId },
        });
      });
    } catch (error) {
      assertCreatable(error, 'This CNIC or login identifier is already in use.');
    }
    return this.toSummary(record);
  }  
}