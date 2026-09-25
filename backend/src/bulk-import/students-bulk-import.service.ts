import { activeSessionForSchool } from '../academic-session/active-session';
// backend/src/bulk-import/students-bulk-import.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { createStudentWithEnrollment } from '../student/create-student-with-enrollment';
import { parseCsv } from './csv';
import {
  GUARDIAN_RELATIONSHIPS,
  type GuardianRelationshipName,
} from '../parent/guardian-links';

const MAX_ROWS = 2000;

export interface RowOutcome {
  line: number;
  data: Record<string, string>;
  errors: string[];
}

export interface PreviewResult {
  rows: RowOutcome[];
  validCount: number;
  errorCount: number;
}

@Injectable()
export class StudentsBulkImportService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateRows(buffer: Buffer): Promise<RowOutcome[]> {
    const parsed = parseCsv(buffer, MAX_ROWS);
    const seenGrNumbers = new Set<string>();
    const outcomes: RowOutcome[] = [];

    for (const { line, row } of parsed) {
      const errors: string[] = [];
      const grNumber = row.grNumber?.trim();
      const name = row.name?.trim();
      const sectionId = row.sectionId?.trim();
      const parentIdentifier = row.parentIdentifier?.trim() || undefined;
      const newParentIdentifier = row.newParentIdentifier?.trim() || undefined;
      const newParentName = row.newParentName?.trim() || undefined;
      const newParentPhone = row.newParentPhone?.trim() || undefined;
      // BL-04: the guardian's relationship is required (FATHER/MOTHER/GUARDIAN/OTHER, any case).
      const relationshipType = row.relationshipType?.trim().toUpperCase() || '';

      if (!grNumber) errors.push('grNumber is required');
      if (!name) errors.push('name is required');
      if (!sectionId) errors.push('sectionId is required');
      if (
        !(GUARDIAN_RELATIONSHIPS as readonly string[]).includes(
          relationshipType,
        )
      ) {
        errors.push(
          `relationshipType must be one of ${GUARDIAN_RELATIONSHIPS.join(', ')}`,
        );
      }

      const hasExisting = !!parentIdentifier;
      const hasNew = !!newParentIdentifier || !!newParentName;
      if (hasExisting === hasNew) {
        errors.push(
          'Provide exactly one of parentIdentifier or newParentIdentifier+newParentName',
        );
      } else if (hasNew && (!newParentIdentifier || !newParentName)) {
        errors.push(
          'newParentIdentifier and newParentName are both required when creating a new parent',
        );
      }

      if (grNumber) {
        if (seenGrNumbers.has(grNumber)) {
          errors.push(`Duplicate grNumber "${grNumber}" within this file`);
        }
        seenGrNumbers.add(grNumber);
      }

      if (sectionId) {
        const section = await this.prisma.section.findUnique({
          where: { id: sectionId },
        });
        if (!section) errors.push(`Section "${sectionId}" not found`);
      }
      if (parentIdentifier) {
        const parent = await this.prisma.parentProfile.findFirst({
          where: { user: { identifier: parentIdentifier } },
        });
        if (!parent)
          errors.push(`Parent with identifier "${parentIdentifier}" not found`);
      }
      if (grNumber) {
        const existing = await this.prisma.student.findUnique({
          where: { grNumber },
        });
        if (existing) errors.push(`grNumber "${grNumber}" already exists`);
      }
      if (newParentIdentifier) {
        const existingUser = await this.prisma.user.findUnique({
          where: { identifier: newParentIdentifier },
        });
        if (existingUser)
          errors.push(`Identifier "${newParentIdentifier}" is already in use`);
      }

      outcomes.push({
        line,
        data: {
          grNumber,
          name,
          sectionId,
          parentIdentifier,
          newParentIdentifier,
          newParentName,
          newParentPhone,
          relationshipType,
        } as Record<string, string>,
        errors,
      });
    }
    return outcomes;
  }

  async preview(buffer: Buffer): Promise<PreviewResult> {
    const rows = await this.validateRows(buffer);
    return {
      rows,
      validCount: rows.filter((r) => r.errors.length === 0).length,
      errorCount: rows.filter((r) => r.errors.length > 0).length,
    };
  }

  async commit(
    buffer: Buffer,
    actingUserId: string,
  ): Promise<{ createdCount: number; studentIds: string[] }> {
    const rows = await this.validateRows(buffer);
    const invalid = rows.filter((r) => r.errors.length > 0);
    if (invalid.length > 0) {
      throw Object.assign(
        new Error('One or more rows are invalid; nothing was imported.'),
        { rows: invalid },
      );
    }

    // Enroll every imported student into the active session of ITS section's school (BL-01) —
    // the same rule StudentService.create() uses for a single admin-created student.
    const sessionBySchool = new Map<string, string>();

    const studentIds = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const { data } of rows) {
        const section = await tx.section.findUniqueOrThrow({
          where: { id: data.sectionId },
          select: {
            id: true,
            class: {
              select: {
                campusId: true,
                campus: { select: { schoolId: true } },
              },
            },
          },
        });
        const schoolId = section.class.campus.schoolId;
        if (!sessionBySchool.has(schoolId)) {
          const active = await activeSessionForSchool(tx, schoolId);
          if (!active) {
            throw new BadRequestException(
              "No active academic session for a section's school — cannot enroll students",
            );
          }
          sessionBySchool.set(schoolId, active.id);
        }
        const activeSession = { id: sessionBySchool.get(schoolId) as string };
        const { studentId } = await createStudentWithEnrollment(
          tx,
          {
            grNumber: data.grNumber,
            name: data.name,
            sectionId: section.id,
            campusId: section.class.campusId,
            academicSessionId: activeSession.id,
            parentProfileId: data.parentIdentifier
              ? (
                  await tx.parentProfile.findFirstOrThrow({
                    where: { user: { identifier: data.parentIdentifier } },
                  })
                ).id
              : undefined,
            newParent: data.newParentIdentifier
              ? {
                  identifier: data.newParentIdentifier,
                  password: randomBytes(24).toString('base64url'),
                  name: data.newParentName,
                  phone: data.newParentPhone || undefined,
                }
              : undefined,
            relationshipType: data.relationshipType as GuardianRelationshipName,
          },
          actingUserId,
        );
        ids.push(studentId);
      }
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'bulk-import.students',
          entity: 'Student',
          metadata: JSON.stringify({ count: ids.length, studentIds: ids }),
        },
      });
      return ids;
    });

    return { createdCount: studentIds.length, studentIds };
  }
}
