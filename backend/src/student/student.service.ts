import { activeSessionForSchool } from '../academic-session/active-session';
import {
  PagedResult,
  pageArgs,
  toPageRequest,
  type PageRequest,
} from '../common/pagination';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertCreatable } from '../common/prisma-create-guard';
import { createStudentWithEnrollment } from './create-student-with-enrollment';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import type { RequestUser } from '../common/student-access.service';

export interface StudentAdminSummary {
  id: string;
  grNumber: string;
  name: string;
  sectionName: string | null;
  className: string | null;
  campusName: string | null;
  parentNames: string[];
}

const WITH_SECTION_AND_PARENTS = {
  enrollments: {
    where: { status: 'ACTIVE' as const },
    orderBy: { startDate: 'desc' as const },
    take: 1,
    include: { section: { include: { class: { include: { campus: true } } } } },
  },
  parents: { include: { parentProfile: { select: { name: true } } } },
};

@Injectable()
export class StudentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(record: {
    id: string;
    grNumber: string;
    name: string;
    enrollments: Array<{
      section: {
        name: string;
        class: { name: string; campus: { name: string } };
      };
    }>;
    parents: Array<{ parentProfile: { name: string } }>;
  }): StudentAdminSummary {
    const enrollment = record.enrollments[0];
    return {
      id: record.id,
      grNumber: record.grNumber,
      name: record.name,
      sectionName: enrollment?.section.name ?? null,
      className: enrollment?.section.class.name ?? null,
      campusName: enrollment?.section.class.campus.name ?? null,
      parentNames: record.parents.map((p) => p.parentProfile.name),
    };
  }

  async create(
    dto: CreateStudentDto,
    actingUserId: string,
  ): Promise<StudentAdminSummary> {
    // `!= null` (not `!== undefined`) so an explicit `null` is treated the same as an omitted
    // field — otherwise `{ parentProfileId: null, newParent: null }` (or a null/omitted mix)
    // slips past this guard and blows up downstream instead of getting a clean 400 here.
    const hasExisting = dto.parentProfileId != null;
    const hasNew = dto.newParent != null;
    if (hasExisting === hasNew) {
      // Both true (both given) or both false (neither given) are the two invalid states.
      throw new BadRequestException(
        'Provide exactly one of parentProfileId or newParent',
      );
    }

    const section = await this.prisma.section.findUnique({
      where: { id: dto.sectionId },
      select: {
        id: true,
        class: {
          select: { campusId: true, campus: { select: { schoolId: true } } },
        },
      },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }
    // BL-01: the active session of the section's own school.
    const activeSession = await activeSessionForSchool(
      this.prisma,
      section.class.campus.schoolId,
    );
    if (!activeSession) {
      throw new BadRequestException(
        "No active academic session for this student's school — cannot enroll a student",
      );
    }

    let studentId: string;
    try {
      ({ studentId } = await this.prisma.$transaction((tx) =>
        createStudentWithEnrollment(
          tx,
          {
            grNumber: dto.grNumber,
            name: dto.name,
            sectionId: section.id,
            campusId: section.class.campusId,
            academicSessionId: activeSession.id,
            parentProfileId: dto.parentProfileId,
            newParent: dto.newParent,
          },
          actingUserId,
        ),
      ));
    } catch (error) {
      assertCreatable(
        error,
        'This GR number or parent identifier is already in use.',
      );
    }

    const created = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: WITH_SECTION_AND_PARENTS,
    });
    return this.toSummary(created);
  }

  // Scoped like CampusService.list(): SUPER_ADMIN sees every student, SCHOOL_ADMIN/ACCOUNTS see
  // only students with an enrollment in their own school. Filters on ANY enrollment (not just the
  // active one used for display) so a withdrawn/graduated student stays visible to the school that
  // actually enrolled them, instead of disappearing from the roster once they leave.
  /** Paged/searchable (BL-40): `q` matches name or GR number. */
  async list(
    actingUser: RequestUser,
    page: PageRequest = toPageRequest(),
  ): Promise<PagedResult<StudentAdminSummary>> {
    let where: Prisma.StudentWhereInput | undefined;
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return PagedResult.of([], 0, page);
    }
    if (scope.campusWhere) {
      where = {
        enrollments: {
          some: { section: { class: { campus: scope.campusWhere } } },
        },
      };
    }
    // Only wrap when searching, so an unfiltered query is exactly the scope query.
    const filtered: Prisma.StudentWhereInput | undefined = page.q
      ? {
          AND: [
            where ?? {},
            {
              OR: [
                { name: { contains: page.q, mode: 'insensitive' as const } },
                {
                  grNumber: { contains: page.q, mode: 'insensitive' as const },
                },
              ],
            },
          ],
        }
      : where;
    const [records, total] = await Promise.all([
      this.prisma.student.findMany({
        where: filtered,
        include: WITH_SECTION_AND_PARENTS,
        orderBy: page.paged
          ? [{ name: 'asc' }, { id: 'asc' }]
          : { name: 'asc' },
        ...pageArgs(page),
      }),
      this.prisma.student.count({ where: filtered }),
    ]);
    return PagedResult.of(
      records.map((r) => this.toSummary(r)),
      total,
      page,
    );
  }

  async update(
    id: string,
    dto: UpdateStudentDto,
    actingUserId: string,
  ): Promise<StudentAdminSummary> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }
    const record = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.grNumber !== undefined ? { grNumber: dto.grNumber } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
      include: WITH_SECTION_AND_PARENTS,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.update',
        entity: 'Student',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }
    try {
      await this.prisma.student.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Student');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.delete',
        entity: 'Student',
        entityId: id,
      },
    });
  }
}
