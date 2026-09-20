import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { OrgScopeService } from './org-scope.service';

export interface RequestUser {
  id: string;
  role: string;
}

interface AccessScope {
  campusId: string;
  schoolId: string;
  // Sections this resource belongs to. For TEACHER, access additionally requires the teacher to
  // be assigned (via Timetable or as classTeacher) to at least one of these — campus match alone
  // is not enough, since a campus can have many classes a given teacher doesn't teach.
  sectionIds: string[];
}

/**
 * The one place that decides "can this caller see/act on this student's records" — shared by
 * Timetable, Attendance, Diary, Circulars, Fees, and every later module so the tenant/campus
 * isolation rule is enforced identically everywhere, not re-implemented per module.
 */
@Injectable()
export class StudentAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
    private readonly orgScope: OrgScopeService,
  ) {}

  async assertCanAccessStudent(
    user: RequestUser,
    studentId: string,
  ): Promise<void> {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return;
      case 'SCHOOL_ADMIN':
      case 'ACCOUNTS':
      case 'TEACHER': {
        const scope = await this.resolveStudentScope(studentId);
        await this.assertCanAccessScope(user, scope);
        return;
      }
      default: {
        // PARENT (or any other unrecognized role): must have a StudentParent link —
        // independent of the student's current enrollment status, so a parent keeps access to
        // a withdrawn/graduated child's historical records, matching the pre-Sprint-L behavior.
        const link = await this.prisma.studentParent.findFirst({
          where: { studentId, parentProfile: { userId: user.id } },
        });
        if (!link) {
          throw new ForbiddenException(
            'You do not have access to this student',
          );
        }
      }
    }
  }

  async assertCanAccessSection(
    user: RequestUser,
    sectionId: string,
  ): Promise<void> {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return;
      case 'SCHOOL_ADMIN':
      case 'ACCOUNTS':
      case 'TEACHER': {
        const scope = await this.resolveSectionScope(sectionId);
        await this.assertCanAccessScope(user, scope);
        return;
      }
      default:
        // No PARENT-accessible caller reaches this method; any other role is denied outright.
        throw new ForbiddenException('You do not have access to this resource');
    }
  }

  async assertCanAccessClass(
    user: RequestUser,
    classId: string,
  ): Promise<void> {
    switch (user.role) {
      case 'SUPER_ADMIN':
        return;
      case 'SCHOOL_ADMIN':
      case 'ACCOUNTS':
      case 'TEACHER': {
        const scope = await this.resolveClassScope(classId);
        await this.assertCanAccessScope(user, scope);
        return;
      }
      default:
        throw new ForbiddenException('You do not have access to this resource');
    }
  }

  private async assertCanAccessScope(
    user: RequestUser,
    scope: AccessScope | null,
  ): Promise<void> {
    if (!scope) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    switch (user.role) {
      case 'SCHOOL_ADMIN':
      case 'ACCOUNTS': {
        const orgScope = await this.orgScope.resolve(user);
        if (
          !orgScope.allows({
            campusId: scope.campusId,
            schoolId: scope.schoolId,
          })
        ) {
          throw new ForbiddenException(
            'You do not have access to this resource',
          );
        }
        return;
      }
      case 'TEACHER': {
        const teacher = await this.prisma.teacher.findUnique({
          where: { userId: user.id },
        });
        if (!teacher || teacher.campusId !== scope.campusId) {
          throw new ForbiddenException(
            'You do not have access to this resource',
          );
        }
        const assignedSectionIds = await this.getTeacherSectionIds(teacher.id);
        const isAssigned = scope.sectionIds.some((id) =>
          assignedSectionIds.has(id),
        );
        if (!isAssigned) {
          throw new ForbiddenException(
            'You do not have access to this resource',
          );
        }
        return;
      }
      default:
        // Unreachable in practice — this is only ever called for SCHOOL_ADMIN/ACCOUNTS/TEACHER
        // (see the switches above) — but fail closed rather than silently allow if that
        // invariant is ever broken.
        throw new ForbiddenException('You do not have access to this resource');
    }
  }

  private async resolveStudentScope(
    studentId: string,
  ): Promise<AccessScope | null> {
    let enrollment: Awaited<
      ReturnType<EnrollmentService['getCurrentEnrollment']>
    >;
    try {
      enrollment = await this.enrollmentService.getCurrentEnrollment(studentId);
    } catch {
      return null;
    }
    const campus = await this.prisma.campus.findUniqueOrThrow({
      where: { id: enrollment.campusId },
      select: { schoolId: true },
    });
    return {
      campusId: enrollment.campusId,
      schoolId: campus.schoolId,
      sectionIds: [enrollment.sectionId],
    };
  }

  private async resolveSectionScope(
    sectionId: string,
  ): Promise<AccessScope | null> {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: {
        class: { include: { campus: { select: { schoolId: true } } } },
      },
    });
    return section
      ? {
          campusId: section.class.campusId,
          schoolId: section.class.campus.schoolId,
          sectionIds: [sectionId],
        }
      : null;
  }

  private async resolveClassScope(
    classId: string,
  ): Promise<AccessScope | null> {
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
      include: {
        campus: { select: { schoolId: true } },
        sections: { select: { id: true } },
      },
    });
    return klass
      ? {
          campusId: klass.campusId,
          schoolId: klass.campus.schoolId,
          sectionIds: klass.sections.map((s) => s.id),
        }
      : null;
  }

  /**
   * Sections a teacher is assigned to: taught via the timetable, or homeroom ("class teacher")
   * of — the same union used to decide list-endpoint visibility (SectionsService, ClassService)
   * so a teacher never sees more in a picker than she'd be allowed to actually open.
   */
  async getTeacherSectionIds(teacherId: string): Promise<Set<string>> {
    const [timetableRows, homeroomSections] = await Promise.all([
      this.prisma.timetable.findMany({
        where: { teacherId },
        select: { sectionId: true },
      }),
      this.prisma.section.findMany({
        where: { classTeacherId: teacherId },
        select: { id: true },
      }),
    ]);
    return new Set([
      ...timetableRows.map((r) => r.sectionId),
      ...homeroomSections.map((s) => s.id),
    ]);
  }
}
