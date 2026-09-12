# P0 Test Coverage Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the P0 test-coverage gap flagged by `PROJECT-STATUS.md`'s Sprint I/J/K "Known gap" note and by the 2026-09-12 repository audit: five backend modules (`holidays`, `complaints`, `report-cards`, `ai-drafting`, `attendance-risk`) ship with zero spec files, and three other pieces of first-party logic (`AuthService.forgotPassword`/`resetPassword`, `POST /attendance/bulk`, timetable scheduling-conflict detection) are likewise untested — all confirmed by direct inspection (no matches for `forgotPassword`, `resetPassword`, `markBulk`, or `conflict` in any existing spec file).

**Architecture:** No product code changes — this plan only adds test files, following this repo's existing convention exactly: one `*.service.spec.ts` per service (hand-rolled `jest.fn()` mocks via `Test.createTestingModule` + `useValue`, no shared mock factory — see `backend/src/timetable/timetable.service.spec.ts`), one `*.job.spec.ts` for the cron job, and e2e coverage for RBAC/parent-isolation/campus behavior in `backend/test/*.e2e-spec.ts` (real Postgres, real HTTP via `supertest`, real login flow — see `backend/test/timetable-attendance.e2e-spec.ts`). Because the implementation already exists and works (per the original sprints' own "all passing" verification), this plan departs from strict red-green TDD: each task's step 2 is "run the new test and confirm it passes against the existing implementation," not "confirm it fails." If a new test ever fails against real code, stop and route it through `superpowers:systematic-debugging` before touching product code — do not silently loosen the assertion to make it pass, and do not fix the underlying code without flagging it first (a real bug found this way is a bigger deal than a coverage gap).

**Tech Stack:** NestJS 10 + Jest (backend unit + e2e), Prisma (Postgres in dev/CI), `supertest` for e2e HTTP, `argon2` for e2e password hashing fixtures — all already in `backend/package.json`, no new dependencies.

**Spec:** None — this is a mechanical test-coverage backfill with no product-behavior decisions; the "spec" is simply "test the code exactly as it already behaves," sourced directly from reading each service's existing implementation (cited per task below).

## Global Constraints

- No product code changes in Tasks 1–9 (pure test additions). If a test in Tasks 1–9 fails against the real implementation, stop, use `superpowers:systematic-debugging` to root-cause it, and report back before deciding whether to fix the code or the test.
- Match existing spec conventions exactly: hand-rolled `jest.fn()` mocks per test file, `Test.createTestingModule({ providers: [...] }).compile()`, no new test-helper abstractions.
- Every new e2e fixture must use a unique, greppable prefix for its identifiers (school name, `identifier`/GR-number strings) and must self-heal in `beforeAll` + clean up in `afterAll`, mirroring `backend/test/timetable-attendance.e2e-spec.ts`'s pattern — respect Prisma `onDelete: Restrict` ordering (delete `Attendance`/`Timetable`/child rows before their parent) exactly as that file does.
- Do NOT add or modify campus/section-boundary enforcement in `StudentAccessService` (`backend/src/common/student-access.service.ts`) as part of this plan. Its blanket "any staff role may access any student" behavior is a pre-existing, already-documented, single-school-system limitation (see `PROJECT-STATUS.md`'s Sprint 5-6 follow-up note) shared by every module built on it — fixing it is a separate, larger initiative outside this plan's scope. Tests here verify parent-isolation (which IS enforced) and role-gating (which IS enforced), not cross-campus staff boundaries (which are NOT enforced anywhere yet).
- Run `cd backend && npm test -- <path>` for a single unit spec, `npm test` for the full unit suite, and `npm run test:e2e` for the e2e suite. Run `npm run lint` and `npm run build` after each task's tests pass.

---

### Task 1: HolidaysService unit spec

**Files:**
- Create: `backend/src/holidays/holidays.service.spec.ts`

**Interfaces:**
- Consumes: `HolidaysService` (`backend/src/holidays/holidays.service.ts`) — `create(dto: CreateHolidayDto): Promise<HolidaySummary>`, `findMany(params: {campusId?, from?, to?}): Promise<HolidaySummary[]>`, `update(id: string, dto: UpdateHolidayDto): Promise<HolidaySummary>`, `delete(id: string): Promise<void>`, `isHoliday(date: Date, campusId: string): Promise<boolean>`. `PrismaService` mocked with `holiday: {create, findMany, findUnique, update, delete, findFirst}`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the test file**

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HolidaysService', () => {
  let service: HolidaysService;
  let prisma: {
    holiday: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      holiday: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [HolidaysService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(HolidaysService);
  });

  it('creates a school-wide holiday when no campusId is given', async () => {
    prisma.holiday.create.mockResolvedValue({
      id: 'h1',
      title: 'Eid',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-02'),
      campusId: null,
    });

    const result = await service.create({
      title: 'Eid',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
    });

    expect(prisma.holiday.create).toHaveBeenCalledWith({
      data: {
        title: 'Eid',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-04-02'),
        campusId: null,
      },
    });
    expect(result).toEqual({
      id: 'h1',
      title: 'Eid',
      startDate: '2026-04-01',
      endDate: '2026-04-02',
      campusId: null,
    });
  });

  it('creates a campus-scoped holiday when campusId is given', async () => {
    prisma.holiday.create.mockResolvedValue({
      id: 'h2',
      title: 'Campus Sports Day',
      startDate: new Date('2026-05-01'),
      endDate: new Date('2026-05-01'),
      campusId: 'campus-1',
    });

    await service.create({
      title: 'Campus Sports Day',
      startDate: '2026-05-01',
      endDate: '2026-05-01',
      campusId: 'campus-1',
    });

    expect(prisma.holiday.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ campusId: 'campus-1' }) }),
    );
  });

  it('findMany scoped to a campus includes both that campus AND school-wide (null) rows', async () => {
    prisma.holiday.findMany.mockResolvedValue([]);

    await service.findMany({ campusId: 'campus-1' });

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: { OR: [{ campusId: 'campus-1' }, { campusId: null }] },
      orderBy: { startDate: 'asc' },
    });
  });

  it('findMany with no campusId omits the campus filter entirely (school-wide calendar view)', async () => {
    prisma.holiday.findMany.mockResolvedValue([]);

    await service.findMany({});

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { startDate: 'asc' },
    });
  });

  it('findMany applies from/to date-range filters', async () => {
    prisma.holiday.findMany.mockResolvedValue([]);

    await service.findMany({ from: '2026-01-01', to: '2026-01-31' });

    expect(prisma.holiday.findMany).toHaveBeenCalledWith({
      where: {
        endDate: { gte: new Date('2026-01-01') },
        startDate: { lte: new Date('2026-01-31') },
      },
      orderBy: { startDate: 'asc' },
    });
  });

  it('update throws NotFoundException for an unknown holiday', async () => {
    prisma.holiday.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { title: 'X' })).rejects.toThrow(NotFoundException);
    expect(prisma.holiday.update).not.toHaveBeenCalled();
  });

  it('update only sends the fields actually provided (undefined fields omitted)', async () => {
    prisma.holiday.findUnique.mockResolvedValue({ id: 'h1' });
    prisma.holiday.update.mockResolvedValue({
      id: 'h1',
      title: 'Renamed',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2026-04-02'),
      campusId: null,
    });

    await service.update('h1', { title: 'Renamed' });

    expect(prisma.holiday.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { title: 'Renamed' },
    });
  });

  it('delete throws NotFoundException for an unknown holiday', async () => {
    prisma.holiday.findUnique.mockResolvedValue(null);

    await expect(service.delete('missing')).rejects.toThrow(NotFoundException);
    expect(prisma.holiday.delete).not.toHaveBeenCalled();
  });

  it('delete removes an existing holiday', async () => {
    prisma.holiday.findUnique.mockResolvedValue({ id: 'h1' });
    prisma.holiday.delete.mockResolvedValue({});

    await service.delete('h1');

    expect(prisma.holiday.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
  });

  it('isHoliday returns true when a campus-specific OR school-wide row covers the date', async () => {
    prisma.holiday.findFirst.mockResolvedValue({ id: 'h1' });

    const result = await service.isHoliday(new Date('2026-04-01'), 'campus-1');

    expect(result).toBe(true);
    expect(prisma.holiday.findFirst).toHaveBeenCalledWith({
      where: {
        startDate: { lte: new Date('2026-04-01') },
        endDate: { gte: new Date('2026-04-01') },
        OR: [{ campusId: 'campus-1' }, { campusId: null }],
      },
      select: { id: true },
    });
  });

  it('isHoliday returns false when no row covers the date', async () => {
    prisma.holiday.findFirst.mockResolvedValue(null);

    expect(await service.isHoliday(new Date('2026-04-01'), 'campus-1')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm test -- holidays.service.spec.ts`
Expected: all 11 tests PASS against the existing `HolidaysService` implementation.

- [ ] **Step 3: Commit**

```bash
git add backend/src/holidays/holidays.service.spec.ts
git commit -m "test(backend): add HolidaysService unit coverage"
```

---

### Task 2: ComplaintsService unit spec

**Files:**
- Create: `backend/src/complaints/complaints.service.spec.ts`

**Interfaces:**
- Consumes: `ComplaintsService` (`backend/src/complaints/complaints.service.ts`) — `create(dto: CreateComplaintDto, raisedById: string)`, `findForStudent(studentId: string)`, `updateStatus(id: string, status: string)`. `PrismaService` mocked with `complaint: {create, findMany, findUnique, update}`.

- [ ] **Step 1: Write the test file**

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ComplaintsService', () => {
  let service: ComplaintsService;
  let prisma: {
    complaint: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const record = {
    id: 'c1',
    studentId: 's1',
    raisedById: 'teacher-1',
    subject: 'Bullying concern',
    description: 'Details here',
    status: 'open',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      complaint: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ComplaintsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ComplaintsService);
  });

  it('creates a complaint with status "open", attributed to the raising staff member', async () => {
    prisma.complaint.create.mockResolvedValue(record);

    const result = await service.create(
      { studentId: 's1', subject: 'Bullying concern', description: 'Details here' },
      'teacher-1',
    );

    expect(prisma.complaint.create).toHaveBeenCalledWith({
      data: {
        studentId: 's1',
        raisedById: 'teacher-1',
        subject: 'Bullying concern',
        description: 'Details here',
        status: 'open',
      },
    });
    expect(result.status).toBe('open');
    expect(result.createdAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('findForStudent orders complaints newest-first', async () => {
    prisma.complaint.findMany.mockResolvedValue([record]);

    await service.findForStudent('s1');

    expect(prisma.complaint.findMany).toHaveBeenCalledWith({
      where: { studentId: 's1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('updateStatus throws NotFoundException for an unknown complaint', async () => {
    prisma.complaint.findUnique.mockResolvedValue(null);

    await expect(service.updateStatus('missing', 'resolved')).rejects.toThrow(NotFoundException);
    expect(prisma.complaint.update).not.toHaveBeenCalled();
  });

  it('updateStatus updates an existing complaint\'s status', async () => {
    prisma.complaint.findUnique.mockResolvedValue(record);
    prisma.complaint.update.mockResolvedValue({ ...record, status: 'resolved' });

    const result = await service.updateStatus('c1', 'resolved');

    expect(prisma.complaint.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { status: 'resolved' },
    });
    expect(result.status).toBe('resolved');
  });
});
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm test -- complaints.service.spec.ts`
Expected: all 4 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/complaints/complaints.service.spec.ts
git commit -m "test(backend): add ComplaintsService unit coverage"
```

---

### Task 3: ReportCardsService unit spec

**Files:**
- Create: `backend/src/report-cards/report-cards.service.spec.ts`

**Interfaces:**
- Consumes: `ReportCardsService` (`backend/src/report-cards/report-cards.service.ts`) — `upload(studentId, academicSessionId, file, uploadedById)`, `findForStudent(studentId)`, `getFileIdForDownload(reportCardId)`. `PrismaService` mocked with `reportCard: {findUnique, create, findMany}`; `FilesService` mocked with `upload: jest.Mock`.

- [ ] **Step 1: Write the test file**

```typescript
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReportCardsService } from './report-cards.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';

describe('ReportCardsService', () => {
  let service: ReportCardsService;
  let prisma: {
    reportCard: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  };
  let filesService: { upload: jest.Mock };

  const fakeFile = { originalname: 'card.pdf' } as Express.Multer.File;

  beforeEach(async () => {
    prisma = {
      reportCard: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    };
    filesService = { upload: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportCardsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();
    service = moduleRef.get(ReportCardsService);
  });

  it('throws ConflictException when a report card already exists for this student+session', async () => {
    prisma.reportCard.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(service.upload('s1', 'session-1', fakeFile, 'teacher-1')).rejects.toThrow(
      ConflictException,
    );
    expect(filesService.upload).not.toHaveBeenCalled();
    expect(prisma.reportCard.create).not.toHaveBeenCalled();
  });

  it('uploads the file then creates the ReportCard row with the returned fileId', async () => {
    prisma.reportCard.findUnique.mockResolvedValue(null);
    filesService.upload.mockResolvedValue({ id: 'file-1' });
    prisma.reportCard.create.mockResolvedValue({
      id: 'rc1',
      studentId: 's1',
      academicSessionId: 'session-1',
      fileId: 'file-1',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    });

    const result = await service.upload('s1', 'session-1', fakeFile, 'teacher-1');

    expect(filesService.upload).toHaveBeenCalledWith(fakeFile, 'teacher-1');
    expect(prisma.reportCard.create).toHaveBeenCalledWith({
      data: { studentId: 's1', academicSessionId: 'session-1', fileId: 'file-1', uploadedById: 'teacher-1' },
    });
    expect(result.fileId).toBe('file-1');
  });

  it('findForStudent orders newest-first', async () => {
    prisma.reportCard.findMany.mockResolvedValue([]);

    await service.findForStudent('s1');

    expect(prisma.reportCard.findMany).toHaveBeenCalledWith({
      where: { studentId: 's1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('getFileIdForDownload returns the fileId for a known report card', async () => {
    prisma.reportCard.findUnique.mockResolvedValue({ fileId: 'file-1' });

    expect(await service.getFileIdForDownload('rc1')).toBe('file-1');
  });

  it('getFileIdForDownload returns null for an unknown report card', async () => {
    prisma.reportCard.findUnique.mockResolvedValue(null);

    expect(await service.getFileIdForDownload('missing')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm test -- report-cards.service.spec.ts`
Expected: all 5 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/report-cards/report-cards.service.spec.ts
git commit -m "test(backend): add ReportCardsService unit coverage"
```

---

### Task 4: AiDraftingService unit spec

**Files:**
- Create: `backend/src/ai-drafting/ai-drafting.service.spec.ts`

**Interfaces:**
- Consumes: `AiDraftingService` (`backend/src/ai-drafting/ai-drafting.service.ts`) — `suggestDraft(userId, targetType, context): Promise<{suggestion: string}>`. Injected `AI_DRAFTING_PROVIDER` token (from `./ai-drafting-provider`) mocked with `{ suggestDraft: jest.Mock }`. `PrismaService` mocked with `draftSuggestion: { create }`.

- [ ] **Step 1: Write the test file**

```typescript
import { Test } from '@nestjs/testing';
import { AiDraftingService } from './ai-drafting.service';
import { PrismaService } from '../prisma/prisma.service';
import { AI_DRAFTING_PROVIDER } from './ai-drafting-provider';

describe('AiDraftingService', () => {
  let service: AiDraftingService;
  let prisma: { draftSuggestion: { create: jest.Mock } };
  let provider: { suggestDraft: jest.Mock };

  beforeEach(async () => {
    prisma = { draftSuggestion: { create: jest.fn() } };
    provider = { suggestDraft: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AiDraftingService,
        { provide: PrismaService, useValue: prisma },
        { provide: AI_DRAFTING_PROVIDER, useValue: provider },
      ],
    }).compile();
    service = moduleRef.get(AiDraftingService);
  });

  it('asks the injected provider for a suggestion, persists it, and returns it', async () => {
    provider.suggestDraft.mockResolvedValue('Dear parents, the PTM is on Sept 20th.');
    prisma.draftSuggestion.create.mockResolvedValue({});

    const result = await service.suggestDraft('user-1', 'circular', 'PTM on Sept 20th');

    expect(provider.suggestDraft).toHaveBeenCalledWith({
      context: 'PTM on Sept 20th',
      targetType: 'circular',
    });
    expect(prisma.draftSuggestion.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        targetType: 'circular',
        prompt: 'PTM on Sept 20th',
        suggestion: 'Dear parents, the PTM is on Sept 20th.',
      },
    });
    expect(result).toEqual({ suggestion: 'Dear parents, the PTM is on Sept 20th.' });
  });

  it('works for the "diary" targetType the same way', async () => {
    provider.suggestDraft.mockResolvedValue('Homework: read chapter 3.');
    prisma.draftSuggestion.create.mockResolvedValue({});

    const result = await service.suggestDraft('user-2', 'diary', 'chapter 3 reading');

    expect(provider.suggestDraft).toHaveBeenCalledWith({
      context: 'chapter 3 reading',
      targetType: 'diary',
    });
    expect(result.suggestion).toBe('Homework: read chapter 3.');
  });
});
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm test -- ai-drafting.service.spec.ts`
Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/ai-drafting/ai-drafting.service.spec.ts
git commit -m "test(backend): add AiDraftingService unit coverage"
```

---

### Task 5: AttendanceRiskService unit spec

**Files:**
- Create: `backend/src/attendance-risk/attendance-risk.service.spec.ts`

**Interfaces:**
- Consumes: `AttendanceRiskService` (`backend/src/attendance-risk/attendance-risk.service.ts`) — `recomputeAll(): Promise<void>`, `getForStudent(studentId): Promise<AttendanceRiskSummary>`, `getFlagged(sectionIds?: string[])`. Constructor deps: `PrismaService` (`enrollment.findMany`, `attendance.findMany`, `attendanceRiskFlag.findUnique/upsert/findMany`, `section.findUnique`, `teacher.findUnique`, `student.findUnique`), `HolidaysService` (`isHoliday`), `NotificationsService` (`notify`). Constants from `./attendance-risk.constants`: `RISK_WINDOW_DAYS=30`, `RISK_THRESHOLD=0.25`, `RISK_MIN_TRACKED_DAYS=5`.

- [ ] **Step 1: Write the test file**

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AttendanceRiskService } from './attendance-risk.service';
import { PrismaService } from '../prisma/prisma.service';
import { HolidaysService } from '../holidays/holidays.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RISK_MIN_TRACKED_DAYS } from './attendance-risk.constants';

describe('AttendanceRiskService', () => {
  let service: AttendanceRiskService;
  let prisma: {
    enrollment: { findMany: jest.Mock };
    attendance: { findMany: jest.Mock };
    attendanceRiskFlag: { findUnique: jest.Mock; upsert: jest.Mock; findMany: jest.Mock };
    section: { findUnique: jest.Mock };
    teacher: { findUnique: jest.Mock };
    student: { findUnique: jest.Mock };
  };
  let holidaysService: { isHoliday: jest.Mock };
  let notificationsService: { notify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      enrollment: { findMany: jest.fn() },
      attendance: { findMany: jest.fn() },
      attendanceRiskFlag: { findUnique: jest.fn(), upsert: jest.fn(), findMany: jest.fn() },
      section: { findUnique: jest.fn() },
      teacher: { findUnique: jest.fn() },
      student: { findUnique: jest.fn() },
    };
    holidaysService = { isHoliday: jest.fn().mockResolvedValue(false) };
    notificationsService = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceRiskService,
        { provide: PrismaService, useValue: prisma },
        { provide: HolidaysService, useValue: holidaysService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();
    service = moduleRef.get(AttendanceRiskService);
  });

  function daysOfStatus(count: number, status: string) {
    return Array.from({ length: count }, (_, i) => ({
      date: new Date(Date.UTC(2026, 7, i + 1)),
      status,
    }));
  }

  it('flags a student whose absence rate meets the threshold over enough tracked days', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      { studentId: 's1', campusId: 'campus-1', sectionId: 'sec-1' },
    ]);
    // 8 tracked days, 2 absent => 25% >= RISK_THRESHOLD (0.25)
    prisma.attendance.findMany.mockResolvedValue([
      ...daysOfStatus(6, 'PRESENT'),
      ...daysOfStatus(2, 'ABSENT'),
    ]);
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue(null); // wasFlagged = false
    prisma.attendanceRiskFlag.upsert.mockResolvedValue({});
    prisma.section.findUnique.mockResolvedValue({ classTeacherId: 'teacher-1' });
    prisma.teacher.findUnique.mockResolvedValue({ userId: 'teacher-user-1' });
    prisma.student.findUnique.mockResolvedValue({ name: 'Ali' });

    await service.recomputeAll();

    expect(prisma.attendanceRiskFlag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 's1' },
        create: expect.objectContaining({ studentId: 's1', absenceRate: 0.25, flagged: true }),
        update: expect.objectContaining({ absenceRate: 0.25, flagged: true }),
      }),
    );
  });

  it('notifies the class teacher only on the false->true transition, never on repeat flags', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      { studentId: 's1', campusId: 'campus-1', sectionId: 'sec-1' },
    ]);
    prisma.attendance.findMany.mockResolvedValue([
      ...daysOfStatus(6, 'PRESENT'),
      ...daysOfStatus(2, 'ABSENT'),
    ]);
    prisma.attendanceRiskFlag.upsert.mockResolvedValue({});
    prisma.section.findUnique.mockResolvedValue({ classTeacherId: 'teacher-1' });
    prisma.teacher.findUnique.mockResolvedValue({ userId: 'teacher-user-1' });
    prisma.student.findUnique.mockResolvedValue({ name: 'Ali' });

    // Case A: previously unflagged -> notify fires
    prisma.attendanceRiskFlag.findUnique.mockResolvedValueOnce(null);
    await service.recomputeAll();
    expect(notificationsService.notify).toHaveBeenCalledTimes(1);
    expect(notificationsService.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'teacher-user-1', type: 'attendance-risk' }),
    );

    // Case B: already flagged -> no duplicate notify
    notificationsService.notify.mockClear();
    prisma.attendanceRiskFlag.findUnique.mockResolvedValueOnce({ flagged: true });
    await service.recomputeAll();
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('excludes holiday days from both the tracked-day and absent-day counts', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      { studentId: 's1', campusId: 'campus-1', sectionId: 'sec-1' },
    ]);
    const records = [...daysOfStatus(3, 'PRESENT'), ...daysOfStatus(2, 'ABSENT')];
    prisma.attendance.findMany.mockResolvedValue(records);
    // Mark every ABSENT day as a holiday — should be excluded entirely, not counted as absent
    holidaysService.isHoliday.mockImplementation(async (date: Date) =>
      records.some((r) => r.date.getTime() === date.getTime() && r.status === 'ABSENT'),
    );
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue(null);
    prisma.attendanceRiskFlag.upsert.mockResolvedValue({});

    await service.recomputeAll();

    // 3 tracked (the PRESENT days), 0 absent => 0% => not flagged, no notify
    expect(prisma.attendanceRiskFlag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ absenceRate: 0, flagged: false }) }),
    );
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('skips a student entirely when fewer than RISK_MIN_TRACKED_DAYS days are tracked', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      { studentId: 's1', campusId: 'campus-1', sectionId: 'sec-1' },
    ]);
    prisma.attendance.findMany.mockResolvedValue(daysOfStatus(RISK_MIN_TRACKED_DAYS - 1, 'ABSENT'));

    await service.recomputeAll();

    expect(prisma.attendanceRiskFlag.upsert).not.toHaveBeenCalled();
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('does not flag when the absence rate is below RISK_THRESHOLD', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      { studentId: 's1', campusId: 'campus-1', sectionId: 'sec-1' },
    ]);
    // 10 tracked, 1 absent = 10% < 25%
    prisma.attendance.findMany.mockResolvedValue([
      ...daysOfStatus(9, 'PRESENT'),
      ...daysOfStatus(1, 'ABSENT'),
    ]);
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue(null);
    prisma.attendanceRiskFlag.upsert.mockResolvedValue({});

    await service.recomputeAll();

    expect(prisma.attendanceRiskFlag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ flagged: false }) }),
    );
    expect(notificationsService.notify).not.toHaveBeenCalled();
  });

  it('getForStudent throws NotFoundException when no risk row exists yet', async () => {
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue(null);

    await expect(service.getForStudent('s1')).rejects.toThrow(NotFoundException);
  });

  it('getForStudent returns the mapped summary for an existing row', async () => {
    prisma.attendanceRiskFlag.findUnique.mockResolvedValue({
      studentId: 's1',
      absenceRate: 0.3,
      flagged: true,
      windowStart: new Date('2026-08-01'),
      windowEnd: new Date('2026-08-31'),
      student: { name: 'Ali' },
    });

    const result = await service.getForStudent('s1');

    expect(result).toEqual({
      studentId: 's1',
      studentName: 'Ali',
      absenceRate: 0.3,
      flagged: true,
      windowStart: '2026-08-01',
      windowEnd: '2026-08-31',
    });
  });

  it('getFlagged with no sectionIds queries every flagged student, school-wide', async () => {
    prisma.attendanceRiskFlag.findMany.mockResolvedValue([]);

    await service.getFlagged();

    expect(prisma.attendanceRiskFlag.findMany).toHaveBeenCalledWith({
      where: { flagged: true },
      include: { student: { select: { name: true } } },
      orderBy: { absenceRate: 'desc' },
    });
  });

  it('getFlagged with sectionIds scopes the query to those sections (a Teacher\'s own classes)', async () => {
    prisma.attendanceRiskFlag.findMany.mockResolvedValue([]);

    await service.getFlagged(['sec-1', 'sec-2']);

    expect(prisma.attendanceRiskFlag.findMany).toHaveBeenCalledWith({
      where: {
        flagged: true,
        student: { enrollments: { some: { sectionId: { in: ['sec-1', 'sec-2'] }, status: 'ACTIVE' } } },
      },
      include: { student: { select: { name: true } } },
      orderBy: { absenceRate: 'desc' },
    });
  });

  it('getFlagged with an empty sectionIds array (Teacher with no class-teacher section) returns none', async () => {
    prisma.attendanceRiskFlag.findMany.mockResolvedValue([]);

    await service.getFlagged([]);

    expect(prisma.attendanceRiskFlag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          student: { enrollments: { some: { sectionId: { in: [] }, status: 'ACTIVE' } } },
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm test -- attendance-risk.service.spec.ts`
Expected: all 10 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/attendance-risk/attendance-risk.service.spec.ts
git commit -m "test(backend): add AttendanceRiskService unit coverage"
```

---

### Task 6: AttendanceRiskJob unit spec

**Files:**
- Create: `backend/src/attendance-risk/attendance-risk.job.spec.ts`

**Interfaces:**
- Consumes: `AttendanceRiskJob` (`backend/src/attendance-risk/attendance-risk.job.ts`) — `run(): Promise<void>`. `AttendanceRiskService` mocked with `{ recomputeAll: jest.Mock }`.

- [ ] **Step 1: Write the test file**

```typescript
import { Test } from '@nestjs/testing';
import { AttendanceRiskJob } from './attendance-risk.job';
import { AttendanceRiskService } from './attendance-risk.service';

describe('AttendanceRiskJob', () => {
  let job: AttendanceRiskJob;
  let attendanceRiskService: { recomputeAll: jest.Mock };

  beforeEach(async () => {
    attendanceRiskService = { recomputeAll: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceRiskJob,
        { provide: AttendanceRiskService, useValue: attendanceRiskService },
      ],
    }).compile();
    job = moduleRef.get(AttendanceRiskJob);
  });

  it('delegates to AttendanceRiskService.recomputeAll()', async () => {
    attendanceRiskService.recomputeAll.mockResolvedValue(undefined);

    await job.run();

    expect(attendanceRiskService.recomputeAll).toHaveBeenCalledTimes(1);
  });

  it('catches a recompute failure and does not let it propagate (nightly job must not crash the process)', async () => {
    attendanceRiskService.recomputeAll.mockRejectedValue(new Error('db unreachable'));

    await expect(job.run()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm test -- attendance-risk.job.spec.ts`
Expected: both tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/attendance-risk/attendance-risk.job.spec.ts
git commit -m "test(backend): add AttendanceRiskJob unit coverage"
```

---

### Task 7: AuthService forgotPassword/resetPassword unit specs

**Files:**
- Modify: `backend/src/auth/auth.service.spec.ts` (append; existing `prisma` mock already declares `passwordResetToken` and `mailAdapter` is already provided via `MAIL_ADAPTER` — only `$transaction` needs to be added to the mock)

**Interfaces:**
- Consumes: `AuthService.forgotPassword(identifier: string): Promise<void>`, `AuthService.resetPassword(token: string, newPassword: string): Promise<void>` (`backend/src/auth/auth.service.ts:130-185`). Constants from `./auth.constants`: `PASSWORD_RESET_TOKEN_TTL_HOURS`, `RESET_PASSWORD_GENERIC_ERROR`.

- [ ] **Step 1: Add `$transaction` to the existing `prisma` mock's type and `beforeEach`**

In `backend/src/auth/auth.service.spec.ts`, extend the `prisma` type declaration (around line 17) to add:

```typescript
    $transaction: jest.Mock;
```

as a sibling of `user`/`refreshToken`/`passwordResetToken`, and in the `beforeEach` block's `prisma = {...}` assignment (around line 46), add:

```typescript
    $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
```

`resetPassword` calls `this.prisma.$transaction([...])` with an array of already-invoked promises (not a callback), so resolving each array element is enough to exercise the real code path.

- [ ] **Step 2: Append the `forgotPassword`/`resetPassword` describe blocks**

Add this at the end of the file, before the closing `});` of the outer `describe('AuthService', ...)`:

```typescript
  describe('forgotPassword', () => {
    it('creates a reset token and emails a reset link for a known identifier', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.passwordResetToken.create.mockResolvedValue({});
      mailAdapter.send.mockResolvedValue(undefined);

      await service.forgotPassword('parent@seeds.edu.pk');

      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            tokenHash: expect.any(String),
            expiresAt: expect.any(Date),
          }),
        }),
      );
      expect(mailAdapter.send).toHaveBeenCalledWith(
        'parent@seeds.edu.pk',
        expect.stringContaining('Reset your'),
        expect.stringContaining('reset-password?token='),
      );
    });

    it('silently no-ops for an unknown identifier — never reveals whether an account exists', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.forgotPassword('nobody@seeds.edu.pk')).resolves.toBeUndefined();

      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(mailAdapter.send).not.toHaveBeenCalled();
    });

    it('swallows a mail-delivery failure — the caller must never see it (same generic response either way)', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.passwordResetToken.create.mockResolvedValue({});
      mailAdapter.send.mockRejectedValue(new Error('smtp down'));

      await expect(service.forgotPassword('parent@seeds.edu.pk')).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    const storedResetToken = {
      id: 'prt-1',
      userId: 'user-1',
      tokenHash: expect.any(String),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      usedAt: null as Date | null,
    };

    it('resets the password, marks the token used, and revokes every active session in one transaction', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(storedResetToken);
      prisma.user.update.mockResolvedValue({});
      prisma.passwordResetToken.update.mockResolvedValue({});
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.resetPassword('raw-token', 'NewCorrectHorse9!');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } }),
      );
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'prt-1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an unknown token with the generic reset error', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword('garbage', 'NewPass9!')).rejects.toThrow(
        RESET_PASSWORD_GENERIC_ERROR,
      );
    });

    it('rejects an expired token', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...storedResetToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword('expired', 'NewPass9!')).rejects.toThrow(
        RESET_PASSWORD_GENERIC_ERROR,
      );
    });

    it('rejects an already-used token (rejects replay)', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        ...storedResetToken,
        usedAt: new Date(),
      });

      await expect(service.resetPassword('used', 'NewPass9!')).rejects.toThrow(
        RESET_PASSWORD_GENERIC_ERROR,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
```

Also add `PASSWORD_RESET_TOKEN_TTL_HOURS, RESET_PASSWORD_GENERIC_ERROR` to the existing `import { MAX_FAILED_ATTEMPTS, GENERIC_AUTH_ERROR, ACCOUNT_LOCKED_ERROR } from './auth.constants';` at the top of the file.

- [ ] **Step 3: Run it and confirm it passes**

Run: `cd backend && npm test -- auth.service.spec.ts`
Expected: all tests (existing + 7 new) PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/auth/auth.service.spec.ts
git commit -m "test(backend): add AuthService forgotPassword/resetPassword unit coverage"
```

---

### Task 8: AttendanceService.markBulk unit spec

**Files:**
- Modify: `backend/src/attendance/attendance.service.spec.ts` (append; the existing `prisma` mock needs `$transaction` added)

**Interfaces:**
- Consumes: `AttendanceService.markBulk(dto: BulkMarkAttendanceDto, markingUserId: string)` (`backend/src/attendance/attendance.service.ts:106-150`).

- [ ] **Step 1: Add `$transaction` to the existing `prisma` mock**

In the `prisma` type declaration (around line 10) add `$transaction: jest.Mock;`, and in `beforeEach`'s `prisma = {...}` (around line 20) add:

```typescript
      $transaction: jest.fn().mockImplementation((cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma)),
```

`markBulk` calls `this.prisma.$transaction(async (tx) => {...})` with a callback (unlike `resetPassword`'s array form) — invoking the callback with `prisma` itself works because `prisma.attendance` and `prisma.auditLog` are the same mocks the assertions below check.

- [ ] **Step 2: Append the `markBulk` describe block**

Add before the closing `});` of the outer `describe('AttendanceService', ...)`:

```typescript
  describe('markBulk', () => {
    it('throws BadRequestException when marks is empty', async () => {
      await expect(
        service.markBulk({ date: '2026-09-01', marks: [] }, 'teacher-user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects marking on a declared holiday, before writing anything', async () => {
      enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1' });
      holidaysService.isHoliday.mockResolvedValue(true);

      await expect(
        service.markBulk(
          { date: '2026-09-01', marks: [{ studentId: 's1', status: 'PRESENT' }] },
          'teacher-user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.attendance.upsert).not.toHaveBeenCalled();
    });

    it('upserts every mark in one transaction, attributed to the marking teacher, and writes one bulk audit log entry', async () => {
      enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1', sectionId: 'sec-1' });
      holidaysService.isHoliday.mockResolvedValue(false);
      prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
      prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });

      await service.markBulk(
        {
          date: '2026-09-01',
          marks: [
            { studentId: 's1', status: 'PRESENT' },
            { studentId: 's2', status: 'ABSENT' },
          ],
        },
        'teacher-user-1',
      );

      expect(prisma.attendance.upsert).toHaveBeenCalledTimes(2);
      expect(prisma.attendance.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: { studentId_date: { studentId: 's1', date: new Date('2026-09-01') } },
          create: expect.objectContaining({ studentId: 's1', status: 'PRESENT', markedById: 'teacher-1' }),
        }),
      );
      expect(prisma.attendance.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          create: expect.objectContaining({ studentId: 's2', status: 'ABSENT', markedById: 'teacher-1' }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'teacher-user-1',
            action: 'attendance.mark-bulk',
            entity: 'Attendance',
          }),
        }),
      );
    });

    it('falls back to the section class-teacher when the marking user has no Teacher profile (Admin marking)', async () => {
      enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1', sectionId: 'sec-1' });
      holidaysService.isHoliday.mockResolvedValue(false);
      prisma.teacher.findUnique.mockResolvedValue(null);
      prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: 'teacher-9' });
      prisma.attendance.upsert.mockResolvedValue({ id: 'att-1' });

      await service.markBulk(
        { date: '2026-09-01', marks: [{ studentId: 's1', status: 'PRESENT' }] },
        'admin-user-1',
      );

      expect(prisma.attendance.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ markedById: 'teacher-9' }) }),
      );
    });
  });
```

- [ ] **Step 3: Run it and confirm it passes**

Run: `cd backend && npm test -- attendance.service.spec.ts`
Expected: all tests (existing + 4 new) PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/src/attendance/attendance.service.spec.ts
git commit -m "test(backend): add AttendanceService.markBulk unit coverage"
```

---

### Task 9: TimetableService conflict-detection unit spec

**Files:**
- Modify: `backend/src/timetable/timetable.service.spec.ts` (append — no mock-shape changes needed; `prisma.timetable.findFirst` is already declared and defaults to `mockResolvedValue(null)`)

**Interfaces:**
- Consumes: `TimetableService.createEntry(dto, actingUserId)`, `TimetableService.updateEntry(id, dto, actingUserId)` — both call the private `assertNoConflict` (`backend/src/timetable/timetable.service.ts:56-80`), which throws `ConflictException` when `prisma.timetable.findFirst` returns a row matching `dayOfWeek`+`period`+(`teacherId` OR `room`).

- [ ] **Step 1: Append the conflict-detection tests**

Add before the closing `});` of the outer `describe('TimetableService', ...)`:

```typescript
  describe('scheduling-conflict detection', () => {
    const dto = {
      sectionId: 'sec-1',
      subjectId: 'sub-1',
      teacherId: 'teacher-1',
      dayOfWeek: 2,
      period: 1,
      startTime: '08:00',
      endTime: '08:40',
      room: 'Room-3A',
    };

    it('createEntry rejects a double-booked teacher in the same day+period', async () => {
      prisma.timetable.findFirst.mockResolvedValue({ id: 'existing', teacherId: 'teacher-1', room: null });

      await expect(service.createEntry(dto, 'admin-1')).rejects.toThrow(ConflictException);
      expect(prisma.timetable.create).not.toHaveBeenCalled();
    });

    it('createEntry rejects a double-booked room in the same day+period', async () => {
      prisma.timetable.findFirst.mockResolvedValue({ id: 'existing', teacherId: null, room: 'Room-3A' });

      await expect(service.createEntry(dto, 'admin-1')).rejects.toThrow(ConflictException);
    });

    it('createEntry allows two entries with neither teacherId nor room set — never flagged as conflicting', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);
      prisma.timetable.create.mockResolvedValue({ id: 't1' });

      const bareDto = { ...dto, teacherId: undefined, room: undefined };
      delete (bareDto as { teacherId?: string }).teacherId;
      delete (bareDto as { room?: string }).room;

      await service.createEntry(bareDto, 'admin-1');

      expect(prisma.timetable.findFirst).not.toHaveBeenCalled();
      expect(prisma.timetable.create).toHaveBeenCalled();
    });

    it('createEntry succeeds when no conflicting row exists', async () => {
      prisma.timetable.findFirst.mockResolvedValue(null);
      prisma.timetable.create.mockResolvedValue({ id: 't1' });

      await service.createEntry(dto, 'admin-1');

      expect(prisma.timetable.create).toHaveBeenCalledWith({ data: dto });
    });

    it('updateEntry rejects a conflict against a DIFFERENT entry', async () => {
      prisma.timetable.findUnique.mockResolvedValue({
        id: 't1',
        dayOfWeek: 2,
        period: 1,
        teacherId: 'teacher-1',
        room: null,
      });
      prisma.timetable.findFirst.mockResolvedValue({ id: 'other-entry', teacherId: 'teacher-1', room: null });

      await expect(service.updateEntry('t1', { period: 2 }, 'admin-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('updateEntry excludes itself from the conflict check (editing an entry\'s own unrelated field is not a self-conflict)', async () => {
      prisma.timetable.findUnique.mockResolvedValue({
        id: 't1',
        dayOfWeek: 2,
        period: 1,
        teacherId: 'teacher-1',
        room: null,
      });
      prisma.timetable.findFirst.mockResolvedValue(null);
      prisma.timetable.update.mockResolvedValue({ id: 't1' });

      await service.updateEntry('t1', { startTime: '08:05' }, 'admin-1');

      expect(prisma.timetable.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: { not: 't1' } }) }),
      );
      expect(prisma.timetable.update).toHaveBeenCalled();
    });
  });
```

Add `ConflictException` to the existing `import { NotFoundException } from '@nestjs/common';` at the top of the file (change to `import { ConflictException, NotFoundException } from '@nestjs/common';`).

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm test -- timetable.service.spec.ts`
Expected: all tests (existing + 6 new) PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/timetable/timetable.service.spec.ts
git commit -m "test(backend): add TimetableService scheduling-conflict unit coverage"
```

---

### Task 10: e2e — extend `timetable-attendance.e2e-spec.ts` with bulk attendance, timetable-conflict, and attendance-risk RBAC/parent-isolation

**Files:**
- Modify: `backend/test/timetable-attendance.e2e-spec.ts` (reuses the existing `tta-*` fixture: `ids.school/section/childA/childB/teacher`, `tta-teacher@seeds.edu.pk`, `tta-admin@seeds.edu.pk`, `tta-parent-a@seeds.edu.pk`, `tta-parent-b@seeds.edu.pk`, all created in the existing `beforeAll`)

**Interfaces:**
- Consumes: `POST /api/v1/attendance/bulk`, `POST /api/v1/timetable`, `GET /api/v1/students/:id/attendance-risk`, `GET /api/v1/attendance-risk` — routes already defined in `AttendanceController`/`TimetableController`/`AttendanceRiskController`.

- [ ] **Step 1: Append new `it()` blocks**

Add these before the final closing `});` of the file's outer `describe(...)`:

```typescript
  it('a Teacher can bulk-mark attendance for a whole section in one call', async () => {
    const teacherToken = await loginAs('tta-teacher@seeds.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/api/v1/attendance/bulk')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        date: today,
        marks: [
          { studentId: ids.childA, status: 'PRESENT' },
          { studentId: ids.childB, status: 'ABSENT' },
        ],
      })
      .expect(201);

    const parentAToken = await loginAs('tta-parent-a@seeds.edu.pk');
    const month = today.slice(0, 7);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/attendance?month=${month}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(res.body.days).toEqual(expect.arrayContaining([{ date: today, status: 'PRESENT' }]));
  });

  it('a PARENT cannot bulk-mark attendance', async () => {
    const parentToken = await loginAs('tta-parent-a@seeds.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/api/v1/attendance/bulk')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ date: today, marks: [{ studentId: ids.childA, status: 'PRESENT' }] })
      .expect(403);
  });

  it('creating a second timetable entry for the same teacher+day+period is rejected as a scheduling conflict', async () => {
    const adminToken = await loginAs('tta-admin@seeds.edu.pk');

    // ids.teacher already has a Mon/period-1 slot from beforeAll (day 1, period 1).
    await request(app.getHttpServer())
      .post('/api/v1/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionId: ids.section,
        subjectId: (await prisma.subject.findFirst({ where: { name: 'TTA English' } }))!.id,
        teacherId: ids.teacher,
        dayOfWeek: 1,
        period: 1,
        startTime: '09:00',
        endTime: '09:40',
      })
      .expect(409);
  });

  it("a parent sees their own child's attendance-risk status, and cannot see another parent's child's", async () => {
    await prisma.attendanceRiskFlag.upsert({
      where: { studentId: ids.childA },
      create: {
        studentId: ids.childA,
        absenceRate: 0.4,
        flagged: true,
        windowStart: new Date('2026-08-01'),
        windowEnd: new Date('2026-08-31'),
      },
      update: { absenceRate: 0.4, flagged: true },
    });

    const parentAToken = await loginAs('tta-parent-a@seeds.edu.pk');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/attendance-risk`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(res.body.flagged).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/attendance-risk`)
      .set('Authorization', `Bearer ${await loginAs('tta-parent-b@seeds.edu.pk')}`)
      .expect(403);

    await prisma.attendanceRiskFlag.deleteMany({ where: { studentId: ids.childA } });
  });

  it('a TEACHER sees only their own class-teacher sections in the flagged-students list', async () => {
    await prisma.section.update({ where: { id: ids.section }, data: { classTeacherId: ids.teacher } });
    await prisma.attendanceRiskFlag.upsert({
      where: { studentId: ids.childA },
      create: {
        studentId: ids.childA,
        absenceRate: 0.5,
        flagged: true,
        windowStart: new Date('2026-08-01'),
        windowEnd: new Date('2026-08-31'),
      },
      update: { absenceRate: 0.5, flagged: true },
    });

    const teacherToken = await loginAs('tta-teacher@seeds.edu.pk');
    const res = await request(app.getHttpServer())
      .get('/api/v1/attendance-risk')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(res.body.map((r: { studentId: string }) => r.studentId)).toContain(ids.childA);

    await prisma.attendanceRiskFlag.deleteMany({ where: { studentId: ids.childA } });
  });
```

Update the file's `afterAll` cleanup to also clear `attendanceRiskFlag` rows before deleting the students (add alongside the existing `prisma.attendance.deleteMany` call, since `AttendanceRiskFlag.student` is `onDelete: Cascade` but a stray row from a failed test run should still be cleared defensively, matching this file's existing self-healing style):

```typescript
    await prisma.attendanceRiskFlag
      .deleteMany({ where: { studentId: { in: [ids.childA, ids.childB] } } })
      .catch(() => undefined);
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm run test:e2e -- timetable-attendance.e2e-spec.ts`
Expected: all tests (existing + 6 new) PASS against the real Postgres test database.

- [ ] **Step 3: Commit**

```bash
git add backend/test/timetable-attendance.e2e-spec.ts
git commit -m "test(backend): add bulk-attendance, timetable-conflict, attendance-risk e2e coverage"
```

---

### Task 11: e2e — new spec for Holidays, Complaints, Report Cards RBAC + parent-isolation

**Files:**
- Create: `backend/test/holidays-complaints-report-cards.e2e-spec.ts`

**Interfaces:**
- Consumes: `POST/GET/PATCH/DELETE /api/v1/holidays`, `POST/GET/PATCH /api/v1/complaints`, `POST/GET /api/v1/report-cards`, `GET /api/v1/report-cards/:id/pdf` — plus a full fixture matching `timetable-attendance.e2e-spec.ts`'s shape but with an `hcr-` identifier prefix so the two suites' fixtures never collide.

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Holidays + Complaints + Report Cards (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'CorrectHorseBattery9!';
  const ids: Record<string, string> = {};

  async function loginAs(identifier: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier, password })
      .expect(201);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'hcr-' } } })
      .catch(() => undefined);
    const staleStudents = await prisma.student.findMany({ where: { grNumber: { startsWith: 'HCR-' } } });
    for (const s of staleStudents) {
      await prisma.complaint.deleteMany({ where: { studentId: s.id } }).catch(() => undefined);
      await prisma.reportCard.deleteMany({ where: { studentId: s.id } }).catch(() => undefined);
    }
    await prisma.student.deleteMany({ where: { grNumber: { startsWith: 'HCR-' } } }).catch(() => undefined);
    const stale = await prisma.school.findMany({ where: { name: 'HCR E2E School' } });
    for (const s of stale) {
      await prisma.holiday.deleteMany({ where: { campus: { schoolId: s.id } } }).catch(() => undefined);
      await prisma.school.delete({ where: { id: s.id } }).catch(() => undefined);
    }

    const school = await prisma.school.create({ data: { name: 'HCR E2E School' } });
    const campus = await prisma.campus.create({ data: { schoolId: school.id, name: 'Main' } });
    const session = await prisma.academicSession.create({
      data: { label: 'HCR', startDate: new Date(), endDate: new Date(), isActive: true },
    });
    const klass = await prisma.class.create({
      data: { campusId: campus.id, academicSessionId: session.id, name: 'HCR Grade' },
    });
    const section = await prisma.section.create({ data: { classId: klass.id, name: 'HCR-A' } });
    ids.school = school.id;
    ids.campus = campus.id;
    ids.session = session.id;
    ids.section = section.id;

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: { identifier: 'hcr-teacher@seeds.edu.pk', passwordHash, role: 'TEACHER' },
    });
    await prisma.teacher.create({ data: { userId: teacherUser.id, name: 'HCR Teacher' } });
    await prisma.user.create({
      data: { identifier: 'hcr-admin@seeds.edu.pk', passwordHash, role: 'SCHOOL_ADMIN' },
    });

    const parentAUser = await prisma.user.create({
      data: { identifier: 'hcr-parent-a@seeds.edu.pk', passwordHash, role: 'PARENT' },
    });
    const parentBUser = await prisma.user.create({
      data: { identifier: 'hcr-parent-b@seeds.edu.pk', passwordHash, role: 'PARENT' },
    });
    const parentAProfile = await prisma.parentProfile.create({
      data: { userId: parentAUser.id, name: 'HCR Parent A' },
    });
    const parentBProfile = await prisma.parentProfile.create({
      data: { userId: parentBUser.id, name: 'HCR Parent B' },
    });

    const childA = await prisma.student.create({ data: { grNumber: 'HCR-A1', name: 'HCR Child A' } });
    const childB = await prisma.student.create({ data: { grNumber: 'HCR-B1', name: 'HCR Child B' } });
    await prisma.enrollment.create({
      data: {
        studentId: childA.id,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.studentParent.create({ data: { studentId: childA.id, parentProfileId: parentAProfile.id } });
    await prisma.studentParent.create({ data: { studentId: childB.id, parentProfileId: parentBProfile.id } });

    Object.assign(ids, { childA: childA.id, childB: childB.id });
  });

  afterAll(async () => {
    await prisma.complaint.deleteMany({ where: { studentId: { in: [ids.childA, ids.childB] } } }).catch(() => undefined);
    await prisma.reportCard.deleteMany({ where: { studentId: { in: [ids.childA, ids.childB] } } }).catch(() => undefined);
    await prisma.holiday.deleteMany({ where: { campusId: ids.campus } }).catch(() => undefined);
    await prisma.student.deleteMany({ where: { grNumber: { in: ['HCR-A1', 'HCR-B1'] } } }).catch(() => undefined);
    await prisma.school.delete({ where: { id: ids.school } }).catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: [
              'hcr-teacher@seeds.edu.pk',
              'hcr-admin@seeds.edu.pk',
              'hcr-parent-a@seeds.edu.pk',
              'hcr-parent-b@seeds.edu.pk',
            ],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  describe('Holidays', () => {
    it('a SCHOOL_ADMIN can create a holiday; any authenticated user (including a parent) can read it', async () => {
      const adminToken = await loginAs('hcr-admin@seeds.edu.pk');

      const created = await request(app.getHttpServer())
        .post('/api/v1/holidays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'HCR Test Holiday', startDate: '2026-12-01', endDate: '2026-12-01', campusId: ids.campus })
        .expect(201);
      ids.holiday = created.body.id;

      const parentToken = await loginAs('hcr-parent-a@seeds.edu.pk');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/holidays?campusId=${ids.campus}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.map((h: { title: string }) => h.title)).toContain('HCR Test Holiday');
    });

    it('a TEACHER cannot create, update, or delete a holiday', async () => {
      const teacherToken = await loginAs('hcr-teacher@seeds.edu.pk');

      await request(app.getHttpServer())
        .post('/api/v1/holidays')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Unauthorized', startDate: '2026-12-02', endDate: '2026-12-02' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/v1/holidays/${ids.holiday}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Renamed' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/holidays/${ids.holiday}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });
  });

  describe('Complaints', () => {
    it('a TEACHER can raise a complaint for a student, and the linked parent can read it', async () => {
      const teacherToken = await loginAs('hcr-teacher@seeds.edu.pk');

      const created = await request(app.getHttpServer())
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ studentId: ids.childA, subject: 'Late homework', description: 'Missed 3 deadlines' })
        .expect(201);
      ids.complaint = created.body.id;
      expect(created.body.status).toBe('open');

      const parentAToken = await loginAs('hcr-parent-a@seeds.edu.pk');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/complaints?studentId=${ids.childA}`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(200);
      expect(res.body.map((c: { id: string }) => c.id)).toContain(ids.complaint);
    });

    it("a parent CANNOT read another parent's child's complaints", async () => {
      const parentBToken = await loginAs('hcr-parent-b@seeds.edu.pk');

      await request(app.getHttpServer())
        .get(`/api/v1/complaints?studentId=${ids.childA}`)
        .set('Authorization', `Bearer ${parentBToken}`)
        .expect(403);
    });

    it('a PARENT cannot create or update a complaint — read-only for parents', async () => {
      const parentToken = await loginAs('hcr-parent-a@seeds.edu.pk');

      await request(app.getHttpServer())
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ studentId: ids.childA, subject: 'X', description: 'Y' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/v1/complaints/${ids.complaint}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ status: 'resolved' })
        .expect(403);
    });

    it('a SCHOOL_ADMIN can update a complaint\'s status', async () => {
      const adminToken = await loginAs('hcr-admin@seeds.edu.pk');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/complaints/${ids.complaint}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'resolved' })
        .expect(200);

      expect(res.body.status).toBe('resolved');
    });
  });

  describe('Report Cards', () => {
    it('a TEACHER can upload a report card; the linked parent can list and download it', async () => {
      const teacherToken = await loginAs('hcr-teacher@seeds.edu.pk');

      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/report-cards')
        .set('Authorization', `Bearer ${teacherToken}`)
        .field('studentId', ids.childA)
        .field('academicSessionId', ids.session)
        .attach('file', Buffer.from('%PDF-1.4 fake report card'), 'report.pdf')
        .expect(201);
      ids.reportCard = uploadRes.body.id;

      const parentAToken = await loginAs('hcr-parent-a@seeds.edu.pk');
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/report-cards?studentId=${ids.childA}`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(200);
      expect(listRes.body.map((r: { id: string }) => r.id)).toContain(ids.reportCard);

      await request(app.getHttpServer())
        .get(`/api/v1/report-cards/${ids.reportCard}/pdf`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(200);
    });

    it("a parent CANNOT download another parent's child's report card", async () => {
      const parentBToken = await loginAs('hcr-parent-b@seeds.edu.pk');

      await request(app.getHttpServer())
        .get(`/api/v1/report-cards/${ids.reportCard}/pdf`)
        .set('Authorization', `Bearer ${parentBToken}`)
        .expect(403);
    });

    it('uploading a second report card for the same student+session is rejected as a conflict', async () => {
      const teacherToken = await loginAs('hcr-teacher@seeds.edu.pk');

      await request(app.getHttpServer())
        .post('/api/v1/report-cards')
        .set('Authorization', `Bearer ${teacherToken}`)
        .field('studentId', ids.childA)
        .field('academicSessionId', ids.session)
        .attach('file', Buffer.from('%PDF-1.4 duplicate'), 'report2.pdf')
        .expect(409);
    });

    it('a PARENT cannot upload a report card', async () => {
      const parentToken = await loginAs('hcr-parent-a@seeds.edu.pk');

      await request(app.getHttpServer())
        .post('/api/v1/report-cards')
        .set('Authorization', `Bearer ${parentToken}`)
        .field('studentId', ids.childB)
        .field('academicSessionId', ids.session)
        .attach('file', Buffer.from('%PDF-1.4 x'), 'x.pdf')
        .expect(403);
    });
  });
});
```

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm run test:e2e -- holidays-complaints-report-cards.e2e-spec.ts`
Expected: all tests PASS against the real Postgres test database.

- [ ] **Step 3: Commit**

```bash
git add backend/test/holidays-complaints-report-cards.e2e-spec.ts
git commit -m "test(backend): add e2e RBAC + parent-isolation coverage for Holidays/Complaints/Report Cards"
```

---

### Task 12: e2e — new spec for forgot/reset password flow

**Files:**
- Create: `backend/test/auth-password-reset.e2e-spec.ts`

**Interfaces:**
- Consumes: `POST /api/v1/auth/forgot-password`, `POST /api/v1/auth/reset-password`, `POST /api/v1/auth/login`. Reads the real reset token via `prisma.passwordResetToken.findFirst` (the token itself is only ever exposed through the `LoggingMailAdapter`'s log line in this environment, per `PROJECT-STATUS.md`'s note that no real SMTP account exists — the e2e test reads the DB row directly instead of parsing logs, which is both simpler and exercises the real persisted-token contract).

- [ ] **Step 1: Write the test file**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Forgot/Reset Password (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const originalPassword = 'OriginalHorseBattery9!';
  const userIdentifier = 'apr-user@seeds.edu.pk';
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    await prisma.user.deleteMany({ where: { identifier: userIdentifier } }).catch(() => undefined);
    const passwordHash = await argon2.hash(originalPassword);
    const user = await prisma.user.create({
      data: { identifier: userIdentifier, passwordHash, role: 'PARENT' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.refreshToken.deleteMany({ where: { userId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { identifier: userIdentifier } }).catch(() => undefined);
    await app.close();
  });

  it('forgot-password always returns 200 with a generic message, whether or not the identifier exists (no enumeration)', async () => {
    const known = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: userIdentifier })
      .expect(201);
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'nobody-at-all@seeds.edu.pk' })
      .expect(201);

    expect(known.body.message).toEqual(unknown.body.message);

    const tokenRows = await prisma.passwordResetToken.findMany({ where: { userId } });
    expect(tokenRows).toHaveLength(1);
  });

  it('resetting with a fabricated (never-issued) token is rejected', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'WontWork9!' })
      .expect(400);
  });

  it('a full reset round trip: old password stops working, new password works, and old sessions are revoked', async () => {
    // Log in once with the original password to create a refresh token that the reset must revoke.
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: userIdentifier, password: originalPassword })
      .expect(201);
    const oldRefreshToken = loginRes.body.refreshToken as string;

    // Drive the real forgot-password endpoint, then recover the raw token the only way available
    // in this test environment: insert a token this test controls with a known raw value, using
    // the same hash function auth.service.ts uses (sha256), so reset-password's lookup succeeds
    // against a row this test can assert on end-to-end.
    const rawToken = 'e2e-test-raw-token-value';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    const newPassword = 'BrandNewHorseBattery9!';
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword })
      .expect(201);

    // Old password no longer works.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: userIdentifier, password: originalPassword })
      .expect(401);

    // New password works.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: userIdentifier, password: newPassword })
      .expect(201);

    // The refresh token issued before the reset is revoked.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);

    // Reusing the same reset token again is rejected (single-use).
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: 'AnotherPassword9!' })
      .expect(400);
  });
});
```

Note on approach: `forgotPassword`'s response never includes the raw token (by design — it's only ever delivered via `MailAdapter`, and `LoggingMailAdapter` only logs it in this environment). Rather than scraping logs, the round-trip test inserts its own `PasswordResetToken` row directly via Prisma, hashed the same way `auth.service.ts`'s `hashToken()` does (`sha256`), so `resetPassword`'s real lookup-by-hash path is exercised end-to-end without depending on log output.

- [ ] **Step 2: Run it and confirm it passes**

Run: `cd backend && npm run test:e2e -- auth-password-reset.e2e-spec.ts`
Expected: all 3 tests PASS. Verify the `POST /api/v1/auth/refresh` route name and its request/response shape against `backend/src/auth/auth.controller.ts` before running — confirm the field name is `refreshToken` in the request body (matches `RefreshDto`, check `backend/src/auth/dto/refresh.dto.ts` if the test fails on a 400 instead of the expected 401).

- [ ] **Step 3: Commit**

```bash
git add backend/test/auth-password-reset.e2e-spec.ts
git commit -m "test(backend): add forgot/reset-password e2e coverage"
```

---

## Final Verification (after all 12 tasks)

- [ ] Run the full backend suite: `cd backend && npm run lint && npm run build && npm test && npm run test:e2e` — all must be clean/green.
- [ ] Update `PROJECT-STATUS.md`: replace the Sprint I/J/K "Known gap" bullet (the one starting "none of the five new backend modules... have their own spec file") with a note that this plan closed it, listing the new spec file paths and the final test counts (unit + e2e), following this doc's own established format for a sprint close-out entry.
- [ ] Update the roadmap's Implementation Checklist (`docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`) is NOT required — this work backfills existing shipped features' test coverage, it does not close a new roadmap sprint item.
