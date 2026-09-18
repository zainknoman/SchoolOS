# Data Model Correction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three data-model gaps in the SchoolOS backend before Sprint 7-8 (Messages/Notifications) and Sprint 9-10 (Fees) build more on top of them: no enrollment history (student→section is a direct FK, so a mid-year section change silently rewrites past months), no fee-payment allocation (a payment can't span multiple vouchers), and cascading deletes on historical records (deleting a student wipes their attendance/fee/leave history).

**Architecture:** Introduce an `Enrollment` model between `Student` and `Section`/`Campus`/`AcademicSession` (student's current/past placement becomes a dated relation, not a field on `Student`); add a shared `EnrollmentService` (same pattern as the existing `StudentAccessService`) as the one place every module resolves "what section is this student in"; add `FeePaymentAllocation` so one payment can be split across vouchers; flip `onDelete: Cascade` → `Restrict` on `Student→Attendance/FeeVoucher/LeaveRequest`. No multi-tenancy, RLS, or full accounting ledger (Invoice/Refund/Reconciliation) — out of scope, this project is a single-school platform per `docs/Seedsapk/MVP-Plan-V3.md`, not a multi-tenant SaaS product.

**Tech Stack:** NestJS + TypeScript, Prisma (SQLite dev datasource), Jest (mocked-`PrismaService` unit tests) + Supertest (e2e).

**Spec:** This plan implements the "Critical" fixes identified in `docs/Plan-Ideas/Feature-Chatgpt-CodeValidateFEAT5-6.txt` (Enrollment history, Finance allocation, cascading deletes), scoped down to exclude that doc's Tenant/RLS recommendations (inapplicable — confirmed against `docs/Seedsapk/MVP-Plan-V3.md`, this is a single-school build, not multi-tenant SaaS).

## Global Constraints

- Money is always an `Int` in the smallest currency unit (paisa) — never `Float`. (Already correct in the current schema; do not regress it.)
- Every service method that writes a record the current codebase audits (attendance, diary, circulars) keeps writing its `AuditLog` row — this plan doesn't touch audit logging, but no task should remove an existing `auditLog.create` call.
- No new module gets its own ad-hoc authorization check — `StudentAccessService`/`@Roles()` guards stay the only place access is decided. `EnrollmentService` (this plan) is a data-resolution helper, not an authorization check.
- Follow the existing DI pattern: shared cross-cutting services (see `StudentAccessService`) are added to each consuming module's own `providers` array, not wrapped in a new shared `Module` — `PrismaModule` is the only `@Global()` module in this codebase, don't add a second one.

---

## File Structure

```
backend/prisma/schema.prisma                          — modify (Enrollment, Student, FeePayment, cascade policy)
backend/prisma/seed.ts                                 — modify (create Enrollment instead of Student.campusId/sectionId)
backend/src/enrollment/enrollment.service.ts            — create (shared "resolve student's section" logic)
backend/src/enrollment/enrollment.service.spec.ts        — create
backend/src/diary/diary.service.ts                      — modify (getForStudent → EnrollmentService.getEnrollmentForDate)
backend/src/diary/diary.service.spec.ts                  — modify
backend/src/diary/diary.module.ts                        — modify (register EnrollmentService)
backend/src/timetable/timetable.service.ts               — modify (getForStudent → EnrollmentService.getCurrentEnrollment)
backend/src/timetable/timetable.service.spec.ts           — modify
backend/src/timetable/timetable.module.ts                 — modify (register EnrollmentService)
backend/src/sections/sections.service.ts                  — modify (getStudents → query via Enrollment)
backend/src/sections/sections.service.spec.ts              — modify
backend/src/circulars/circulars.service.ts                 — modify (section-scope recipient resolution → via Enrollment)
backend/src/circulars/circulars.service.spec.ts              — modify
backend/src/me/me.service.ts                                — modify (getChildrenForUser → include campus/section via Enrollment)
backend/src/me/me.service.spec.ts                            — modify
backend/test/me.e2e-spec.ts                                    — modify (fixtures: create Enrollment; afterAll: delete students before school)
backend/test/diary-circulars.e2e-spec.ts                        — modify (same)
backend/test/timetable-attendance.e2e-spec.ts                     — modify (same)
build/PROJECT-STATUS.md                                            — modify (new Sprint 6.5 entry)
plan/docs/FEATURES.txt                                               — modify (note under FEAT-012 referencing the allocation model)
```

---

### Task 1: Schema — `Enrollment` model, `Student` cleanup, seed script, e2e fixtures

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`
- Modify: `backend/test/me.e2e-spec.ts`
- Modify: `backend/test/diary-circulars.e2e-spec.ts`
- Modify: `backend/test/timetable-attendance.e2e-spec.ts`

**Interfaces:**
- Produces: `model Enrollment { id, studentId, campusId, sectionId, academicSessionId, startDate, endDate?, status: EnrollmentStatus }` and `enum EnrollmentStatus { ACTIVE, TRANSFERRED, COMPLETED }` — every later task in this plan queries `prisma.enrollment`.
- Produces: `Student` no longer has `campusId`/`sectionId`/`campus`/`section` fields.

There's no separate "write a failing test" step here — this task has no behavior to unit-test yet (that's Tasks 2-7); it's the schema foundation everything else depends on. Verification is "the app still boots and the existing test suite still passes after every consumer is updated" at the end of Task 7.

- [ ] **Step 1: Edit `schema.prisma`** — add the `Enrollment` model and `EnrollmentStatus` enum, remove `Student.campusId`/`sectionId`, add reverse relations.

```prisma
enum EnrollmentStatus {
  ACTIVE
  TRANSFERRED
  COMPLETED
}

model Student {
  id         String   @id @default(uuid())
  grNumber   String   @unique
  name       String
  parents         StudentParent[]
  enrollments     Enrollment[]
  attendance      Attendance[]
  feeVouchers     FeeVoucher[]
  leaveRequests   LeaveRequest[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Enrollment {
  id                String            @id @default(uuid())
  studentId         String
  student           Student           @relation(fields: [studentId], references: [id], onDelete: Cascade)
  campusId          String
  campus            Campus            @relation(fields: [campusId], references: [id], onDelete: Restrict)
  sectionId         String
  section           Section           @relation(fields: [sectionId], references: [id], onDelete: Restrict)
  academicSessionId String
  academicSession   AcademicSession   @relation(fields: [academicSessionId], references: [id], onDelete: Restrict)
  startDate         DateTime
  endDate           DateTime?
  status            EnrollmentStatus  @default(ACTIVE)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  @@index([studentId])
  @@index([sectionId])
  @@index([campusId])
}
```

Update the three related models to drop the old `Student` relation and add the new `Enrollment` reverse relation (remove `Campus.students`, `Section.students`; add `Campus.enrollments Enrollment[]`, `Section.enrollments Enrollment[]`, `AcademicSession.enrollments Enrollment[]`):

```prisma
model Campus {
  id        String   @id @default(uuid())
  schoolId  String
  school    School   @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  name      String
  classes     Class[]
  enrollments Enrollment[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([schoolId])
}

model AcademicSession {
  id         String   @id @default(uuid())
  label      String
  startDate  DateTime
  endDate    DateTime
  isActive   Boolean  @default(false)
  classes      Class[]
  feeVouchers  FeeVoucher[]
  enrollments  Enrollment[]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model Section {
  id        String   @id @default(uuid())
  classId   String
  class     Class    @relation(fields: [classId], references: [id], onDelete: Cascade)
  name      String
  enrollments  Enrollment[]
  timetables   Timetable[]
  diaryEntries DiaryEntry[]
  circulars    Circular[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([classId])
}
```

- [ ] **Step 2: Regenerate the dev database** — there is no production data in this schema yet (Fees/Messages aren't built; the only rows in `dev.db` come from `seed.ts`), so a clean reset is correct rather than a data-preserving migration:

```bash
cd backend
rm -f prisma/dev.db
npx prisma migrate dev --name enrollment_model
```

Expected: Prisma generates a new migration under `prisma/migrations/` and applies it to a fresh `dev.db`. It will not prompt about data loss since the file was deleted first.

- [ ] **Step 3: Update `seed.ts`** — replace the direct `Student.create({ campusId, sectionId, ... })` with a `Student.create` (no placement fields) followed by an `Enrollment.create`:

```typescript
const student = await prisma.student.create({
  data: { grNumber: 'GR-1001', name: 'Eshaal Sample' },
});
const studentEnrollment = await prisma.enrollment.create({
  data: {
    studentId: student.id,
    campusId: gulistan.id,
    sectionId: section3A.id,
    academicSessionId: session.id,
    startDate: session.startDate,
    status: 'ACTIVE',
  },
});
void studentEnrollment;
```

Place this replacement where the original `const student = await prisma.student.create(...)` call is (currently around line 47-49 of `backend/prisma/seed.ts`); everything below that already references `student.id`, which is unaffected.

- [ ] **Step 4: Run the seed and confirm it succeeds**

```bash
npx prisma generate
npx tsx prisma/seed.ts
```

Expected: the existing console output ("Seeded: 1 school, 2 campuses, ...") with no errors.

- [ ] **Step 5: Update `backend/test/me.e2e-spec.ts` fixtures** — replace both `prisma.student.create({ data: { campusId, sectionId, ... } })` calls (lines 97-114) with `Student.create` + `Enrollment.create`, and fix `afterAll` so it deletes students (which cascades their `Enrollment` rows) before deleting the school:

```typescript
const [childA, childB] = await Promise.all([
  prisma.student.create({ data: { grNumber: 'ME2E-A1', name: 'Child A' } }),
  prisma.student.create({ data: { grNumber: 'ME2E-B1', name: 'Child B' } }),
]);
await Promise.all([
  prisma.enrollment.create({
    data: {
      studentId: childA.id,
      campusId: campus.id,
      sectionId: section.id,
      academicSessionId: session.id,
      startDate: session.startDate,
      status: 'ACTIVE',
    },
  }),
  prisma.enrollment.create({
    data: {
      studentId: childB.id,
      campusId: campus.id,
      sectionId: section.id,
      academicSessionId: session.id,
      startDate: session.startDate,
      status: 'ACTIVE',
    },
  }),
]);
```

```typescript
afterAll(async () => {
  // Enrollment.campus/section/academicSession are onDelete: Restrict (deliberately — see Task 9's
  // philosophy) so students must be deleted first; that cascades their Enrollment rows, which then
  // unblocks the School cascade below.
  await prisma.student
    .deleteMany({ where: { grNumber: { in: ['ME2E-A1', 'ME2E-B1'] } } })
    .catch(() => undefined);
  await prisma.school
    .delete({ where: { id: ids.school } })
    .catch(() => undefined);
  await prisma.user
    .deleteMany({
      where: {
        identifier: {
          in: ['me2e-parent-a@schoolos.edu.pk', 'me2e-parent-b@schoolos.edu.pk'],
        },
      },
    })
    .catch(() => undefined);
  await app.close();
});
```

- [ ] **Step 6: Apply the same pattern to `backend/test/diary-circulars.e2e-spec.ts`** — replace the `childA`/`childB` creation (lines 94-99) with `Student.create` + `Enrollment.create` (one enrolled in `sectionA`, one in `sectionB`), and add `prisma.student.deleteMany({ where: { grNumber: { in: ['DC-A1', 'DC-B1'] } } })` as the first line of `afterAll` (before the existing `prisma.school.delete(...)` at line 111). Also add the same `student.deleteMany` guard to the stale-fixture self-healing block at the top of `beforeAll` (before its `prisma.school.delete(...)` at line 46), matching by `grNumber: { startsWith: 'DC-' }`.

- [ ] **Step 7: Apply the same pattern to `backend/test/timetable-attendance.e2e-spec.ts`** — replace `childA`/`childB` creation (lines 111-126, both enrolled in `section`) the same way, add `prisma.student.deleteMany({ where: { grNumber: { in: ['TTA-A1', 'TTA-B1'] } } })` as the first line of `afterAll` (before line 155's `prisma.school.delete(...)`), and add the matching guard (`grNumber: { startsWith: 'TTA-' }`) to the stale-fixture cleanup at the top of `beforeAll`.

- [ ] **Step 8: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/seed.ts backend/prisma/migrations \
  backend/test/me.e2e-spec.ts backend/test/diary-circulars.e2e-spec.ts backend/test/timetable-attendance.e2e-spec.ts
git commit -m "feat(schema): introduce Enrollment, remove Student.campusId/sectionId"
```

(Backend code that still references `student.sectionId`/`student.campusId` — `DiaryService`, `TimetableService`, `SectionsService`, `CircularsService`, `MeService` — will now fail `tsc`. That's expected; Tasks 2-7 fix each one. Don't run the full build between this commit and the end of Task 7.)

**Addendum (found during Task 1 implementation, not anticipated when this plan was written):** `backend/src/files/files-access.service.ts` also queries the removed `Section.students` relation (`assertCanAccessFile`'s diary-attachment branch: `section: { students: { some: { parents: { some: { parentProfile: { userId } } } } } } }`) — a sixth consumer of the old direct relation, missed when this plan enumerated Diary/Timetable/Sections/Circulars/Me as "the five consumer services." Confirmed via `tsc --noEmit` that no other files were missed. Fixed as part of Task 1 (folded in as a fix round rather than a new task, since it's a required-for-compilation, single-file, single-query change with no new design decision — same "section → currently-enrolled students" direct-`prisma.enrollment` pattern Tasks 5 and 6 use):

```typescript
// backend/src/files/files-access.service.ts — assertCanAccessFile's diary-attachment branch
const viaDiary = await this.prisma.diaryAttachment.findFirst({
  where: {
    fileId,
    diaryEntry: {
      section: {
        enrollments: {
          some: {
            status: 'ACTIVE',
            student: { parents: { some: { parentProfile: { userId: user.id } } } },
          },
        },
      },
    },
  },
});
```

---

### Task 2: `EnrollmentService`

**Files:**
- Create: `backend/src/enrollment/enrollment.service.ts`
- Test: `backend/src/enrollment/enrollment.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (existing, injected via constructor — see `StudentAccessService` for the pattern).
- Produces: `EnrollmentService.getCurrentEnrollment(studentId: string): Promise<Enrollment>` and `EnrollmentService.getEnrollmentForDate(studentId: string, date: Date): Promise<Enrollment>`, both throwing `NotFoundException` when no matching row exists. Tasks 3-7 call these.

- [ ] **Step 1: Write the failing tests**

```typescript
// backend/src/enrollment/enrollment.service.spec.ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EnrollmentService } from './enrollment.service';
import { PrismaService } from '../prisma/prisma.service';

describe('EnrollmentService', () => {
  let service: EnrollmentService;
  let prisma: { enrollment: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { enrollment: { findFirst: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [EnrollmentService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(EnrollmentService);
  });

  it("returns the student's active enrollment", async () => {
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1', sectionId: 'sec-1' });

    const result = await service.getCurrentEnrollment('s1');

    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 's1', status: 'ACTIVE' } }),
    );
    expect(result).toEqual({ id: 'enr-1', sectionId: 'sec-1' });
  });

  it('throws NotFoundException when the student has no active enrollment', async () => {
    prisma.enrollment.findFirst.mockResolvedValue(null);

    await expect(service.getCurrentEnrollment('s1')).rejects.toThrow(NotFoundException);
  });

  it('resolves the enrollment covering a given date, not the current one', async () => {
    prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-old', sectionId: 'sec-old' });
    const date = new Date('2026-08-01T00:00:00.000Z');

    const result = await service.getEnrollmentForDate('s1', date);

    expect(prisma.enrollment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId: 's1',
          startDate: { lte: date },
          OR: [{ endDate: null }, { endDate: { gte: date } }],
        },
      }),
    );
    expect(result).toEqual({ id: 'enr-old', sectionId: 'sec-old' });
  });

  it('throws NotFoundException when no enrollment covers the given date', async () => {
    prisma.enrollment.findFirst.mockResolvedValue(null);

    await expect(
      service.getEnrollmentForDate('s1', new Date('2020-01-01')),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend && npx jest src/enrollment/enrollment.service.spec.ts`
Expected: FAIL — `Cannot find module './enrollment.service'`.

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/enrollment/enrollment.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The one place every module resolves "what section/campus is this student in" — mirrors
 * StudentAccessService's role as a single shared read path, so this rule isn't re-implemented
 * (and re-broken) per module the way it was before Enrollment existed (Diary and Timetable each
 * read `student.sectionId` directly, which meant a mid-year section change silently rewrote what
 * a parent saw for past months).
 */
@Injectable()
export class EnrollmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrentEnrollment(studentId: string) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: { studentId, status: 'ACTIVE' },
      orderBy: { startDate: 'desc' },
    });
    if (!enrollment) {
      throw new NotFoundException('Student has no active enrollment');
    }
    return enrollment;
  }

  /**
   * Resolves which section a student belonged to as of a given date — NOT the student's current
   * section. Use for any month/date-scoped query (e.g. Diary) so a later section transfer doesn't
   * retroactively change what a past month shows.
   */
  async getEnrollmentForDate(studentId: string, date: Date) {
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentId,
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      },
      orderBy: { startDate: 'desc' },
    });
    if (!enrollment) {
      throw new NotFoundException('Student has no enrollment covering this date');
    }
    return enrollment;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/enrollment/enrollment.service.spec.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/enrollment
git commit -m "feat(enrollment): add shared EnrollmentService"
```

---

### Task 3: `DiaryService.getForStudent` — resolve section by date, not current placement

**Files:**
- Modify: `backend/src/diary/diary.service.ts:100-106`
- Modify: `backend/src/diary/diary.module.ts`
- Modify: `backend/src/diary/diary.service.spec.ts:96-105`

**Interfaces:**
- Consumes: `EnrollmentService.getEnrollmentForDate` (Task 2).

- [ ] **Step 1: Update the failing test** — replace the existing "resolves a student's own section" test (lines 96-105) so it exercises the new dependency instead of `prisma.student.findUnique`:

```typescript
// replace the `student: { findUnique: jest.Mock }` prisma mock and the enrollmentService mock:
let prisma: {
  diaryEntry: { upsert: jest.Mock; findMany: jest.Mock };
  diaryAttachment: { deleteMany: jest.Mock; createMany: jest.Mock };
  auditLog: { create: jest.Mock };
};
let enrollmentService: { getEnrollmentForDate: jest.Mock };

beforeEach(async () => {
  prisma = {
    diaryEntry: { upsert: jest.fn(), findMany: jest.fn() },
    diaryAttachment: { deleteMany: jest.fn(), createMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  enrollmentService = { getEnrollmentForDate: jest.fn() };
  const moduleRef = await Test.createTestingModule({
    providers: [
      DiaryService,
      { provide: PrismaService, useValue: prisma },
      { provide: EnrollmentService, useValue: enrollmentService },
    ],
  }).compile();
  service = moduleRef.get(DiaryService);
});

it("resolves the student's enrolled section as of the requested month before listing that section's entries", async () => {
  enrollmentService.getEnrollmentForDate.mockResolvedValue({ sectionId: 'sec-1' });
  prisma.diaryEntry.findMany.mockResolvedValue([]);

  await service.getForStudent('s1', '2026-08');

  expect(enrollmentService.getEnrollmentForDate).toHaveBeenCalledWith(
    's1',
    new Date('2026-08-01T00:00:00.000Z'),
  );
  expect(prisma.diaryEntry.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ sectionId: 'sec-1' }) }),
  );
});

it('propagates NotFoundException when the student has no enrollment covering that month', async () => {
  enrollmentService.getEnrollmentForDate.mockRejectedValue(new NotFoundException());
  await expect(service.getForStudent('s1', '2026-08')).rejects.toThrow(NotFoundException);
});
```

Remove the old "throws NotFoundException for an unknown student" test (lines 107-110) — that case is now `EnrollmentService`'s responsibility, already covered by Task 2's tests. Add the `EnrollmentService` import at the top of the spec file: `import { EnrollmentService } from '../enrollment/enrollment.service';`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/diary/diary.service.spec.ts`
Expected: FAIL — `service.getForStudent` still calls `this.prisma.student.findUnique`, which is `undefined` on the new mock shape.

- [ ] **Step 3: Update the implementation**

```typescript
// backend/src/diary/diary.service.ts — replace the existing getForStudent (lines 100-106)
async getForStudent(studentId: string, month: string): Promise<DiaryEntrySummary[]> {
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const enrollment = await this.enrollmentService.getEnrollmentForDate(studentId, monthStart);
  return this.getForSection(enrollment.sectionId, month);
}
```

Add the constructor dependency and import:

```typescript
import { EnrollmentService } from '../enrollment/enrollment.service';

@Injectable()
export class DiaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
  ) {}
  // ...
```

Remove the now-unused `NotFoundException` import only if nothing else in the file throws it — `createEntry` doesn't, but check before deleting the import line.

- [ ] **Step 4: Register `EnrollmentService` in `DiaryModule`**

```typescript
// backend/src/diary/diary.module.ts
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [DiaryService, StudentAccessService, EnrollmentService],
  controllers: [DiaryController],
})
export class DiaryModule {}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/diary/diary.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/diary
git commit -m "fix(diary): resolve section by enrollment-as-of-date, not current placement"
```

**Addendum (found during Task 7's full-suite checkpoint, not anticipated when this plan was written):** the `monthStart` reference date above breaks in the common case, not just an edge case. `EnrollmentService.getEnrollmentForDate` requires `enrollment.startDate <= date`; since a real enrollment's `startDate` is almost never literally the 1st of whatever month is later queried (it's session-start or enrollment-creation date), querying "this month" 404s whenever the student's enrollment began after the 1st — which is nearly always. Fixed by widening `getEnrollmentForDate` to an overlap-window query when the caller supplies an end date, and having `DiaryService.getForStudent` supply one:

```typescript
// backend/src/enrollment/enrollment.service.ts — getEnrollmentForDate, additive/backward-compatible
async getEnrollmentForDate(studentId: string, date: Date, windowEnd?: Date) {
  const enrollment = await this.prisma.enrollment.findFirst({
    where: {
      studentId,
      startDate: windowEnd ? { lt: windowEnd } : { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
    orderBy: { startDate: 'desc' },
  });
  if (!enrollment) {
    throw new NotFoundException('Student has no enrollment covering this date');
  }
  return enrollment;
}
```

```typescript
// backend/src/diary/diary.service.ts — getForStudent
async getForStudent(studentId: string, month: string): Promise<DiaryEntrySummary[]> {
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);
  const enrollment = await this.enrollmentService.getEnrollmentForDate(studentId, monthStart, monthEnd);
  return this.getForSection(enrollment.sectionId, month);
}
```

When `windowEnd` is omitted, the query is byte-identical to before (Task 2's tests need no changes). `getCurrentEnrollment`, `TimetableService`, `SectionsService`, and `CircularsService` are unaffected — none of them use `getEnrollmentForDate`.

---

### Task 4: `TimetableService.getForStudent` — resolve current section via `EnrollmentService`

**Files:**
- Modify: `backend/src/timetable/timetable.service.ts:20-32`
- Modify: `backend/src/timetable/timetable.module.ts`
- Modify: `backend/src/timetable/timetable.service.spec.ts:27-60`

**Interfaces:**
- Consumes: `EnrollmentService.getCurrentEnrollment` (Task 2) — timetable is "what's the schedule right now," not a dated historical record, so unlike Diary this uses the current-enrollment lookup, not the by-date one.

- [ ] **Step 1: Update the failing test**

```typescript
// backend/src/timetable/timetable.service.spec.ts
import { Test } from '@nestjs/testing';
import { TimetableService } from './timetable.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

describe('TimetableService', () => {
  let service: TimetableService;
  let prisma: { timetable: { findMany: jest.Mock; create: jest.Mock } };
  let enrollmentService: { getCurrentEnrollment: jest.Mock };

  beforeEach(async () => {
    prisma = { timetable: { findMany: jest.fn(), create: jest.fn() } };
    enrollmentService = { getCurrentEnrollment: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TimetableService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollmentService },
      ],
    }).compile();
    service = moduleRef.get(TimetableService);
  });

  it("returns the student's current-enrollment section timetable ordered by day then period", async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.timetable.findMany.mockResolvedValue([
      {
        id: 't1',
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        room: '3A',
        subject: { name: 'English' },
        teacher: { name: 'Ms. Sample' },
      },
    ]);

    const result = await service.getForStudent('s1');

    expect(enrollmentService.getCurrentEnrollment).toHaveBeenCalledWith('s1');
    expect(prisma.timetable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sectionId: 'sec-1' },
        orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({ subject: 'English', teacher: 'Ms. Sample', room: '3A' }),
    );
  });

  it('creates a timetable entry', async () => {
    prisma.timetable.create.mockResolvedValue({ id: 't2' });

    const dto = {
      sectionId: 'sec-1',
      subjectId: 'sub-1',
      dayOfWeek: 2,
      period: 1,
      startTime: '08:00',
      endTime: '08:40',
    };
    await service.createEntry(dto);

    expect(prisma.timetable.create).toHaveBeenCalledWith({ data: dto });
  });
});
```

(The old "throws NotFoundException for an unknown student" test is dropped — that's `EnrollmentService`'s responsibility now, covered in Task 2.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/timetable/timetable.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Update the implementation**

```typescript
// backend/src/timetable/timetable.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTimetableEntryDto } from './dto/create-timetable-entry.dto';
import { EnrollmentService } from '../enrollment/enrollment.service';

export interface TimetableEntrySummary {
  id: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string | null;
  room: string | null;
}

@Injectable()
export class TimetableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  async getForStudent(studentId: string): Promise<TimetableEntrySummary[]> {
    const enrollment = await this.enrollmentService.getCurrentEnrollment(studentId);

    const entries = await this.prisma.timetable.findMany({
      where: { sectionId: enrollment.sectionId },
      orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }],
      include: { subject: true, teacher: true },
    });

    return entries.map((e) => ({
      id: e.id,
      dayOfWeek: e.dayOfWeek,
      period: e.period,
      startTime: e.startTime,
      endTime: e.endTime,
      subject: e.subject.name,
      teacher: e.teacher?.name ?? null,
      room: e.room,
    }));
  }

  async createEntry(dto: CreateTimetableEntryDto) {
    return this.prisma.timetable.create({ data: dto });
  }
}
```

- [ ] **Step 4: Register `EnrollmentService` in `TimetableModule`**

```typescript
// backend/src/timetable/timetable.module.ts
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [TimetableService, StudentAccessService, EnrollmentService],
  controllers: [TimetableController],
})
export class TimetableModule {}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest src/timetable/timetable.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/timetable
git commit -m "fix(timetable): resolve section via EnrollmentService"
```

---

### Task 5: `SectionsService.getStudents` — roster via active `Enrollment`

**Files:**
- Modify: `backend/src/sections/sections.service.ts:29-35`
- Modify: `backend/src/sections/sections.service.spec.ts:47-60`

**Interfaces:**
- Consumes: `prisma.enrollment.findMany` directly (this is a section→students roster query, the inverse direction of `EnrollmentService`'s student→section lookups — no shared helper needed here, a direct Prisma query is simplest and matches the existing style of this service).

- [ ] **Step 1: Update the failing test**

```typescript
// backend/src/sections/sections.service.spec.ts — replace the 'lists students in a section' test
it('lists students with an active enrollment in a section, ordered by name', async () => {
  prisma.enrollment.findMany.mockResolvedValue([
    { student: { id: 's1', name: 'Eshaal', grNumber: 'GR-1001' } },
  ]);

  const result = await service.getStudents('sec-1');

  expect(prisma.enrollment.findMany).toHaveBeenCalledWith({
    where: { sectionId: 'sec-1', status: 'ACTIVE' },
    orderBy: { student: { name: 'asc' } },
    select: { student: { select: { id: true, name: true, grNumber: true } } },
  });
  expect(result).toEqual([{ id: 's1', name: 'Eshaal', grNumber: 'GR-1001' }]);
});
```

Update the `prisma` mock shape in `beforeEach` to `enrollment: { findMany: jest.fn() }` instead of `student: { findMany: jest.fn() }`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/sections/sections.service.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Update the implementation**

```typescript
// backend/src/sections/sections.service.ts
async getStudents(sectionId: string) {
  const rows = await this.prisma.enrollment.findMany({
    where: { sectionId, status: 'ACTIVE' },
    orderBy: { student: { name: 'asc' } },
    select: { student: { select: { id: true, name: true, grNumber: true } } },
  });
  return rows.map((r) => r.student);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/sections/sections.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/sections
git commit -m "fix(sections): resolve section roster via active Enrollment"
```

---

### Task 6: `CircularsService` — section-scoped recipient resolution via `Enrollment`

**Files:**
- Modify: `backend/src/circulars/circulars.service.ts:52-61`
- Modify: `backend/src/circulars/circulars.service.spec.ts:65-82`

**Interfaces:**
- Consumes: `prisma.user.findMany` with a nested `parentProfile.children` filter (same shape as today, just re-pointed at `Enrollment` instead of `Student.sectionId`).

- [ ] **Step 1: Update the failing test**

```typescript
// backend/src/circulars/circulars.service.spec.ts — replace the section-scoped publish test
it("publishing a section-scoped circular only reaches that section's currently-enrolled parents", async () => {
  prisma.circular.create.mockResolvedValue({ id: 'circ-2' });
  prisma.user.findMany.mockResolvedValue([{ id: 'parent-a' }]);

  await service.publish(
    { title: 'Trip', description: 'Field trip.', scope: 'section', sectionId: 'sec-1' },
    'admin-1',
  );

  expect(prisma.user.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        role: 'PARENT',
        parentProfile: {
          children: {
            some: {
              student: {
                enrollments: { some: { sectionId: 'sec-1', status: 'ACTIVE' } },
              },
            },
          },
        },
      }),
    }),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/circulars/circulars.service.spec.ts`
Expected: FAIL — the current query still filters on `student: { sectionId: dto.sectionId }`.

- [ ] **Step 3: Update the implementation**

```typescript
// backend/src/circulars/circulars.service.ts — replace lines 52-61
const recipients =
  dto.scope === 'school'
    ? await this.prisma.user.findMany({ where: { role: 'PARENT' }, select: { id: true } })
    : await this.prisma.user.findMany({
        where: {
          role: 'PARENT',
          parentProfile: {
            children: {
              some: {
                student: {
                  enrollments: { some: { sectionId: dto.sectionId, status: 'ACTIVE' } },
                },
              },
            },
          },
        },
        select: { id: true },
      });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/circulars/circulars.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/circulars
git commit -m "fix(circulars): resolve section-scoped recipients via active Enrollment"
```

---

### Task 7: `MeService.getChildrenForUser` — campus/class/section via active `Enrollment`

**Files:**
- Modify: `backend/src/me/me.service.ts`
- Modify: `backend/src/me/me.service.spec.ts`

**Interfaces:**
- Produces: `ChildSummary` shape is unchanged (`{ id, name, grNumber, campus, class, section }`) — only how it's resolved changes, so the Flutter parent app and staff console need no changes.

- [ ] **Step 1: Update the failing test** — the fixture shape changes (student's `enrollments` array instead of direct `campus`/`section`):

```typescript
// backend/src/me/me.service.spec.ts — replace the fixture in both passing tests
prisma.parentProfile.findUnique.mockResolvedValue({
  id: 'pp-1',
  children: [
    {
      student: {
        id: 's-1',
        name: 'Eshaal',
        grNumber: 'GR-1001',
        enrollments: [
          {
            campus: { id: 'c-1', name: 'Gulistan-e-Jauhar' },
            section: { id: 'sec-1', name: '3A', class: { id: 'cl-1', name: 'Grade 3' } },
          },
        ],
      },
    },
    {
      student: {
        id: 's-2',
        name: 'Ahmed',
        grNumber: 'GR-2002',
        enrollments: [
          {
            campus: { id: 'c-2', name: 'Gulshan-e-Iqbal' },
            section: { id: 'sec-2', name: '6B', class: { id: 'cl-2', name: 'Grade 6' } },
          },
        ],
      },
    },
  ],
});
```

(Apply the same fixture-shape change to the third test, "never leaks a child that is not linked to this parent" — it uses the same nested shape for its single child.) The assertions on `children[0]`/`children[1]` and the `prisma.parentProfile.findUnique` call shape stay the same — this is purely a fixture-shape change, output contract unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/me/me.service.spec.ts`
Expected: FAIL — `student.campus`/`student.section` are `undefined` in the mapping code with the new fixture shape.

- [ ] **Step 3: Update the implementation**

```typescript
// backend/src/me/me.service.ts
async getChildrenForUser(userId: string): Promise<ChildSummary[]> {
  const parentProfile = await this.prisma.parentProfile.findUnique({
    where: { userId },
    include: {
      children: {
        include: {
          student: {
            include: {
              enrollments: {
                where: { status: 'ACTIVE' },
                take: 1,
                include: { campus: true, section: { include: { class: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!parentProfile) {
    return [];
  }

  return parentProfile.children.map(({ student }) => {
    const enrollment = student.enrollments[0];
    return {
      id: student.id,
      name: student.name,
      grNumber: student.grNumber,
      campus: enrollment.campus.name,
      class: enrollment.section.class.name,
      section: enrollment.section.name,
    };
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/me/me.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Run the full backend unit + e2e suite** — this is the checkpoint for the whole Enrollment migration (Tasks 1-7):

```bash
cd backend
npm run lint
npx tsc --noEmit
npx jest
npm run test:e2e
```

Expected: all green. If `test:e2e` fails on fixture cleanup ordering, re-check Task 1 Steps 5-7 (student deletion must happen before school deletion in every `afterAll`, and in the stale-fixture self-healing blocks).

- [ ] **Step 6: Commit**

```bash
git add backend/src/me
git commit -m "fix(me): resolve child campus/class/section via active Enrollment"
```

---

### Task 8: Fee payments — `FeePaymentAllocation` (schema only, no service exists yet)

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `FeePayment` no longer has a direct `feeVoucherId`; `FeePaymentAllocation { feePaymentId, feeVoucherId, amount }` lets one payment cover multiple vouchers (or a partial amount of one). `FeeVoucher.amountPaid` is not a stored field in either the old or new schema — it was never persisted — so this task doesn't change how outstanding balance is computed today; it only removes the 1:1 constraint that would have made a correct computation impossible once `FEAT-012` is built.

There's no test step here: `FEAT-012` (Fees) is still `⏳ PENDING` per `PROJECT-STATUS.md` — no controller/service reads or writes `FeePayment` yet, so this is a pure schema change with no consumer to update or regression-test. Whoever implements `FEAT-012` builds against this shape from the start instead of the 1:1 one.

- [ ] **Step 1: Edit `schema.prisma`**

```prisma
model FeeVoucher {
  id                String   @id @default(uuid())
  studentId         String
  student           Student  @relation(fields: [studentId], references: [id], onDelete: Restrict)
  academicSessionId String
  academicSession   AcademicSession @relation(fields: [academicSessionId], references: [id])
  month             String
  issueDate         DateTime
  dueDate           DateTime
  items       FeeItem[]
  allocations FeePaymentAllocation[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([studentId])
}

model FeePayment {
  id          String     @id @default(uuid())
  amount      Int        // paisa
  method      String     // "jazzcash" | "easypaisa" | "manual"
  status      String     // "pending" | "completed" | "failed"
  reference   String?    @unique // gateway transaction id — lets a retried webhook be a no-op instead of a duplicate payment
  allocations FeePaymentAllocation[]
  receipt     Receipt?
  createdAt   DateTime   @default(now())
}

model FeePaymentAllocation {
  id           String     @id @default(uuid())
  feePaymentId String
  feePayment   FeePayment @relation(fields: [feePaymentId], references: [id], onDelete: Restrict)
  feeVoucherId String
  feeVoucher   FeeVoucher @relation(fields: [feeVoucherId], references: [id], onDelete: Restrict)
  amount       Int        // paisa — this payment's contribution to this voucher; sum per voucher = amount paid toward it
  createdAt    DateTime   @default(now())

  @@unique([feePaymentId, feeVoucherId])
  @@index([feeVoucherId])
}
```

(`FeeItem` and `Receipt` are unchanged — `Receipt.feePaymentId` still points at `FeePayment` 1:1, that relationship was never the problem.)

- [ ] **Step 2: Regenerate the migration**

```bash
cd backend
npx prisma migrate dev --name fee_payment_allocation
npx prisma generate
```

Expected: a new migration is created; no data-loss prompt (no `FeePayment`/`FeeVoucher` rows exist in `dev.db` yet, since `seed.ts` never creates any and `FEAT-012` isn't built).

- [ ] **Step 3: Confirm the app still boots**

```bash
npm run start:dev
```

Expected: no Prisma client errors on startup (nothing references the old `FeePayment.feeVoucherId` field). Stop the server once confirmed.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(schema): fee payments allocate across vouchers instead of a 1:1 tie"
```

---

### Task 9: Cascade-delete hardening on historical records

**Files:**
- Modify: `backend/prisma/schema.prisma`

**Interfaces:**
- Produces: `Student → Attendance`, `Student → FeeVoucher`, `Student → LeaveRequest` become `onDelete: Restrict` instead of `Cascade`. Scope is deliberately limited to these three — `Section/Class/Campus` cascading into `Timetable/DiaryEntry/Circular` is a separate, lower-urgency concern (those aren't financial/attendance-compliance records) and is out of scope for this plan to avoid scope creep; note it as a follow-up in Task 10's `PROJECT-STATUS.md` entry instead.

- [ ] **Step 1: Edit `schema.prisma`** — change the `onDelete` clause on three relations:

```prisma
model Attendance {
  id           String           @id @default(uuid())
  studentId    String
  student      Student          @relation(fields: [studentId], references: [id], onDelete: Restrict)
  // ...unchanged below
}

model FeeVoucher {
  id                String   @id @default(uuid())
  studentId         String
  student           Student  @relation(fields: [studentId], references: [id], onDelete: Restrict)
  // ...unchanged below (already set to Restrict in Task 8 — if Task 8 landed first, this is a no-op; if this task lands first, Task 8's snippet above already shows Restrict too, so apply whichever change is still pending)
}

model LeaveRequest {
  id        String   @id @default(uuid())
  studentId String
  student   Student  @relation(fields: [studentId], references: [id], onDelete: Restrict)
  // ...unchanged below
}
```

- [ ] **Step 2: Regenerate the migration**

```bash
cd backend
npx prisma migrate dev --name restrict_student_history_deletes
npx prisma generate
```

- [ ] **Step 3: Add a regression test proving the restriction holds** — create a focused Prisma-level test rather than going through a service (no `Student` delete endpoint exists in any controller today, so there's no service method to unit-test; this proves the database constraint itself):

```typescript
// backend/test/cascade-delete-restrictions.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Historical-record delete restrictions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let studentId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    const school = await prisma.school.create({ data: { name: 'CDR E2E School' } });
    const campus = await prisma.campus.create({ data: { schoolId: school.id, name: 'Main' } });
    const session = await prisma.academicSession.create({
      data: { label: 'CDR', startDate: new Date(), endDate: new Date(), isActive: true },
    });
    const klass = await prisma.class.create({
      data: { campusId: campus.id, academicSessionId: session.id, name: 'CDR Grade' },
    });
    const section = await prisma.section.create({ data: { classId: klass.id, name: 'CDR-A' } });
    const teacherUser = await prisma.user.create({
      data: { identifier: 'cdr-teacher@schoolos.edu.pk', passwordHash: 'x', role: 'TEACHER' },
    });
    const teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'CDR Teacher' },
    });
    const student = await prisma.student.create({ data: { grNumber: 'CDR-1', name: 'CDR Student' } });
    studentId = student.id;
    await prisma.enrollment.create({
      data: {
        studentId,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.attendance.create({
      data: { studentId, date: new Date(), status: 'PRESENT', markedById: teacher.id },
    });
  });

  afterAll(async () => {
    await prisma.attendance.deleteMany({ where: { studentId } }).catch(() => undefined);
    await prisma.student.deleteMany({ where: { id: studentId } }).catch(() => undefined);
    await prisma.school.deleteMany({ where: { name: 'CDR E2E School' } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { identifier: 'cdr-teacher@schoolos.edu.pk' } }).catch(() => undefined);
    await app.close();
  });

  it('refuses to delete a student with attendance history instead of silently wiping it', async () => {
    await expect(prisma.student.delete({ where: { id: studentId } })).rejects.toThrow();

    const stillThere = await prisma.attendance.findFirst({ where: { studentId } });
    expect(stillThere).not.toBeNull();
  });
});
```

- [ ] **Step 4: Run it to verify it passes against the new schema**

Run: `cd backend && npm run test:e2e -- cascade-delete-restrictions`
Expected: PASS. (Before Step 1's schema edit, this test would fail — the delete would succeed and silently cascade away the attendance row. Confirm that by checking it out against the pre-Task-9 schema if you want to see the red state; not required to proceed.)

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/test/cascade-delete-restrictions.e2e-spec.ts
git commit -m "fix(schema): restrict (don't cascade) deletes of students with attendance/fee/leave history"
```

---

### Task 10: Update `PROJECT-STATUS.md` and `FEATURES.txt`

**Files:**
- Modify: `build/PROJECT-STATUS.md`
- Modify: `plan/docs/FEATURES.txt`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Insert a new sprint entry into `PROJECT-STATUS.md`** between the existing "Sprint 5-6 — Diary + Circulars ✅ DONE" section and "Sprint 7-8 — Messages + Notifications 🔜 NEXT":

```markdown
## Sprint 6.5 — Data Model Correction ✅ DONE

- [x] Added `Enrollment` (student ↔ campus/section/academic-session, dated) — replaces
      `Student.campusId`/`sectionId` direct fields. Fixes a real bug: `Diary`/`Timetable`/`Sections`/
      `Circulars`/`Me` all resolved a student's section by reading the *current* placement, so a
      mid-year section transfer would have silently rewritten what a parent saw for past months
      (most visibly in Diary's month view). New shared `EnrollmentService` (same pattern as
      `StudentAccessService`) is now the one place every module resolves this.
- [x] `FeePayment` now allocates across vouchers via `FeePaymentAllocation` instead of a 1:1
      `feeVoucherId` tie — done ahead of `FEAT-012` (Fees, not yet built) so that feature isn't
      built against a shape that can't represent a lump-sum or partial payment.
- [x] `Student → Attendance/FeeVoucher/LeaveRequest` changed from `onDelete: Cascade` to
      `Restrict` — deleting a student can no longer silently wipe their attendance/fee/leave
      history.
- Scope note: did **not** adopt multi-tenancy/RLS or a full accounting ledger
  (Invoice/Refund/Reconciliation) — this project is a single-school platform per
  `docs/Seedsapk/MVP-Plan-V3.md`, not multi-tenant SaaS; see
  `docs/Plan-Ideas/Feature-Chatgpt-CodeValidateFEAT5-6.txt` for the full analysis this sprint
  addresses (and what it deliberately doesn't).
- Follow-up (tracked, not blocking): `Section/Class/Campus → Timetable/DiaryEntry/Circular` are
  still `onDelete: Cascade` — lower urgency than the financial/attendance-compliance tables fixed
  here, revisit before a second school/campus is onboarded. `StudentAccessService`'s staff-role
  free-pass (any `TEACHER`/`SCHOOL_ADMIN`/`ACCOUNTS`/`SUPER_ADMIN` can access any student) is
  unchanged — fine for one campus's staff, worth scoping if multi-campus staff restriction becomes
  a real need.
```

- [ ] **Step 2: Update the "Next step" line at the bottom of `PROJECT-STATUS.md`** to point at Sprint 7-8 again (unchanged target, just confirming it's next after 6.5):

```markdown
**Next step:** Sprint 7-8 — FEAT-010 (Messages, scoped inbox) + FEAT-011 (Notifications, FCM wiring
+ deep links), backend API through both clients, same TDD rigor as Sprints 1-6.5.
```

- [ ] **Step 3: Add a one-line note under `FEAT-012` in `plan/docs/FEATURES.txt`** referencing the allocation model landed in Task 8:

```
### FEAT-012 — Fees
Domain: data,ui,mobile,payments  Complexity: L  Dependencies: FEAT-001,FEAT-004,FEAT-005
Description: Server-computed voucher, PDF generation, JazzCash/EasyPaisa in-app payment, payment
history/receipts. Never trust client-computed totals.
Note: build against FeePayment/FeePaymentAllocation (Sprint 6.5) — a payment can span multiple
vouchers; a voucher's amount paid is the sum of its allocations, not a stored field.
```

- [ ] **Step 4: Commit**

```bash
git add build/PROJECT-STATUS.md plan/docs/FEATURES.txt
git commit -m "docs: record Sprint 6.5 data-model correction"
```

---

## Self-Review

**Spec coverage** — against `docs/Plan-Ideas/Feature-Chatgpt-CodeValidateFEAT5-6.txt`'s "Critical" list (§37): Tenant architecture — explicitly excluded (confirmed out of scope, not a gap); Enrollment/history — Tasks 1-7; Authorization scopes — explicitly deferred (StudentAccessService free-pass noted as a documented follow-up, not silently dropped); PostgreSQL + RLS — explicitly excluded (RLS is a tenancy mechanism; Postgres-vs-SQLite is a separate, already-tracked `PROJECT-STATUS.md` item, not part of this plan); Finance domain — Task 8; Circular/Diary targeting — Task 6 (Circular) and Task 3 (Diary); Dangerous cascading deletes — Task 9.

**Placeholder scan** — every step has real code, no "TBD"/"similar to Task N."

**Type consistency** — `EnrollmentService.getCurrentEnrollment`/`getEnrollmentForDate` signatures match between Task 2's definition and every call site in Tasks 3, 4 (Task 5 and Task 6 query `prisma.enrollment` directly rather than through the service, noted explicitly in each task's Interfaces block — a section→students roster query and a section→parents fan-out query are the inverse direction of what `EnrollmentService` resolves, so a direct Prisma call is the right level, not a missing dependency; Task 7 also queries `prisma.enrollment` directly, via a nested `include`, rather than calling `EnrollmentService` — the same "not a missing dependency" reasoning applies).

---

**Plan complete and saved to `plan/docs/DATA-MODEL-CORRECTION-PLAN.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
