# Sprint C — Attendance & Access Bug Fixes + Verification Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Admin/Super-Admin attendance-marking bug, close a real gap in Messaging's
parent-isolation test coverage found while verifying it, and fix a fee-voucher due-date
off-by-one bug discovered during this same verification pass.

**Architecture:** Three independent, backend-only fixes in the existing NestJS app — no new
modules, no client-facing (staff-console/parent-app) changes. Task 1 (attendance) reuses the
exact class-teacher-attribution pattern `LeaveService.approve()` already established for the
identical `Attendance.markedById` FK constraint. Task 2 (messaging scoping) adds one missing e2e
test — no production code change, because the code already does the right thing; this task exists
to *prove* it (the roadmap's own reasoning for why this is a "verification pass," not assumed-safe
code). Task 3 (fee-voucher status) is a one-line date-comparison fix. All three can be done in any
order — none depends on another.

**Tech Stack:** NestJS 11, Prisma (Postgres, driver-adapter mode — see Sprint B), Jest (unit + e2e
via supertest).

**Spec:** `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` §4 "Sprint C — Attendance &
Access Bug Fixes + Verification Pass" (line ~321) and `build/PROJECT-STATUS.md`'s "Sprint C" section
(records what's already been found/fixed vs. still open as of 2026-09-10).

## Global Constraints

- All new/changed backend behavior needs a passing unit or e2e test — matches every prior sprint's
  bar (see `build/PROJECT-STATUS.md` "Verified:" lines).
- Run `cd backend && npm run build` (type-check) and `npm test` after every task — `ts-jest` runs
  with `isolatedModules: true`, so `tsc` catches type errors `jest` alone won't.
- Match existing code style: services throw `BadRequestException`/`NotFoundException` from
  `@nestjs/common`; every write that changes data gets an `AuditLog` row (see
  `AttendanceService.markAttendance`'s existing audit-log write, unchanged by Task 1).
- **Already done, not part of this plan (see `build/PROJECT-STATUS.md`'s Sprint C section):** the
  Circulars nav-role bug (`AppShell.vue`'s `isAdmin` condition) was already fixed by the 2026-09-07
  Staff Console Shell Redesign's `canManageCirculars` computed — confirmed by reading
  `staff-console/src/components/AppShell.vue:16-24,374`, no new work needed. The parent-app login
  CORS gap found while starting this sprint (Flutter web preview's dev port wasn't in the
  CORS_ORIGINS allow-list) is already fixed and verified (`backend/src/config/cors.config.ts`'s
  `buildCorsOriginOption`), unrelated to the three tasks below.
- **Environment note:** local dev now requires a reachable Postgres instance (Sprint B) — the
  e2e steps below assume `backend/.env`'s `DATABASE_URL` already points at one and
  `npx prisma migrate deploy` has been run.

---

### Task 1: Fix the Admin/Super-Admin attendance-marking bug

**Context:** `AttendanceController.markAttendance` is guarded by
`@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')`, but `AttendanceService.markAttendance`
(`backend/src/attendance/attendance.service.ts:28-34`) unconditionally requires a `Teacher` row
for the acting user (`Attendance.markedById` is a required FK to `Teacher.id`, not `User.id` —
`backend/prisma/schema.prisma:268-269`) and throws `NotFoundException` if none exists. A
`SCHOOL_ADMIN`/`SUPER_ADMIN` account has no `Teacher` profile, so despite being authorized by the
role guard, they get a 404 the moment they try — the exact bug named in the roadmap (Gap Analysis
Critical #4). This project already solved the identical FK problem once:
`LeaveService.approve()` (`backend/src/leave/leave.service.ts:68-98`) attributes an admin-approved
leave's resulting `Attendance` rows to the student's section's `classTeacherId` instead of the
acting admin, because the admin has no `Teacher` row of their own. This task applies the same
pattern to `markAttendance`.

**Files:**
- Modify: `backend/src/attendance/attendance.service.ts`
- Modify: `backend/src/attendance/attendance.module.ts`
- Test: `backend/src/attendance/attendance.service.spec.ts`
- Test: `backend/test/timetable-attendance.e2e-spec.ts`

**Interfaces:**
- Consumes: `EnrollmentService.getCurrentEnrollment(studentId: string): Promise<Enrollment>` (throws
  `NotFoundException` if none) — already exported from `backend/src/enrollment/enrollment.service.ts`,
  already used the same way by `LeaveService`.
- Produces: nothing new — `AttendanceService.markAttendance`'s signature and return shape are
  unchanged; only its internal resolution of `markedById` changes.

- [ ] **Step 1: Write the failing unit tests**

In `backend/src/attendance/attendance.service.spec.ts`, replace the imports at the top and the
`prisma` mock shape:

```typescript
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let prisma: {
    teacher: { findUnique: jest.Mock };
    section: { findUnique: jest.Mock };
    attendance: { upsert: jest.Mock; findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let enrollmentService: { getCurrentEnrollment: jest.Mock };

  beforeEach(async () => {
    prisma = {
      teacher: { findUnique: jest.fn() },
      section: { findUnique: jest.fn() },
      attendance: { upsert: jest.fn(), findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    enrollmentService = { getCurrentEnrollment: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollmentService },
      ],
    }).compile();
    service = moduleRef.get(AttendanceService);
  });
```

Then replace the existing `it('throws NotFoundException if the marking user has no Teacher
profile', ...)` test (this behavior is intentionally changing) with these two:

```typescript
  it('an Admin/Super-Admin with no Teacher profile marks attendance attributed to the section class teacher', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: 'teacher-9' });
    prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });

    await service.markAttendance(
      { studentId: 's1', date: '2026-08-27', status: 'ABSENT' },
      'admin-user-1',
    );

    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ markedById: 'teacher-9' }),
        update: expect.objectContaining({ markedById: 'teacher-9' }),
      }),
    );
    // The audit log still names the acting admin, not the class teacher stand-in.
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'admin-user-1' }) }),
    );
  });

  it('throws BadRequestException if the acting user has no Teacher profile and the section has no class teacher either', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: null });

    await expect(
      service.markAttendance(
        { studentId: 's1', date: '2026-08-27', status: 'PRESENT' },
        'admin-user-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/attendance/attendance.service.spec.ts`
Expected: FAIL — today's code still throws `NotFoundException` unconditionally when
`teacher.findUnique` returns `null`, and `EnrollmentService`/`section.findUnique` are never called.

- [ ] **Step 3: Implement the fix**

Replace `backend/src/attendance/attendance.service.ts` in full:

```typescript
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';

export interface AttendanceDay {
  date: string;
  status: string;
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  holiday: number;
  leave: number;
  attendancePercentage: number;
}

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
  ) {}

  /**
   * Attendance is immutable from the parent side by construction — this is the ONLY write path,
   * and it lives behind the `@Roles('TEACHER','SCHOOL_ADMIN','SUPER_ADMIN')` guard on the
   * controller, never exposed to PARENT. Every write is audit-logged (never skippable).
   *
   * `Attendance.markedById` is a required Teacher FK. A TEACHER has a Teacher profile and is
   * attributed directly; a SCHOOL_ADMIN/SUPER_ADMIN doesn't, so — mirroring
   * LeaveService.approve()'s identical problem for admin-approved leave — the write is attributed
   * to the student's current section's class teacher instead. The AuditLog row still names the
   * real acting user (markingUserId), regardless of whose Teacher id the FK points at.
   */
  async markAttendance(dto: MarkAttendanceDto, markingUserId: string) {
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId: markingUserId },
    });
    const markedById = teacher ? teacher.id : await this.resolveClassTeacherId(dto.studentId);

    const date = new Date(dto.date);
    const record = await this.prisma.attendance.upsert({
      where: { studentId_date: { studentId: dto.studentId, date } },
      create: {
        studentId: dto.studentId,
        date,
        status: dto.status,
        markedById,
      },
      update: { status: dto.status, markedById },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: markingUserId,
        action: 'attendance.mark',
        entity: 'Attendance',
        entityId: record.id,
        metadata: JSON.stringify({
          studentId: dto.studentId,
          date: dto.date,
          status: dto.status,
        }),
      },
    });

    return record;
  }

  private async resolveClassTeacherId(studentId: string): Promise<string> {
    const enrollment = await this.enrollmentService.getCurrentEnrollment(studentId);
    const section = await this.prisma.section.findUnique({ where: { id: enrollment.sectionId } });
    if (!section?.classTeacherId) {
      throw new BadRequestException(
        "Cannot mark attendance: this student's section has no class teacher assigned",
      );
    }
    return section.classTeacherId;
  }

  /**
   * Pre-populates the teacher's roster with whatever was already marked for this section on the
   * given date — without this, a teacher who re-opens the Attendance screen (or logs back in)
   * sees a blank roster and has to re-mark everyone, even though their earlier marks are already
   * saved (markAttendance upserts, so nothing was lost — it just was never shown back).
   */
  async getForSection(sectionId: string, dateStr: string): Promise<Record<string, string>> {
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const records = await this.prisma.attendance.findMany({
      where: { date, student: { enrollments: { some: { sectionId, status: 'ACTIVE' } } } },
      select: { studentId: true, status: true },
    });
    return Object.fromEntries(records.map((r) => [r.studentId, r.status]));
  }

  async getForStudent(
    studentId: string,
    month: string,
  ): Promise<{ days: AttendanceDay[]; summary: AttendanceSummary }> {
    const start = new Date(`${month}-01T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);

    const records = await this.prisma.attendance.findMany({
      where: { studentId, date: { gte: start, lt: end } },
      orderBy: { date: 'asc' },
    });

    const summary: AttendanceSummary = {
      present: 0,
      absent: 0,
      late: 0,
      holiday: 0,
      leave: 0,
      attendancePercentage: 0,
    };

    for (const r of records) {
      switch (r.status) {
        case 'PRESENT':
          summary.present++;
          break;
        case 'ABSENT':
          summary.absent++;
          break;
        case 'LATE':
          summary.late++;
          break;
        case 'HOLIDAY':
          summary.holiday++;
          break;
        case 'LEAVE':
          summary.leave++;
          break;
      }
    }

    const countable =
      summary.present + summary.absent + summary.late + summary.leave;
    summary.attendancePercentage =
      countable === 0 ? 0 : Math.round((summary.present / countable) * 100);

    return {
      days: records.map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        status: r.status,
      })),
      summary,
    };
  }
}
```

Then, in `backend/src/attendance/attendance.module.ts`, add `EnrollmentService` as a provider
(mirrors `LeaveModule`'s identical wiring):

```typescript
import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [AttendanceService, StudentAccessService, EnrollmentService],
  controllers: [AttendanceController],
})
export class AttendanceModule {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/attendance/attendance.service.spec.ts`
Expected: PASS (6 tests — the 4 pre-existing ones untouched, plus the 2 new ones from Step 1).

- [ ] **Step 5: Write the failing e2e test**

In `backend/test/timetable-attendance.e2e-spec.ts`, add an admin user in `beforeAll`. Find this
block:

```typescript
    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'tta-teacher@seeds.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    const teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'TTA Teacher' },
    });
```

and add immediately after it:

```typescript
    await prisma.user.create({
      data: {
        identifier: 'tta-admin@seeds.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
      },
    });
```

(Not bound to a variable — nothing downstream needs its id, only its identifier string for login.)

Update the top-of-`beforeAll` self-healing cleanup's identifier prefix match — it already matches
`tta-` as a prefix (`where: { identifier: { startsWith: 'tta-' } }`), so `tta-admin@seeds.edu.pk`
is automatically covered; no change needed there. Update the `afterAll` user cleanup list to
include it:

```typescript
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: [
              'tta-teacher@seeds.edu.pk',
              'tta-admin@seeds.edu.pk',
              'tta-parent-a@seeds.edu.pk',
              'tta-parent-b@seeds.edu.pk',
            ],
          },
        },
      })
      .catch(() => undefined);
```

Also add `teacher: teacher.id` to the `Object.assign(ids, { childA: childA.id, childB: childB.id,
section: section.id });` call further down in `beforeAll` (becomes
`Object.assign(ids, { childA: childA.id, childB: childB.id, section: section.id, teacher:
teacher.id });`) — `teacher` (the `Teacher` row) is declared `const` inside `beforeAll`'s own
function body, so unlike `ids` (declared at the `describe`-block level specifically so it can be
shared) it is **not** visible from an `it(...)` callback; route it through `ids` like every other
cross-scope value in this file.

Then add this new test, right after the existing `'a teacher can mark attendance, and it is then
visible to the linked parent'` test:

```typescript
  it('an Admin can also mark attendance (no Teacher profile of their own) — attributed to the section class teacher', async () => {
    await prisma.section.update({
      where: { id: ids.section },
      data: { classTeacherId: ids.teacher },
    });

    const adminToken = await loginAs('tta-admin@seeds.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentId: ids.childB, date: today, status: 'PRESENT' })
      .expect(201);

    const parentToken = await loginAs('tta-parent-b@seeds.edu.pk');
    const month = today.slice(0, 7);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childB}/attendance?month=${month}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    expect(res.body.days).toEqual(
      expect.arrayContaining([{ date: today, status: 'PRESENT' }]),
    );
  });
```

This test uses `ids.childB`/`tta-parent-b` (not `childA`/`parent-a`, already used by the
teacher-marks-attendance test above it) so the two tests don't share mutable state.

- [ ] **Step 6: Run the e2e test to verify it fails, then passes**

Run: `cd backend && npx jest --config test/jest-e2e.json timetable-attendance.e2e-spec.ts`
Expected before Step 3's fix: FAIL with a 404 on the `POST /api/v1/attendance` call. After Step 3:
PASS (all tests in the file, including this new one).

- [ ] **Step 7: Run the full backend suite to confirm no regression**

Run: `cd backend && npm run build && npm test && npm run test:e2e`
Expected: all PASS. (`fees.e2e-spec.ts`'s one pre-existing date-boundary failure, fixed by Task 3
below, is unrelated to this task — if Task 3 hasn't been done yet in your execution order, that
one failure is expected and is not a regression from this task.)

- [ ] **Step 8: Commit**

```bash
git add backend/src/attendance/attendance.service.ts backend/src/attendance/attendance.module.ts backend/src/attendance/attendance.service.spec.ts backend/test/timetable-attendance.e2e-spec.ts
git commit -m "fix: let Admin/Super-Admin mark attendance via class-teacher attribution, mirroring LeaveService"
```

---

### Task 2: Verify Fees/Messaging scoping — close the one real gap found

**Context:** The roadmap calls for verifying that Fees and Messaging enforce the same
parent-isolation rigor already proven on Attendance/Diary — "must be checked, not assumed"
(`docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` §0). Reading both modules:

- **Fees** (`backend/src/fees/fees.controller.ts`) already calls
  `StudentAccessService.assertCanAccessStudent` on every parent-facing read (voucher list, payment
  list, PDF downloads), and `backend/test/fees.e2e-spec.ts` already has a passing e2e test proving
  a parent gets 403 reading another parent's child's fees. No gap found here — nothing to fix,
  this task's verification step just re-confirms it (see Step 3 below).
- **Messaging** (`backend/src/messages/conversations.service.ts`) already scopes `getById`/
  `reply`/`markRead` to the conversation's exact two parties, and
  `backend/test/messages-notifications.e2e-spec.ts` already has a passing e2e test proving a
  non-party parent/teacher gets 403 reading/replying. **But** `ConversationsService.create()`
  (line 42-45) also calls `assertCanAccessStudent` — for the `CLASS_TEACHER` recipient type, using
  the caller-supplied `dto.studentId` — and **no test exercises what happens when a parent supplies
  another parent's child's `studentId`**. This is exactly the kind of "looked confirmed but wasn't"
  gap the roadmap is written to catch (§14, Question 1, item 6). This task adds that missing test.

**Files:**
- Test: `backend/test/messages-notifications.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing new — this task adds a test against the existing
  `POST /api/v1/conversations` endpoint and existing `StudentAccessService.assertCanAccessStudent`
  behavior.
- Produces: nothing new.

- [ ] **Step 1: Add a real "other parent's own child" fixture**

`mn-other-parent@seeds.edu.pk` (created in `beforeAll`, used as the non-party parent at line ~201)
currently has **no child of their own** in this fixture — it has no `ParentProfile` and no
`Student` linked to it at all; it's only ever used to prove it *can't* access `mn-parent`'s
existing conversation. The `orphanChild` fixture (`ids.orphanChildId`) is a red herring for this
task — it belongs to `mn-parent`'s own `parentProfile` (line 133), not to `mn-other-parent`; it
exists only for the pre-existing "no class teacher assigned" 400 test. This step adds a genuine
second-parent-owned child.

In `backend/test/messages-notifications.e2e-spec.ts`, find this block in `beforeAll` (right after
`orphanChild`'s `studentParent` link and `ids.orphanChildId = orphanChild.id;`):

```typescript
    ids.orphanChildId = orphanChild.id;
  });
```

Replace it with:

```typescript
    ids.orphanChildId = orphanChild.id;

    const otherParentProfile = await prisma.parentProfile.create({
      data: { userId: otherParentUser.id, name: 'MN Other Parent' },
    });
    const otherChild = await prisma.student.create({ data: { grNumber: 'MN-3', name: 'MN Other Child' } });
    await prisma.enrollment.create({
      data: {
        studentId: otherChild.id,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.studentParent.create({
      data: { studentId: otherChild.id, parentProfileId: otherParentProfile.id },
    });
    ids.otherChildId = otherChild.id;
  });
```

(`otherParentUser`, `campus`, `section`, and `session` are all already in scope in this same
`beforeAll` closure — no new top-level variables needed beyond `otherParentProfile`/`otherChild`.)

Then update the two `grNumber`-based cleanup lists so this new student is cleared like the others.
In `beforeAll`'s pre-flight cleanup, `grNumber: { startsWith: 'MN-' }` already matches `'MN-3'` —
no change needed there. In `afterAll`, find:

```typescript
    await prisma.student.deleteMany({ where: { grNumber: { in: ['MN-1', 'MN-2'] } } }).catch(() => undefined);
```

and change it to:

```typescript
    await prisma.student.deleteMany({ where: { grNumber: { in: ['MN-1', 'MN-2', 'MN-3'] } } }).catch(() => undefined);
```

- [ ] **Step 2: Write the failing e2e test**

Add this test to `backend/test/messages-notifications.e2e-spec.ts`, in the same `describe` block,
right after the existing `'another parent and another teacher cannot read or reply to this
conversation'` test:

```typescript
  it("a parent cannot start a CLASS_TEACHER conversation using another parent's child's studentId", async () => {
    const parentToken = await loginAs('mn-parent@seeds.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ recipientType: 'CLASS_TEACHER', studentId: ids.otherChildId, body: 'Not my child' })
      .expect(403);
  });
```

- [ ] **Step 3: Run the test**

Run: `cd backend && npx jest --config test/jest-e2e.json messages-notifications.e2e-spec.ts`
Expected: PASS immediately — `ConversationsService.create()` already calls
`assertCanAccessStudent` before resolving a `CLASS_TEACHER` recipient (line 42-45 of
`conversations.service.ts`), so this test passing on the first run is the actual verification
outcome: the scoping rigor already exists, it just had no test proving it. If it unexpectedly
FAILs, that is a real, previously-undetected scoping bug — stop and investigate
`ConversationsService.create()`/`resolveStaffUserId()` rather than assuming the test is wrong.

- [ ] **Step 4: Re-run the Fees e2e suite as the other half of this verification pass**

Run: `cd backend && npx jest --config test/jest-e2e.json fees.e2e-spec.ts`
Expected: PASS on every test except (if Task 3 below hasn't been done yet) the one date-boundary
failure Task 3 fixes — that failure is a real bug (see Task 3), but it is a *status-computation*
bug, not a scoping bug; the cross-parent-403 assertions in this same file (lines 170-179, 182-189)
already passing is the Fees half of this task's verification. No new Fees test is needed — this
step is a confirmation, not new code.

- [ ] **Step 5: Commit**

```bash
git add backend/test/messages-notifications.e2e-spec.ts
git commit -m "test: verify a parent can't start a CLASS_TEACHER conversation via another parent's child"
```

---

### Task 3: Fix the fee-voucher due-date status off-by-one

**Context:** Found while running the full e2e suite during this session's verification pass (not
originally in the roadmap's Sprint C scope). `FeeVouchersService.toSummary()`
(`backend/src/fees/fee-vouchers.service.ts:128`) computes `status = 'overdue'` from
`voucher.dueDate < new Date()`. `dueDate` is stored as a plain date (midnight UTC on the due day);
`new Date()` is the current instant, which is later in the day than midnight the moment the due
date arrives — so a voucher due *today* already reads `overdue` from 00:00:01 onward, not once the
due date has actually passed. `backend/test/fees.e2e-spec.ts`'s existing test (line 143, `dueDate:
'2026-09-10'`) fails whenever run on 2026-09-10 itself, expecting `status: 'unpaid'` and getting
`'overdue'`. Fix: compare against the start of *today* (midnight), not the current instant, so a
voucher stays `unpaid` through its entire due date and only becomes `overdue` the day after.

**Files:**
- Modify: `backend/src/fees/fee-vouchers.service.ts`
- Test: `backend/src/fees/fee-vouchers.service.spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — `toSummary`'s signature and `VoucherSummary` shape are unchanged; only
  the `status` value it computes for a same-day-due voucher changes.

- [ ] **Step 1: Write the failing unit test**

In `backend/src/fees/fee-vouchers.service.spec.ts`, find the existing
`it('getForStudent computes amountDue and status from items minus allocations', ...)` test (around
line 86) and add this new test right after it, in the same `describe` block:

```typescript
  it('a voucher due today is unpaid, not overdue (status flips the day AFTER the due date, not on it)', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    prisma.feeVoucher.findMany.mockResolvedValue([
      {
        id: 'v-today',
        studentId: 's1',
        month: '2026-09',
        dueDate: today,
        items: [{ label: 'Tuition Fee', amount: 500000 }],
        allocations: [],
      },
    ]);

    const result = await service.getForStudent('s1', '2026-09');

    expect(result[0]).toEqual(
      expect.objectContaining({ amountPaid: 0, amountDue: 500000, status: 'unpaid' }),
    );
  });
```

(This sits alongside the existing `dueDate: new Date('2020-01-01')` "long past — overdue" test in
the same `it` block above it — that test's assertion (`status: 'overdue'`) is unaffected by this
fix and must keep passing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/fees/fee-vouchers.service.spec.ts`
Expected: FAIL — today's code compares against `new Date()` (the current instant, always later in
the day than midnight), so a voucher due at today's midnight already reads `'overdue'`.

- [ ] **Step 3: Implement the fix**

In `backend/src/fees/fee-vouchers.service.ts`, replace the `toSummary` method's status
computation:

```typescript
  private toSummary(
    voucher: {
      id: string;
      studentId: string;
      month: string;
      dueDate: Date;
      items: Array<{ label: string; amount: number }>;
    },
    amountPaid: number,
  ): VoucherSummary {
    const totalAmount = voucher.items.reduce((sum, i) => sum + i.amount, 0);
    const amountDue = totalAmount - amountPaid;
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    let status: VoucherSummary['status'];
    if (amountDue <= 0) status = 'paid';
    else if (amountPaid > 0) status = 'partial';
    else if (voucher.dueDate < startOfToday) status = 'overdue';
    else status = 'unpaid';
    return {
      id: voucher.id,
      studentId: voucher.studentId,
      month: voucher.month,
      dueDate: voucher.dueDate.toISOString().slice(0, 10),
      items: voucher.items.map((i) => ({ label: i.label, amount: i.amount })),
      totalAmount,
      amountPaid,
      amountDue,
      status,
```

(Only the `if (amountDue <= 0) ...` block through the new `startOfToday` computation changes — the
`return { ... }` block below it, and everything else in the file, is untouched.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/fees/fee-vouchers.service.spec.ts`
Expected: PASS (including the pre-existing "long past — overdue" test in the same file).

- [ ] **Step 5: Run the e2e test that originally surfaced this bug**

Run: `cd backend && npx jest --config test/jest-e2e.json fees.e2e-spec.ts`
Expected: PASS — including `'an admin issues a voucher, a second issue for the same student+month
is rejected, and the owning parent sees a server-computed amountDue'`, which issues a voucher with
`dueDate` equal to the current run date and previously failed on that exact day.

- [ ] **Step 6: Run the full backend suite to confirm no regression**

Run: `cd backend && npm run build && npm test && npm run test:e2e`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/fees/fee-vouchers.service.ts backend/src/fees/fee-vouchers.service.spec.ts
git commit -m "fix: a fee voucher stays unpaid through its due date, not overdue from midnight on"
```

---

### Final verification (after all 3 tasks)

- [ ] Run the full backend suite: `cd backend && npm run build && npm test && npm run test:e2e`
      — expect all green (237+ unit tests, 62+ e2e tests, no failures).
- [ ] Confirm CI is green on the branch/PR (backend, staff-console, parent-app jobs).
- [ ] Manually smoke-test in a real running app: log in as `admin@seeds.edu.pk` (or
      `principal@seeds.edu.pk`, both `SCHOOL_ADMIN`), open the Attendance screen for a section that
      has a class teacher assigned, and mark a student present — confirm no error and that the
      mark is visible to the linked parent, same as Task 1's e2e test but eyeballed in the browser.
- [ ] Update `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`'s Implementation
      Checklist: check Sprint C's remaining two sub-items (attendance fix, Fees/Messaging
      verification) — the Circulars-nav and parent-login-CORS lines are already checked as of
      2026-09-10 — noting the merge commit range and date, per
      [[roadmap-checklist-convention]].
- [ ] Update `build/PROJECT-STATUS.md`: move Sprint C from "⏳ IN PROGRESS" to "✅ DONE" with the
      merge commit range and date, following Sprint A/B's format.
