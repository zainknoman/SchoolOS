import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from './org-scope.service';
import type { RequestUser } from './student-access.service';

export type ScopedRecordKind = 'student' | 'staff' | 'teacher';
export const SCOPED_RECORD_KEY = 'scopedRecord';

/**
 * Confines every route of a controller that addresses one record by URL parameter (`:id`,
 * `:studentId`, …) to the caller's school/campus. Routes without that parameter (lists, create)
 * are not affected; a record that does not exist passes through so the service answers 404.
 * Used with `@UseGuards(RecordScopeGuard)`, so it runs after authentication and `@Roles`.
 */
export const ScopedRecord = (kind: ScopedRecordKind, param: string) =>
  SetMetadata(SCOPED_RECORD_KEY, { kind, param });

type Place = { campusId: string; schoolId: string };

@Injectable()
export class RecordScopeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<
      { kind: ScopedRecordKind; param: string } | undefined
    >(SCOPED_RECORD_KEY, [context.getHandler(), context.getClass()]);
    if (!meta) return true;
    const req = context
      .switchToHttp()
      .getRequest<{ params?: Record<string, string>; user?: RequestUser }>();
    const id = req.params?.[meta.param];
    if (!id || !req.user) return true;

    const scope = await this.orgScope.resolve(req.user);
    if (scope.unrestricted) return true;

    const places = await this.placesOf(meta.kind, id);
    if (places === null) return true; // not found: let the service say 404
    if (!scope.denied && places.some((p) => scope.allows(p))) return true;
    throw new ForbiddenException(
      `This ${meta.kind} is not in your school or campus`,
    );
  }

  /** Where the record lives; a student lives wherever any of its enrolments is (history included). */
  private async placesOf(
    kind: ScopedRecordKind,
    id: string,
  ): Promise<Place[] | null> {
    if (kind === 'student') {
      const s = await this.prisma.student.findUnique({
        where: { id },
        select: {
          enrollments: {
            select: { campusId: true, campus: { select: { schoolId: true } } },
          },
        },
      });
      return s
        ? s.enrollments.map((e) => ({
            campusId: e.campusId,
            schoolId: e.campus.schoolId,
          }))
        : null;
    }
    const row =
      kind === 'staff'
        ? await this.prisma.staff.findUnique({
            where: { id },
            select: { campusId: true, campus: { select: { schoolId: true } } },
          })
        : await this.prisma.teacher.findUnique({
            where: { id },
            select: { campusId: true, campus: { select: { schoolId: true } } },
          });
    return row
      ? [{ campusId: row.campusId, schoolId: row.campus.schoolId }]
      : null;
  }
}
