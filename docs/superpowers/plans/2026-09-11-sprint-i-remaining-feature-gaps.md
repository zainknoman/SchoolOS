# Sprint I — Remaining Feature Gaps (Phase 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the seven remaining named MVP-scope gaps the Gap Analysis's Medium/Low register still
lists open, that don't each warrant their own sprint: report cards, a calendar-wide Holiday model,
complaint tracking, forgot-password, a teacher's own timetable view (fixing Sprint D's dead nav link),
bulk attendance marking, and timetable conflict detection.

**Architecture:** Five independent bounded contexts (`holidays`, `complaints`, `report-cards`, plus
additive changes to `auth`, `attendance`, and `timetable`), each following the existing per-feature
Nest-module + Vue-view + Prisma-model pattern already proven throughout this codebase. Holiday must
land before Bulk Attendance (the bulk endpoint's holiday guard depends on it). Everything else is
independent and can be built/reviewed in any order.

**Tech Stack:** NestJS + Prisma backend, Vue 3 staff-console, Flutter parent-app — no new
architecture beyond the swappable-adapter pattern already used for `StorageAdapter`/`PushAdapter`
(reused here for a new `MailAdapter`).

**Spec:** `docs/superpowers/specs/2026-09-11-sprint-i-remaining-feature-gaps-design.md`

## Global Constraints

- **Holiday model is additive, not a replacement.** `AttendanceStatus.HOLIDAY` stays in the enum;
  historical per-row markings are never backfilled into `Holiday` rows. See spec Design §1.
- **Complaints are staff-created/managed, parent-read-only this sprint** — no parent-facing create
  route. See spec Decisions.
- **Forgot-password ships behind `LoggingMailAdapter` by default** — no real SMTP account exists in
  this environment; this matches every prior "structurally complete, not live-verified" integration
  in this project (JazzCash/EasyPaisa, FCM, WhatsApp/SMS). Do not block this sprint on procuring SMTP
  credentials.
- **Forgot/reset-password must never leak whether an identifier/token is valid** — always return the
  same generic response shape on both branches. This is a security requirement, not a style choice.
- **Verify exact schema field/model names before each task that assumes one** — `Campus`,
  `AcademicSession`, `Timetable.room`, and `User`'s login-identifier field name are all assumed from
  roadmap/spec language, not directly confirmed against `schema.prisma` in the investigation pass
  behind this plan. Each task below says exactly which field to confirm and where.
- A successful password reset must invalidate **every** existing `RefreshToken` row for that user, not
  just end the current request.

---

## File Structure

- `backend/prisma/schema.prisma` (modify) — `Holiday`, `Complaint`, `PasswordResetToken`,
  `ReportCard` models; new relations on `Campus`/`Student`/`User`/`AcademicSession`/`File`.
- `backend/prisma/migrations/*` (new, one per model/feature group).
- `backend/src/holidays/` (new) — `holidays.module.ts`, `.controller.ts`, `.service.ts`, DTOs, specs.
- `backend/src/complaints/` (new) — same shape.
- `backend/src/report-cards/` (new) — same shape.
- `backend/src/notifications/mail-adapter.ts`, `logging-mail.adapter.ts`, `smtp-mail.adapter.ts`,
  `smtp-config.ts` (new) — mirrors `sms-sender.ts`/`sms.adapter.ts`/`sms-config.ts`'s shape.
- `backend/src/auth/dto/forgot-password.dto.ts`, `reset-password.dto.ts` (new).
- `backend/src/auth/auth.controller.ts`, `auth.service.ts` (modify) — two new public routes/methods.
- `backend/src/attendance/dto/bulk-mark-attendance.dto.ts` (new).
- `backend/src/attendance/attendance.controller.ts`, `.service.ts` (modify) — `markBulk`,
  `assertNotHoliday`.
- `backend/src/timetable/timetable.controller.ts`, `.service.ts` (modify) — `assertNoConflict`,
  `getForTeacher`.
- `staff-console/src/views/HolidaysView.vue`, `ComplaintsQueueView.vue`, `ReportCardsView.vue`,
  `ForgotPasswordView.vue`, `ResetPasswordView.vue`, `TeacherTimetableView.vue` (new).
- `staff-console/src/components/AppShell.vue` (modify) — nav links for Holidays, Complaints,
  Report Cards (admin), Timetable (teacher).
- `staff-console/src/views/LoginView.vue` (modify) — "Forgot password?" link.
- `staff-console/src/router/index.ts` (modify) — new routes.
- `staff-console/src/lib/api.ts` (modify) — new client methods.
- `staff-console/src/views/AttendanceView.vue` (modify) — bulk-save call site.
- `staff-console/src/views/TimetablePageView.vue` (modify) — surface 409 conflict errors.
- `staff-console/src/components/AppShell.spec.ts` (modify) — flip the teacher-Timetable-link
  assertion.
- `parent-app/lib/src/api/api_client.dart` (modify) — new client methods.
- `parent-app/lib/src/screens/` — new `report_cards_screen.dart`, `complaints_screen.dart`,
  `forgot_password_screen.dart`, `reset_password_screen.dart`; modify `more_tab.dart` (add entries),
  `calendar_tab.dart` (holiday overlay), login screen (forgot-password link).
- Test files: one spec/e2e file per new module/service, following each area's existing convention.

---

### Task 1: `Holiday` model + `HolidaysModule` (backend)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- New: migration, `backend/src/holidays/holidays.module.ts`, `.controller.ts`, `.service.ts`,
  `dto/create-holiday.dto.ts`, `dto/update-holiday.dto.ts`
- Test: `backend/src/holidays/holidays.service.spec.ts`, `backend/test/holidays.e2e-spec.ts`

**Interfaces:**
- Produces: `HolidaysService.isHoliday(date: Date, campusId: string): Promise<boolean>` — consumed by
  Task 6 (attendance).
- Produces: `GET /api/v1/holidays`, `POST /api/v1/holidays`, `PATCH /api/v1/holidays/:id`,
  `DELETE /api/v1/holidays/:id`.

- [ ] **Step 1:** Open `backend/prisma/schema.prisma` and confirm the exact name of the existing
  campus model (search for `model Campus` or `model SchoolCampus`). Add:
  ```prisma
  model Holiday {
    id        String   @id @default(uuid())
    title     String
    startDate DateTime
    endDate   DateTime
    campusId  String?
    campus    Campus?  @relation(fields: [campusId], references: [id], onDelete: Cascade)
    createdAt DateTime @default(now())

    @@index([campusId])
    @@index([startDate, endDate])
  }
  ```
  (Replace `Campus` with the confirmed model name if different.) Run
  `npx prisma migrate dev --name add_holiday`.
- [ ] **Step 2:** Write failing unit tests for `HolidaysService.isHoliday`: a date inside a
  campus-specific holiday range returns true for that campus and false for another; a date inside a
  `campusId: null` (school-wide) holiday returns true for every campus; a date outside any range
  returns false.
- [ ] **Step 3:** Implement `HolidaysService` (`create`, `update`, `delete`, `findMany({campusId?,
  from?, to?})`, `isHoliday`). Run the unit tests, confirm pass.
- [ ] **Step 4:** Write failing e2e tests: `SCHOOL_ADMIN`/`SUPER_ADMIN` can create/update/delete; a
  `TEACHER` create attempt is 403; a `PARENT` can `GET /holidays` successfully (no
  `StudentAccessService` check — holidays aren't student-scoped).
- [ ] **Step 5:** Implement `HolidaysController` with the roles above, wire `HolidaysModule` into
  `AppModule`. Run the e2e tests, confirm pass. Run `npm run build`.
- [ ] **Step 6: Commit**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/holidays backend/src/app.module.ts
  git commit -m "feat(backend): add calendar-wide Holiday model and HolidaysModule"
  ```

---

### Task 2: Holidays admin UI + parent calendar overlay

**Files:**
- New: `staff-console/src/views/HolidaysView.vue`
- Modify: `staff-console/src/components/AppShell.vue`, `staff-console/src/router/index.ts`,
  `staff-console/src/lib/api.ts`
- Modify: `parent-app/lib/src/api/api_client.dart`,
  `parent-app/lib/src/screens/calendar_tab.dart` (confirm this file's current data source before
  changing it — it was not inspected during spec investigation)
- Test: `staff-console/src/views/HolidaysView.spec.ts`, `AppShell.spec.ts` (add nav-link case),
  `parent-app/test/screens/calendar_tab_test.dart`

**Interfaces:**
- Consumes: Task 1's `GET/POST/PATCH/DELETE /api/v1/holidays`.
- Produces: `api.listHolidays/createHoliday/updateHoliday/deleteHoliday` (staff-console),
  `ApiClient.holidays({campusId, from, to})` (parent-app).

- [ ] **Step 1:** Write a failing `HolidaysView.spec.ts` test asserting the view renders holidays in
  an `EntityTable.vue` and a create form built from `FormField.vue`, following the exact structure of
  an existing Sprint-D-extracted CRUD screen (copy the nearest one, e.g. whichever admin CRUD view is
  simplest — check `staff-console/src/views/` for the shortest existing example to model this on).
- [ ] **Step 2:** Implement `HolidaysView.vue` + the four `api.ts` client methods. Add the route in
  `router/index.ts` (`/admin/holidays`, role-gated `SCHOOL_ADMIN`/`SUPER_ADMIN`) and a nav link in
  `AppShell.vue`'s admin group (confirm and follow the exact `canManage*` computed-property naming
  convention already used for sibling links).
- [ ] **Step 3:** Run `HolidaysView.spec.ts` and `AppShell.spec.ts`, confirm pass. Run `npm run
  type-check` and `npm run lint`.
- [ ] **Step 4:** Read `parent-app/lib/src/screens/calendar_tab.dart` to find its current data
  source. Write a failing widget test asserting a holiday date range from `ApiClient.holidays(...)`
  renders as an overlay/marker on the calendar for the active child's campus.
- [ ] **Step 5:** Add `ApiClient.holidays({campusId, from, to})` and wire the overlay into
  `calendar_tab.dart`. Run the widget test, confirm pass. Run `flutter analyze`.
- [ ] **Step 6: Commit**
  ```bash
  git add staff-console/src parent-app/lib parent-app/test
  git commit -m "feat: add Holidays admin screen and parent-app calendar overlay"
  ```

---

### Task 3: `Complaint` model + `ComplaintsModule` (backend)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- New: migration, `backend/src/complaints/complaints.module.ts`, `.controller.ts`, `.service.ts`,
  `dto/create-complaint.dto.ts`, `dto/update-complaint-status.dto.ts`
- Test: `backend/src/complaints/complaints.service.spec.ts`,
  `backend/test/complaints.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /api/v1/complaints`, `GET /api/v1/complaints?studentId=`,
  `PATCH /api/v1/complaints/:id`.

- [ ] **Step 1:** Add to `schema.prisma`:
  ```prisma
  model Complaint {
    id          String   @id @default(uuid())
    studentId   String
    student     Student  @relation(fields: [studentId], references: [id], onDelete: Restrict)
    raisedById  String
    raisedBy    User     @relation(fields: [raisedById], references: [id])
    subject     String
    description String
    status      String   @default("open")
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt

    @@index([studentId])
  }
  ```
  Run `npx prisma migrate dev --name add_complaint`.
- [ ] **Step 2:** Write failing unit tests for `ComplaintsService`: `create` sets `status: "open"` and
  `raisedById` from the acting user; `updateStatus` transitions status; `findForStudent` returns rows
  for a given `studentId`.
- [ ] **Step 3:** Implement `ComplaintsService`. Run unit tests, confirm pass.
- [ ] **Step 4:** Write failing e2e tests: a `STAFF_ROLES` member (see
  `student-access.service.ts:4` for the exact list) can create; a `PARENT` create attempt is 403; a
  parent `GET` is scoped via `StudentAccessService.assertCanAccessStudent` (cross-student 403); a
  staff `PATCH` updates status, a parent `PATCH` attempt is 403.
- [ ] **Step 5:** Implement `ComplaintsController` (inject `StudentAccessService` for the `GET`
  path), wire `ComplaintsModule` into `AppModule`. Run e2e tests, confirm pass. Run `npm run build`.
- [ ] **Step 6: Commit**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/complaints backend/src/app.module.ts
  git commit -m "feat(backend): add Complaint model and ComplaintsModule (staff-managed, parent-read-only)"
  ```

---

### Task 4: Complaints UI (staff queue + parent read-only list)

**Files:**
- New: `staff-console/src/views/ComplaintsQueueView.vue`,
  `parent-app/lib/src/screens/complaints_screen.dart`
- Modify: `staff-console/src/components/AppShell.vue`, `router/index.ts`, `lib/api.ts`,
  `parent-app/lib/src/api/api_client.dart`, `parent-app/lib/src/screens/more_tab.dart`
- Test: `ComplaintsQueueView.spec.ts`, `parent-app/test/screens/complaints_screen_test.dart`

**Interfaces:**
- Consumes: Task 3's endpoints.
- Produces: `api.listComplaints/createComplaint/updateComplaintStatus` (staff-console),
  `ApiClient.complaints(studentId)` (parent-app).

- [ ] **Step 1:** Write a failing `ComplaintsQueueView.spec.ts` test: renders complaints in an
  `EntityTable.vue`-based list with a status-update control per row (no delete action).
- [ ] **Step 2:** Implement `ComplaintsQueueView.vue` + the three `api.ts` methods, route
  (`/admin/complaints` or `/teacher/complaints` — confirm which roles the roadmap's "staff-facing
  tracking" implies should see this; default to the same `STAFF_ROLES` set as the backend guard), and
  nav link.
- [ ] **Step 3:** Run the spec test, `type-check`, `lint`. Confirm pass.
- [ ] **Step 4:** Write a failing widget test for `complaints_screen.dart`: lists complaints for the
  active child, read-only (no create button/form).
- [ ] **Step 5:** Add `ApiClient.complaints(studentId)`, implement the screen, add a "Complaints"
  entry to `more_tab.dart` linking to it. Run the widget test, confirm pass. Run `flutter analyze`.
- [ ] **Step 6: Commit**
  ```bash
  git add staff-console/src parent-app/lib parent-app/test
  git commit -m "feat: add staff Complaints queue and parent-app read-only Complaints screen"
  ```

---

### Task 5: `MailAdapter` + forgot/reset-password (backend)

**Files:**
- Modify: `backend/prisma/schema.prisma`, `backend/src/auth/auth.controller.ts`,
  `backend/src/auth/auth.service.ts`
- New: migration, `backend/src/notifications/mail-adapter.ts`, `logging-mail.adapter.ts`,
  `smtp-mail.adapter.ts`, `smtp-config.ts`, `backend/src/auth/dto/forgot-password.dto.ts`,
  `reset-password.dto.ts`
- Test: `backend/src/notifications/smtp-config.spec.ts`, `backend/src/auth/auth.service.spec.ts`
  (extend), `backend/test/auth.e2e-spec.ts` (extend)

**Interfaces:**
- Produces: `MailAdapter.send(to, subject, body): Promise<void>`;
  `AuthService.forgotPassword(identifier): Promise<void>`,
  `AuthService.resetPassword(token, newPassword): Promise<void>`.

- [ ] **Step 1:** Open `schema.prisma`'s `model User` and confirm the exact login-identifier field
  name (used by `auth.service.ts:41`'s `login(identifier, password)`). Add:
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
  Run `npx prisma migrate dev --name add_password_reset_token`.
- [ ] **Step 2:** Write failing unit tests for a new `resolveSmtpConfig()`
  (`smtp-config.ts`, mirroring `fcm-config.ts`'s exact contract: unset → `undefined`; fully set →
  config object; partial outside dev/test → throws; partial inside dev/test → `undefined`).
- [ ] **Step 3:** Implement `resolveSmtpConfig`, `MailAdapter` interface, `LoggingMailAdapter`
  (logs `to`/`subject`/`body`), `SmtpMailAdapter` (real, behind config — pick a minimal SMTP client;
  do not add a heavyweight dependency for a path that isn't live-verified this sprint). Register both
  behind a `MAIL_ADAPTER` token in whichever module already provides `PUSH_ADAPTER`
  (`notifications.module.ts`), falling back to `LoggingMailAdapter` exactly like every other
  adapter's config-absent path. Run the config tests, confirm pass.
- [ ] **Step 4:** Write failing unit tests for `AuthService.forgotPassword`: existing identifier
  generates a token, stores its hash with `usedAt: null` and a ~1-hour `expiresAt`, calls
  `MailAdapter.send`; non-existent identifier does **not** call `MailAdapter.send` but the method
  still resolves normally (no thrown error, no distinguishable behavior from the caller's
  perspective).
- [ ] **Step 5:** Write failing unit tests for `AuthService.resetPassword`: valid unexpired unused
  token updates the password (verify via whatever hash comparison `login` already uses) and sets
  `usedAt`; expired/used/wrong token throws the same generic error in all three cases; a successful
  reset deletes/invalidates every `RefreshToken` row for that `userId` (confirm via
  `refreshToken.deleteMany` or an equivalent revocation, matching how `refresh()`'s
  rotation-on-use already handles token invalidation).
- [ ] **Step 6:** Implement both `AuthService` methods, the two DTOs
  (`ForgotPasswordDto { identifier: string }`, `ResetPasswordDto { token: string; newPassword:
  string }`), and `@Public() @Throttle(...)` routes on `AuthController` (`POST
  /auth/forgot-password`, `POST /auth/reset-password`) — throttle these at least as strictly as
  `login` (Sprint B's 5/min precedent), since both are unauthenticated and enumerable. Run the unit
  tests, confirm pass.
- [ ] **Step 7:** Write failing e2e tests confirming both routes return an identical response body
  shape for the valid/invalid-identifier and valid/invalid-token branches respectively. Run e2e,
  confirm pass. Run `npm run build`.
- [ ] **Step 8: Commit**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/notifications backend/src/auth
  git commit -m "feat(backend): add forgot/reset-password flow behind a swappable MailAdapter"
  ```

---

### Task 6: Bulk attendance-marking endpoint + Holiday guard

**Files:**
- Modify: `backend/src/attendance/attendance.controller.ts`, `.service.ts`
- New: `backend/src/attendance/dto/bulk-mark-attendance.dto.ts`
- Test: `backend/src/attendance/attendance.service.spec.ts` (extend),
  `backend/test/attendance.e2e-spec.ts` (extend)

**Interfaces:**
- Consumes: Task 1's `HolidaysService.isHoliday`.
- Produces: `AttendanceService.markBulk(dto, markingUserId): Promise<...>`,
  `POST /api/v1/attendance/bulk`.

- [ ] **Step 1:** Write a failing unit test for a new `AttendanceService.assertNotHoliday(date,
  campusId)`: throws `BadRequestException` when `HolidaysService.isHoliday` (mocked) returns true;
  no-op otherwise.
- [ ] **Step 2:** Implement `assertNotHoliday`, inject `HolidaysService` into `AttendanceService`,
  and call it from the existing single `markAttendance` (resolve `campusId` the same way that method
  already resolves the marking teacher's scope — reuse, don't duplicate that lookup). Run the test,
  confirm pass. Run the existing `attendance.service.spec.ts` in full to catch any regression in
  `markAttendance` from the new dependency.
- [ ] **Step 3:** Write a failing unit test for `markBulk`: given `{date, marks: [...]}`, upserts one
  `Attendance` row per mark inside a single transaction and writes exactly one `AuditLog` row
  summarizing the batch; rejects an empty `marks` array (400); rejects when `assertNotHoliday` throws
  (propagates, no partial writes).
- [ ] **Step 4:** Implement `AttendanceService.markBulk` using `prisma.$transaction`, mirroring
  `TimetableService.replaceForSection`'s transactional shape. Run the test, confirm pass.
- [ ] **Step 5:** Write a failing e2e test: `POST /attendance/bulk` with N marks creates/updates N
  `Attendance` rows and one `AuditLog` row; a holiday-date request is rejected (400) and creates zero
  rows; role check matches the existing single-mark route (`TEACHER`, `SCHOOL_ADMIN`, `SUPER_ADMIN`).
- [ ] **Step 6:** Implement `BulkMarkAttendanceDto` and the controller route. Run e2e, confirm pass.
  Run `npm run build`.
- [ ] **Step 7: Commit**
  ```bash
  git add backend/src/attendance
  git commit -m "feat(backend): add POST /attendance/bulk with a shared Holiday guard"
  ```

---

### Task 7: Bulk attendance — staff-console wiring

**Files:**
- Modify: `staff-console/src/views/AttendanceView.vue`, `staff-console/src/lib/api.ts`
- Test: `AttendanceView.spec.ts` (extend)

**Interfaces:**
- Consumes: Task 6's `POST /api/v1/attendance/bulk`.
- Produces: `api.markAttendanceBulk(accessToken, payload: { date, marks })`.

- [ ] **Step 1:** Write a failing test asserting the save handler now issues exactly one
  `markAttendanceBulk` call with an array payload, not N sequential `markAttendance` calls (spy on
  the API module, assert call count === 1).
- [ ] **Step 2:** Add `api.markAttendanceBulk` to `api.ts` (mirror the existing `markAttendance`
  method's error-handling shape). Replace `AttendanceView.vue:83-90`'s `for` loop with one call.
  Surface a holiday-rejection (400) as a clear inline message, not a generic error.
- [ ] **Step 3:** Run `AttendanceView.spec.ts`, confirm pass. Run `npm run test`, `type-check`,
  `lint` for the full suite (this touches a shared, well-covered view).
- [ ] **Step 4: Commit**
  ```bash
  git add staff-console/src/views/AttendanceView.vue staff-console/src/lib/api.ts staff-console/src/views/AttendanceView.spec.ts
  git commit -m "feat(staff-console): switch attendance save to one bulk API call"
  ```

---

### Task 8: Timetable scheduling-conflict detection (backend)

**Files:**
- Modify: `backend/src/timetable/timetable.service.ts`
- Test: `backend/src/timetable/timetable.service.spec.ts` (extend),
  `backend/test/timetable.e2e-spec.ts` (extend)

**Interfaces:**
- Produces: `TimetableService.assertNoConflict(dto, excludeId?): Promise<void>`.

- [ ] **Step 1:** Open `schema.prisma`'s `model Timetable` and confirm the exact room field
  name/type.
- [ ] **Step 2:** Write failing unit tests for `assertNoConflict`: same `teacherId`+`dayOfWeek`+
  `period` as an existing row throws `ConflictException`; same room, different teacher, same slot
  throws; different teacher, different room, same slot passes; updating a row against itself
  (`excludeId` = that row's own id) does not throw.
- [ ] **Step 3:** Implement `assertNoConflict` per the spec's Design §6 code, call it from
  `createEntry` (before create) and `updateEntry` (before update, passing `excludeId`). Run the unit
  tests, confirm pass.
- [ ] **Step 4:** Write a failing unit test for `replaceForSection`: a submitted batch containing two
  entries that conflict with each other is rejected before any write; a batch that conflicts with an
  existing entry in a *different* section (not being replaced) is rejected; a batch that only
  conflicts with entries in the section being replaced (which are about to be deleted anyway) is
  allowed.
- [ ] **Step 5:** Implement the batch-level check inside `replaceForSection` (pairwise within the
  incoming array, plus a query excluding the section being replaced). Run the test, confirm pass.
- [ ] **Step 6:** Write failing e2e tests covering the same three scenarios end-to-end (409 with a
  message naming which resource conflicted). Run e2e, confirm pass. Run `npm run build`.
- [ ] **Step 7: Commit**
  ```bash
  git add backend/src/timetable
  git commit -m "feat(backend): reject teacher/room double-booking in Timetable create/update/replace"
  ```

---

### Task 9: Timetable conflict errors — staff-console

**Files:**
- Modify: `staff-console/src/views/TimetablePageView.vue`
- Test: `TimetablePageView.spec.ts` (extend)

- [ ] **Step 1:** Read `TimetablePageView.vue`'s current error-handling for a failed
  create/update/replace call (whatever pattern the other Sprint-D CRUD screens already use for a
  rejected mutation).
- [ ] **Step 2:** Write a failing test: a 409 response surfaces its message text inline/as a toast
  (matching that existing pattern), not a generic "something went wrong."
- [ ] **Step 3:** Implement the change. Run the test, confirm pass. Run `type-check`, `lint`.
- [ ] **Step 4: Commit**
  ```bash
  git add staff-console/src/views/TimetablePageView.vue staff-console/src/views/TimetablePageView.spec.ts
  git commit -m "feat(staff-console): surface timetable conflict errors with their real message"
  ```

---

### Task 10: `ReportCard` model + `ReportCardsModule` (backend)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- New: migration, `backend/src/report-cards/report-cards.module.ts`, `.controller.ts`,
  `.service.ts`, `dto/create-report-card.dto.ts`
- Test: `backend/src/report-cards/report-cards.service.spec.ts`,
  `backend/test/report-cards.e2e-spec.ts`

**Interfaces:**
- Consumes: `StorageAdapter` (`STORAGE_ADAPTER` token), `StudentAccessService`.
- Produces: `POST /api/v1/report-cards`, `GET /api/v1/report-cards?studentId=`,
  `GET /api/v1/report-cards/:id/pdf`.

- [ ] **Step 1:** Confirm the exact existing academic-session model name in `schema.prisma`. Add:
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
  Run `npx prisma migrate dev --name add_report_card`.
- [ ] **Step 2:** Write failing unit tests for `ReportCardsService.upload`: persists a `File` via the
  existing storage path then a linked `ReportCard`; a second upload for the same
  `studentId`+`academicSessionId` throws (409-mapped exception).
- [ ] **Step 3:** Implement `ReportCardsService` (`upload`, `findForStudent`, `getFileForDownload`),
  reusing `FilesService`'s existing upload helper rather than reimplementing multer config. Run the
  tests, confirm pass.
- [ ] **Step 4:** Write failing e2e tests: `TEACHER`/`SCHOOL_ADMIN`/`SUPER_ADMIN` can upload; a
  `PARENT` upload attempt is 403; a parent read is scoped via `StudentAccessService` (cross-student
  403); a duplicate upload is rejected (409); PDF download streams the right bytes.
- [ ] **Step 5:** Implement `ReportCardsController`, wire `ReportCardsModule` into `AppModule`. Run
  e2e, confirm pass. Run `npm run build`.
- [ ] **Step 6: Commit**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations backend/src/report-cards backend/src/app.module.ts
  git commit -m "feat(backend): add ReportCard model and ReportCardsModule"
  ```

---

### Task 11: Report Cards UI (staff upload + parent viewer)

**Files:**
- New: `staff-console/src/views/ReportCardsView.vue`,
  `parent-app/lib/src/screens/report_cards_screen.dart`
- Modify: `staff-console/src/components/AppShell.vue`, `router/index.ts`, `lib/api.ts`,
  `parent-app/lib/src/api/api_client.dart`, `parent-app/lib/src/screens/more_tab.dart`
- Test: `ReportCardsView.spec.ts`, `parent-app/test/screens/report_cards_screen_test.dart`

- [ ] **Step 1:** Write a failing `ReportCardsView.spec.ts` test: student picker + session picker +
  file input; submitting calls the upload API; a duplicate-upload 409 surfaces as a clear message.
- [ ] **Step 2:** Implement `ReportCardsView.vue` + `api.ts` methods (`uploadReportCard`,
  `listReportCards`), route, and nav link.
- [ ] **Step 3:** Run the spec test, `type-check`, `lint`.
- [ ] **Step 4:** Write a failing widget test for `report_cards_screen.dart`: lists report cards for
  the active child; tapping one opens its PDF via `url_launcher` (same pattern as
  `fees_tab.dart`'s receipt download).
- [ ] **Step 5:** Add `ApiClient.reportCards(studentId)`, implement the screen, add a "Report Cards"
  entry to `more_tab.dart`. Run the widget test, confirm pass. Run `flutter analyze`.
- [ ] **Step 6: Commit**
  ```bash
  git add staff-console/src parent-app/lib parent-app/test
  git commit -m "feat: add staff Report Cards upload screen and parent-app viewer"
  ```

---

### Task 12: Teacher's own timetable view (backend + frontend + nav link)

**Files:**
- Modify: `backend/src/timetable/timetable.controller.ts`, `.service.ts`
- New: `staff-console/src/views/TeacherTimetableView.vue`
- Modify: `staff-console/src/components/AppShell.vue`, `router/index.ts`,
  `staff-console/src/components/AppShell.spec.ts`
- Test: `backend/test/timetable.e2e-spec.ts` (extend), `TeacherTimetableView.spec.ts`

**Interfaces:**
- Produces: `TimetableService.getForTeacher(teacherId): Promise<...>`,
  `GET /api/v1/teachers/me/timetable`.

- [ ] **Step 1:** Confirm the exact existing lookup pattern for resolving a `Teacher` record from a
  `req.user.id` (check how the attendance/diary teacher-role handlers already do this).
- [ ] **Step 2:** Write a failing unit test for `TimetableService.getForTeacher(teacherId)`: returns
  only that teacher's entries, ordered by `dayOfWeek`/`period`.
- [ ] **Step 3:** Implement `getForTeacher`. Run the test, confirm pass.
- [ ] **Step 4:** Write a failing e2e test: `GET /teachers/me/timetable` as `TEACHER` returns only
  the calling teacher's entries; a non-`TEACHER` role gets 403.
- [ ] **Step 5:** Implement the controller route (`@Roles('TEACHER')`, resolves `Teacher` from
  `req.user.id` per Step 1's confirmed pattern). Run e2e, confirm pass. Run `npm run build`.
- [ ] **Step 6:** Write a failing `TeacherTimetableView.spec.ts` test: renders a read-only weekly
  grid from the endpoint's response, reusing whichever grid-rendering component
  `TimetablePageView.vue` already uses internally (confirm its name before importing).
- [ ] **Step 7:** Implement `TeacherTimetableView.vue`, add route `/teacher/timetable`, and add the
  `nav-timetable` `RouterLink` back into `AppShell.vue`'s `isTeacher` block
  (`AppShell.vue:326-330`).
- [ ] **Step 8:** Update `AppShell.spec.ts:77-79` — flip the assertion from "does not exist" to
  "exists" for the teacher-role `[data-testid="nav-timetable"]` link. Run
  `TeacherTimetableView.spec.ts` and `AppShell.spec.ts`, confirm both pass. Run the full
  staff-console suite (`npm run test`, `type-check`, `lint`) to confirm no other spec assumed the old
  behavior.
- [ ] **Step 9: Commit**
  ```bash
  git add backend/src/timetable staff-console/src
  git commit -m "feat: add teacher's own timetable view, re-add the nav-timetable link Sprint D removed"
  ```

---

## Definition of Done (from the roadmap)

- All items in the Gap Analysis's Medium/Low severity register that fall in this list are closed; the
  dead Teacher → Timetable link resolves to a real screen (and its regression test now asserts the
  link exists, not that it's absent).
- Verify at the end: full backend unit + e2e suites green, `npm run build` clean, lint clean on every
  touched file; staff-console `npm run test`/`type-check`/`lint` all green; parent-app `flutter
  analyze` clean and full `flutter test` suite passing.
- Document explicitly, per this repo's established pattern (Sprints C/E/F/H): forgot-password ships
  on `LoggingMailAdapter` (no real SMTP account exists), and the exact confirmed/adjusted schema field
  names (`Campus`, `AcademicSession`, `Timetable.room`, `User`'s identifier field) discovered while
  implementing, in `PROJECT-STATUS.md` and the roadmap's Implementation Checklist.
