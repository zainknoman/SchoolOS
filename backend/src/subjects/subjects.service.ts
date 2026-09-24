import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';

export interface SubjectSummary {
  id: string;
  name: string;
  schoolId: string | null;
  isActive: boolean;
}

/**
 * Subject management (BL-02, Q2): subjects are per school and reusable across its campuses and
 * classes. SUPER_ADMIN and a school-wide SCHOOL_ADMIN manage their school's subjects; teachers
 * and accounts staff read them. A subject in use is deactivated, never deleted, so marks and
 * timetables keep their history.
 */
@Injectable()
export class SubjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private toSummary(s: {
    id: string;
    name: string;
    schoolId: string | null;
    isActive: boolean;
  }): SubjectSummary {
    return {
      id: s.id,
      name: s.name,
      schoolId: s.schoolId,
      isActive: s.isActive,
    };
  }

  /** The caller's school's subjects (+ legacy school-less ones until M4 is backfilled). */
  async listAll(
    actor: RequestUser,
    options: { schoolId?: string; includeInactive?: boolean } = {},
  ): Promise<SubjectSummary[]> {
    const scope = await this.orgScope.resolve(actor);
    if (scope.denied) return [];
    const where: Prisma.SubjectWhereInput = {
      ...(options.includeInactive ? {} : { isActive: true }),
      ...(scope.unrestricted
        ? options.schoolId
          ? { schoolId: options.schoolId }
          : {}
        : { OR: [{ schoolId: scope.schoolId }, { schoolId: null }] }),
    };
    const subjects = await this.prisma.subject.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return subjects.map((s) => this.toSummary(s));
  }

  async create(
    dto: { name: string; schoolId?: string },
    actor: RequestUser,
  ): Promise<SubjectSummary> {
    const schoolId = await this.managedSchool(actor, dto.schoolId);
    const name = dto.name.trim();
    try {
      const created = await this.prisma.subject.create({
        data: { name, schoolId },
      });
      await this.audit(actor, 'subject.create', created.id, { name, schoolId });
      return this.toSummary(created);
    } catch (err) {
      throw this.translateUnique(err);
    }
  }

  async update(
    id: string,
    dto: { name?: string; isActive?: boolean },
    actor: RequestUser,
  ): Promise<SubjectSummary> {
    const existing = await this.getManaged(id, actor);
    try {
      const updated = await this.prisma.subject.update({
        where: { id: existing.id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
      await this.audit(actor, 'subject.update', id, dto);
      return this.toSummary(updated);
    } catch (err) {
      throw this.translateUnique(err);
    }
  }

  /** Deletes an unused subject; a used one must be deactivated instead (history stays intact). */
  async delete(id: string, actor: RequestUser): Promise<void> {
    await this.getManaged(id, actor);
    const [timetables, assessments, diary] = await Promise.all([
      this.prisma.timetable.count({ where: { subjectId: id } }),
      this.prisma.assessment.count({ where: { subjectId: id } }),
      this.prisma.diaryEntry.count({ where: { subjectId: id } }),
    ]);
    if (timetables + assessments + diary > 0) {
      throw new BadRequestException(
        'This subject is in use (timetable, assessments or diary) — deactivate it instead.',
      );
    }
    await this.prisma.subject.delete({ where: { id } });
    await this.audit(actor, 'subject.delete', id, {});
  }

  /** The school a caller may manage subjects for. */
  private async managedSchool(
    actor: RequestUser,
    requestedSchoolId?: string,
  ): Promise<string> {
    const scope = await this.orgScope.resolve(actor);
    if (scope.unrestricted) {
      if (!requestedSchoolId) {
        throw new BadRequestException('schoolId is required');
      }
      const school = await this.prisma.school.findUnique({
        where: { id: requestedSchoolId },
        select: { id: true },
      });
      if (!school) throw new BadRequestException('School not found');
      return school.id;
    }
    if (scope.denied || scope.campusId !== null || !scope.schoolId) {
      throw new ForbiddenException(
        'Only a school-wide administrator can manage subjects',
      );
    }
    if (requestedSchoolId && requestedSchoolId !== scope.schoolId) {
      throw new ForbiddenException(
        'You can only manage your own school’s subjects',
      );
    }
    return scope.schoolId;
  }

  private async getManaged(id: string, actor: RequestUser) {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');
    const scope = await this.orgScope.resolve(actor);
    if (scope.unrestricted) return subject;
    if (
      scope.denied ||
      scope.campusId !== null ||
      !subject.schoolId ||
      subject.schoolId !== scope.schoolId
    ) {
      throw new ForbiddenException('You cannot manage this subject');
    }
    return subject;
  }

  private translateUnique(err: unknown): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return new ConflictException(
        'A subject with this name already exists in this school',
      );
    }
    return err;
  }

  private async audit(
    actor: RequestUser,
    action: string,
    entityId: string,
    metadata: object,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId: actor.id,
        action,
        entity: 'Subject',
        entityId,
        metadata: JSON.stringify(metadata),
      },
    });
  }
}
