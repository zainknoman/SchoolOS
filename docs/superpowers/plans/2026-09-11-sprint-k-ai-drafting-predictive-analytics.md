# Sprint K — Differentiation Kickoff: AI Drafting + Predictive Analytics (Phase 7–8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the project's first genuinely differentiated (not at-parity) capability — an
AI-assisted first draft on circular/diary compose, and an attendance early-warning panel on the admin
dashboard — following the "never auto-publish without staff review" and "computed from existing data,
no new collection" constraints the roadmap sets for both.

**Architecture:** Two independent new bounded contexts (`ai-drafting`, `attendance-risk`), each
additive to existing controllers/views rather than replacing anything. `AiDraftingProvider` is a
swappable interface (mirrors `StorageAdapter`/`PaymentGatewayAdapter`/`PushAdapter`) defaulting to a
non-LLM stub. `AttendanceRiskService` computes nightly via the job runner Sprint H already wired up
(`@nestjs/schedule`, `ScheduleModule.forRoot()`), writing precomputed flags a dashboard panel reads
cheaply. Early-warning alerts route through the existing `NotificationsService.notify()` exactly as
Sprint H left it — no changes to its channel/digest logic, just one new `NotificationType` member.

**Tech Stack:** NestJS + Prisma backend (`@anthropic-ai/sdk` new dependency), Vue 3 staff-console
(reuses `TrendsSparkline.vue`) — no parent-app work (compose is staff-only, confirmed absent there).

**Spec:** `docs/superpowers/specs/2026-09-11-sprint-k-ai-drafting-predictive-analytics-design.md`

## Global Constraints

- **Draft suggestions never auto-publish.** Every draft-suggestion response is placed into the
  existing compose textarea for the staff member to edit; the existing publish/create endpoints are
  never modified to accept or auto-apply a suggestion.
- **The two draft-suggestion endpoints use different role sets, matching each entity's real write
  permissions exactly** — circulars: `SCHOOL_ADMIN, SUPER_ADMIN` only (teachers cannot publish
  circulars); diary: `TEACHER, SCHOOL_ADMIN, SUPER_ADMIN`. Do not introduce a shared "staff" role
  constant for these two endpoints.
- **Never include unrelated student PII in an LLM prompt.** The `context` field is staff-typed free
  text; the draft-suggestion flow never auto-pulls a student record into the prompt.
- **No real Anthropic API key exists in this environment.** `StubAiDraftingProvider` is the default
  and must be fully exercised (not skipped) in dev/CI — mock the real provider in tests, never call
  the live API.
- **Risk flags are precomputed nightly, never computed live on a dashboard request** — the read
  endpoints only ever read the `AttendanceRiskFlag` table.
- **`HOLIDAY` and `LEAVE` attendance rows are excluded from the absence-rate denominator.** Confirm
  the exact `AttendanceStatus` enum values in `schema.prisma` before writing the query (Task 4, Step
  1) — do not assume the set from this plan's prose alone.
- Confirm which file actually renders each compose route (`CircularsView.vue` vs.
  `CircularsPageView.vue`; `DiaryView.vue` vs. `DiaryPageView.vue`) before adding the "Suggest draft"
  button — do not assume based on filename alone.

---

## File Structure

- `backend/prisma/schema.prisma` (modify) — `DraftSuggestion`, `AttendanceRiskFlag` models.
- `backend/prisma/migrations/*` (new).
- `backend/package.json` (modify) — add `@anthropic-ai/sdk`.
- `backend/src/ai-drafting/` (new) — `ai-drafting.module.ts`, `ai-drafting-provider.ts`,
  `anthropic-drafting.provider.ts`, `stub-drafting.provider.ts`, `anthropic-config.ts`,
  `ai-drafting.service.ts`.
- `backend/src/circulars/circulars.controller.ts` (modify) — `POST /draft-suggestion`.
- `backend/src/diary/diary.controller.ts` (modify) — `POST /draft-suggestion`.
- `backend/src/attendance-risk/` (new) — `attendance-risk.module.ts`, `.constants.ts`,
  `.service.ts`, `.controller.ts`, `.job.ts`.
- `backend/src/notifications/notifications.service.ts` (modify) — add `'attendance-risk'` to
  `NotificationType`.
- `staff-console/src/views/CircularsView.vue` (or `CircularsPageView.vue`, confirm first),
  `DiaryView.vue` (or `DiaryPageView.vue`, confirm first) (modify) — "Suggest draft" button.
- `staff-console/src/views/AdminHomeView.vue` (modify) — early-warning panel.
- `staff-console/src/lib/api.ts` (modify) — new client methods.
- Test files: unit specs per new backend service/provider; e2e for both new controller routes;
  a component spec for the new dashboard panel.

---

### Task 1: `AiDraftingProvider` (Anthropic + stub) and `AiDraftingModule`

**Files:**
- New: `backend/src/ai-drafting/ai-drafting-provider.ts`, `anthropic-drafting.provider.ts`,
  `stub-drafting.provider.ts`, `anthropic-config.ts`, `ai-drafting.module.ts`
- Modify: `backend/package.json`
- Test: `anthropic-config.spec.ts`, `anthropic-drafting.provider.spec.ts`,
  `stub-drafting.provider.spec.ts`

**Interfaces:**
- Produces: `AiDraftingProvider.suggestDraft({context, targetType}): Promise<string>` — consumed by
  Task 2.

- [ ] **Step 1:** Add `@anthropic-ai/sdk` to `backend/package.json`, run install.
- [ ] **Step 2:** Write failing unit tests for `resolveAnthropicConfig()`: `ANTHROPIC_API_KEY` unset
  → `undefined`; set → `{ apiKey }`.
- [ ] **Step 3:** Implement `resolveAnthropicConfig`. Run the test, confirm pass.
- [ ] **Step 4:** Write a failing unit test for `StubAiDraftingProvider.suggestDraft`: returns the
  exact fixed placeholder string for both `targetType` values, makes no network call (assert no
  fetch/SDK mock was invoked).
- [ ] **Step 5:** Implement `StubAiDraftingProvider`. Run the test, confirm pass.
- [ ] **Step 6:** Write a failing unit test for `AnthropicDraftingProvider.suggestDraft`: given a
  mocked Anthropic client, calls it with a system prompt that mentions the `targetType` and the given
  `context`, and returns the mocked response text.
- [ ] **Step 7:** Implement `AnthropicDraftingProvider` against the real `@anthropic-ai/sdk` client
  (constructed from `resolveAnthropicConfig()`'s `apiKey`). Run the test, confirm pass.
- [ ] **Step 8:** Implement `AiDraftingModule` providing `AI_DRAFTING_PROVIDER` via a factory: stub
  when `resolveAnthropicConfig()` returns `undefined`, real otherwise. Run `npm run build`.
- [ ] **Step 9: Commit**
  ```bash
  git add backend/package.json backend/package-lock.json backend/src/ai-drafting
  git commit -m "feat(backend): add AiDraftingProvider (Anthropic + stub) behind a swappable interface"
  ```

---

### Task 2: `DraftSuggestion` model + `AiDraftingService` + endpoints

**Files:**
- Modify: `backend/prisma/schema.prisma`, `backend/src/circulars/circulars.controller.ts`,
  `backend/src/diary/diary.controller.ts`
- New: migration, `backend/src/ai-drafting/ai-drafting.service.ts`,
  `dto/suggest-draft.dto.ts`
- Test: `ai-drafting.service.spec.ts`, `backend/test/circulars.e2e-spec.ts` (extend),
  `backend/test/diary.e2e-spec.ts` (extend)

**Interfaces:**
- Consumes: Task 1's `AI_DRAFTING_PROVIDER`.
- Produces: `AiDraftingService.suggestDraft(userId, targetType, context): Promise<{suggestion:
  string}>`, `POST /api/v1/circulars/draft-suggestion`, `POST /api/v1/diary/draft-suggestion`.

- [ ] **Step 1:** Add to `schema.prisma`:
  ```prisma
  model DraftSuggestion {
    id         String   @id @default(uuid())
    userId     String?
    user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
    targetType String
    prompt     String
    suggestion String
    createdAt  DateTime @default(now())

    @@index([userId])
  }
  ```
  Run `npx prisma migrate dev --name add_draft_suggestion`.
- [ ] **Step 2:** Write a failing unit test for `AiDraftingService.suggestDraft`: calls the injected
  provider, persists exactly one `DraftSuggestion` row with the right `targetType`/`prompt`/
  `suggestion`, and returns `{ suggestion }`.
- [ ] **Step 3:** Implement `AiDraftingService` and `SuggestDraftDto { context: string }`. Run the
  test, confirm pass.
- [ ] **Step 4:** Write failing e2e tests: `POST /api/v1/circulars/draft-suggestion` —
  `SCHOOL_ADMIN`/`SUPER_ADMIN` succeed, `TEACHER` gets 403 (matching real
  `POST /api/v1/circulars` permissions exactly). `POST /api/v1/diary/draft-suggestion` — `TEACHER`
  succeeds too.
- [ ] **Step 5:** Add the two controller routes to `CircularsController`/`DiaryController` with the
  exact same `@Roles(...)` each controller's existing publish/create route already uses. Wire
  `AiDraftingModule` into whichever modules need it (import into `CircularsModule`/`DiaryModule`, or
  export from a shared module — confirm the existing cross-module injection pattern used elsewhere,
  e.g. how `StudentAccessService` is shared). Run e2e, confirm pass. Run `npm run build`.
- [ ] **Step 6: Commit**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/ai-drafting backend/src/circulars backend/src/diary
  git commit -m "feat(backend): add draft-suggestion endpoints on circulars and diary, audit-logged via DraftSuggestion"
  ```

---

### Task 3: "Suggest draft" button — staff-console

**Files:**
- Modify: whichever file renders each compose route (confirm `CircularsView.vue` vs.
  `CircularsPageView.vue`, `DiaryView.vue` vs. `DiaryPageView.vue` first), `staff-console/src/lib/api.ts`
- Test: matching `.spec.ts` for each modified view

**Interfaces:**
- Consumes: Task 2's two draft-suggestion endpoints.
- Produces: `api.suggestCircularDraft(context)`, `api.suggestDiaryDraft(context)`.

- [ ] **Step 1:** Open the router config to confirm which file (`*View.vue` or `*PageView.vue`)
  actually renders `/admin/circulars` (or wherever circulars compose lives) and the diary-compose
  route. Read that file's current form structure.
- [ ] **Step 2:** Write a failing test for the circulars compose file: a "Suggest draft" button opens
  a one-line context input; submitting it calls `api.suggestCircularDraft` and appends the result
  into the `description-input` textarea without clearing existing content.
- [ ] **Step 3:** Add `api.suggestCircularDraft(context)` to `api.ts` and implement the button +
  inline context input in the confirmed circulars-compose file. Run the test, confirm pass.
- [ ] **Step 4:** Repeat Steps 2-3 for the diary-compose file (`api.suggestDiaryDraft`, appending into
  `entry-text`).
- [ ] **Step 5:** Run `npm run test`, `type-check`, `lint` for the full staff-console suite (both
  compose views are otherwise well-covered — confirm no regression).
- [ ] **Step 6: Commit**
  ```bash
  git add staff-console/src
  git commit -m "feat(staff-console): add Suggest draft to circulars and diary compose"
  ```

---

### Task 4: `AttendanceRiskFlag` model + `AttendanceRiskService` + nightly job

**Files:**
- Modify: `backend/prisma/schema.prisma`, `backend/src/notifications/notifications.service.ts`
- New: migration, `backend/src/attendance-risk/attendance-risk.constants.ts`,
  `.service.ts`, `.job.ts`, `.module.ts`
- Test: `attendance-risk.service.spec.ts`, `attendance-risk.job.spec.ts`

**Interfaces:**
- Consumes: `NotificationsService.notify()` (existing, unchanged signature).
- Produces: `AttendanceRiskService.recomputeAll(): Promise<void>`,
  `AttendanceRiskService.getForStudent(studentId)`,
  `AttendanceRiskService.getFlagged(sectionIds?: string[])`.

- [ ] **Step 1:** Open `schema.prisma` and confirm the exact `AttendanceStatus` enum values (expected:
  `PRESENT, ABSENT, LATE, LEAVE, HOLIDAY` — confirm, don't assume). Add:
  ```prisma
  model AttendanceRiskFlag {
    id          String   @id @default(uuid())
    studentId   String   @unique
    student     Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
    absenceRate Float
    flagged     Boolean
    windowStart DateTime
    windowEnd   DateTime
    updatedAt   DateTime @updatedAt
  }
  ```
  Run `npx prisma migrate dev --name add_attendance_risk_flag`.
- [ ] **Step 2:** Add `'attendance-risk'` to `NotificationType` in `notifications.service.ts`.
- [ ] **Step 3:** Write `attendance-risk.constants.ts`:
  ```ts
  export const RISK_WINDOW_DAYS = 30;
  export const RISK_THRESHOLD = 0.25;
  export const RISK_MIN_TRACKED_DAYS = 5;
  ```
- [ ] **Step 4:** Write failing unit tests for `AttendanceRiskService.recomputeAll`: a student with a
  known 30-day attendance history crosses `flagged: true` exactly at `RISK_THRESHOLD`;
  `HOLIDAY`/`LEAVE` rows are excluded from `trackedDays`; a student with fewer than
  `RISK_MIN_TRACKED_DAYS` tracked days gets no `AttendanceRiskFlag` row at all; a student transitioning
  from unflagged/absent to `flagged: true` triggers exactly one
  `NotificationsService.notify({ type: 'attendance-risk', ... })` call (mock `NotificationsService`);
  a student already `flagged: true` staying `flagged: true` triggers zero additional calls.
- [ ] **Step 5:** Implement `recomputeAll`, resolving each flagged student's class teacher via
  `Section.classTeacherId` (mirroring Sprint C's attendance-attribution precedent) for the `userId`
  passed to `notify()`. Run the tests, confirm pass.
- [ ] **Step 6:** Write a failing test for `AttendanceRiskJob`: `@Cron`-triggered `run()` calls
  `recomputeAll()` exactly once.
- [ ] **Step 7:** Implement `AttendanceRiskJob` (`@Cron('0 3 * * *')`, named constant not a magic
  string) and `AttendanceRiskModule`, registering it the same way `DigestDispatchJob` is registered.
  Run the test, confirm pass. Run `npm run build`.
- [ ] **Step 8: Commit**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/attendance-risk backend/src/notifications
  git commit -m "feat(backend): add nightly AttendanceRiskService recompute with early-warning alerts"
  ```

---

### Task 5: Read endpoints for attendance risk

**Files:**
- New: `backend/src/attendance-risk/attendance-risk.controller.ts`
- Modify: `backend/src/attendance-risk/attendance-risk.module.ts`
- Test: `backend/test/attendance-risk.e2e-spec.ts`

**Interfaces:**
- Produces: `GET /api/v1/students/:id/attendance-risk`, `GET /api/v1/attendance-risk`.

- [ ] **Step 1:** Write failing e2e tests: a parent can `GET /students/:id/attendance-risk` for their
  own child (403 for another parent's child, reusing `StudentAccessService`); a `TEACHER` calling
  `GET /attendance-risk` only sees flagged students in their own section(s); `SCHOOL_ADMIN`/
  `SUPER_ADMIN` see every flagged student school-wide.
- [ ] **Step 2:** Implement `AttendanceRiskController` — the per-student route injects
  `StudentAccessService`; the aggregate route resolves the caller's sections for a `TEACHER` (via
  `Section.classTeacherId` or however teacher-section ownership is otherwise modeled — confirm) and
  skips that filter for admin roles. Run e2e, confirm pass. Run `npm run build`.
- [ ] **Step 3: Commit**
  ```bash
  git add backend/src/attendance-risk
  git commit -m "feat(backend): add attendance-risk read endpoints, scoped per caller role"
  ```

---

### Task 6: Early-warning panel on the admin dashboard

**Files:**
- Modify: `staff-console/src/views/AdminHomeView.vue`, `staff-console/src/lib/api.ts`
- Test: `AdminHomeView.spec.ts` (extend)

**Interfaces:**
- Consumes: Task 5's `GET /api/v1/attendance-risk`, and whatever school-wide daily-trend field the
  dashboard's existing summary endpoint exposes (confirm in Step 1).

- [ ] **Step 1:** Read `AdminHomeView.vue`'s existing summary-fetch call and its backing endpoint to
  confirm whether a school-wide daily absence-rate series already exists to extend, or whether the
  summary endpoint needs a new field added.
- [ ] **Step 2:** Write a failing `AdminHomeView.spec.ts` test: renders a new panel next to the
  existing `trends-panel` with (a) a `TrendsSparkline` series for the school-wide absence-rate trend
  and (b) a plain list of currently-flagged students (name + rate), each linking to that student's
  profile.
- [ ] **Step 3:** Add `api.getFlaggedStudents()` to `api.ts`. Implement the panel, extending
  `trendSeries`'s computed builder with the new series (or wiring a second small fetch if the summary
  endpoint isn't extended) and rendering the flagged-student list below it.
- [ ] **Step 4:** Run the spec test, confirm pass. Run `npm run test`, `type-check`, `lint` for the
  full staff-console suite.
- [ ] **Step 5: Commit**
  ```bash
  git add staff-console/src/views/AdminHomeView.vue staff-console/src/lib/api.ts staff-console/src/views/AdminHomeView.spec.ts
  git commit -m "feat(staff-console): add attendance early-warning panel to the admin dashboard"
  ```

---

## Definition of Done (from the roadmap)

- A teacher can generate and then edit an AI-drafted circular or diary entry before publishing —
  never auto-published.
- An admin sees a student flagged after a defined absence-rate threshold is crossed, sourced from real
  `Attendance` data, not a static dashboard number.
- Verify at the end: full backend unit + e2e suites green (mocking the external Anthropic call, never
  hitting it live), `npm run build` clean, lint clean on every touched file; staff-console `npm run
  test`/`type-check`/`lint` all green.
- Document explicitly, per this repo's established pattern: AI drafting runs on
  `StubAiDraftingProvider` in this environment (no Anthropic API key provisioned), and note the exact
  confirmed `AttendanceStatus` enum values and teacher-section-ownership lookup used, in
  `PROJECT-STATUS.md` and the roadmap's Implementation Checklist.
