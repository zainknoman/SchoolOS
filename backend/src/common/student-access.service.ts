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
  studentId?: string;
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
    if (user.role === 'SUPER_ADMIN') {
      return;
    }
    const scope = await this.resolveStudentScope(studentId);
    await this.assertCanAccessScope(user, scope);
  }

  async assertCanAccessSection(user: RequestUser, sectionId: string): Promise<void> {
    if (user.role === 'SUPER_ADMIN') {
      return;
    }
    const scope = await this.resolveSectionScope(sectionId);
    await this.assertCanAccessScope(user, scope);
  }

  private async assertCanAccessScope(user: RequestUser, scope: AccessScope | null): Promise<void> {
    if (!scope) {
      throw new ForbiddenException('You do not have access to this resource');
    }
    if (user.role === 'SCHOOL_ADMIN' || user.role === 'ACCOUNTS') {
      const admin = await this.prisma.user.findUnique({ where: { id: user.id } });
      if (!admin?.schoolId || admin.schoolId !== scope.schoolId) {
        throw new ForbiddenException('You do not have access to this resource');
      }
      return;
    }
    if (user.role === 'TEACHER') {
      const teacher = await this.prisma.teacher.findUnique({ where: { userId: user.id } });
      if (!teacher || teacher.campusId !== scope.campusId) {
        throw new ForbiddenException('You do not have access to this resource');
      }
      return;
    }
    // PARENT (or any other role): must have a StudentParent link, never a broader query the
    // caller could widen. Only reachable via assertCanAccessStudent — assertCanAccessSection has
    // no PARENT-accessible caller, so scope.studentId is always set on this branch.
    const link = await this.prisma.studentParent.findFirst({
      where: { studentId: scope.studentId, parentProfile: { userId: user.id } },
    });
    if (!link) {
      throw new ForbiddenException('You do not have access to this student');
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
    return { campusId: enrollment.campusId, schoolId: campus.schoolId, studentId };
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
}
