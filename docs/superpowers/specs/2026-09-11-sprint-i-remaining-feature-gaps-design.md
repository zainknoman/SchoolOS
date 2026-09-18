# Sprint I — Remaining Feature Gaps (Phase 5)

Status: approved (design), ready for implementation planning.
As of commit `32d6e26` on `main` (latest at the time this spec was written; working tree carries 3
unrelated untracked doc files, no modified tracked files).
Spec source: `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md`, Implementation Checklist +
§4 "Sprint I — Remaining Feature Gaps (Phase 5)":
- Report cards (static PDF upload/view)
- Calendar-wide `Holiday` model (replaces per-student-per-day pattern)
- Complaint/concern tracking
- Forgot-password flow
- Teacher's own timetable view (fixes the dead nav link from Sprint D)
- Bulk attendance-marking endpoint (`POST /attendance/bulk`)
- Timetable scheduling-conflict detection

## Reconciliation with the roadmap doc before scoping work

Verified directly against `build/backend`, `build/staff-console`, `build/parent-app` rather than
assumed from the roadmap text (this project's specs have repeatedly found the roadmap stale on
specifics — Sprint E's PDF voucher generation was one example). Findings for each of the 7 items:

1. **Holiday model** — STALE ("doesn't exist" is right, but the roadmap undersells how entangled it
   already is). No `Holiday` model exists. A holiday is today recorded as `AttendanceStatus.HOLIDAY`
   (`schema.prisma:23-29`) on a **per-student, per-date** `Attendance` row (`schema.prisma:270-283`,
   `@@unique([studentId, date])`) — exactly the pattern the roadmap says to replace. Any new
   calendar-wide model must decide how it interacts with `AttendanceService`'s existing summary
   counts (`attendance.service.ts:112-144`), which read `HOLIDAY` off individual rows today.
2. **Complaint model** — CONFIRMED absent. No `Complaint`/`Concern` model anywhere in
   `schema.prisma`. Closest existing shape to imitate is `LeaveRequest`
   (`schema.prisma:466-476` — `studentId` FK, string `status`, timestamps), not `Conversation`/
   `Message`.
3. **Forgot-password flow** — CONFIRMED absent, and genuinely more constrained than "just add a
   route": **no mailer exists anywhere in the repo** (no `nodemailer`, no `@nestjs-modules/mailer`,
   grep for `mail|smtp` hits only field names). SMS delivery infrastructure *does* exist
   (`backend/src/notifications/sms-sender.ts`, `sms.adapter.ts`) but resolves a destination only via
   `ParentProfile.phone` — `Teacher`/`SchoolAdmin`/`Accounts`/`SuperAdmin` accounts have no phone or
   email delivery channel wired anywhere today. `auth.controller.ts` exposes only `login` and
   `refresh` (both `@Public()`, both `@Throttle`d); `auth.service.ts` exposes only `assertRole`,
   `login`, `refresh`, private `issueSession`.
4. **ReportCard model** — CONFIRMED absent. No model, no module. A reusable pattern exists for the
   PDF half of this work: `StorageAdapter` (`backend/src/storage/storage-adapter.ts:1-7` —
   `save(buffer, extension)`/`read(storageKey)`/`delete(storageKey)`, injected via
   `STORAGE_ADAPTER`) plus the existing `File` model (`schema.prisma:478-487`) and
   `FilesService.upload` (`files.service.ts:21-52`).
5. **Bulk attendance** — CONFIRMED absent, and the current frontend workaround is exactly what the
   roadmap describes: `MarkAttendanceDto` (`mark-attendance.dto.ts:11-21`) takes one
   `{studentId, date, status}`; `AttendanceController` only exposes
   `@Roles('TEACHER','SCHOOL_ADMIN','SUPER_ADMIN') @Post('attendance')` for a single row
   (`attendance.controller.ts:45-52`); `AttendanceView.vue:83-90` does
   `for (const [studentId, status] of entries) { await api.markAttendance(...) }` — one HTTP round
   trip per student, sequentially awaited.
6. **Timetable scheduling-conflict detection** — CONFIRMED absent. `TimetableService.createEntry`
   (`timetable.service.ts:51-63`) does a bare `prisma.timetable.create(dto)` with zero query against
   existing rows first; `updateEntry` (65-81) and `replaceForSection` (106-129, full delete+recreate
   transaction) have the same gap. No conflict/overlap check exists anywhere in
   `backend/src/timetable`.
7. **Teacher's own timetable view** — CONFIRMED, and the dead-link history is exactly as Sprint D's
   own regression test documents it. Backend has `GET /students/:id/timetable`
   (`timetable.controller.ts:24-31`, parent-facing) and `GET /sections/:id/timetable`
   (`timetable.controller.ts:37-40`, `@Roles('SCHOOL_ADMIN','SUPER_ADMIN')` only — **not** reachable
   by `TEACHER`). No `GET /teachers/:id/timetable` or `/me/timetable` route exists. Staff-console's
   teacher nav (`AppShell.vue:326-330`) has exactly Attendance/Diary/Messages — no Timetable entry at
   all. `AppShell.spec.ts:77-79` asserts, in so many words, that `[data-testid="nav-timetable"]` does
   **not** exist for `TEACHER` and that Sprint I will re-add it once a real view exists — this test
   must be updated (not just satisfied) as part of this sprint.

## Decisions this spec makes so engineering doesn't have to guess

**Holiday model does not replace historical data — it becomes the source of truth going forward.**
`AttendanceStatus.HOLIDAY` stays in the enum (dropping it would be a breaking schema change nobody
asked for, and historical rows already use it). The new `Holiday` model is consulted *in addition to*
per-row status when computing attendance summaries and when deciding whether a date is markable —
no backfill migration converts old `HOLIDAY` rows into `Holiday` rows. This is additive, matching
every prior sprint's "don't rewrite history, extend forward" precedent (e.g. Sprint B's Postgres
migration touched the provider only, never the data).

**Complaints are staff-created/managed, parent-read-only, this sprint.** The roadmap's own note flags
this ambiguity and cites the Gap Analysis calling it staff-facing "tracking," not
parent-submittable — that's the default this spec locks in. Parent-submitted complaints are an
explicit, documented deferral (not a silently dropped feature) for a future sprint if the product
wants it.

**Forgot-password ships as a real, structurally-complete flow behind a swappable `MailAdapter`, not
blocked on procuring SMTP credentials.** This mirrors the exact shape already proven for
`PaymentGatewayAdapter` (Sprint E), `PushAdapter` (Sprint F), and the WhatsApp/SMS adapters
(Sprint H): a real interface, a `LoggingMailAdapter` default that logs the reset link instead of
emailing it (so local dev/CI need zero config, and nothing regresses), and an optional real
`SmtpMailAdapter` behind env config for whenever a real mail provider is chosen. **Scope for this
sprint is every role** (not parent-only) since the token/verification logic is role-agnostic and
costs nothing extra — only the *delivery channel* is the constrained part, and logging is
role-agnostic too.

**Report cards reuse the existing `File`/`StorageAdapter` upload path exactly as Fees' PDF work
already established the pattern** — no new storage mechanism.

**Bulk attendance and the Holiday model are sequenced together**: the bulk endpoint's "don't let
staff accidentally mark attendance on a declared holiday" guard depends on the Holiday model
existing first. The plan orders these accordingly.

**Timetable conflict detection blocks on both `teacherId` and `room`** — a double-booked teacher and
a double-booked room are both real scheduling failures the roadmap's Definition of Done implies
("a double-booked teacher/room is rejected").

## Design

### 1. `Holiday` model + calendar-wide read/write

```prisma
model Holiday {
  id        String   @id @default(uuid())
  title     String
  startDate DateTime
  endDate   DateTime
  campusId  String?  // null = applies to every campus
  campus    Campus?  @relation(fields: [campusId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([campusId])
  @@index([startDate, endDate])
}
```
Confirm the exact existing campus-model name (`Campus` assumed from the roadmap's "School/Campus"
CRUD-screen language — verify against `schema.prisma` before writing the migration; it may be
`SchoolCampus` or similar).

New `HolidaysModule` (`backend/src/holidays/`):
- `POST /api/v1/holidays`, `PATCH /api/v1/holidays/:id`, `DELETE /api/v1/holidays/:id` —
  `@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')`.
- `GET /api/v1/holidays?campusId=&from=&to=` — any authenticated user (parents included; holidays
  are not per-student PII, and the parent app's calendar needs to read them directly without going
  through `StudentAccessService`).

`AttendanceService` changes (additive, not a rewrite):
- New `HolidaysService.isHoliday(date, campusId): Promise<boolean>` (checks `startDate <= date <=
  endDate` for the given campus or a `campusId: null` school-wide row).
- New `AttendanceService.assertNotHoliday(date, campusId)` — throws `BadRequestException` if
  `isHoliday` is true. Called from both `markAttendance` (single) and the new `markBulk` (Design §5)
  so the two entry points can't diverge.
- `getForStudent`'s summary computation (`attendance.service.ts:112-144`) gets one additional
  `holidayCount` source: dates in the requested range covered by a `Holiday` row for the student's
  enrolled campus, counted **in addition to** any pre-existing per-row `HOLIDAY` markings (a date
  could theoretically have both if historical data was marked before this sprint — sum, don't
  dedupe by fiat; document this as a known edge case, not silently resolved).

**staff-console**: new `HolidaysView.vue` admin CRUD screen, built on the `EntityTable.vue`/
`FormField.vue`/`ConfirmDialog.vue` components Sprint D already extracted — this is the ninth CRUD
screen on that shared foundation, not a new pattern. Add a `nav-holidays` link to the admin nav
group in `AppShell.vue` gated by whatever `can*` computed the other admin CRUD links use (confirm
the naming convention, e.g. `canManageHolidays`, matching `canManageCirculars`/`canManageTimetable`).

**parent-app**: confirm `calendar_tab.dart`'s current data source before changing it (not
inspected in this spec's investigation pass) — it should overlay `Holiday` ranges from
`GET /api/v1/holidays` for the child's campus, in addition to whatever it already renders, so a
declared holiday shows on every enrolled child's calendar without any per-student action.

### 2. `Complaint` model + `ComplaintsModule`

```prisma
model Complaint {
  id          String   @id @default(uuid())
  studentId   String
  student     Student  @relation(fields: [studentId], references: [id], onDelete: Restrict)
  raisedById  String
  raisedBy    User     @relation(fields: [raisedById], references: [id])
  subject     String
  description String
  status      String   @default("open") // "open" | "in_progress" | "resolved"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([studentId])
}
```
- `POST /api/v1/complaints` — any `STAFF_ROLES` member (`TEACHER, SCHOOL_ADMIN, ACCOUNTS,
  SUPER_ADMIN`, per `student-access.service.ts:4`) creates, `raisedById` = the acting staff user.
- `GET /api/v1/complaints?studentId=` — staff see all for a student directly; a parent request is
  scoped via `StudentAccessService.assertCanAccessStudent` (same call every other student-linked
  read already uses) and is **read-only** (no create route exposed to `PARENT`).
- `PATCH /api/v1/complaints/:id` — staff only, status transitions (`open` → `in_progress` →
  `resolved`). No `DELETE` — matches this schema's existing discipline of preferring `Restrict`/
  audit-preserving deletes over hard deletes for anything with a paper trail.

**staff-console**: new `ComplaintsQueueView.vue` (`EntityTable.vue`-based list + status-update
action, not a full CRUD form since there's no delete).

**parent-app**: a read-only "Complaints" entry under the More section (mirrors where Report Cards
lands, Design §4 below) — a simple list screen showing subject/status/date per active child, no
compose UI.

### 3. Forgot-password flow

```prisma
model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId])
}
```
Before writing this migration, confirm the exact field `User` uses as a login identifier
(`auth.service.ts:41`'s `login(identifier, password)` — check `schema.prisma`'s `User` model for
whether that's `email`, `username`, or something else) so `forgot-password`'s lookup matches it
exactly.

- `POST /api/v1/auth/forgot-password` — body `{ identifier }`. **Always returns 200 with a generic
  message regardless of whether a matching user exists** (standard user-enumeration defense — do
  not leak account existence). If a user is found: generate 32 random bytes, hex-encode as the raw
  token, store only `sha256(token)` as `tokenHash` with a 1-hour `expiresAt`, and send via a new
  `MailAdapter`.
- `POST /api/v1/auth/reset-password` — body `{ token, newPassword }`. Hash the incoming token,
  look up a `PasswordResetToken` row by `tokenHash` with `usedAt: null` and `expiresAt > now()`; on
  no match, 400 with a generic "invalid or expired" message (don't distinguish "expired" from
  "wrong" — same enumeration-defense reasoning). On match: update `User.password` using whatever
  hashing `AuthService` already uses to verify passwords at login (reuse, don't reinvent), set
  `usedAt`, and **revoke every existing `RefreshToken` row for that user** (force re-login on every
  device — a password reset should end all prior sessions, not just this request's).

**`MailAdapter`** (`backend/src/notifications/mail-adapter.ts`, new — deliberately placed alongside
the existing `PushAdapter`/`sms.adapter.ts`/`whatsapp.adapter.ts` since it's the same
swappable-integration shape):
```ts
export interface MailAdapter {
  send(to: string, subject: string, body: string): Promise<void>;
}
```
- `LoggingMailAdapter` (default) — logs `to`/`subject`/`body` (which includes the reset link) via
  the same logger every `Logging*Adapter` in this codebase already uses. This is the "structurally
  complete, not live-verified" bar every other integration in this project ships at
  (JazzCash/EasyPaisa, FCM, WhatsApp, SMS) — no real SMTP account exists in this environment, and
  none is required to ship this feature correctly.
- `SmtpMailAdapter` (optional, real) — behind `resolveSmtpConfig()` mirroring
  `resolveFirebaseConfig()`'s exact all-or-nothing + dev/test-carve-out contract; only constructed
  when full config is present outside `development`/`test`.
- Reset link format: `{FRONTEND_URL}/reset-password?token={token}` — confirm `FRONTEND_URL` (or
  equivalent existing env var) before hardcoding a new one.

**staff-console**: `LoginView.vue` gets a "Forgot password?" link → new `ForgotPasswordView.vue`
(identifier form, always shows the generic "if an account exists, a reset link was sent" message) →
new `ResetPasswordView.vue` (reads `token` from the query string, new-password form).

**parent-app**: same shape — a forgot-password screen reachable from the existing login screen, and
a reset-password screen. Since the parent app has no in-app browser step for "click the emailed
link," the reset-password screen should also be reachable by pasting/deep-linking the token (an
Android deep link into the reset screen) — confirm the parent app's existing deep-link handling
(used for push-notification taps, per Sprint F) to reuse the same URI-scheme mechanism rather than
inventing a second one.

### 4. `ReportCard` model + `ReportCardsModule`

```prisma
model ReportCard {
  id                String          @id @default(uuid())
  studentId         String
  student           Student         @relation(fields: [studentId], references: [id], onDelete: Restrict)
  academicSessionId String
  academicSession   AcademicSession @relation(fields: [academicSessionId], references: [id], onDelete: Restrict)
  fileId            String
  file              File            @relation(fields: [fileId], references: [id], onDelete: Restrict)
  uploadedById      String
  uploadedBy        User            @relation(fields: [uploadedById], references: [id])
  createdAt         DateTime        @default(now())

  @@unique([studentId, academicSessionId])
}
```
Confirm the exact existing academic-session model name (`AcademicSession` assumed from the
roadmap's "Academic-Session" CRUD-screen language) against `schema.prisma` before writing the
migration.

- `POST /api/v1/report-cards` — multipart upload (`studentId`, `academicSessionId`, `file`),
  `@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')`. Persists the file via the existing
  `FilesService.upload`-equivalent path (reuse, don't reimplement multer config/size limits already
  hardened in Sprint B), then creates the `ReportCard` row. The `@@unique([studentId,
  academicSessionId])` means a re-upload for the same student+session must be an explicit
  replace-flow decision — for this sprint, reject a duplicate with 409 rather than silently
  overwriting (staff can delete-then-reupload if the schema ends up exposing a delete route; simplest
  correct behavior for a first pass).
- `GET /api/v1/report-cards?studentId=` — scoped via `StudentAccessService.assertCanAccessStudent`,
  same as every other student-linked read.
- `GET /api/v1/report-cards/:id/pdf` — streams via `StorageAdapter.read`, same download shape the
  existing Fees voucher/receipt PDF routes use (the `?access_token=` bypass-of-retry-on-401 issue
  flagged as a Sprint A follow-up is a known, separately-tracked gap — not fixed here, just not made
  worse).

**staff-console**: new `ReportCardsView.vue` (student picker, session picker, file input, list of
already-uploaded cards).

**parent-app**: a Report Cards screen under the More section — called out by the UI/UX Audit as
"near-empty" today — listing report cards for the active child, each opening its PDF via the
existing `url_launcher` pattern (`fees_tab.dart`/`circulars_tab.dart` already do exactly this for
receipts/attachments).

### 5. Bulk attendance-marking endpoint

```ts
// backend/src/attendance/dto/bulk-mark-attendance.dto.ts
export class BulkMarkAttendanceDto {
  date: string;
  marks: { studentId: string; status: AttendanceStatus }[];
}
```
`AttendanceService.markBulk(dto, markingUserId)`:
1. Reject an empty `marks` array (400).
2. Resolve the marking teacher's campus (however `markAttendance` already resolves it for a single
   call — reuse that lookup) and call `assertNotHoliday(dto.date, campusId)` (Design §1) — reject
   the whole batch (400) if the date is a declared holiday, rather than silently marking a subset.
3. One `prisma.$transaction` wrapping one `upsert` per mark (same `studentId_date` unique constraint
   every single-mark call already uses) plus **one** `auditLog.create` summarizing the batch
   (`{ date, count: marks.length, studentIds }`) instead of one audit row per student — mirrors
   `TimetableService.replaceForSection`'s existing transactional bulk pattern.
4. `POST /api/v1/attendance/bulk`, `@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')` — same roles as
   the existing single-mark route.

Apply the same `assertNotHoliday` guard to the existing single `markAttendance` too, so the two entry
points can't diverge on holiday behavior — a small, additive change to an already-working method.

**staff-console**: `AttendanceView.vue`'s save handler (`AttendanceView.vue:83-90`) replaces its
sequential `for (const [studentId, status] of entries) { await api.markAttendance(...) }` loop with
one `api.markAttendanceBulk(date, marks)` call. `staff-console/src/lib/api.ts` gains
`markAttendanceBulk(accessToken, payload: { date, marks })`.

### 6. Timetable scheduling-conflict detection

```ts
private async assertNoConflict(
  dto: { dayOfWeek: number; period: number; teacherId: string; room: string },
  excludeId?: string,
) {
  const conflict = await this.prisma.timetable.findFirst({
    where: {
      dayOfWeek: dto.dayOfWeek,
      period: dto.period,
      id: excludeId ? { not: excludeId } : undefined,
      OR: [{ teacherId: dto.teacherId }, { room: dto.room }],
    },
  });
  if (conflict) {
    throw new ConflictException(
      conflict.teacherId === dto.teacherId
        ? 'This teacher is already scheduled for this period.'
        : 'This room is already booked for this period.',
    );
  }
}
```
Confirm the exact `room` field name/type on `model Timetable` in `schema.prisma` before implementing
(not verified in this spec's investigation pass — the field may be named differently, e.g.
`roomName`/`roomId`).

- `createEntry` calls `assertNoConflict(dto)` before `prisma.timetable.create`.
- `updateEntry` calls `assertNoConflict(dto, id)` (excluding the row being updated) before the update.
- `replaceForSection`'s incoming array is checked two ways before the transaction commits: (a)
  pairwise within the submitted batch itself (two new entries in the same request can't conflict with
  each other), and (b) against existing `Timetable` rows outside the section being replaced (a
  teacher already booked elsewhere can't be double-booked by this section's new schedule).

**staff-console**: `TimetablePageView.vue` surfaces the 409's message as an inline/toast error
instead of a generic failure state — confirm the view's existing error-handling pattern (whatever the
other CRUD screens already use post-Sprint-D) and reuse it.

### 7. Teacher's own timetable view

`GET /api/v1/teachers/me/timetable` (`@Roles('TEACHER')`) — resolves the acting `Teacher` record from
`req.user.id` (confirm the exact lookup, e.g. `prisma.teacher.findUnique({ where: { userId } })`,
mirroring how `ParentProfile` is resolved from a parent's `userId` elsewhere in this codebase) and
calls `TimetableService.getForTeacher(teacherId)` — `prisma.timetable.findMany({ where: { teacherId },
orderBy: [{ dayOfWeek: 'asc' }, { period: 'asc' }] })`. Response shape matches whatever
`GET /sections/:id/timetable` already returns, so the frontend can reuse the same rendering component.

**staff-console**: new `TeacherTimetableView.vue` (read-only weekly grid) at route `/teacher/timetable`
— confirm and reuse whichever grid-rendering component `TimetablePageView.vue` already uses internally
rather than building a second grid renderer. Add the `nav-timetable` `RouterLink` back into
`AppShell.vue`'s `isTeacher` block (`AppShell.vue:326-330`), alongside Attendance/Diary/Messages.

**Required test update, not just a new test**: `AppShell.spec.ts:77-79` currently asserts
`[data-testid="nav-timetable"]` does **not** exist for the `TEACHER` role (this was Sprint D's
intentional stopgap, with an explicit comment that Sprint I would re-add it). This assertion must be
flipped to confirm the link **does** exist once this task ships — leaving the old assertion in place
would make this sprint fail its own regression suite.

## Testing

- e2e: `Holiday` CRUD is admin-only; `GET /holidays` is readable by a parent; `assertNotHoliday`
  rejects both single and bulk attendance marking on a declared-holiday date; the attendance summary
  reflects a holiday-covered date it has no per-row marking for.
- e2e: a parent can read but not create/update a `Complaint`; a staff member can create and transition
  its status; a parent's read is scoped to their own linked students (cross-student 403).
- e2e: forgot-password returns 200 for both an existing and a non-existent identifier (enumeration
  defense) with an identical response body; reset-password rejects an expired/used/wrong token (same
  generic message); a successful reset invalidates all of that user's existing refresh tokens
  (a previously-valid refresh token 401s afterward).
- e2e: report-card upload persists a `File`+`ReportCard` pair; a duplicate upload for the same
  student+session is rejected (409); a parent can read but not upload; PDF download streams correctly.
- e2e: bulk attendance — one request marks N students in one audit-logged transaction; rejected on a
  holiday date; rejected on an empty `marks` array.
- e2e: timetable conflict — creating/updating an entry that double-books a teacher or room is rejected
  (409) with a message identifying which resource conflicted; `replaceForSection` rejects a batch that
  conflicts with itself or with an untouched section's existing entry.
- e2e: `GET /teachers/me/timetable` returns only that teacher's own entries; a non-teacher role gets
  403.
- Regression: `AppShell.spec.ts` updated (not just left alone) to assert the teacher Timetable nav
  link now exists.

## Out of scope this sprint

- Backfilling historical `Attendance.HOLIDAY` rows into the new `Holiday` model.
- Parent-submitted complaints (staff-created/managed only, per the Decisions section above).
- A real SMTP/mail-provider account — `LoggingMailAdapter` ships as the default, matching every other
  "not live-verified" integration precedent in this project.
- Fixing the pre-existing `?access_token=` PDF-download/401-retry gap (Sprint A follow-up) — report
  cards reuse the existing download pattern as-is.
- A report-card *replace* flow beyond "duplicate upload is rejected" — no delete/reupload UX this
  sprint.
