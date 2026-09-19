import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrgStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import {
  assertCreatable,
  assertValidReferences,
} from '../common/prisma-create-guard';
import {
  createPrincipalUser,
  type ProvisionedLogin,
} from '../common/create-principal-user';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
import type { RequestUser } from '../common/student-access.service';

export interface CampusSummary {
  id: string;
  name: string;
  schoolId: string;
  schoolName: string;
  code: string | null;
  campusType: string | null;
  logoFileId: string | null;
  principalName: string | null;
  principalPhone: string | null;
  principalEmail: string | null;
  openingDate: Date | null;
  capacity: number | null;
  latitude: number | null;
  longitude: number | null;
  status: OrgStatus;
  departments: string[];
  alternatePhone: string | null;
  addressId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  studentCount: number;
  staffCount: number;
}

const WITH_SCHOOL = { school: { select: { name: true } } } as const;

@Injectable()
export class CampusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private async toSummary(
    record: Omit<
      CampusSummary,
      'schoolName' | 'studentCount' | 'staffCount'
    > & {
      school: { name: string };
    },
  ): Promise<CampusSummary> {
    const [studentCount, staffCount] = await Promise.all([
      this.prisma.enrollment.count({
        where: { status: 'ACTIVE', campusId: record.id },
      }),
      this.prisma.staff.count({ where: { campusId: record.id } }),
    ]);
    const { school, ...rest } = record;
    return {
      ...rest,
      schoolName: school.name,
      studentCount,
      staffCount,
    };
  }

  async create(
    dto: CreateCampusDto,
    actingUserId: string,
    actingUser?: RequestUser,
  ): Promise<CampusSummary & { provisionedLogin?: ProvisionedLogin }> {
    if (actingUser && actingUser.role !== 'SUPER_ADMIN') {
      const scope = await this.orgScope.resolve(actingUser);
      if (scope.denied || scope.campusId !== null || scope.schoolId !== dto.schoolId) {
        throw new ForbiddenException('You can only create campuses for your own school');
      }
    }
    // `principal` (and any password in it) must never reach Prisma or the audit log.
    const { principal, ...campusData } = dto;
    let provisionedLogin: ProvisionedLogin | undefined;
    // The Campus row and its audit-log entry are wrapped in one $transaction so a bad
    // actingUserId (e.g. a stale/orphaned session) rolls back the Campus row too, instead of
    // silently persisting a Campus with no audit trail while the caller sees a 500.
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.campus
        .create({
          data: {
            ...campusData,
            openingDate: campusData.openingDate
              ? new Date(campusData.openingDate)
              : undefined,
          },
          include: WITH_SCHOOL,
        })
        .catch((error: unknown) => {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            return assertCreatable(
              error,
              'This campus code is already in use for this school.',
            );
          }
          return assertValidReferences(error, 'Invalid school reference.');
        });
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'campus.create',
          entity: 'Campus',
          entityId: created.id,
          metadata: JSON.stringify(campusData),
        },
      });
      if (principal) {
        provisionedLogin = await createPrincipalUser(tx, {
          identifier: principal.identifier,
          password: principal.password,
          schoolId: created.schoolId,
          campusId: created.id,
        });
        await tx.auditLog.create({
          data: {
            userId: actingUserId,
            action: 'user.create',
            entity: 'User',
            entityId: created.id,
            metadata: JSON.stringify({
              identifier: provisionedLogin.identifier,
              role: 'SCHOOL_ADMIN',
              campusId: created.id,
            }),
          },
        });
      }
      return created;
    });
    const summary = await this.toSummary(record);
    return provisionedLogin ? { ...summary, provisionedLogin } : summary;
  }

  async list(actingUser: RequestUser): Promise<CampusSummary[]> {
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      // Fail closed: a non-SUPER_ADMIN caller with no schoolId sees no campuses at all.
      return [];
    }
    const records = await this.prisma.campus.findMany({
      where: scope.campusWhere,
      include: WITH_SCHOOL,
      orderBy: { name: 'asc' },
    });
    return Promise.all(records.map((r) => this.toSummary(r)));
  }

  async update(
    id: string,
    dto: UpdateCampusDto,
    actingUserId: string,
  ): Promise<CampusSummary> {
    const existing = await this.prisma.campus.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Campus not found');
    }
    const { openingDate, ...rest } = dto;
    // The Campus row and its audit-log entry are wrapped in one $transaction so a bad
    // actingUserId (e.g. a stale/orphaned session) rolls back the Campus update too, instead of
    // silently persisting the update with no audit trail while the caller sees a 500.
    const record = await this.prisma.$transaction(async (tx) => {
      let updated: Parameters<CampusService['toSummary']>[0];
      try {
        updated = await tx.campus.update({
          where: { id },
          data: {
            ...rest,
            ...(openingDate !== undefined
              ? { openingDate: new Date(openingDate) }
              : {}),
          },
          include: WITH_SCHOOL,
        });
      } catch (error) {
        assertCreatable(
          error,
          'This campus code is already in use for this school.',
        );
      }
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'campus.update',
          entity: 'Campus',
          entityId: id,
          metadata: JSON.stringify(dto),
        },
      });
      return updated;
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.campus.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Campus not found');
    }
    // The delete and its audit-log entry are wrapped in one $transaction so a bad actingUserId
    // (e.g. a stale/orphaned session) rolls back the delete too, instead of silently deleting the
    // Campus with no audit trail while the caller sees a 500.
    await this.prisma.$transaction(async (tx) => {
      try {
        await tx.campus.delete({ where: { id } });
      } catch (error) {
        assertDeletable(error, 'Campus');
      }
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'campus.delete',
          entity: 'Campus',
          entityId: id,
        },
      });
    });
  }
}
