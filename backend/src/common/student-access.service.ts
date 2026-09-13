import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

export interface RequestUser {
  id: string;
  role: string;
}

interface AccessScope {
  campusId: string;
  schoolId: string;
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
  ) {}

  async assertCanAccessStudent(user: RequestUser, studentId: string): Promise<void> {
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
          throw new ForbiddenException('You do not have access to this student');
        }
      }
    }
  }

  async assertCanAccessSection(user: RequestUser, sectionId: string): Promise<void> {
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

  async assertCanAccessClass(user: RequestUser, classId: string): Promise<void> {
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

  private async assertCanAccessScope(user: RequestUser, scope: AccessScope | null): Promise<void> {
    if (!scope) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    switch (user.role) {
      case 'SCHOOL_ADMIN':
      case 'ACCOUNTS': {
        const admin = await this.prisma.user.findUnique({ where: { id: user.id } });
        if (!admin?.schoolId || admin.schoolId !== scope.schoolId) {
          throw new ForbiddenException('You do not have access to this resource');
        }
        return;
      }
      case 'TEACHER': {
        const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
        if (!teacher || teacher.campusId !== scope.campusId) {
          throw new ForbiddenException('You do not have access to this resource');
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

  private async resolveStudentScope(studentId: string): Promise<AccessScope | null> {
    let enrollment;
    try {
      enrollment = await this.enrollmentService.getCurrentEnrollment(studentId);
    } catch {
      return null;
    }
    const campus = await this.prisma.campus.findUniqueOrThrow({
      where: { id: enrollment.campusId },
      select: { schoolId: true },
    });
    return { campusId: enrollment.campusId, schoolId: campus.schoolId };
  }

  private async resolveSectionScope(sectionId: string): Promise<AccessScope | null> {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { class: { include: { campus: { select: { schoolId: true } } } } },
    });
    return section
      ? { campusId: section.class.campusId, schoolId: section.class.campus.schoolId }
      : null;
  }

  private async resolveClassScope(classId: string): Promise<AccessScope | null> {
    const klass = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { campus: { select: { schoolId: true } } },
    });
    return klass ? { campusId: klass.campusId, schoolId: klass.campus.schoolId } : null;
  }
}
