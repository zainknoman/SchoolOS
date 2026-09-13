// backend/src/bulk-import/parents-bulk-import.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { createParentWithUser } from '../parent/create-parent-with-user';
import { parseCsv } from './csv';
import type { RowOutcome, PreviewResult } from './students-bulk-import.service';

const MAX_ROWS = 2000;

@Injectable()
export class ParentsBulkImportService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateRows(buffer: Buffer): Promise<RowOutcome[]> {
    const parsed = parseCsv(buffer, MAX_ROWS);
    const seenIdentifiers = new Set<string>();
    const outcomes: RowOutcome[] = [];

    for (const { line, row } of parsed) {
      const errors: string[] = [];
      const identifier = row.identifier?.trim();
      const name = row.name?.trim();
      const phone = row.phone?.trim();

      if (!identifier) errors.push('identifier is required');
      if (!name) errors.push('name is required');

      if (identifier) {
        if (seenIdentifiers.has(identifier)) {
          errors.push(`Duplicate identifier "${identifier}" within this file`);
        }
        seenIdentifiers.add(identifier);
        const existing = await this.prisma.user.findUnique({ where: { identifier } });
        if (existing) errors.push(`Identifier "${identifier}" is already in use`);
      }

      outcomes.push({ line, data: { identifier, name, phone } as Record<string, string>, errors });
    }
    return outcomes;
  }

  async preview(buffer: Buffer): Promise<PreviewResult> {
    const rows = await this.validateRows(buffer);
    return { rows, validCount: rows.filter((r) => r.errors.length === 0).length, errorCount: rows.filter((r) => r.errors.length > 0).length };
  }

  async commit(buffer: Buffer, actingUserId: string): Promise<{ createdCount: number; parentIds: string[] }> {
    const rows = await this.validateRows(buffer);
    const invalid = rows.filter((r) => r.errors.length > 0);
    if (invalid.length > 0) {
      throw Object.assign(new Error('One or more rows are invalid; nothing was imported.'), { rows: invalid });
    }

    const parentIds = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const { data } of rows) {
        const parent = await createParentWithUser(tx, {
          identifier: data.identifier,
          password: randomBytes(24).toString('base64url'),
          name: data.name,
          phone: data.phone || undefined,
        });
        ids.push(parent.id);
      }
      await tx.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'bulk-import.parents',
          entity: 'ParentProfile',
          metadata: JSON.stringify({ count: ids.length, parentIds: ids }),
        },
      });
      return ids;
    });

    return { createdCount: parentIds.length, parentIds };
  }
}
