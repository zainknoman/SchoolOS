import {
  PagedResult,
  pageArgs,
  toPageRequest,
  type PageRequest,
} from '../common/pagination';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertCreatable } from '../common/prisma-create-guard';
import { createParentWithUser } from './create-parent-with-user';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { UpdateParentChildLinkDto } from './dto/update-parent-child-link.dto';
import type { AddressDto } from '../common/dto/address.dto';
import type { RequestUser } from '../common/student-access.service';

export interface ParentSummary {
  id: string;
  identifier: string;
  name: string;
  phone: string | null;
  childrenCount: number;
}

export interface ParentAddress {
  line1: string;
  line2: string | null;
  area: string | null;
  city: string | null;
  district: string | null;
  province: string | null;
  postalCode: string | null;
  country: string;
}

export interface ParentProfileDetail extends ParentSummary {
  cnic: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  alternatePhone: string | null;
  whatsappNumber: string | null;
  email: string | null;
  occupation: string | null;
  employerName: string | null;
  designation: string | null;
  currentAddress: ParentAddress | null;
  permanentAddress: ParentAddress | null;
  children: Array<{
    studentId: string;
    studentName: string;
    grNumber: string;
    className: string | null;
    sectionName: string | null;
    relationship: string;
    isPrimary: boolean;
    isEmergencyContact: boolean;
  }>;
}

const PROFILE_INCLUDE = {
  user: { select: { identifier: true } },
  currentAddress: true,
  permanentAddress: true,
  children: {
    include: {
      student: {
        select: {
          id: true,
          name: true,
          grNumber: true,
          enrollments: {
            where: { status: 'ACTIVE' },
            orderBy: { startDate: 'desc' },
            take: 1,
            select: {
              section: {
                select: { name: true, class: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const;

const toAddress = (
  a: {
    line1: string;
    line2: string | null;
    area: string | null;
    city: string | null;
    district: string | null;
    province: string | null;
    postalCode: string | null;
    country: string;
  } | null,
): ParentAddress | null =>
  a
    ? {
        line1: a.line1,
        line2: a.line2,
        area: a.area,
        city: a.city,
        district: a.district,
        province: a.province,
        postalCode: a.postalCode,
        country: a.country,
      }
    : null;

const WITH_USER_AND_COUNT = {
  user: { select: { identifier: true } },
  _count: { select: { children: true } },
} as const;

@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(record: {
    id: string;
    name: string;
    phone: string | null;
    user: { identifier: string };
    _count: { children: number };
  }): ParentSummary {
    return {
      id: record.id,
      identifier: record.user.identifier,
      name: record.name,
      phone: record.phone,
      childrenCount: record._count.children,
    };
  }

  async create(
    dto: CreateParentDto,
    actingUserId: string,
  ): Promise<ParentSummary> {
    let created: Awaited<ReturnType<typeof createParentWithUser>>;
    try {
      created = await this.prisma.$transaction((tx) =>
        createParentWithUser(tx, dto),
      );
    } catch (error) {
      assertCreatable(error, 'This identifier is already in use.');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'parent.create',
        entity: 'ParentProfile',
        entityId: created.id,
        metadata: JSON.stringify({
          identifier: dto.identifier,
          name: dto.name,
        }),
      },
    });
    return {
      id: created.id,
      identifier: created.identifier,
      name: created.name,
      phone: created.phone,
      childrenCount: 0,
    };
  }

  /** Paged/searchable (BL-40): `q` matches name, phone, CNIC or login identifier. */
  async list(
    actingUser: RequestUser,
    page: PageRequest = toPageRequest(),
  ): Promise<PagedResult<ParentSummary>> {
    let where: Prisma.ParentProfileWhereInput | undefined;
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return PagedResult.of([], 0, page);
    }
    if (scope.campusWhere) {
      where = {
        children: {
          some: {
            student: {
              enrollments: {
                some: { section: { class: { campus: scope.campusWhere } } },
              },
            },
          },
        },
      };
    }
    // Only wrap when searching, so an unfiltered query is exactly the scope query.
    const filtered: Prisma.ParentProfileWhereInput | undefined = page.q
      ? {
          AND: [
            where ?? {},
            {
              OR: [
                { name: { contains: page.q, mode: 'insensitive' as const } },
                { phone: { contains: page.q, mode: 'insensitive' as const } },
                { cnic: { contains: page.q, mode: 'insensitive' as const } },
                {
                  user: {
                    identifier: {
                      contains: page.q,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              ],
            },
          ],
        }
      : where;
    const [records, total] = await Promise.all([
      this.prisma.parentProfile.findMany({
        where: filtered,
        include: WITH_USER_AND_COUNT,
        orderBy: page.paged
          ? [{ name: 'asc' }, { id: 'asc' }]
          : { name: 'asc' },
        ...pageArgs(page),
      }),
      this.prisma.parentProfile.count({ where: filtered }),
    ]);
    return PagedResult.of(
      records.map((r) => this.toSummary(r)),
      total,
      page,
    );
  }

  /** SCHOOL_ADMIN may only reach parents that have a child enrolled in their own school. */
  private async assertParentInScope(
    parentId: string,
    actingUser: RequestUser,
  ): Promise<void> {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) {
      throw new NotFoundException('Parent not found');
    }
    if (actingUser.role === 'SUPER_ADMIN') return;
    const scope = await this.orgScope.resolve(actingUser);
    const inScope = !scope.denied
      ? await this.prisma.studentParent.findFirst({
          where: {
            parentProfileId: parentId,
            student: {
              enrollments: {
                some: { section: { class: { campus: scope.campusWhere } } },
              },
            },
          },
          select: { id: true },
        })
      : null;
    if (!inScope) {
      throw new ForbiddenException(
        'Cannot access a parent outside your own school',
      );
    }
  }

  async getProfile(
    id: string,
    actingUser: RequestUser,
  ): Promise<ParentProfileDetail> {
    await this.assertParentInScope(id, actingUser);
    const p = await this.prisma.parentProfile.findUniqueOrThrow({
      where: { id },
      include: PROFILE_INCLUDE,
    });
    return {
      id: p.id,
      identifier: p.user.identifier,
      name: p.name,
      phone: p.phone,
      childrenCount: p.children.length,
      cnic: p.cnic,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth?.toISOString().slice(0, 10) ?? null,
      alternatePhone: p.alternatePhone,
      whatsappNumber: p.whatsappNumber,
      email: p.email,
      occupation: p.occupation,
      employerName: p.employerName,
      designation: p.designation,
      currentAddress: toAddress(p.currentAddress),
      permanentAddress: toAddress(p.permanentAddress),
      children: p.children.map((link) => {
        const section = link.student.enrollments[0]?.section;
        return {
          studentId: link.student.id,
          studentName: link.student.name,
          grNumber: link.student.grNumber,
          className: section?.class.name ?? null,
          sectionName: section?.name ?? null,
          relationship: link.relationship,
          isPrimary: link.isPrimary,
          isEmergencyContact: link.isEmergencyContact,
        };
      }),
    };
  }

  /**
   * Guardian flags for one child. Marking a guardian primary demotes any other primary guardian of
   * the same student, so a child never has two primaries.
   */
  async updateChildLink(
    parentId: string,
    studentId: string,
    dto: UpdateParentChildLinkDto,
    actingUser: RequestUser,
  ): Promise<ParentProfileDetail> {
    await this.assertParentInScope(parentId, actingUser);
    const link = await this.prisma.studentParent.findUnique({
      where: {
        studentId_parentProfileId: { studentId, parentProfileId: parentId },
      },
    });
    if (!link) {
      throw new NotFoundException('This parent is not linked to that student');
    }
    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary === true) {
        await tx.studentParent.updateMany({
          where: { studentId, NOT: { parentProfileId: parentId } },
          data: { isPrimary: false },
        });
      }
      await tx.studentParent.update({
        where: { id: link.id },
        data: {
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          ...(dto.isEmergencyContact !== undefined
            ? { isEmergencyContact: dto.isEmergencyContact }
            : {}),
          ...(dto.relationship !== undefined
            ? { relationship: dto.relationship }
            : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          userId: actingUser.id,
          action: 'parent.link.update',
          entity: 'StudentParent',
          entityId: link.id,
          metadata: JSON.stringify(dto),
        },
      });
    });
    return this.getProfile(parentId, actingUser);
  }

  private addressWrite(
    address: AddressDto | undefined,
    existingId: string | null | undefined,
  ) {
    if (!address) return undefined;
    return existingId ? { update: address } : { create: address };
  }

  async update(
    id: string,
    dto: UpdateParentDto,
    actingUserId: string,
  ): Promise<ParentSummary> {
    const existing = await this.prisma.parentProfile.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Parent not found');
    }
    if (dto.password !== undefined) {
      const passwordHash = await argon2.hash(dto.password);
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { passwordHash },
      });
    }
    const blankToNull = (v: string | undefined) =>
      v === undefined ? undefined : v.trim() || null;
    let record;
    try {
      record = await this.prisma.parentProfile.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          cnic: blankToNull(dto.cnic),
          gender: dto.gender,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          alternatePhone: blankToNull(dto.alternatePhone),
          whatsappNumber: blankToNull(dto.whatsappNumber),
          email: blankToNull(dto.email),
          occupation: blankToNull(dto.occupation),
          employerName: blankToNull(dto.employerName),
          designation: blankToNull(dto.designation),
          currentAddress: this.addressWrite(
            dto.currentAddress,
            existing.currentAddressId,
          ),
          permanentAddress: this.addressWrite(
            dto.permanentAddress,
            existing.permanentAddressId,
          ),
        },
        include: WITH_USER_AND_COUNT,
      });
    } catch (error) {
      assertCreatable(error, 'This CNIC is already in use.');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'parent.update',
        entity: 'ParentProfile',
        entityId: id,
        metadata: JSON.stringify({
          fields: Object.keys(dto).filter((k) => k !== 'password'),
          passwordChanged: dto.password !== undefined,
        }),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.parentProfile.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Parent not found');
    }
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.parentProfile.delete({ where: { id } });
        await tx.user.delete({ where: { id: existing.userId } });
      });
    } catch (error) {
      assertDeletable(error, 'Parent');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'parent.delete',
        entity: 'ParentProfile',
        entityId: id,
      },
    });
  }
}
