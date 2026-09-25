import {
  PagedResult,
  pageArgs,
  toPageRequest,
  type PageRequest,
} from '../common/pagination';
import {
  BadRequestException,
  ConflictException,
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
import { LinkParentChildDto } from './dto/link-parent-child.dto';
import { LookupParentDto } from './dto/lookup-parent.dto';
import { freePrimarySlot, legacyLinkFields } from './guardian-links';
import { normalizeIdentifier } from '../common/normalize-identifier';
import { rethrowUniqueAsConflict } from '../common/prisma-create-guard';
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
    /** BL-04: typed relationship, free text for OTHER, primary slot (1|2|null). */
    relationshipType: string;
    relationshipNote: string | null;
    primarySlot: number | null;
    isPrimary: boolean;
    isEmergencyContact: boolean;
    schoolName: string | null;
  }>;
}

/** BL-23: what another school learns when it looks a guardian up — no children, no contact data. */
export interface ParentLookupResult {
  id: string;
  identifier: string;
  name: string;
}

/** BL-23: a group of guardian profiles sharing one deterministic key (never a name). */
export interface DuplicateGuardianGroup {
  key: 'cnic' | 'identifier' | 'phone' | 'email';
  parentIds: string[];
}

const profileInclude = (childWhere?: Prisma.StudentParentWhereInput) => ({
  user: { select: { identifier: true } },
  currentAddress: true,
  permanentAddress: true,
  children: {
    // BL-23: a school admin sees only the links to children of their own school/campus.
    ...(childWhere ? { where: childWhere } : {}),
    include: {
      student: {
        select: {
          id: true,
          name: true,
          grNumber: true,
          enrollments: {
            where: { status: 'ACTIVE' as const },
            orderBy: { startDate: 'desc' as const },
            take: 1,
            select: {
              section: {
                select: { name: true, class: { select: { name: true } } },
              },
              campus: { select: { school: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'asc' as const },
  },
});

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
    // BL-23: the children count covers only the caller's own school/campus.
    const childWhere = scope.campusWhere
      ? this.linkInScope(scope.campusWhere)
      : undefined;
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
        include: {
          user: { select: { identifier: true } },
          _count: {
            select: { children: childWhere ? { where: childWhere } : true },
          },
        },
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
    const childWhere = await this.childWhereFor(actingUser);
    const p = await this.prisma.parentProfile.findUniqueOrThrow({
      where: { id },
      include: profileInclude(childWhere),
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
          relationshipType: link.relationshipType,
          relationshipNote: link.relationshipNote,
          primarySlot: link.primarySlot,
          isPrimary: link.primarySlot !== null,
          isEmergencyContact: link.isEmergencyContact,
          schoolName: link.student.enrollments[0]?.campus.school.name ?? null,
        };
      }),
    };
  }

  /** A guardian link whose student has an enrolment inside `campusWhere` (BL-23). */
  private linkInScope(
    campusWhere: Prisma.CampusWhereInput,
  ): Prisma.StudentParentWhereInput {
    return {
      student: {
        enrollments: { some: { section: { class: { campus: campusWhere } } } },
      },
    };
  }

  /** undefined = every link (SUPER_ADMIN); otherwise the caller's school/campus only. */
  private async childWhereFor(
    actingUser: RequestUser,
  ): Promise<Prisma.StudentParentWhereInput | undefined> {
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.unrestricted) return undefined;
    if (scope.denied || !scope.campusWhere) {
      throw new ForbiddenException('No school is linked to this account');
    }
    return this.linkInScope(scope.campusWhere);
  }

  /** The student must be actively enrolled inside the caller's scope (BL-23). */
  private async assertStudentInScope(
    studentId: string,
    actingUser: RequestUser,
  ): Promise<void> {
    const scope = await this.orgScope.resolve(actingUser);
    const student = await this.prisma.student.findUnique({
      where: { id: studentId },
      select: {
        enrollments: {
          where: { status: 'ACTIVE' },
          select: { campusId: true, campus: { select: { schoolId: true } } },
        },
      },
    });
    if (!student) throw new NotFoundException('Student not found');
    if (scope.unrestricted) return;
    const ok = student.enrollments.some((e) =>
      scope.allows({ campusId: e.campusId, schoolId: e.campus.schoolId }),
    );
    if (!ok) {
      throw new ForbiddenException(
        'Cannot manage guardians of a student outside your own school',
      );
    }
  }

  /**
   * BL-23 PII boundary: the guardian's own profile (name, CNIC, contact data, password) and the
   * account itself are changed by a SCHOOL_ADMIN only when EVERY child of that guardian with an
   * active enrolment is inside the admin's school/campus. A guardian shared with another school is
   * edited or deleted only by a SUPER_ADMIN; each school still manages its own links.
   */
  private async assertParentEntirelyInScope(
    parentId: string,
    actingUser: RequestUser,
  ): Promise<void> {
    await this.assertParentInScope(parentId, actingUser);
    if (actingUser.role === 'SUPER_ADMIN') return;
    const scope = await this.orgScope.resolve(actingUser);
    const outside = await this.prisma.studentParent.findFirst({
      where: {
        parentProfileId: parentId,
        student: {
          enrollments: {
            some: {
              status: 'ACTIVE',
              NOT: { section: { class: { campus: scope.campusWhere } } },
            },
          },
        },
      },
      select: { id: true },
    });
    if (outside) {
      throw new ForbiddenException(
        'This guardian also has children in another school or campus; only a super admin can change or delete the guardian profile',
      );
    }
  }

  /**
   * Guardian fields for one child (BL-04). `isPrimary: true` takes a free primary slot — at most
   * two per student, a third is rejected with 409; `false` releases the slot. Only the caller's
   * own students' links can be changed (BL-23).
   */
  async updateChildLink(
    parentId: string,
    studentId: string,
    dto: UpdateParentChildLinkDto,
    actingUser: RequestUser,
  ): Promise<ParentProfileDetail> {
    await this.assertStudentInScope(studentId, actingUser);
    const link = await this.prisma.studentParent.findUnique({
      where: {
        studentId_parentProfileId: { studentId, parentProfileId: parentId },
      },
    });
    if (!link) {
      throw new NotFoundException('This parent is not linked to that student');
    }
    const type = dto.relationshipType ?? link.relationshipType;
    await this.prisma
      .$transaction(async (tx) => {
        let primarySlot = link.primarySlot;
        if (dto.isPrimary === true && primarySlot === null) {
          primarySlot = await freePrimarySlot(tx, studentId, link.id);
        } else if (dto.isPrimary === false) {
          primarySlot = null;
        }
        await tx.studentParent.update({
          where: { id: link.id },
          data: {
            relationshipType: type,
            relationshipNote:
              type === 'OTHER'
                ? dto.relationshipNote !== undefined
                  ? dto.relationshipNote.trim() || null
                  : link.relationshipNote
                : null,
            primarySlot,
            ...legacyLinkFields(type, primarySlot),
            ...(dto.isEmergencyContact !== undefined
              ? { isEmergencyContact: dto.isEmergencyContact }
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
      })
      .catch((error: unknown) =>
        rethrowUniqueAsConflict(
          error,
          'Another primary guardian was set for this student at the same time; reload and try again',
        ),
      );
    return this.getProfile(parentId, actingUser);
  }

  /**
   * BL-23/BL-04: link an existing guardian (found via lookup — possibly already a guardian at
   * another school) to one of the caller's students. The response shows only the caller's own
   * children of that guardian.
   */
  async linkChild(
    parentId: string,
    dto: LinkParentChildDto,
    actingUser: RequestUser,
  ): Promise<ParentProfileDetail> {
    await this.assertStudentInScope(dto.studentId, actingUser);
    const parent = await this.prisma.parentProfile.findUnique({
      where: { id: parentId },
      select: { id: true },
    });
    if (!parent) throw new NotFoundException('Parent not found');
    await this.prisma
      .$transaction(async (tx) => {
        const exists = await tx.studentParent.findUnique({
          where: {
            studentId_parentProfileId: {
              studentId: dto.studentId,
              parentProfileId: parentId,
            },
          },
          select: { id: true },
        });
        if (exists) {
          throw new ConflictException(
            'This guardian is already linked to that student',
          );
        }
        const primarySlot = dto.isPrimary
          ? await freePrimarySlot(tx, dto.studentId)
          : null;
        const created = await tx.studentParent.create({
          data: {
            studentId: dto.studentId,
            parentProfileId: parentId,
            relationshipType: dto.relationshipType,
            relationshipNote:
              dto.relationshipType === 'OTHER'
                ? dto.relationshipNote?.trim() || null
                : null,
            primarySlot,
            isEmergencyContact: dto.isEmergencyContact ?? false,
            ...legacyLinkFields(dto.relationshipType, primarySlot),
          },
        });
        await tx.auditLog.create({
          data: {
            userId: actingUser.id,
            action: 'parent.link.create',
            entity: 'StudentParent',
            entityId: created.id,
            metadata: JSON.stringify({
              parentId,
              studentId: dto.studentId,
              relationshipType: dto.relationshipType,
              primarySlot,
            }),
          },
        });
      })
      .catch((error: unknown) =>
        rethrowUniqueAsConflict(
          error,
          'This link or primary slot was created by someone else at the same time; reload and try again',
        ),
      );
    return this.getProfile(parentId, actingUser);
  }

  /** BL-23: remove a guardian link of one of the caller's students; a student keeps at least one. */
  async unlinkChild(
    parentId: string,
    studentId: string,
    actingUser: RequestUser,
  ): Promise<void> {
    await this.assertStudentInScope(studentId, actingUser);
    const link = await this.prisma.studentParent.findUnique({
      where: {
        studentId_parentProfileId: { studentId, parentProfileId: parentId },
      },
    });
    if (!link) {
      throw new NotFoundException('This parent is not linked to that student');
    }
    const others = await this.prisma.studentParent.count({
      where: { studentId, NOT: { id: link.id } },
    });
    if (others === 0) {
      throw new BadRequestException(
        "This is the student's only guardian; link another guardian first",
      );
    }
    await this.prisma.$transaction([
      this.prisma.studentParent.delete({ where: { id: link.id } }),
      this.prisma.auditLog.create({
        data: {
          userId: actingUser.id,
          action: 'parent.link.delete',
          entity: 'StudentParent',
          entityId: link.id,
          metadata: JSON.stringify({ parentId, studentId }),
        },
      }),
    ]);
  }

  /**
   * BL-23: find a guardian by a deterministic key only (exact login identifier or CNIC, never a
   * name) so a second school links the same person instead of creating a duplicate. Returns the
   * id, identifier and name only — nothing about other schools' children. Audited.
   */
  async lookup(
    dto: LookupParentDto,
    actingUser: RequestUser,
  ): Promise<ParentLookupResult> {
    if (!dto.identifier === !dto.cnic) {
      throw new BadRequestException('Give exactly one of identifier or cnic');
    }
    const found = await this.prisma.parentProfile.findFirst({
      where: dto.identifier
        ? {
            user: {
              identifier: {
                in: [
                  dto.identifier.trim(),
                  normalizeIdentifier(dto.identifier),
                ],
              },
            },
          }
        : { cnic: dto.cnic!.trim() },
      select: { id: true, name: true, user: { select: { identifier: true } } },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'parent.lookup',
        entity: 'ParentProfile',
        entityId: found?.id ?? null,
        metadata: JSON.stringify({
          by: dto.identifier ? 'identifier' : 'cnic',
          found: !!found,
        }),
      },
    });
    if (!found) throw new NotFoundException('No guardian with that key');
    return {
      id: found.id,
      identifier: found.user.identifier,
      name: found.name,
    };
  }

  /**
   * BL-23 dedupe report (SUPER_ADMIN): guardian profiles sharing a deterministic key — CNIC
   * digits, normalised login identifier, phone digits or e-mail. Names are never compared and
   * nothing is merged; any merge is a later, audited admin action.
   */
  async duplicates(actingUser: RequestUser): Promise<DuplicateGuardianGroup[]> {
    const rows = await this.prisma.parentProfile.findMany({
      select: {
        id: true,
        cnic: true,
        phone: true,
        email: true,
        user: { select: { identifier: true } },
      },
    });
    const digits = (v: string | null) => (v ?? '').replace(/\D/g, '');
    const keys: Array<
      [DuplicateGuardianGroup['key'], (r: (typeof rows)[number]) => string]
    > = [
      ['cnic', (r) => digits(r.cnic)],
      ['identifier', (r) => normalizeIdentifier(r.user.identifier)],
      ['phone', (r) => digits(r.phone)],
      ['email', (r) => (r.email ?? '').trim().toLowerCase()],
    ];
    const groups: DuplicateGuardianGroup[] = [];
    for (const [key, of] of keys) {
      const byValue = new Map<string, string[]>();
      for (const r of rows) {
        const v = of(r);
        if (v.length < 5) continue;
        byValue.set(v, [...(byValue.get(v) ?? []), r.id]);
      }
      for (const ids of byValue.values()) {
        if (ids.length > 1) groups.push({ key, parentIds: ids.sort() });
      }
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUser.id,
        action: 'parent.duplicates-report',
        entity: 'ParentProfile',
        metadata: JSON.stringify({ groups: groups.length }),
      },
    });
    return groups;
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
    actingUser: RequestUser,
  ): Promise<ParentSummary> {
    const actingUserId = actingUser.id;
    await this.assertParentEntirelyInScope(id, actingUser);
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

  async delete(id: string, actingUser: RequestUser): Promise<void> {
    const actingUserId = actingUser.id;
    await this.assertParentEntirelyInScope(id, actingUser);
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
