# Sprint M — P0 Test Coverage, UI Half — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing staff-console component specs and parent-app widget tests for the five
Sprint I/J/K modules that shipped without dedicated UI test coverage, and extend the existing
`AdminHomeView` spec to actually exercise the attendance-risk panel it already renders.

**Architecture:** No new production code and no architectural changes — every task below adds a
test file (or test cases to an existing one) against code that already works today. Each task
follows this project's established `@vue/test-utils`/`vitest` (staff-console) or `flutter_test`
(parent-app) conventions, mirroring the closest existing spec file exactly rather than inventing a
new test shape.

**Tech Stack:** Vue 3 + `@vue/test-utils` + `vitest` + Pinia (staff-console); Flutter +
`flutter_test` + `package:http/testing.dart`'s `MockClient` (parent-app).

**Spec:** `build/docs/superpowers/specs/2026-09-13-sprint-m-test-coverage-ui-design.md`

## Global Constraints

- No production-code behavior changes this sprint (per the spec's Decisions section) — every task
  is additive test coverage only. If a test genuinely surfaces a real bug, stop and flag it rather
  than silently patching production code outside this plan's scope.
- No new test-infrastructure patterns, no snapshot testing — plain component/widget mounts with
  mocked API calls, matching every existing spec in the tree.
- Do **not** write specs for any `*PageView.vue` wrapper (`HolidaysPageView`, `ComplaintsPageView`,
  `ReportCardsPageView`, `TeacherComplaintsPageView`, `TeacherReportCardsPageView`) — confirmed
  zero-logic wrappers, untested everywhere else in this codebase by consistent convention.
- Because every task here tests already-correct production code, the usual "write a failing test
  first" RED step means: write the test, run it, and expect it to **pass** immediately (the
  behavior already exists). If a test unexpectedly fails, that is a signal to stop and investigate
  before continuing — not to change production code to make it pass without understanding why.

---

### Task 1: `HolidaysView.spec.ts`

**Files:**
- Create: `staff-console/src/views/HolidaysView.spec.ts`
- Reference (no changes): `staff-console/src/views/HolidaysView.vue`,
  `staff-console/src/views/CampusManagementView.spec.ts` (template)

**Interfaces:**
- Consumes: `HolidaysView.vue`'s existing template — `data-testid`s `open-add-form`, `add-title`,
  `add-start-date`, `add-end-date`, `add-campus`, `add-submit`, `edit-{id}`, `edit-title-{id}`,
  `save-{id}`, `delete-{id}`; `api.listHolidays(token)`, `api.listCampuses(token)`,
  `api.createHoliday(token, {title, startDate, endDate, campusId?})`,
  `api.updateHoliday(token, id, {title?, startDate?, endDate?})`, `api.deleteHoliday(token, id)`
  (all from `staff-console/src/lib/api.ts`); `useConfirm()` from `staff-console/src/lib/useConfirm.ts`.
- Produces: nothing consumed by later tasks (each task in this plan is independent).

- [ ] **Step 1: Write the spec file**

```ts
// staff-console/src/views/HolidaysView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import HolidaysView from './HolidaysView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';
import { useConfirm } from '../lib/useConfirm';

vi.mock('../lib/api', () => ({
  api: {
    listHolidays: vi.fn(),
    listCampuses: vi.fn(),
    createHoliday: vi.fn(),
    updateHoliday: vi.fn(),
    deleteHoliday: vi.fn(),
  },
}));
vi.mock('../lib/useConfirm', () => ({
  useConfirm: vi.fn(),
}));

describe('HolidaysView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listCampuses).mockResolvedValue([
      { id: 'c1', name: 'Gulistan-e-Jauhar', schoolId: 's1', schoolName: 'The SchoolOS School' },
    ]);
    vi.mocked(useConfirm).mockReturnValue({ confirm: vi.fn().mockResolvedValue(true) });
  });

  it('lists holidays and creates a new one scoped to a campus', async () => {
    vi.mocked(api.listHolidays).mockResolvedValue([
      { id: 'h1', title: 'Eid Break', startDate: '2026-09-01', endDate: '2026-09-03', campusId: null },
    ]);
    vi.mocked(api.createHoliday).mockResolvedValue(undefined);

    const wrapper = mount(HolidaysView);
    await flushPromises();

    expect(wrapper.text()).toContain('Eid Break');
    expect(wrapper.text()).toContain('Every campus');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-title"]').setValue('Winter Break');
    await wrapper.find('[data-testid="add-start-date"]').setValue('2026-12-20');
    await wrapper.find('[data-testid="add-end-date"]').setValue('2027-01-05');
    await wrapper.find('[data-testid="add-campus"]').setValue('c1');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createHoliday).toHaveBeenCalledWith('token-1', {
      title: 'Winter Break',
      startDate: '2026-12-20',
      endDate: '2027-01-05',
      campusId: 'c1',
    });
  });

  it('edits a holiday\'s title and dates', async () => {
    vi.mocked(api.listHolidays).mockResolvedValue([
      { id: 'h1', title: 'Eid Break', startDate: '2026-09-01', endDate: '2026-09-03', campusId: null },
    ]);
    vi.mocked(api.updateHoliday).mockResolvedValue(undefined);

    const wrapper = mount(HolidaysView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-h1"]').trigger('click');
    await wrapper.find('[data-testid="edit-title-h1"]').setValue('Eid-ul-Fitr Break');
    await wrapper.find('[data-testid="save-h1"]').trigger('click');
    await flushPromises();

    expect(api.updateHoliday).toHaveBeenCalledWith('token-1', 'h1', {
      title: 'Eid-ul-Fitr Break',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
    });
  });

  it('deletes a holiday after confirmation, and does nothing if declined', async () => {
    vi.mocked(api.listHolidays).mockResolvedValue([
      { id: 'h1', title: 'Eid Break', startDate: '2026-09-01', endDate: '2026-09-03', campusId: null },
    ]);
    vi.mocked(api.deleteHoliday).mockResolvedValue(undefined);
    const confirmFn = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    vi.mocked(useConfirm).mockReturnValue({ confirm: confirmFn });

    const wrapper = mount(HolidaysView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-h1"]').trigger('click');
    await flushPromises();
    expect(api.deleteHoliday).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="delete-h1"]').trigger('click');
    await flushPromises();
    expect(api.deleteHoliday).toHaveBeenCalledWith('token-1', 'h1');
    expect(confirmFn).toHaveBeenCalledWith({
      title: 'Delete this holiday?',
      message: 'This cannot be undone.',
      danger: true,
    });
  });

  it('shows an error message when loading or saving fails', async () => {
    vi.mocked(api.listHolidays).mockRejectedValue(new Error('Network down'));

    const wrapper = mount(HolidaysView);
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `cd staff-console && npx vitest run src/views/HolidaysView.spec.ts`
Expected: 4 passed (this is coverage-backfill against already-correct code, not new behavior — a
failure here means investigate before continuing, not adjust production code blindly).

- [ ] **Step 3: Commit**

```bash
git add staff-console/src/views/HolidaysView.spec.ts
git commit -m "test: add HolidaysView coverage (Sprint M)"
```

---

### Task 2: `ComplaintsQueueView.spec.ts`

**Files:**
- Create: `staff-console/src/views/ComplaintsQueueView.spec.ts`
- Reference (no changes): `staff-console/src/views/ComplaintsQueueView.vue`

**Interfaces:**
- Consumes: `data-testid`s `open-add-form`, `select-student`, `add-subject`, `add-description`,
  `add-submit`, `status-{id}` (a `<select>`); `api.listAdminStudents(token)`,
  `api.listComplaints(token, studentId)`,
  `api.createComplaint(token, {studentId, subject, description})`,
  `api.updateComplaintStatus(token, id, status)`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the spec file**

```ts
// staff-console/src/views/ComplaintsQueueView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ComplaintsQueueView from './ComplaintsQueueView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listAdminStudents: vi.fn(),
    listComplaints: vi.fn(),
    createComplaint: vi.fn(),
    updateComplaintStatus: vi.fn(),
  },
}));

describe('ComplaintsQueueView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listAdminStudents).mockResolvedValue([
      { id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample', sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
  });

  it('loads a student\'s complaints once selected, and raises a new one', async () => {
    vi.mocked(api.listComplaints).mockResolvedValue([
      { id: 'cm1', studentId: 's1', raisedById: 'u1', subject: 'Late pickup', description: 'Repeated late pickup', status: 'open' },
    ]);
    vi.mocked(api.createComplaint).mockResolvedValue(undefined);

    const wrapper = mount(ComplaintsQueueView);
    await flushPromises();
    expect(api.listComplaints).not.toHaveBeenCalled();

    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    expect(api.listComplaints).toHaveBeenCalledWith('token-1', 's1');
    expect(wrapper.text()).toContain('Late pickup');

    await wrapper.find('[data-testid="open-add-form"]').trigger('click');
    await wrapper.find('[data-testid="add-subject"]').setValue('Uniform issue');
    await wrapper.find('[data-testid="add-description"]').setValue('Missing badge');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createComplaint).toHaveBeenCalledWith('token-1', {
      studentId: 's1',
      subject: 'Uniform issue',
      description: 'Missing badge',
    });
  });

  it('transitions a complaint\'s status and reloads the list', async () => {
    vi.mocked(api.listComplaints).mockResolvedValue([
      { id: 'cm1', studentId: 's1', raisedById: 'u1', subject: 'Late pickup', description: 'Repeated late pickup', status: 'open' },
    ]);
    vi.mocked(api.updateComplaintStatus).mockResolvedValue(undefined);

    const wrapper = mount(ComplaintsQueueView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    await wrapper.find('[data-testid="status-cm1"]').setValue('in_progress');
    await flushPromises();

    expect(api.updateComplaintStatus).toHaveBeenCalledWith('token-1', 'cm1', 'in_progress');
    expect(api.listComplaints).toHaveBeenCalledTimes(2);
  });

  it('shows an error message when a call fails', async () => {
    vi.mocked(api.listComplaints).mockRejectedValue(new Error('Network down'));

    const wrapper = mount(ComplaintsQueueView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Network down');
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `cd staff-console && npx vitest run src/views/ComplaintsQueueView.spec.ts`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add staff-console/src/views/ComplaintsQueueView.spec.ts
git commit -m "test: add ComplaintsQueueView coverage (Sprint M)"
```

---

### Task 3: `ReportCardsView.spec.ts`

**Files:**
- Create: `staff-console/src/views/ReportCardsView.spec.ts`
- Reference (no changes): `staff-console/src/views/ReportCardsView.vue`,
  `staff-console/src/views/TeacherReportCardsView.spec.ts` (template)

**Interfaces:**
- Consumes: `data-testid`s `select-student`, `select-session`, `select-file`, `upload-submit`,
  `download-{id}`; `api.listAdminStudents(token)`, `api.listAcademicSessions(token)`,
  `api.listReportCards(token, studentId)`,
  `api.uploadReportCard(token, {studentId, academicSessionId, file})`,
  `api.reportCardPdfUrl(token, id)`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the spec file**

```ts
// staff-console/src/views/ReportCardsView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ReportCardsView from './ReportCardsView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listAdminStudents: vi.fn(),
    listAcademicSessions: vi.fn(),
    listReportCards: vi.fn(),
    uploadReportCard: vi.fn(),
    reportCardPdfUrl: vi.fn(() => 'https://example.test/pdf'),
  },
}));

describe('ReportCardsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listAdminStudents).mockReset();
    vi.mocked(api.listAcademicSessions).mockReset();
    vi.mocked(api.listReportCards).mockReset();
    vi.mocked(api.uploadReportCard).mockReset();
    vi.mocked(api.listAdminStudents).mockResolvedValue([
      { id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample', sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'sess-1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
  });

  it('lists a student\'s existing report cards once selected', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([
      { id: 'rc1', studentId: 's1', academicSessionId: 'sess-1', fileId: 'f1', createdAt: '2026-06-01T00:00:00.000Z' },
    ]);

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    expect(wrapper.find('[data-testid="download-rc1"]').exists()).toBe(false);

    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    expect(api.listReportCards).toHaveBeenCalledWith('token-1', 's1');
    expect(wrapper.find('[data-testid="download-rc1"]').exists()).toBe(true);
  });

  it('shows an empty state when a student has no report cards', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([]);

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await flushPromises();

    expect(wrapper.text()).toContain('No report cards uploaded yet.');
  });

  it('uploads a report card for the selected student and session', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([]);
    vi.mocked(api.uploadReportCard).mockResolvedValue(undefined);

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await wrapper.find('[data-testid="select-session"]').setValue('sess-1');
    await flushPromises();

    const file = new File(['pdf-bytes'], 'card.pdf', { type: 'application/pdf' });
    const fileInput = wrapper.find('[data-testid="select-file"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    await wrapper.find('[data-testid="select-file"]').trigger('change');

    await wrapper.find('[data-testid="upload-submit"]').trigger('click');
    await flushPromises();

    expect(api.uploadReportCard).toHaveBeenCalledWith('token-1', {
      studentId: 's1',
      academicSessionId: 'sess-1',
      file,
    });
  });

  it('shows the backend error on a duplicate upload for the same student and session', async () => {
    vi.mocked(api.listReportCards).mockResolvedValue([]);
    vi.mocked(api.uploadReportCard).mockRejectedValue(
      new Error('A report card already exists for this student and session'),
    );

    const wrapper = mount(ReportCardsView);
    await flushPromises();
    await wrapper.find('[data-testid="select-student"]').setValue('s1');
    await wrapper.find('[data-testid="select-session"]').setValue('sess-1');
    await flushPromises();

    const file = new File(['pdf-bytes'], 'card.pdf', { type: 'application/pdf' });
    const fileInput = wrapper.find('[data-testid="select-file"]').element as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [file] });
    await wrapper.find('[data-testid="select-file"]').trigger('change');
    await wrapper.find('[data-testid="upload-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('already exists for this student and session');
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `cd staff-console && npx vitest run src/views/ReportCardsView.spec.ts`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add staff-console/src/views/ReportCardsView.spec.ts
git commit -m "test: add ReportCardsView coverage (Sprint M)"
```

---

### Task 4: "Suggest draft" coverage on `DiaryView.spec.ts`

**Files:**
- Modify: `staff-console/src/views/DiaryView.spec.ts`
- Reference (no changes): `staff-console/src/views/DiaryView.vue:24-42,145-163`

**Interfaces:**
- Consumes: `data-testid`s `suggest-draft-toggle`, `draft-context-input`, `draft-context-submit`,
  `entry-text` (a `<textarea>` bound to `text`); `api.suggestDiaryDraft(token, context): Promise<{
  suggestion: string }>`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add the mock and test cases**

Add `suggestDiaryDraft: vi.fn()` to the existing `vi.mock('../lib/api', ...)` factory (alongside
`listSections`, `listSubjects`, `listSectionDiary`, `uploadFile`, `createDiaryEntry`) and
`vi.mocked(api.suggestDiaryDraft).mockReset()` to the existing `beforeEach`. Then add:

```ts
it('generates a draft suggestion and inserts it into the entry text, without publishing', async () => {
  vi.mocked(api.listSections).mockResolvedValue([
    { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
  ]);
  vi.mocked(api.listSubjects).mockResolvedValue([{ id: 'sub-1', name: 'Urdu' }]);
  vi.mocked(api.listSectionDiary).mockResolvedValue([]);
  vi.mocked(api.suggestDiaryDraft).mockResolvedValue({
    suggestion: 'Please complete chapter 4 exercises by Monday.',
  });

  const wrapper = mount(DiaryView);
  await flushPromises();

  await wrapper.find('[data-testid="suggest-draft-toggle"]').trigger('click');
  await wrapper.find('[data-testid="draft-context-input"]').setValue('Homework reminder for chapter 4');
  await wrapper.find('[data-testid="draft-context-submit"]').trigger('click');
  await flushPromises();

  expect(api.suggestDiaryDraft).toHaveBeenCalledWith('token-1', 'Homework reminder for chapter 4');
  expect((wrapper.find('[data-testid="entry-text"]').element as HTMLTextAreaElement).value).toBe(
    'Please complete chapter 4 exercises by Monday.',
  );
  expect(api.createDiaryEntry).not.toHaveBeenCalled();
});
```

(Read the existing file first to match its exact `auth.accessToken` setup and `beforeEach` shape
before inserting — do not duplicate a second `describe`/`beforeEach` block.)

- [ ] **Step 2: Run the spec**

Run: `cd staff-console && npx vitest run src/views/DiaryView.spec.ts`
Expected: all cases pass, including the new one.

- [ ] **Step 3: Commit**

```bash
git add staff-console/src/views/DiaryView.spec.ts
git commit -m "test: cover Suggest draft on DiaryView (Sprint M)"
```

---

### Task 5: "Suggest draft" coverage on `CircularsView.spec.ts`

**Files:**
- Modify: `staff-console/src/views/CircularsView.spec.ts`
- Reference (no changes): `staff-console/src/views/CircularsView.vue:24-39,128-164`

**Interfaces:**
- Consumes: `data-testid`s `suggest-draft-toggle`, `draft-context-input`, `draft-context-submit`,
  `description-input` (a `<textarea>` bound to `description`), `publish-circular`;
  `api.suggestCircularDraft(token, context): Promise<{ suggestion: string }>`. This file's existing
  `mountView()` helper (it wires a router because the component calls `useRoute()`) must be reused,
  not remounted a different way.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add the mock and test case**

Add `suggestCircularDraft: vi.fn()` to the existing `vi.mock('../lib/api', ...)` factory (alongside
`listSections`, `listCirculars`, `circularStats`, `uploadFile`, `publishCircular`) and its
`.mockReset()` to the existing `beforeEach`. Then add:

```ts
it('generates a draft suggestion and inserts it into the description, without publishing', async () => {
  vi.mocked(api.listSections).mockResolvedValue([
    { id: 'sec-1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
  ]);
  vi.mocked(api.listCirculars).mockResolvedValue([]);
  vi.mocked(api.circularStats).mockResolvedValue({ delivered: 0, read: 0 });
  vi.mocked(api.suggestCircularDraft).mockResolvedValue({
    suggestion: 'The Parent-Teacher meeting is scheduled for Friday, 9 AM.',
  });

  const wrapper = await mountView();
  await flushPromises();

  await wrapper.find('[data-testid="suggest-draft-toggle"]').trigger('click');
  await wrapper.find('[data-testid="draft-context-input"]').setValue('Parent-teacher meeting next Friday');
  await wrapper.find('[data-testid="draft-context-submit"]').trigger('click');
  await flushPromises();

  expect(api.suggestCircularDraft).toHaveBeenCalledWith('token-1', 'Parent-teacher meeting next Friday');
  expect((wrapper.find('[data-testid="description-input"]').element as HTMLTextAreaElement).value).toBe(
    'The Parent-Teacher meeting is scheduled for Friday, 9 AM.',
  );
  expect(api.publishCircular).not.toHaveBeenCalled();
});
```

(Read the existing file first to confirm the exact `circularStats` fixture shape the other tests
already use — reuse it rather than guessing a new one.)

- [ ] **Step 2: Run the spec**

Run: `cd staff-console && npx vitest run src/views/CircularsView.spec.ts`
Expected: all cases pass, including the new one.

- [ ] **Step 3: Commit**

```bash
git add staff-console/src/views/CircularsView.spec.ts
git commit -m "test: cover Suggest draft on CircularsView (Sprint M)"
```

---

### Task 6: Attendance-risk panel coverage on `AdminHomeView.spec.ts`

**Files:**
- Modify: `staff-console/src/views/AdminHomeView.spec.ts`
- Reference (no changes): `staff-console/src/views/AdminHomeView.vue:7,12,25-37,118-128`

**Interfaces:**
- Consumes: `data-testid`s `attendance-risk-panel`, `risk-student-{studentId}`;
  `api.getFlaggedStudents(token): Promise<AttendanceRiskSummary[]>` where
  `AttendanceRiskSummary = { studentId: string; studentName: string; absenceRate: number; flagged: boolean }`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Extend the mock and give every existing test a default**

Change the mock factory to:
```ts
vi.mock('../lib/api', () => ({
  api: { dashboardSummary: vi.fn(), getFlaggedStudents: vi.fn() },
}));
```
Add `vi.mocked(api.getFlaggedStudents).mockReset()` next to the existing
`vi.mocked(api.dashboardSummary).mockReset()` in `beforeEach`, then add
`vi.mocked(api.getFlaggedStudents).mockResolvedValue([]);` as the first line inside each of the
three existing `it(...)` blocks (each already calls `vi.mocked(api.dashboardSummary).mockResolvedValue(...)`
as its first line — add the new line directly above or below it in each). This keeps all three
existing tests exercising exactly the same behavior as before (no flagged students, panel absent).

- [ ] **Step 2: Run the existing suite to confirm nothing broke**

Run: `cd staff-console && npx vitest run src/views/AdminHomeView.spec.ts`
Expected: the original 3 tests still pass.

- [ ] **Step 3: Add the three new cases**

```ts
it('renders one row per flagged student in the attendance-risk panel', async () => {
  vi.mocked(api.dashboardSummary).mockResolvedValue(fixture);
  vi.mocked(api.getFlaggedStudents).mockResolvedValue([
    { studentId: 's1', studentName: 'Eshaal Sample', absenceRate: 0.32, flagged: true },
    { studentId: 's2', studentName: 'Ahmed Sample', absenceRate: 0.41, flagged: true },
  ]);

  const wrapper = await mountView();

  const panel = wrapper.find('[data-testid="attendance-risk-panel"]');
  expect(panel.exists()).toBe(true);
  expect(wrapper.find('[data-testid="risk-student-s1"]').text()).toContain('Eshaal Sample');
  expect(panel.text()).toContain('32% absent');
  expect(wrapper.find('[data-testid="risk-student-s2"]').text()).toContain('Ahmed Sample');
  expect(panel.text()).toContain('41% absent');
});

it('shows no attendance-risk panel when no student is flagged', async () => {
  vi.mocked(api.dashboardSummary).mockResolvedValue(fixture);
  vi.mocked(api.getFlaggedStudents).mockResolvedValue([]);

  const wrapper = await mountView();

  expect(wrapper.find('[data-testid="attendance-risk-panel"]').exists()).toBe(false);
});

it('still renders the rest of the dashboard when the attendance-risk fetch fails', async () => {
  vi.mocked(api.dashboardSummary).mockResolvedValue(fixture);
  vi.mocked(api.getFlaggedStudents).mockRejectedValue(new Error('Network down'));

  const wrapper = await mountView();

  expect(wrapper.find('[data-testid="attendance-risk-panel"]').exists()).toBe(false);
  expect(wrapper.text()).toContain('128'); // KPI still rendered
  expect(wrapper.find('[role="alert"]').exists()).toBe(false); // this failure is swallowed, not surfaced
});
```
(Insert these inside the existing `describe('AdminHomeView (Dashboard)', ...)` block, after the
three existing tests — reusing the file's existing `fixture` object and `mountView()` helper.)

- [ ] **Step 4: Run the full spec**

Run: `cd staff-console && npx vitest run src/views/AdminHomeView.spec.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/AdminHomeView.spec.ts
git commit -m "test: cover attendance-risk panel on AdminHomeView (Sprint M)"
```

---

### Task 7: `complaints_screen_test.dart` (parent-app)

**Files:**
- Create: `parent-app/test/screens/complaints_screen_test.dart`
- Reference (no changes): `parent-app/lib/src/screens/complaints_screen.dart`,
  `parent-app/test/screens/leave_screen_test.dart` (template)

**Interfaces:**
- Consumes: `ComplaintsScreen({accessToken, api, children, initialChildId})`;
  `ApiClient.complaints(accessToken, studentId) -> List<Complaint>` hitting
  `GET /api/v1/complaints?studentId=...`; `Complaint({id, studentId, subject, description, status, createdAt})`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the test file**

```dart
// parent-app/test/screens/complaints_screen_test.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/complaints_screen.dart';

const _child = ChildSummary(
  id: 'child-1',
  name: 'Eshaal Sample',
  grNumber: 'GR-1001',
  campus: 'Gulistan-e-Jauhar',
  schoolClass: 'Grade 3',
  section: '3A',
);

const _secondChild = ChildSummary(
  id: 'child-2',
  name: 'Ahmed Sample',
  grNumber: 'GR-2002',
  campus: 'Gulshan-e-Iqbal',
  schoolClass: 'Grade 6',
  section: '6B',
);

void main() {
  testWidgets('shows a loading state, then a student\'s complaints', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/complaints') {
          expect(request.url.queryParameters['studentId'], 'child-1');
          return http.Response(
            jsonEncode([
              {
                'id': 'cm1',
                'studentId': 'child-1',
                'subject': 'Late pickup',
                'description': 'Repeated late pickup',
                'status': 'open',
                'createdAt': '2026-09-01T00:00:00.000Z',
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ComplaintsScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();

    expect(find.text('Late pickup'), findsOneWidget);
    expect(find.text('Repeated late pickup'), findsOneWidget);
    expect(find.text('open'), findsOneWidget);
  });

  testWidgets('shows an empty state when there are no complaints', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async => http.Response(jsonEncode(<dynamic>[]), 200)),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ComplaintsScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No complaints on record.'), findsOneWidget);
  });

  testWidgets('defaults to the actively-selected child and reloads on switch', (tester) async {
    String? requestedStudentId;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        requestedStudentId = request.url.queryParameters['studentId'];
        return http.Response(jsonEncode(<dynamic>[]), 200);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ComplaintsScreen(
          accessToken: 'tok',
          api: api,
          children: const [_child, _secondChild],
          initialChildId: 'child-2',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(requestedStudentId, 'child-2');

    await tester.tap(find.byKey(const Key('complaintsChildDropdown')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Eshaal Sample').last);
    await tester.pumpAndSettle();

    expect(requestedStudentId, 'child-1');
  });
}
```

- [ ] **Step 2: Run the test**

Run: `cd parent-app && flutter test test/screens/complaints_screen_test.dart`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add parent-app/test/screens/complaints_screen_test.dart
git commit -m "test: add complaints_screen coverage (Sprint M)"
```

---

### Task 8: `report_cards_screen_test.dart` (parent-app)

**Files:**
- Create: `parent-app/test/screens/report_cards_screen_test.dart`
- Reference (no changes): `parent-app/lib/src/screens/report_cards_screen.dart`

**Interfaces:**
- Consumes: `ReportCardsScreen({accessToken, api, children, initialChildId})`;
  `ApiClient.reportCards(accessToken, studentId) -> List<ReportCard>` hitting
  `GET /api/v1/report-cards?studentId=...`;
  `ReportCard({id, studentId, academicSessionId, fileId, createdAt})`.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Write the test file**

```dart
// parent-app/test/screens/report_cards_screen_test.dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/report_cards_screen.dart';

const _child = ChildSummary(
  id: 'child-1',
  name: 'Eshaal Sample',
  grNumber: 'GR-1001',
  campus: 'Gulistan-e-Jauhar',
  schoolClass: 'Grade 3',
  section: '3A',
);

const _secondChild = ChildSummary(
  id: 'child-2',
  name: 'Ahmed Sample',
  grNumber: 'GR-2002',
  campus: 'Gulshan-e-Iqbal',
  schoolClass: 'Grade 6',
  section: '6B',
);

void main() {
  testWidgets('shows a loading state, then a student\'s report cards', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/report-cards') {
          expect(request.url.queryParameters['studentId'], 'child-1');
          return http.Response(
            jsonEncode([
              {
                'id': 'rc1',
                'studentId': 'child-1',
                'academicSessionId': 'sess-1',
                'fileId': 'f1',
                'createdAt': '2026-06-01T00:00:00.000Z',
              },
            ]),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ReportCardsScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    await tester.pumpAndSettle();

    expect(find.textContaining('Report card — 2026-06-01'), findsOneWidget);
    expect(find.byIcon(Icons.download_outlined), findsOneWidget);
  });

  testWidgets('shows an empty state when there are no report cards', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async => http.Response(jsonEncode(<dynamic>[]), 200)),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ReportCardsScreen(accessToken: 'tok', api: api, children: const [_child]),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No report cards uploaded yet.'), findsOneWidget);
  });

  testWidgets('defaults to the actively-selected child and reloads on switch', (tester) async {
    String? requestedStudentId;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        requestedStudentId = request.url.queryParameters['studentId'];
        return http.Response(jsonEncode(<dynamic>[]), 200);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: ReportCardsScreen(
          accessToken: 'tok',
          api: api,
          children: const [_child, _secondChild],
          initialChildId: 'child-2',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(requestedStudentId, 'child-2');

    await tester.tap(find.byKey(const Key('reportCardsChildDropdown')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Eshaal Sample').last);
    await tester.pumpAndSettle();

    expect(requestedStudentId, 'child-1');
  });
}
```

- [ ] **Step 2: Run the test**

Run: `cd parent-app && flutter test test/screens/report_cards_screen_test.dart`
Expected: 3 passed.

- [ ] **Step 3: Commit**

```bash
git add parent-app/test/screens/report_cards_screen_test.dart
git commit -m "test: add report_cards_screen coverage (Sprint M)"
```

---

### Task 9: Full-suite verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full backend, staff-console, and parent-app suites**

```bash
cd backend && npm test && npm run test:e2e
cd ../staff-console && npx vitest run && npx vue-tsc --noEmit
cd ../parent-app && flutter analyze && flutter test
```
Expected: all green, no regressions introduced by this sprint's new test files.

- [ ] **Step 2: Update the roadmap doc's Implementation Checklist**

In `docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md`, check off Sprint M's box
and its sub-items, noting the merge commit range and date, per this project's established
Implementation Checklist convention (see Sprints A-L's entries for the exact format).

- [ ] **Step 3: Commit**

```bash
git add docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md
git commit -m "docs: mark Sprint M complete in the roadmap checklist"
```
