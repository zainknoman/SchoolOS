# Sprint P — Bulk Import/Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let staff bulk-create Students, Parents, or Teachers from a CSV file, with a
preview-before-commit flow, in-file and against-database duplicate detection, and an all-or-nothing
transactional commit — reusing each entity's existing single-row creation logic, not a second
parallel validation/creation path.

**Architecture:** One new `BulkImportModule` (`backend/src/bulk-import/`) with one service per
entity (Students, Parents, Teachers), each doing a read-only "preview" pass and a
write-everything-or-nothing "commit" pass. Students reuse `createStudentWithEnrollment`
(`backend/src/student/create-student-with-enrollment.ts`, extracted in Sprint O — **this plan
assumes Sprint O has already merged**); Parents reuse the existing `createParentWithUser`; Teachers
reuse a newly-extracted `createTeacherWithUser` (this sprint extracts it from
`TeacherService.create()`, mirroring Sprint O's extraction of `createStudentWithEnrollment`).
CSV-only (no `.xlsx`), import-only (no export), via `csv-parse`.

**Tech Stack:** NestJS + Prisma + Postgres + `csv-parse` (backend); Vue 3 +
`@vue/test-utils`/`vitest` (staff-console).

**Spec:** `build/docs/superpowers/specs/2026-09-13-sprint-p-bulk-import-design.md`

## Global Constraints

- CSV only — no `.xlsx`/Excel parsing.
- Import only — no CSV export in this sprint.
- Preview never writes to the database; commit re-validates (never trusts a client-held preview
  result) and then writes the whole batch in one `$transaction`, all-or-nothing.
- A new `User` account created by this sprint (a Student row's new parent, every Teacher row) gets
  a random password, never a value from the CSV — no password column exists in any CSV shape.
- Every route is `SCHOOL_ADMIN`/`SUPER_ADMIN` only (matching `StudentController`'s existing
  single-create gating — no `ACCOUNTS`).
- A row-count cap (2,000 rows) is enforced before any row-level validation runs.
- One summarizing `AuditLog` row per import batch, not one per created record.

---

### Task 1: Add `csv-parse` and a shared parse-and-cap helper

**Files:**
- Modify: `backend/package.json`
- Create: `backend/src/bulk-import/csv.ts`, `backend/src/bulk-import/csv.spec.ts`

**Interfaces:**
- Produces: `parseCsv<T>(buffer: Buffer, maxRows: number): { line: number; row: Record<string, string> }[]`
  (throws `BadRequestException` if the row count exceeds `maxRows`) — every entity service in this
  plan calls this.

- [ ] **Step 1: Add the dependency**

Run: `cd backend && npm install csv-parse`
Expected: `csv-parse` added to `backend/package.json`'s dependencies.

- [ ] **Step 2: Write the failing test**

```ts
// backend/src/bulk-import/csv.spec.ts
import { BadRequestException } from '@nestjs/common';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses a CSV buffer into rows with 1-based line numbers matching the file, header excluded', () => {
    const buffer = Buffer.from('grNumber,name\nGR-1,Alice\nGR-2,Bob\n');
    const rows = parseCsv(buffer, 2000);
    expect(rows).toEqual([
      { line: 2, row: { grNumber: 'GR-1', name: 'Alice' } },
      { line: 3, row: { grNumber: 'GR-2', name: 'Bob' } },
    ]);
  });

  it('rejects a file whose row count exceeds the cap', () => {
    const rows = Array.from({ length: 5 }, (_, i) => `GR-${i}`).join('\n');
    const buffer = Buffer.from(`grNumber\n${rows}\n`);
    expect(() => parseCsv(buffer, 3)).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 3: Run the test to see it fail**

Run: `cd backend && npx jest src/bulk-import/csv.spec.ts`
Expected: FAIL — `Cannot find module './csv'`.

- [ ] **Step 4: Implement `csv.ts`**

```ts
// backend/src/bulk-import/csv.ts
import { BadRequestException } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

export interface ParsedRow {
  line: number;
  row: Record<string, string>;
}

export function parseCsv(buffer: Buffer, maxRows: number): ParsedRow[] {
  const records: Record<string, string>[] = parse(buffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  if (records.length > maxRows) {
    throw new BadRequestException(`This file has ${records.length} rows, which exceeds the ${maxRows}-row limit per import.`);
  }
  // Line 1 is the header; data rows start at line 2, matching what a user sees in a spreadsheet.
  return records.map((row, i) => ({ line: i + 2, row }));
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `cd backend && npx jest src/bulk-import/csv.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/bulk-import/csv.ts backend/src/bulk-import/csv.spec.ts
git commit -m "feat(bulk-import): add csv-parse dependency and parse-and-cap helper"
```

---

### Task 2: Extract `createTeacherWithUser` from `TeacherService.create()`

**Files:**
- Create: `backend/src/teacher/create-teacher-with-user.ts`
- Modify: `backend/src/teacher/teacher.service.ts`
- Reference (no changes): `backend/src/teacher/teacher.service.spec.ts`

**Interfaces:**
- Produces: `createTeacherWithUser(tx: Prisma.TransactionClient, input: {identifier, password, name,
  campusId}): Promise<{id, name, identifier}>` — Task 5 (`TeachersBulkImportService`) calls this
  exact function, inside its own `$transaction`, the same way `TeacherService.create()` does after
  this refactor.

Pure refactor — no behavior change. Same TDD shape as Sprint O's Task 2: confirm green, refactor,
confirm still green.

- [ ] **Step 1: Confirm the starting baseline is green**

Run: `cd backend && npx jest src/teacher/teacher.service.spec.ts`
Expected: PASS before any change.

- [ ] **Step 2: Write `create-teacher-with-user.ts`**

```ts
// backend/src/teacher/create-teacher-with-user.ts
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';

export interface CreateTeacherWithUserInput {
  identifier: string;
  password: string;
  name: string;
  campusId: string;
}

export interface CreatedTeacher {
  id: string;
  name: string;
  identifier: string;
}

/**
 * The one place a Teacher's User + Teacher row are created together — called from
 * TeacherService.create() (its own transaction) and from the bulk-import Teachers path (its own
 * transaction) — mirrors createParentWithUser's and createStudentWithEnrollment's exact shape.
 */
export async function createTeacherWithUser(
  tx: Prisma.TransactionClient,
  input: CreateTeacherWithUserInput,
): Promise<CreatedTeacher> {
  const passwordHash = await argon2.hash(input.password);
  const user = await tx.user.create({
    data: { identifier: input.identifier, passwordHash, role: 'TEACHER' },
  });
  const teacher = await tx.teacher.create({
    data: { userId: user.id, name: input.name, campusId: input.campusId },
  });
  return { id: teacher.id, name: teacher.name, identifier: user.identifier };
}
```

- [ ] **Step 3: Refactor `TeacherService.create()` to call it**

```ts
async create(dto: CreateTeacherDto, actingUser: RequestUser): Promise<TeacherAdminSummary> {
  if (actingUser.role !== 'SUPER_ADMIN') {
    const [admin, campus] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: actingUser.id } }),
      this.prisma.campus.findUnique({ where: { id: dto.campusId } }),
    ]);
    if (!admin?.schoolId || !campus || admin.schoolId !== campus.schoolId) {
      throw new ForbiddenException('You do not have access to this campus');
    }
  }
  let created: CreatedTeacher;
  try {
    created = await this.prisma.$transaction((tx) => createTeacherWithUser(tx, dto));
  } catch (error) {
    assertCreatable(error, 'This identifier is already in use.');
  }
  await this.prisma.auditLog.create({
    data: {
      userId: actingUser.id,
      action: 'teacher.create',
      entity: 'Teacher',
      entityId: created.id,
      metadata: JSON.stringify({ identifier: dto.identifier, name: dto.name }),
    },
  });
  return created;
}
```
Add `import { createTeacherWithUser, type CreatedTeacher } from './create-teacher-with-user';` and
remove the now-unused `import * as argon2 from 'argon2';` if nothing else in the file uses it
(check `update()` — it still calls `argon2.hash` directly for a password change, so keep the
import).

- [ ] **Step 4: Run the tests again to confirm nothing regressed**

Run: `cd backend && npx jest src/teacher/teacher.service.spec.ts`
Run: `cd backend && npx jest --config test/jest-e2e.json people-crud.e2e-spec.ts`
Expected: both PASS, unchanged.

- [ ] **Step 5: Commit**

```bash
git add backend/src/teacher
git commit -m "refactor(teacher): extract createTeacherWithUser for reuse by bulk import"
```

---

### Task 3: Students bulk import (preview + commit)

**Files:**
- Create: `backend/src/bulk-import/bulk-import.module.ts`
- Create: `backend/src/bulk-import/students-bulk-import.service.ts`
- Create: `backend/src/bulk-import/bulk-import.controller.ts`
- Create: `backend/test/bulk-import.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `parseCsv` (Task 1); `createStudentWithEnrollment` (Sprint O,
  `backend/src/student/create-student-with-enrollment.ts`).
- Produces: `StudentsBulkImportService.preview/commit`,
  `POST /api/v1/bulk-import/students/preview`, `POST /api/v1/bulk-import/students/commit` — Task 6
  (Vue) is the frontend consumer; Tasks 4-5 follow this task's exact controller-dispatch shape for
  Parents/Teachers.

- [ ] **Step 1: Write `students-bulk-import.service.ts`**

```ts
// backend/src/bulk-import/students-bulk-import.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { createStudentWithEnrollment } from '../student/create-student-with-enrollment';
import { parseCsv } from './csv';

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

      if (!grNumber) errors.push('grNumber is required');
      if (!name) errors.push('name is required');
      if (!sectionId) errors.push('sectionId is required');

      const hasExisting = !!parentIdentifier;
      const hasNew = !!newParentIdentifier || !!newParentName;
      if (hasExisting === hasNew) {
        errors.push('Provide exactly one of parentIdentifier or newParentIdentifier+newParentName');
      } else if (hasNew && (!newParentIdentifier || !newParentName)) {
        errors.push('newParentIdentifier and newParentName are both required when creating a new parent');
      }

      if (grNumber) {
        if (seenGrNumbers.has(grNumber)) {
          errors.push(`Duplicate grNumber "${grNumber}" within this file`);
        }
        seenGrNumbers.add(grNumber);
      }

      if (sectionId) {
        const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
        if (!section) errors.push(`Section "${sectionId}" not found`);
      }
      if (parentIdentifier) {
        const parent = await this.prisma.parentProfile.findFirst({ where: { user: { identifier: parentIdentifier } } });
        if (!parent) errors.push(`Parent with identifier "${parentIdentifier}" not found`);
      }
      if (grNumber) {
        const existing = await this.prisma.student.findUnique({ where: { grNumber } });
        if (existing) errors.push(`grNumber "${grNumber}" already exists`);
      }
      if (newParentIdentifier) {
        const existingUser = await this.prisma.user.findUnique({ where: { identifier: newParentIdentifier } });
        if (existingUser) errors.push(`Identifier "${newParentIdentifier}" is already in use`);
      }

      outcomes.push({
        line,
        data: { grNumber, name, sectionId, parentIdentifier, newParentIdentifier, newParentName, newParentPhone } as Record<string, string>,
        errors,
      });
    }
    return outcomes;
  }

  async preview(buffer: Buffer): Promise<PreviewResult> {
    const rows = await this.validateRows(buffer);
    return { rows, validCount: rows.filter((r) => r.errors.length === 0).length, errorCount: rows.filter((r) => r.errors.length > 0).length };
  }

  async commit(buffer: Buffer, actingUserId: string): Promise<{ createdCount: number; studentIds: string[] }> {
    const rows = await this.validateRows(buffer);
    const invalid = rows.filter((r) => r.errors.length > 0);
    if (invalid.length > 0) {
      throw Object.assign(new Error('One or more rows are invalid; nothing was imported.'), { rows: invalid });
    }

    const studentIds = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const { data } of rows) {
        const { studentId } = await createStudentWithEnrollment(
          tx,
          {
            grNumber: data.grNumber,
            name: data.name,
            sectionId: data.sectionId,
            parentProfileId: data.parentIdentifier
              ? (await tx.parentProfile.findFirstOrThrow({ where: { user: { identifier: data.parentIdentifier } } })).id
              : undefined,
            newParent: data.newParentIdentifier
              ? { identifier: data.newParentIdentifier, password: randomBytes(24).toString('base64url'), name: data.newParentName, phone: data.newParentPhone || undefined }
              : undefined,
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
```
This service throws a plain `Error` with a `.rows` property on a re-validation failure at commit
time (rather than `BadRequestException` directly) so the controller (Step 3) can shape a consistent
`{ message, rows }` 400 body across all three entities — see Step 3.

- [ ] **Step 2: Write the DTO-free file-upload wiring in `bulk-import.controller.ts`**

```ts
// backend/src/bulk-import/bulk-import.controller.ts
import { BadRequestException, Controller, Post, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { StudentsBulkImportService } from './students-bulk-import.service';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

const CSV_UPLOAD_OPTIONS = {
  storage: memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB — far more than 2,000 rows of plain text needs
  fileFilter: (_req: unknown, file: Express.Multer.File, callback: (error: Error | null, accept: boolean) => void) => {
    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      callback(new BadRequestException('Only .csv files are accepted.'), false);
      return;
    }
    callback(null, true);
  },
};

@Controller('api/v1/bulk-import')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class BulkImportController {
  constructor(private readonly studentsService: StudentsBulkImportService) {}

  @Post('students/preview')
  @UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
  previewStudents(@UploadedFile() file: Express.Multer.File) {
    return this.studentsService.preview(file.buffer);
  }

  @Post('students/commit')
  @UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
  async commitStudents(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    try {
      return await this.studentsService.commit(file.buffer, req.user.id);
    } catch (error) {
      if (error instanceof Error && 'rows' in error) {
        throw new BadRequestException({ message: error.message, rows: (error as Error & { rows: unknown }).rows });
      }
      throw error;
    }
  }
}
```

- [ ] **Step 3: Write `bulk-import.module.ts` and register it**

```ts
// backend/src/bulk-import/bulk-import.module.ts
import { Module } from '@nestjs/common';
import { StudentsBulkImportService } from './students-bulk-import.service';
import { BulkImportController } from './bulk-import.controller';

@Module({
  providers: [StudentsBulkImportService],
  controllers: [BulkImportController],
})
export class BulkImportModule {}
```
Register `BulkImportModule` in `backend/src/app.module.ts` near the other feature modules.

- [ ] **Step 4: Write the e2e spec (new file)**

Mirror `backend/test/holidays-complaints-report-cards.e2e-spec.ts`'s seeding shape (school → campus
→ academic session → class → section → a `SCHOOL_ADMIN` login), identifier prefix `bi-`,
school-name/grNumber prefix `BI-`/`BI E2E School`. Also seed one existing `ParentProfile` (identifier
`bi-existing-parent`) linked to no student yet, for the "links to an existing parent" case.

```ts
describe('Students bulk import', () => {
  const csvBuffer = (text: string) => Buffer.from(text);

  it('preview reports per-row validity and writes nothing', async () => {
    const adminToken = await loginAs('bi-admin');
    const csv = `grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone\nBI-1001,Zainab,${ids.section},bi-existing-parent,,,\nBI-1002,Ahmed,${ids.section},,bi-new-parent,New Parent,03001234567\n`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/bulk-import/students/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvBuffer(csv), 'students.csv')
      .expect(201);

    expect(res.body.validCount).toBe(2);
    expect(res.body.errorCount).toBe(0);

    const studentsAfter = await prisma.student.count({ where: { grNumber: { startsWith: 'BI-' } } });
    expect(studentsAfter).toBe(0);
  });

  it('flags a within-file duplicate grNumber and a database duplicate, without blocking other valid rows', async () => {
    const adminToken = await loginAs('bi-admin');
    const csv = `grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone\nBI-1001,Zainab,${ids.section},bi-existing-parent,,,\nBI-1001,Zainab Again,${ids.section},bi-existing-parent,,,\nBI-1003,Third,${ids.section},bi-existing-parent,,,\n`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/bulk-import/students/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvBuffer(csv), 'students.csv')
      .expect(201);

    expect(res.body.rows[0].errors).toEqual([]);
    expect(res.body.rows[1].errors).toEqual(expect.arrayContaining([expect.stringContaining('Duplicate grNumber')]));
    expect(res.body.rows[2].errors).toEqual([]);
    expect(res.body.validCount).toBe(2);
  });

  it('commit rejects the entire batch if any row still errors', async () => {
    const adminToken = await loginAs('bi-admin');
    const csv = `grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone\nBI-1004,Valid,${ids.section},bi-existing-parent,,,\nBI-BAD,,${ids.section},bi-existing-parent,,,\n`;
    await request(app.getHttpServer())
      .post('/api/v1/bulk-import/students/commit')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvBuffer(csv), 'students.csv')
      .expect(400);

    const created = await prisma.student.findUnique({ where: { grNumber: 'BI-1004' } });
    expect(created).toBeNull();
  });

  it('commit creates every valid row transactionally, with one summarizing audit-log entry', async () => {
    const adminToken = await loginAs('bi-admin');
    const csv = `grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone\nBI-1005,Fatima,${ids.section},bi-existing-parent,,,\nBI-1006,Bilal,${ids.section},,bi-new-parent-2,New Parent Two,03007654321\n`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/bulk-import/students/commit')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvBuffer(csv), 'students.csv')
      .expect(201);

    expect(res.body.createdCount).toBe(2);
    const auditRows = await prisma.auditLog.count({ where: { action: 'bulk-import.students', userId: expect.anything() } });
    expect(auditRows).toBeGreaterThanOrEqual(1);
    const newParentUser = await prisma.user.findUnique({ where: { identifier: 'bi-new-parent-2' } });
    expect(newParentUser).not.toBeNull();
  });

  it('a TEACHER cannot access any bulk-import route', async () => {
    const teacherToken = await loginAs('bi-teacher');
    await request(app.getHttpServer())
      .post('/api/v1/bulk-import/students/preview')
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', csvBuffer('grNumber,name,sectionId\n'), 'students.csv')
      .expect(403);
  });
});
```

- [ ] **Step 5: Run the e2e spec**

Run: `cd backend && npx jest --config test/jest-e2e.json bulk-import.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/bulk-import backend/src/app.module.ts backend/test/bulk-import.e2e-spec.ts
git commit -m "feat(bulk-import): add Students preview/commit endpoints"
```

---

### Task 4: Parents bulk import (preview + commit)

**Files:**
- Create: `backend/src/bulk-import/parents-bulk-import.service.ts`
- Modify: `backend/src/bulk-import/bulk-import.controller.ts`, `backend/src/bulk-import/bulk-import.module.ts`
- Modify: `backend/test/bulk-import.e2e-spec.ts`

**Interfaces:**
- Consumes: `parseCsv` (Task 1); `createParentWithUser` (existing,
  `backend/src/parent/create-parent-with-user.ts`).
- Produces: `ParentsBulkImportService.preview/commit`,
  `POST /api/v1/bulk-import/parents/preview`, `POST /api/v1/bulk-import/parents/commit`.

- [ ] **Step 1: Write `parents-bulk-import.service.ts`**

```ts
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
```
Export `RowOutcome`/`PreviewResult` from `students-bulk-import.service.ts` (they're already declared
there as plain interfaces — just add `export` if not already present) so this file can import them
rather than redeclaring an identical shape.

- [ ] **Step 2: Add the two routes to `bulk-import.controller.ts`**

```ts
@Post('parents/preview')
@UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
previewParents(@UploadedFile() file: Express.Multer.File) {
  return this.parentsService.preview(file.buffer);
}

@Post('parents/commit')
@UseInterceptors(FileInterceptor('file', CSV_UPLOAD_OPTIONS))
async commitParents(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
  try {
    return await this.parentsService.commit(file.buffer, req.user.id);
  } catch (error) {
    if (error instanceof Error && 'rows' in error) {
      throw new BadRequestException({ message: error.message, rows: (error as Error & { rows: unknown }).rows });
    }
    throw error;
  }
}
```
Add `private readonly parentsService: ParentsBulkImportService` to the controller's constructor
and `import { ParentsBulkImportService } from './parents-bulk-import.service';`.

- [ ] **Step 3: Register in `bulk-import.module.ts`**

Add `ParentsBulkImportService` to `providers`.

- [ ] **Step 4: Add e2e cases**

```ts
describe('Parents bulk import', () => {
  it('commit creates parents and rejects a within-file duplicate identifier', async () => {
    const adminToken = await loginAs('bi-admin');
    const csv = `identifier,name,phone\nbi-parent-a,Parent A,03001112222\nbi-parent-a,Parent A Dup,03003334444\n`;
    await request(app.getHttpServer())
      .post('/api/v1/bulk-import/parents/commit')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csv), 'parents.csv')
      .expect(400);

    const created = await prisma.user.findUnique({ where: { identifier: 'bi-parent-a' } });
    expect(created).toBeNull();
  });

  it('commit creates a valid batch of parents', async () => {
    const adminToken = await loginAs('bi-admin');
    const csv = `identifier,name,phone\nbi-parent-b,Parent B,03005556666\n`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/bulk-import/parents/commit')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csv), 'parents.csv')
      .expect(201);
    expect(res.body.createdCount).toBe(1);
  });
});
```

- [ ] **Step 5: Run the e2e suite**

Run: `cd backend && npx jest --config test/jest-e2e.json bulk-import.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/bulk-import
git commit -m "feat(bulk-import): add Parents preview/commit endpoints"
```

---

### Task 5: Teachers bulk import (preview + commit)

**Files:**
- Create: `backend/src/bulk-import/teachers-bulk-import.service.ts`
- Modify: `backend/src/bulk-import/bulk-import.controller.ts`, `backend/src/bulk-import/bulk-import.module.ts`
- Modify: `backend/test/bulk-import.e2e-spec.ts`

**Interfaces:**
- Consumes: `parseCsv` (Task 1); `createTeacherWithUser` (Task 2).
- Produces: `TeachersBulkImportService.preview/commit`,
  `POST /api/v1/bulk-import/teachers/preview`, `POST /api/v1/bulk-import/teachers/commit`.

- [ ] **Step 1: Write `teachers-bulk-import.service.ts`**

```ts
// backend/src/bulk-import/teachers-bulk-import.service.ts
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { createTeacherWithUser } from '../teacher/create-teacher-with-user';
import { parseCsv } from './csv';
import type { RowOutcome, PreviewResult } from './students-bulk-import.service';

const MAX_ROWS = 2000;

@Injectable()
export class TeachersBulkImportService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateRows(buffer: Buffer): Promise<RowOutcome[]> {
    const parsed = parseCsv(buffer, MAX_ROWS);
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
        const existing = await this.prisma.user.findUnique({ where: { identifier } });
        if (existing) errors.push(`Identifier "${identifier}" is already in use`);
      }
      if (campusId) {
        const campus = await this.prisma.campus.findUnique({ where: { id: campusId } });
        if (!campus) errors.push(`Campus "${campusId}" not found`);
      }

      outcomes.push({ line, data: { identifier, name, campusId } as Record<string, string>, errors });
    }
    return outcomes;
  }

  async preview(buffer: Buffer): Promise<PreviewResult> {
    const rows = await this.validateRows(buffer);
    return { rows, validCount: rows.filter((r) => r.errors.length === 0).length, errorCount: rows.filter((r) => r.errors.length > 0).length };
  }

  async commit(buffer: Buffer, actingUserId: string): Promise<{ createdCount: number; teacherIds: string[] }> {
    const rows = await this.validateRows(buffer);
    const invalid = rows.filter((r) => r.errors.length > 0);
    if (invalid.length > 0) {
      throw Object.assign(new Error('One or more rows are invalid; nothing was imported.'), { rows: invalid });
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
```

- [ ] **Step 2: Add the two routes to `bulk-import.controller.ts`**

Same shape as Parents (Task 4, Step 2), substituting `teachersService`/`TeachersBulkImportService`
and the `teachers/preview`/`teachers/commit` paths.

- [ ] **Step 3: Register in `bulk-import.module.ts`**

Add `TeachersBulkImportService` to `providers`.

- [ ] **Step 4: Add e2e cases**

```ts
describe('Teachers bulk import', () => {
  it('commit creates teachers and rejects a row with an unknown campusId', async () => {
    const adminToken = await loginAs('bi-admin');
    const csv = `identifier,name,campusId\nbi-teacher-a,Teacher A,${ids.campus}\nbi-teacher-b,Teacher B,not-a-real-campus\n`;
    await request(app.getHttpServer())
      .post('/api/v1/bulk-import/teachers/commit')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csv), 'teachers.csv')
      .expect(400);

    const created = await prisma.user.findUnique({ where: { identifier: 'bi-teacher-a' } });
    expect(created).toBeNull();
  });

  it('commit creates a valid batch of teachers', async () => {
    const adminToken = await loginAs('bi-admin');
    const csv = `identifier,name,campusId\nbi-teacher-c,Teacher C,${ids.campus}\n`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/bulk-import/teachers/commit')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', Buffer.from(csv), 'teachers.csv')
      .expect(201);
    expect(res.body.createdCount).toBe(1);
  });
});
```

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && npm test && npm run test:e2e`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/bulk-import backend/test/bulk-import.e2e-spec.ts
git commit -m "feat(bulk-import): add Teachers preview/commit endpoints"
```

---

### Task 6: `BulkImportView.vue` (staff-console)

**Files:**
- Modify: `staff-console/src/lib/api.ts` (add types + methods)
- Create: `staff-console/src/views/BulkImportView.vue`, `staff-console/src/views/BulkImportView.spec.ts`
- Create: `staff-console/src/views/BulkImportPageView.vue`
- Modify: `staff-console/src/router/index.ts`, `staff-console/src/components/AppShell.vue`,
  `staff-console/src/locales/en.json`, `staff-console/src/locales/ur.json`

**Interfaces:**
- Consumes: `POST /api/v1/bulk-import/:entity/preview`, `POST /api/v1/bulk-import/:entity/commit`
  (Tasks 3-5).
- Produces: nothing consumed elsewhere — final task in this sprint.

- [ ] **Step 1: Add API types and methods to `staff-console/src/lib/api.ts`**

```ts
export interface BulkImportRowOutcome {
  line: number;
  data: Record<string, string>;
  errors: string[];
}

export interface BulkImportPreviewResult {
  rows: BulkImportRowOutcome[];
  validCount: number;
  errorCount: number;
}

export type BulkImportEntity = 'students' | 'parents' | 'teachers';
```
Add:
```ts
async previewBulkImport(accessToken: string, entity: BulkImportEntity, file: File): Promise<BulkImportPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/v1/bulk-import/${entity}/preview`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: formData,
  });
  return asJson(res);
},

async commitBulkImport(accessToken: string, entity: BulkImportEntity, file: File): Promise<{ createdCount: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}/api/v1/bulk-import/${entity}/commit`, {
    method: 'POST',
    headers: authHeaders(accessToken),
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Import failed.', res.status);
  }
  return res.json();
},
```
(Mirror `uploadReportCard`'s exact `FormData`/`fetch` shape for the multipart request — read that
method in `api.ts` immediately before writing these two.)

- [ ] **Step 2: Write `BulkImportView.vue`**

An entity selector (`students`/`parents`/`teachers`, `data-testid="select-entity"`) + file input
(`data-testid="select-file"`) + "Preview" button (`data-testid="preview-submit"`) calling
`api.previewBulkImport`; renders a table of `rows` (line number, each `data` field, errors joined
and shown in a distinct error style per row); a "Commit" button (`data-testid="commit-submit"`),
disabled while `errorCount > 0` or no preview has run yet, calling `api.commitBulkImport` with the
same file; on success, shows `"${createdCount} record(s) imported."` and a note that any newly
created accounts should use Forgot Password to set their own password.

- [ ] **Step 3: Write `BulkImportView.spec.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import BulkImportView from './BulkImportView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: { previewBulkImport: vi.fn(), commitBulkImport: vi.fn() },
}));

function setFile(wrapper: ReturnType<typeof mount>, file: File) {
  const input = wrapper.find('[data-testid="select-file"]').element as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file] });
  return wrapper.find('[data-testid="select-file"]').trigger('change');
}

describe('BulkImportView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.previewBulkImport).mockReset();
    vi.mocked(api.commitBulkImport).mockReset();
  });

  it('disables Commit until a preview with zero errors has run', async () => {
    vi.mocked(api.previewBulkImport).mockResolvedValue({
      rows: [{ line: 2, data: { grNumber: 'GR-1' }, errors: ['name is required'] }],
      validCount: 0,
      errorCount: 1,
    });

    const wrapper = mount(BulkImportView);
    await wrapper.find('[data-testid="select-entity"]').setValue('students');
    const file = new File(['grNumber\nGR-1\n'], 'students.csv', { type: 'text/csv' });
    await setFile(wrapper, file);
    await wrapper.find('[data-testid="preview-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('name is required');
    expect((wrapper.find('[data-testid="commit-submit"]').element as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Commit once the preview has zero errors, then commits', async () => {
    vi.mocked(api.previewBulkImport).mockResolvedValue({
      rows: [{ line: 2, data: { grNumber: 'GR-1' }, errors: [] }],
      validCount: 1,
      errorCount: 0,
    });
    vi.mocked(api.commitBulkImport).mockResolvedValue({ createdCount: 1 });

    const wrapper = mount(BulkImportView);
    await wrapper.find('[data-testid="select-entity"]').setValue('students');
    const file = new File(['grNumber,name,sectionId\nGR-1,Alice,sec-1\n'], 'students.csv', { type: 'text/csv' });
    await setFile(wrapper, file);
    await wrapper.find('[data-testid="preview-submit"]').trigger('click');
    await flushPromises();

    expect((wrapper.find('[data-testid="commit-submit"]').element as HTMLButtonElement).disabled).toBe(false);

    await wrapper.find('[data-testid="commit-submit"]').trigger('click');
    await flushPromises();

    expect(api.commitBulkImport).toHaveBeenCalledWith('token-1', 'students', file);
    expect(wrapper.text()).toContain('1 record(s) imported.');
  });

  it('shows the backend error message when commit is rejected', async () => {
    vi.mocked(api.previewBulkImport).mockResolvedValue({ rows: [], validCount: 0, errorCount: 0 });
    vi.mocked(api.commitBulkImport).mockRejectedValue(new Error('One or more rows are invalid; nothing was imported.'));

    const wrapper = mount(BulkImportView);
    await wrapper.find('[data-testid="select-entity"]').setValue('students');
    const file = new File(['grNumber\n'], 'students.csv', { type: 'text/csv' });
    await setFile(wrapper, file);
    await wrapper.find('[data-testid="preview-submit"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="commit-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('One or more rows are invalid');
  });
});
```

- [ ] **Step 4: Run the spec**

Run: `cd staff-console && npx vitest run src/views/BulkImportView.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire route, nav, and translations**

Create `BulkImportPageView.vue` (standard `<AppShell><BulkImportView /></AppShell>` wrapper, no
spec). Add `/admin/bulk-import` (`meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title:
'Bulk Import' }`) to `staff-console/src/router/index.ts`. Add a `nav-bulk-import` `RouterLink` to
`AppShell.vue`'s admin nav group, gated by `canManageHolidays`-equivalent
(`auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN'` — reuse the existing
`canManageHolidays` computed directly rather than adding an identical new one, since the role check
is the same). Add `"bulkImport": "Bulk Import"` to `en.json`'s `nav` object and
`"bulkImport": "بلک امپورٹ"` to `ur.json`'s (confirm this reads naturally before merging).

- [ ] **Step 6: Run the full staff-console suite**

Run: `cd staff-console && npx vitest run && npx vue-tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add staff-console/src
git commit -m "feat(bulk-import): add BulkImportView (preview-then-commit UI)"
```

---

### Task 7: Full-suite verification and roadmap update

**Files:** `docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md` (roadmap checklist only).

- [ ] **Step 1: Run every suite**

```bash
cd backend && npm test && npm run test:e2e && npm run build
cd ../staff-console && npx vitest run && npx vue-tsc --noEmit && npm run lint
```
Expected: all green, clean build/lint.

- [ ] **Step 2: Update the roadmap doc's Implementation Checklist**

Check off Sprint P's box and sub-items, noting that CSV export was explicitly out of scope this
sprint (a separate, smaller follow-up), matching the established format from Sprints A-O.

- [ ] **Step 3: Commit**

```bash
git add docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md
git commit -m "docs: mark Sprint P complete in the roadmap checklist"
```
