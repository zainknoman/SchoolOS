// backend/src/bulk-import/staff-bulk-import.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { EmployeeType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { createStaffWithOptionalTeacher } from '../hiring/create-staff-with-optional-teacher';
import { parseCsv } from './csv';
import type { RowOutcome, PreviewResult } from './students-bulk-import.service';

const MAX_ROWS = 2000;
const EMPLOYEE_TYPES = new Set(Object.values(EmployeeType) as string[]);

@Injectable()
export class StaffBulkImportService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateRows(buffer: Buffer): Promise<RowOutcome[]> {
    const parsed = parseCsv(buffer, MAX_ROWS);
    const seenLoginIdentifiers = new Set<string>();
    const outcomes: RowOutcome[] = [];

    for (const { line, row } of parsed) {
      const errors: string[] = [];
      const name = row.name?.trim();
      const employeeType = row.employeeType?.trim().toUpperCase();
      const campusId = row.campusId?.trim();
      const dateOfBirth = row.dateOfBirth?.trim() || undefined;
      const cnic = row.cnic?.trim() || undefined;
      const mobile = row.mobile?.trim() || undefined;
      const email = row.email?.trim() || undefined;
      const joiningDate = row.joiningDate?.trim() || undefined;
      const loginIdentifier = row.loginIdentifier?.trim() || undefined;

      if (!name) errors.push('name is required');
      if (!employeeType) {
        errors.push('employeeType is required');
      } else if (!EMPLOYEE_TYPES.has(employeeType)) {
        errors.push(
          `employeeType "${employeeType}" is not a recognized employee type`,
        );
      }
      if (!campusId) errors.push('campusId is required');

      if (employeeType === 'TEACHER') {
        if (!loginIdentifier) {
          errors.push(
            'loginIdentifier is required when employeeType is TEACHER',
          );
        } else {
          if (seenLoginIdentifiers.has(loginIdentifier)) {
            errors.push(
              `Duplicate loginIdentifier "${loginIdentifier}" within this file`,
            );
          }
          seenLoginIdentifiers.add(loginIdentifier);
          const existingUser = await this.prisma.user.findUnique({
            where: { identifier: loginIdentifier },
          });
          if (existingUser)
            errors.push(`Identifier "${loginIdentifier}" is already in use`);
        }
      }

      if (campusId) {
        const campus = await this.prisma.campus.findUnique({
          where: { id: campusId },
        });
        if (!campus) errors.push(`Campus "${campusId}" not found`);
      }
      if (cnic) {
        const existingStaff = await this.prisma.staff.findUnique({
          where: { cnic },
        });
        if (existingStaff) errors.push(`CNIC "${cnic}" is already in use`);
      }

      outcomes.push({
        line,
        data: {
          name,
          employeeType,
          campusId,
          dateOfBirth,
          cnic,
          mobile,
          email,
          joiningDate,
          loginIdentifier,
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
  ): Promise<{ createdCount: number; staffIds: string[] }> {
    const rows = await this.validateRows(buffer);
    const invalid = rows.filter((r) => r.errors.length > 0);
    if (invalid.length > 0) {
      throw Object.assign(
        new Error('One or more rows are invalid; nothing was imported.'),
        { rows: invalid },
      );
    }

    const staffIds = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const { data } of rows) {
        const { id } = await createStaffWithOptionalTeacher(tx, {
          name: data.name,
          employeeType: data.employeeType as EmployeeType,
          campusId: data.campusId,
          dateOfBirth: data.dateOfBirth || undefined,
          cnic: data.cnic || undefined,
          mobile: data.mobile || undefined,
          email: data.email || undefined,
          joiningDate: data.joiningDate || undefined,
          login:
            data.employeeType === 'TEACHER'
              ? {
                  identifier: data.loginIdentifier,
                  password: randomBytes(24).toString('base64url'),
                }
              : undefined,
        });
        ids.push(id);
      }
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'bulk-import.staff',
          entity: 'Staff',
          metadata: JSON.stringify({ count: ids.length, staffIds: ids }),
        },
      });
      return ids;
    });

    return { createdCount: staffIds.length, staffIds };
  }
}
