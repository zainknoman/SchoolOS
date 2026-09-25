import { Injectable } from '@nestjs/common';
import type { Prisma, TeachingRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import { UNPAGED_CAP } from '../common/pagination';

export interface TeachingAssignmentQuery {
  teacherId?: string;
  academicSessionId?: string;
  classId?: string;
  sectionId?: string;
  subjectId?: string;
  role?: TeachingRole;
  /** true: only assignments that are still open */
  current?: boolean;
}

export interface TeachingAssignmentRow {
  id: string;
  role: TeachingRole;
  teacherId: string | null;
  teacherName: string;
  academicSessionId: string | null;
  sessionLabel: string;
  classId: string | null;
  className: string;
  sectionId: string | null;
  sectionName: string;
  subjectId: string | null;
  subjectName: string | null;
  startDate: Date;
  startDateUnknown: boolean;
  endDate: Date | null;
}

/**
 * BL-25 (Q15): read side of the teaching-assignment history. The rows themselves are written by
 * database triggers (migration M8), never by application code — so this service only reads, within
 * the caller's school/campus.
 */
@Injectable()
export class TeachingAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  async list(
    actor: RequestUser,
    query: TeachingAssignmentQuery,
  ): Promise<TeachingAssignmentRow[]> {
    const scope = await this.orgScope.resolve(actor);
    if (scope.denied) return [];
    const where: Prisma.TeachingAssignmentWhereInput = {
      ...(scope.unrestricted
        ? {}
        : {
            schoolId: scope.schoolId!,
            ...(scope.campusId ? { campusId: scope.campusId } : {}),
          }),
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.academicSessionId
        ? { academicSessionId: query.academicSessionId }
        : {}),
      ...(query.classId ? { classId: query.classId } : {}),
      ...(query.sectionId ? { sectionId: query.sectionId } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      ...(query.role ? { role: query.role } : {}),
      ...(query.current ? { endDate: null } : {}),
    };
    return this.prisma.teachingAssignment.findMany({
      where,
      orderBy: [{ startDate: 'desc' }, { className: 'asc' }, { id: 'asc' }],
      take: UNPAGED_CAP,
      select: {
        id: true,
        role: true,
        teacherId: true,
        teacherName: true,
        academicSessionId: true,
        sessionLabel: true,
        classId: true,
        className: true,
        sectionId: true,
        sectionName: true,
        subjectId: true,
        subjectName: true,
        startDate: true,
        startDateUnknown: true,
        endDate: true,
      },
    });
  }
}
