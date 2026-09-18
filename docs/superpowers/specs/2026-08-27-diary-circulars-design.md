# Sprint 5-6 — Diary/Homework + Circulars (FEAT-008, FEAT-009)

Status: approved, ready for implementation planning.
Spec source: `SchoolOS/apk/MVP-Plan-V3.md` → `plan/docs/FEATURES.txt` (FEAT-008, FEAT-009).

## Goal

- **FEAT-008 (Diary/homework):** teachers post per-subject, per-section homework/diary entries
  with an optional due date and attachments; parents see their child's section's entries; Urdu
  text renders correctly right-to-left with a proper Urdu font, no auto-translation.
- **FEAT-009 (Circulars):** admins publish school-wide or section-scoped notices with
  attachments; parents see a read/unread inbox; admins see delivered-vs-read counts per circular.

## Data model changes

Building on the placeholder tables already in `schema.prisma` (from FEAT-001):

- `DiaryEntry`: **replace** the `students Student[]` many-to-many with `sectionId String` +
  `section Section @relation(fields: [sectionId], references: [id], onDelete: Cascade)`. An
  entry is authored once per section+subject+date and is visible to every student in that
  section — mirrors how `Timetable` already models "one row covers a whole section." Also
  remove the now-unused `diaryReads DiaryEntry[] @relation("DiaryEntryStudents")` back-relation
  on `Student`. No existing data migration concern — `DiaryEntry` is currently an empty table.
- `Circular`: add `sectionId String?` (nullable; set only when `scope === "section"`) so the
  recipient fan-out knows who to include.
- New `CircularRecipient` model — one row per intended reader, created at publish time:
  ```
  model CircularRecipient {
    id         String    @id @default(uuid())
    circularId String
    circular   Circular  @relation(fields: [circularId], references: [id], onDelete: Cascade)
    userId     String
    user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
    readAt     DateTime?
    createdAt  DateTime  @default(now())

    @@unique([circularId, userId])
    @@index([userId])
  }
  ```
  Same shape as the existing `MessageRecipient` (Sprint 7-8 precedent). Delivered = row count;
  read = rows with `readAt IS NOT NULL`.
- `File`/`DiaryAttachment`/`CircularAttachment` — no schema change. `File.storageKey` already
  exists; a storage adapter decides what a key resolves to (see below).

Migration: one new Prisma migration for this sprint. Update `prisma/seed.ts` again to add a
sample diary entry and a sample circular (with `CircularRecipient` rows for the seeded parents)
— the same category of gap that left Timetable/Attendance unseeded must not recur here.

## File storage

No real S3-compatible storage exists yet (tracked separately under Sprint 11-12 hardening).
This sprint adds a small `StorageAdapter` interface — `save(buffer, mimeType): Promise<{storageKey}>`,
`read(storageKey): Promise<Readable>`, `delete(storageKey): Promise<void>` — with a
local-filesystem implementation (files under `backend/uploads/`, keyed by a random UUID + original
extension, never the original filename on disk). Swapping to an S3-compatible implementation
later is a one-file change behind the same interface, the same pattern already used for the
SQLite → PostgreSQL datasource swap.

## Backend API

New NestJS modules, following the existing `attendance`/`timetable` module shape (controller +
service + DTOs, `@Roles()` guards, audit-logged writes). No teacher-to-own-section ownership
check is introduced — matches the existing Attendance/Timetable precedent where any `TEACHER`
token can act on any section.

**Files module** (shared by Diary and Circulars):
- `POST /api/v1/files` — `@Roles('TEACHER','SCHOOL_ADMIN','SUPER_ADMIN')`, multipart upload via
  `FileInterceptor`, streams through `StorageAdapter.save()`, creates a `File` row, returns its id.
- `GET /api/v1/files/:id` — streams the file. Staff can fetch any file. A `PARENT` may only fetch
  a file that is actually attached (via `DiaryAttachment` or `CircularAttachment`) to a diary
  entry/circular they're entitled to see — checked the same way `StudentAccessService` checks
  diary access, and the same way `CircularRecipient` gates circular access.

**Diary module:**
- `POST /api/v1/diary` — `@Roles('TEACHER','SCHOOL_ADMIN','SUPER_ADMIN')` —
  `{ sectionId, subjectId, date, text, dueDate?, fileIds? }`.
- `GET /api/v1/students/:id/diary?month=` — parent-ownership-checked via the existing
  `StudentAccessService` (same call shape as `GET /students/:id/attendance`). Resolves the
  student's `sectionId`, returns that section's entries for the month with attachments.
- `GET /api/v1/sections/:id/diary?month=` — staff-only, powers the teacher-authoring screen's
  "what have I already posted" list.

**Circulars module:**
- `POST /api/v1/circulars` — `@Roles('SCHOOL_ADMIN','SUPER_ADMIN')` —
  `{ title, description, scope, sectionId?, priority?, expiresAt?, fileIds? }`. On create, fans
  out `CircularRecipient` rows to every `PARENT` in scope: all parents (`scope: "school"`) or
  parents of students in `sectionId` (`scope: "section"`).
- `GET /api/v1/circulars` — any authenticated role. A `PARENT` gets their own inbox (joined
  through their `CircularRecipient` rows, with `readAt`); staff gets what they authored.
- `POST /api/v1/circulars/:id/read` — `@Roles('PARENT')` — sets the caller's
  `CircularRecipient.readAt = now()`; 404s if no recipient row exists for that circular+user
  (i.e. out of scope for them).
- `GET /api/v1/circulars/:id/stats` — `@Roles('SCHOOL_ADMIN','SUPER_ADMIN')` —
  `{ delivered: number, read: number }`.

Every write (`diary.create`, `circular.publish`, `circular.read`, `file.upload`) gets an
`AuditLog` row, matching the Attendance precedent.

## Client UI

**Staff console (Vue):**
- `DiaryView.vue` (teacher role) — section/subject picker, date, due-date, text area with file
  attach, list of already-posted entries for the selected section (via
  `GET /sections/:id/diary`). Reuses `AttendanceView.vue`'s layout/section-picker conventions.
- `CircularsView.vue` (admin role) — compose form (title/description/scope/attachments) +
  published list showing delivered/read counts per circular (`GET /circulars/:id/stats`).
- Both wired into `router/index.ts` under the existing role-gated nav pattern — the sidebar
  already has placeholder "Timetable"/"Circulars" entries from the Sprint 3-4 shell.

**Parent app (Flutter):**
- Diary fills in the existing 3rd sub-tab of `calendar_tab.dart`'s `CalendarTab` (already
  scaffolded as `Tab(text: 'Diary')` with a "lands in the next sprint" placeholder) — a
  `_DiaryTab` following the same `_TimetableTab`/`_AttendanceTab` fetch-and-list pattern.
- Circulars fills in the `HomeShell` bottom nav's "Notifications" tab (index 2, currently a
  placeholder) — FEAT-011's future FCM push wiring (Sprint 7-8) can later deep-link into this
  same list rather than needing a separate screen. Shows unread count as a nav badge; opening an
  entry fires `POST /circulars/:id/read`.

## Urdu RTL + font handling

A small shared helper, implemented once per client:

- Inspect each text block **independently** (entry title and body can differ in language — a
  title could be English, the body Urdu). If the first strong-directionality character
  (Unicode bidi class) is Arabic/Urdu script, render that block `dir: rtl` with a proper Urdu
  font; otherwise default `dir: ltr` with the existing Plus Jakarta Sans stack.
- **Flutter:** `GoogleFonts.notoNastaliqUrdu()` (the `google_fonts` package is already a
  dependency, per `app_theme.dart`) wrapped in a `Directionality` widget per block.
- **Vue (staff console, for both display and the teacher's authoring textarea):** a Noto
  Nastaliq Urdu `@font-face` (Google Fonts) + `direction: rtl` applied via the same detection
  helper, ported to TypeScript.
- This is pure Unicode bidi-class detection — no language-ID model, no translation, matching
  the "no auto-translation" requirement.

## Testing & rollout

Same rigor as Sprints 1-4, TDD throughout:
- Backend: one `*.service.spec.ts` per new service (mocked `PrismaService`, following
  `attendance.service.spec.ts` conventions) + e2e tests for role-gating and parent-isolation —
  a parent can't read another section's diary, can't mark read a circular outside their scope,
  can't fetch a file they have no attachment link to.
- Staff console: one component spec per new view (`AttendanceView.spec.ts` conventions).
- Parent app: one widget test per new tab.
- `prisma/seed.ts`: add one sample diary entry and one sample circular (with recipient rows) so
  a fresh `dev.db` never regresses to the "looks blank but isn't broken" state again.
