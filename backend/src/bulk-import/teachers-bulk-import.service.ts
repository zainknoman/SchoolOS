// backend/src/bulk-import/teachers-bulk-import.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import { createTeacherWithUser } from '../teacher/create-teacher-with-user';
import { parseCsv } from './csv';
import type { RowOutcome, PreviewResult } from './students-bulk-import.service';

const MAX_ROWS = 2000;

@Injectable()
export class TeachersBulkImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
  ) {}

  private async validateRows(
    buffer: Buffer,
    actingUser: RequestUser,
  ): Promise<RowOutcome[]> {
    const parsed = parseCsv(buffer, MAX_ROWS);
    // Only campuses inside the importer's own school/campus are accepted.
    const scope = await this.orgScope.resolve(actingUser);
    const seenIdentifiers = new Set<string>();
    const outcomes: RowOutcome[] = [];

    for (const { line, row } of parsed) {
      const errors: string[] = [];
      const identifier = row.identifier?.trim();
      const name = row.name?.trim();
      const campusId = row.campusId?.trim();

      if (!identifier) errors.push('identifier is required');
      if (!name) errors.push('name is required');
      if (!campusId) errors.push('campusId is required');

      if (identifier) {
        if (seenIdentifiers.has(identifier)) {
          errors.push(`Duplicate identifier "${identifier}" within this file`);
        }
        seenIdentifiers.add(identifier);
        const existing = await this.prisma.user.findUnique({
          where: { identifier },
        });
        if (existing)
          errors.push(`Identifier "${identifier}" is already in use`);
      }
      if (campusId) {
        const campus = await this.prisma.campus.findUnique({
          where: { id: campusId },
        });
        if (!campus) errors.push(`Campus "${campusId}" not found`);
        else if (!scope.allows({ campusId, schoolId: campus.schoolId })) {
          errors.push(
            `Campus "${campusId}" belongs to another school or campus`,
          );
        }
      }

      outcomes.push({
        line,
        data: { identifier, name, campusId },
        errors,
      });
    }
    return outcomes;
  }

  async preview(
    buffer: Buffer,
    actingUser: RequestUser,
  ): Promise<PreviewResult> {
    const rows = await this.validateRows(buffer, actingUser);
    return {
      rows,
      validCount: rows.filter((r) => r.errors.length === 0).length,
      errorCount: rows.filter((r) => r.errors.length > 0).length,
    };
  }

  async commit(
    buffer: Buffer,
    actingUser: RequestUser,
  ): Promise<{ createdCount: number; teacherIds: string[] }> {
    const actingUserId = actingUser.id;
    const rows = await this.validateRows(buffer, actingUser);
    const invalid = rows.filter((r) => r.errors.length > 0);
    if (invalid.length > 0) {
      throw Object.assign(
        new Error('One or more rows are invalid; nothing was imported.'),
        { rows: invalid },
      );
    }

    const teacherIds = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const { data } of rows) {
        const teacher = await createTeacherWithUser(tx, {
          identifier: data.identifier,
          password: randomBytes(24).toString('base64url'),
          name: data.name,
          campusId: data.campusId,
        });
        ids.push(teacher.id);
      }
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'bulk-import.teachers',
          entity: 'Teacher',
          metadata: JSON.stringify({ count: ids.length, teacherIds: ids }),
        },
      });
      return ids;
    });

    return { createdCount: teacherIds.length, teacherIds };
  }
}
