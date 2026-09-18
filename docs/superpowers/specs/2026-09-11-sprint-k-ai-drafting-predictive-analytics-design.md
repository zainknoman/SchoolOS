# Sprint K — Differentiation Kickoff: AI Drafting + Predictive Analytics (Phase 7–8)

Status: approved (design), ready for implementation planning.
As of commit `32d6e26` on `main` (latest `main` commit — Sprint H's WhatsApp/SMS/digest work is
merged; working tree carries 3 unrelated untracked doc files, no modified tracked files).
Spec source: `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md`, §4 "Sprint K —
Differentiation Kickoff: AI Drafting + Predictive Analytics (Phase 7–8)":
- `AiDraftingService` — "Suggest draft" on circulars/diary compose
- `AttendanceRiskService` — early-warning panel on the admin dashboard

## Reconciliation with the roadmap doc before scoping work

Verified against `build/backend` and `build/staff-console` at commit `32d6e26` rather than assumed
from the roadmap text:

1. **No existing LLM/AI integration anywhere** — CONFIRMED. Grep for `openai|anthropic|llm|gpt|
   AiDrafting|DraftSuggestion` across `backend/` and its dependency list turned up nothing but
   unrelated substring matches (`helper`, `http`, etc.). This is genuinely greenfield, as the roadmap
   assumes.
2. **`NotificationDispatchService` naming is stale — again.** The roadmap's Sprint K text (written
   before Sprint H) still calls it `NotificationDispatchService`; the real class, confirmed unchanged
   through Sprint H, is `NotificationsService` (`backend/src/notifications/notifications.service.ts`).
   Its **current** (post-Sprint-H) public method is:
   ```ts
   export interface NotifyInput {
     userId: string;
     type: NotificationType; // 'diary' | 'circular' | 'message'
     title: string;
     body: string;
     entityRef?: string;
   }
   async notify(input: NotifyInput): Promise<void>
   ```
   `notify()` already handles digest-deferral and channel selection (push/WhatsApp/SMS) internally as
   of Sprint H — this sprint's early-warning alerts call through it exactly as-is; they do not need to
   know about channels or digest mode at all. The `NotificationType` union has no `'attendance-risk'`
   member yet — adding one is a one-line change this sprint makes.
3. **`Attendance` model, quoted in full** (`schema.prisma:270-283`):
   ```prisma
   model Attendance {
     id           String           @id @default(uuid())
     studentId    String
     student      Student          @relation(fields: [studentId], references: [id], onDelete: Restrict)
     date         DateTime
     status       AttendanceStatus
     markedById   String
     markedBy     Teacher          @relation("AttendanceMarkedBy", fields: [markedById], references: [id])
     createdAt    DateTime         @default(now())
     updatedAt    DateTime         @updatedAt

     @@unique([studentId, date])
     @@index([studentId])
   }
   ```
   No direct campus/section column — scoping for a school/section-level aggregate must join through
   `Student.enrollments`, the same relation `circulars.service.ts:66` already uses for recipient
   scoping. Exact `AttendanceStatus` enum values were not re-confirmed in this pass beyond what
   Sprint I's investigation already found (`PRESENT, ABSENT, LATE, LEAVE, HOLIDAY` — confirm again
   before writing the risk query, since an implementation must exclude `HOLIDAY`/`LEAVE` from the
   denominator, not just `ABSENT` from the numerator).
4. **`TrendsSparkline.vue` usage, confirmed exact shape.** Props: `labels: string[]`, `series:
   SparklineSeries[]` where `SparklineSeries = { label, color, values: number[], dashed?: boolean }`.
   Used in `AdminHomeView.vue:98` as `<TrendsSparkline :labels="trendLabels" :series="trendSeries" />`
   with both built as computed properties (lines 33-49) from `summary.value.weeklyTrend`. A new panel
   reuses this exact component and prop shape — no new charting library.
5. **Circulars/diary compose forms, confirmed exact fields.** `CircularsView.vue:107-115` — body is
   `<textarea data-testid="description-input" v-model="description" rows="3">`. `DiaryView.vue:125-134`
   — body is `<textarea data-testid="entry-text" v-model="text" rows="4" :dir="detectDirection(text)">`.
   **Caveat carried forward from the investigation, not yet resolved:** each view may have a sibling
   `*PageView.vue` wrapper (`CircularsPageView.vue`, `DiaryPageView.vue`) that could be the file that
   actually renders at the route — confirm which file renders before adding the "Suggest draft"
   button, per Task 3/4 Step 1 below. Parent-app confirmed to have **no** compose UI for either
   (`api_client.dart` only exposes read + mark-read methods for circulars, read-only for diary) — no
   client-side parent-app work this sprint, exactly as the roadmap assumes.
6. **`AuditLog` is the only existing "audit-logged" table pattern** (`schema.prisma:489-502`):
   ```prisma
   model AuditLog {
     id        String   @id @default(uuid())
     userId    String?
     user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
     action    String
     entity    String
     entityId  String?
     metadata  String?
     ip        String?
     createdAt DateTime @default(now())

     @@index([userId])
     @@index([entity, entityId])
   }
   ```
   A new `DraftSuggestion` table mirrors this shape (nullable-on-delete `User` FK, string
   discriminator, string payload column) rather than inventing a different convention.
7. **Cron job runner — STALE if the roadmap's "no job runner exists" note is taken at face value.**
   `@nestjs/schedule` is a direct dependency (`backend/package.json`), `ScheduleModule.forRoot()` is
   already registered in `app.module.ts`, and `DigestDispatchJob`
   (`backend/src/notifications/digest-dispatch.job.ts`) already uses `@Cron(...)` — this landed with
   Sprint H. This sprint's nightly risk-recompute job is a sibling of `DigestDispatchJob`, not a new
   architectural addition.
8. **Real controller routes/roles for circulars and diary, confirmed and NOT uniform:**
   - `POST /api/v1/circulars` — `@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')` (`circulars.controller.ts:16`).
     **Teachers cannot publish circulars.**
   - `POST /api/v1/diary` — `@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')`
     (`diary.controller.ts:19`).
   This is an important correction to the roadmap's implicit "staff-only, one role set" framing — the
   two new draft-suggestion endpoints must use two *different* role sets, matching each entity's real
   write permissions exactly, not a shared "staff" constant.

## Decisions this spec makes

**LLM provider: Anthropic Claude, behind a swappable `AiDraftingProvider` interface, defaulting to a
non-LLM stub when unconfigured.** The roadmap explicitly leaves "provider choice out of scope for this
document." This is a low-stakes, fully swappable engineering choice (unlike Sprint J's localization
scope, which is a market/product commitment) — Anthropic is chosen as the default because it's the
model family this codebase's own tooling already runs on, and the interface makes switching providers
later a one-file change. When `ANTHROPIC_API_KEY` is unset (the expected state in this environment —
no key exists here), `StubAiDraftingProvider` returns a clearly-labeled placeholder string rather than
fabricating a fake "AI" suggestion — the endpoint's full code path (validation, audit row, response
shape) is exercised in dev/CI either way, matching this project's "structurally complete, not
live-verified" bar for every prior external integration.

**Risk scores are precomputed nightly into a small table, not computed live on every dashboard
view.** This lets the nightly job detect a "student just crossed the threshold" transition (needed to
fire exactly one alert per transition, not one every time an admin opens the dashboard) and keeps the
dashboard's read path cheap. Live per-request computation was considered and rejected for this reason,
not for performance (the roadmap correctly notes performance is a non-issue at pilot scale).

**Absence-rate window: trailing 30 calendar days, `HOLIDAY` and `LEAVE` excluded from the
denominator, flagged at ≥25% absence with a minimum of 5 school days present in the window** (avoids
flagging a student on 1 absence out of 2 total days). These are named constants, not hardcoded magic
numbers, so a school can tune them later without a code change to the computation logic itself.

**If Sprint I's `Holiday` model has landed by the time this ships, exclude holiday-covered dates from
the window; if not, exclude only per-row `HOLIDAY`-status rows.** These two sprints have no hard
dependency on each other (per the roadmap's own dependency graph — "AI Drafting is independent, can
start as soon as Phase 0 is done"), so this spec does not assume Sprint I's ship order.

## Design

### 1. `AiDraftingProvider` + `DraftSuggestion` audit table

```prisma
model DraftSuggestion {
  id         String   @id @default(uuid())
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  targetType String   // "circular" | "diary"
  prompt     String
  suggestion String
  createdAt  DateTime @default(now())

  @@index([userId])
}
```

```ts
// backend/src/ai-drafting/ai-drafting-provider.ts
export interface AiDraftingProvider {
  suggestDraft(input: { context: string; targetType: 'circular' | 'diary' }): Promise<string>;
}
export const AI_DRAFTING_PROVIDER = 'AI_DRAFTING_PROVIDER';
```
- `AnthropicDraftingProvider` (`anthropic-drafting.provider.ts`) — calls the Anthropic Messages API
  (`@anthropic-ai/sdk`) with a system prompt scoping it to "draft a short, professional school
  {circular|diary entry} in plain language, in English or Urdu matching the input's language, based
  only on the provided context" — deliberately excludes any student PII from the prompt (the `context`
  field is staff-typed free text, e.g. a topic or a rough note; the endpoint never auto-pulls student
  records into the prompt, per the roadmap's own security note).
- `StubAiDraftingProvider` (default, `stub-drafting.provider.ts`) — returns a fixed string:
  `"[AI drafting is not configured in this environment. Set ANTHROPIC_API_KEY to enable real
  suggestions.]"`. No network call, no error thrown.
- `resolveAnthropicConfig()` (`anthropic-config.ts`) — mirrors `resolveFirebaseConfig()`'s exact
  contract: `ANTHROPIC_API_KEY` unset → `undefined` (stub used); set → real config. There is no
  "partial config" state for a single API key, so the dev/test-carve-out branch this pattern usually
  has doesn't apply here — document that explicitly rather than copying dead branches from the
  pattern.
- `AiDraftingModule` provides `AI_DRAFTING_PROVIDER` via a factory selecting between the two based on
  `resolveAnthropicConfig()`, exactly like `PUSH_ADAPTER`'s existing factory shape.

### 2. `AiDraftingService` + endpoints

```ts
async suggestDraft(
  userId: string,
  targetType: 'circular' | 'diary',
  context: string,
): Promise<{ suggestion: string }> {
  const suggestion = await this.provider.suggestDraft({ context, targetType });
  await this.prisma.draftSuggestion.create({
    data: { userId, targetType, prompt: context, suggestion },
  });
  return { suggestion };
}
```
- `POST /api/v1/circulars/draft-suggestion` — `@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')` (matches
  `POST /api/v1/circulars` exactly). Body: `{ context: string }`.
- `POST /api/v1/diary/draft-suggestion` — `@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')` (matches
  `POST /api/v1/diary` exactly). Body: `{ context: string }`.
- Both sit in the existing `CircularsController`/`DiaryController` classes, next to `publish`/
  `createEntry`, not a new shared controller — the role difference between the two entities makes a
  shared endpoint the wrong shape.
- Never auto-publishes: the response is a suggestion string the client places into the existing
  compose textarea for the staff member to edit before submitting through the existing, unmodified
  publish/create endpoint.

### 3. `AttendanceRiskFlag` + `AttendanceRiskService`

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
```ts
// backend/src/attendance-risk/attendance-risk.constants.ts
export const RISK_WINDOW_DAYS = 30;
export const RISK_THRESHOLD = 0.25;
export const RISK_MIN_TRACKED_DAYS = 5;
```
`AttendanceRiskService.recomputeAll()`:
1. For every active student (an active `Enrollment`), fetch `Attendance` rows in the trailing
   `RISK_WINDOW_DAYS`, excluding `HOLIDAY` (and `LEAVE` — a parent-approved leave should not count
   against a student the way an unexplained absence does) and any date covered by a `Holiday` row if
   that model exists in the running schema (feature-detect via a try/catch around the Prisma delegate,
   or gate on a boolean confirmed at implementation time — see the Sprint I/K sequencing note above).
2. Compute `absenceRate = absentDays / trackedDays`. Skip (leave unflagged, don't write a
   misleadingly-precise row) any student with `trackedDays < RISK_MIN_TRACKED_DAYS`.
3. Upsert `AttendanceRiskFlag` by `studentId`. If a student's `flagged` transitions from `false`/absent
   to `true` in this run, call `NotificationsService.notify({ userId: <that student's class teacher's
   userId>, type: 'attendance-risk', title: 'Attendance risk flagged', body: '<student name> has an
   absence rate of <rate>% over the last 30 days.', entityRef: studentId })` — resolve the class
   teacher via `Section.classTeacherId` (the same relation Sprint C's attendance-fallback fix already
   established as the attribution path for a section).
4. Add `'attendance-risk'` to the `NotificationType` union in `notifications.service.ts` — a one-line
   addition, not a refactor of `notify()` itself.

`AttendanceRiskJob` (`attendance-risk.job.ts`) — `@Cron('0 3 * * *')` (nightly, off-hours; named
constant, not a magic string), calls `recomputeAll()`. Sibling of `DigestDispatchJob`, registered the
same way in its module.

### 4. Read endpoints

- `GET /api/v1/students/:id/attendance-risk` — scoped via
  `StudentAccessService.assertCanAccessStudent` (parent can see their own child; staff per the usual
  `STAFF_ROLES` set). Reads the precomputed `AttendanceRiskFlag` row (404 if none yet — e.g. a
  brand-new enrollment with `trackedDays < RISK_MIN_TRACKED_DAYS`).
- `GET /api/v1/attendance-risk` — `@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')`, returns the list
  of currently-`flagged` students, scoped to the teacher's own section(s) for a `TEACHER` caller (join
  through `Enrollment`/`Section.classTeacherId`) and unscoped for admin roles — mirrors how every
  other teacher-facing read in this codebase is section-scoped.

### 5. Admin dashboard panel

`AdminHomeView.vue` gains a new panel, placed alongside the existing `trends-panel`
(`AdminHomeView.vue:95-99`): a `TrendsSparkline` showing the school-wide daily absence-rate trend
(one new `series` entry built the same way `trendSeries` already is, sourced from a new
school-wide-aggregate field the dashboard's existing summary endpoint should expose — confirm whether
`AdminHomeView`'s backing summary endpoint already returns a `weeklyTrend`-shaped series that can be
extended, or whether a new field is needed, before implementing), plus a plain list (not a chart) of
currently-flagged students below it, each linking to that student's profile. This follows the
roadmap's own instruction to extend the existing sparkline pattern rather than build a new
visualization system, while keeping the actual "who's at risk" list as the simple list it actually is
— not force-fit into a chart.

### 6. "Suggest draft" button on compose forms

`CircularsView.vue` and `DiaryView.vue` each get a "Suggest draft" button next to their body
`<textarea>` (`description-input`/`entry-text`). Clicking opens a small inline prompt for `context`
(a one-line topic/notes field, separate from the body textarea — never silently reuses partially-typed
body text as the prompt without the staff member seeing what's being sent), calls the relevant
draft-suggestion endpoint, and on success **appends** the suggestion into the body textarea (never
overwrites existing typed content silently) for the staff member to edit before publishing. Confirm
which file (`CircularsView.vue` vs. `CircularsPageView.vue`, `DiaryView.vue` vs. `DiaryPageView.vue`)
actually renders at each route before adding the button.

## Testing

- Unit: `AttendanceRiskService.recomputeAll` — a student with a known attendance history flips
  `flagged` at exactly the threshold boundary; `HOLIDAY`/`LEAVE` rows are excluded from the
  denominator; a student below `RISK_MIN_TRACKED_DAYS` gets no row; a false→true transition fires
  exactly one `NotificationsService.notify()` call with `type: 'attendance-risk'`; a true→true
  (already flagged, still flagged) run fires zero additional notifications.
- Unit: `AiDraftingService.suggestDraft` — always writes a `DraftSuggestion` row regardless of which
  provider is active; the stub provider path never makes a network call.
- e2e: `POST /circulars/draft-suggestion` — `SCHOOL_ADMIN` succeeds, `TEACHER` gets 403 (matching real
  circular-publish permissions exactly). `POST /diary/draft-suggestion` — `TEACHER` succeeds.
- e2e: `GET /students/:id/attendance-risk` — parent scoped to own child (403 cross-student); `GET
  /attendance-risk` — a `TEACHER` caller only sees their own section's flagged students.
- Integration: mock the external Anthropic call in CI (never hit the real API in tests) and confirm
  the draft-suggestion round trip returns the mocked value end-to-end.

## Out of scope this sprint

- Live verification against a real Anthropic API call — no billing/API key is provisioned in this
  environment; ships at the same "structurally complete, not live-verified" bar as every prior
  external integration (JazzCash/EasyPaisa, FCM, WhatsApp/SMS).
- Multi-provider support beyond the one swappable interface (e.g. no OpenAI/Gemini adapter this
  sprint) — the interface makes adding one later a contained change, not a rewrite.
- Any change to how circulars/diary entries are actually published — draft-suggestion is purely
  additive to the compose UI, never auto-publishing.
- EMI-style fee installments and the admissions/lottery module (Phase 8 remainder) — explicitly a
  later, separate scope per the roadmap.
