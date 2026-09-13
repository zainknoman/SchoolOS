# SEEDS Digital Platform

A school management platform for a single school running multiple campuses: one NestJS + Prisma
backend serving two clients — a Vue **staff console** (Teacher / School Admin / Accounts / Principal,
one role-gated app) and a Flutter **parent app**. Built feature-by-feature against a validated MVP
plan and, since 2026-09-13, a Post-MVP roadmap on top of it; current status is tracked in
[`PROJECT-STATUS.md`](./PROJECT-STATUS.md), which is the source of truth for what's actually done
versus pending — this file is a map of the codebase, not a status report.

## Status at a glance

All MVP features (FEAT-001 through FEAT-013) and Sprints A through Q of the Post-MVP roadmap are
done: session/CI/database hardening, Postgres migration, payments (JazzCash/EasyPaisa adapters +
cash reconciliation), push notifications (FCM), WhatsApp/SMS/digest notifications, report cards,
holidays, complaints, forgot-password, leave workflow, teacher timetable, cross-tenant/cross-campus
access-control hardening, P0 test-coverage backfill, a structured **gradebook** (Sprint N), an
**admissions/enrollment pipeline** (Sprint O), **bulk import** for Students/Parents/Teachers via CSV
(Sprint P), and a shared `StatusPill` component + accessibility fixes (Sprint Q) — all four pushed to
`main` and green on GitHub Actions. FEAT-014 (offline caching) is partially done. See
[`PROJECT-STATUS.md`](./PROJECT-STATUS.md) for the authoritative, up-to-date checklist, and
`docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` / `build/MASTER-PROMPT-TRACKER.md`
for how Sprints N–Q map back to the original gap analysis (both are stale as of this writing — their
checklists still show N–Q as unstarted; update them alongside this file).

**Known, deliberately-scoped remaining gaps** (not oversights — see the roadmap docs for why):
EMI-style fee installments (explicitly deferred by the Post-MVP master prompt), a Users/roles
management UI (School Admin/Accounts/Super Admin/Principal accounts are still seed-script-only — no
in-app way to create or manage them), Command Palette accessibility audit (overflow/keyboard/focus —
named in the master prompt's UI Accessibility section but not carried into Sprint Q's actual scope),
and the parent-app's report-card screen still passes an empty `termId` placeholder to the grades API
pending a term-selection UI. Play Store submission, real S3/Firebase/payment-gateway/WhatsApp-SMS
credentials, JWT-secret rotation, and a scoped pilot rollout remain before any production deployment.

## Architecture

```
backend/               NestJS + Prisma API — the only backend, serves both clients
staff-console/         Vue 3 SPA for Teacher / School Admin / Accounts / Principal roles
parent-app/            Flutter app for parents (Android/iOS/web/desktop targets)
plan/docs/             Original MVP plan and full feature spec (FEAT-001..014)
docs/superpowers/      Per-sprint implementation plans + design specs (superpowers-driven-development artifacts)
docs/Plan-Ideas/       Post-MVP planning set: gap analysis, competitor research, roadmap, master prompts
docs/Figma/            Figma design-system handoff spec
docs/wireframe/        MVP screen wireframes and per-flow HTML/PNG exports
docs/timetable-samples/  Reference timetable design images
```

- **One backend, two clients.** Both clients talk to the same REST API at `/api/v1/...`; there's no
  separate backend-for-frontend layer.
- **Role-gated, not app-per-role.** The staff console is a single Vue app — Teacher and Admin/
  Accounts/Principal see different nav items and routes based on their JWT role, enforced
  server-side (`@Roles()` guards), never just hidden in CSS.
- **Server is the only source of truth on authorization.** Every write path re-checks role,
  campus, and tenant (`schoolId`) ownership on the backend; a hidden button on the frontend is
  never the security boundary (hardened further in Sprint L's cross-tenant/cross-campus pass).
- **Swappable infrastructure adapters.** File storage (`STORAGE_ADAPTER`), payment gateway
  (`PaymentGatewayAdapter`, with real JazzCash/EasyPaisa implementations behind it), push
  notifications (`PushAdapter`, real FCM implementation), and AI drafting (stub-or-real Anthropic
  provider) are all behind interface tokens, each falling back to a stub/logging implementation in
  development/test when real credentials aren't configured.
- **Audit-logged writes.** Every state-changing endpoint writes an `AuditLog` row — who did what, to
  which entity, when.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | NestJS 11, Prisma 7 + PostgreSQL (`@prisma/adapter-pg`), Passport-JWT + argon2, class-validator, pdfkit, csv-parse |
| Staff console | Vue 3, TypeScript, Vite, Pinia, Vue Router, vue-i18n, Vitest |
| Parent app | Flutter (Dart), `flutter_secure_storage`, `shared_preferences` (offline caching), `firebase_messaging`, `flutter_localizations` |
| Testing | Jest (backend unit + e2e), Vitest (staff-console), `flutter test` (parent-app) |

## Backend module map

`backend/src/` — one NestJS module per concern:

| Module | Responsibility |
|---|---|
| `auth/` | Login, JWT access+refresh (with rotation), RBAC guards, account lockout, forgot/reset-password |
| `me/` | Authenticated parent's own profile + linked children |
| `school/`, `campus/`, `academic-session/`, `class/`, `sections/` | Org structure CRUD (School → Campus → Class → Section, academic sessions) |
| `student/`, `parent/`, `teacher/`, `teachers/` | People CRUD (Student/Parent/Teacher create with linked `User` accounts) |
| `timetable/`, `attendance/` | Class schedules, daily/bulk attendance marking, scheduling-conflict detection |
| `diary/`, `circulars/`, `holidays/` | Homework/diary entries, school-wide/section-wide announcements, calendar-wide holidays |
| `messages/`, `notifications/` | Scoped parent↔staff messaging, in-app + WhatsApp/SMS/push notification dispatch with digest bundling |
| `fees/` | Fee structures, voucher issuance, PDF generation, JazzCash/EasyPaisa payment + cash reconciliation |
| `leave/` | Leave applications and approval, feeding into attendance |
| `complaints/` | Parent/staff complaint or concern tracking (distinct from discipline) |
| `report-cards/` | Report-card PDF upload/view (Admin + Teacher) |
| `gradebook/` | **Sprint N** — Terms, weighted Assessment Categories, Assessments, Marks, calculated final grades consumed by report cards |
| `admissions/` | **Sprint O** — Applicant/Application pipeline: submit, review, approve/reject, create the resulting `Student` + `Enrollment` |
| `bulk-import/` | **Sprint P** — CSV preview/commit import for Students, Parents, and Teachers, with validation, duplicate detection, and audit logging |
| `ai-drafting/` | "Suggest draft" for circulars/diary (stub provider unless `ANTHROPIC_API_KEY` is set) |
| `attendance-risk/` | Nightly-computed early-warning panel (attendance risk flags) on the admin dashboard |
| `files/` | Generic file upload/download behind `STORAGE_ADAPTER`, with size/MIME limits |
| `dashboard/` | Admin dashboard aggregate stats, wired to live data |
| `common/`, `storage/`, `enrollment/`, `subjects/` | Shared guards/helpers (incl. tenant/campus access checks), storage adapter interface, student↔section enrollment resolution, subject reference data |

Full endpoint-level detail lives in `plan/docs/FEATURES.txt` (FEAT-001..014, MVP baseline) and the
per-sprint sections of `PROJECT-STATUS.md` (Post-MVP work, Sprints A–Q).

## Getting started (local development)

Three processes, none of which auto-start — a blank client screen almost always means one of these
isn't running.

### Prerequisites

- Node.js (backend and staff-console; `engines` in each `package.json` names the tested version)
- PostgreSQL 16+ running locally and reachable (`localhost:5432` by default — a native service or a
  container both work; this repo's own dev environment runs a native Windows Postgres service)
- Flutter SDK 3.47.x (parent-app) — `flutter doctor` should be green for at least web/Chrome; an
  Android emulator or a physical device is only needed for a non-web preview

### 1. Backend (NestJS API, port 3000)

```bash
cd backend
npm install
cp .env.example .env          # points at a local Postgres DB; dev-only JWT secrets
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

`.env.example` also documents optional integration credentials (JazzCash/EasyPaisa, Firebase/FCM,
SMTP for password reset, `ANTHROPIC_API_KEY` for real AI drafting) — leave any provider's variables
entirely unset to fall back to that provider's stub/logging adapter in development/test; setting
*some but not all* of a provider's variables is a startup error outside development/test, by design.

The seed script creates a school with 2 campuses, 3 classes/sections, teachers, an admin/accounts/
principal/super-admin, 2 parents with linked children, timetables, attendance history, and one of
each of diary/circular/message/notification/fee-voucher/leave-request, so most screens have real data
on first run. **It does not seed any Terms/Assessment Categories/Marks, Applicants/Applications, or
bulk-import history** — the gradebook, admissions, and bulk-import screens (Sprints N/O/P) will show
empty state until you create data through those screens yourself.

Login accepts either an email identifier or a student GR number.

### 2. Staff console (Vue, port 5173)

```bash
cd staff-console
npm install
npm run dev
```

### 3. Parent app (Flutter)

```bash
cd parent-app
flutter pub get
flutter run -d chrome    # or an Android emulator / iOS simulator
```

### After pulling a branch with schema changes

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

## Test accounts (seeded)

All accounts below share the password **`ChangeMe123!`** — dev-only, created by
`backend/prisma/seed.ts`, not fixed anywhere else. Re-running the seed script (against an empty
database) recreates them identically; there is no way to look up or reset a password other than
re-seeding or using the app's own forgot-password flow.

| Identifier | Role | Password | Notes |
|---|---|---|---|
| `superadmin@seeds.edu.pk` | Super Admin | `ChangeMe123!` | Only role that can use Org Structure CRUD (School/Campus/AcademicSession/Class/Section) |
| `admin@seeds.edu.pk` | School Admin | `ChangeMe123!` | Full admin nav: People CRUD, Fees, Gradebook, Admissions, Bulk Import, Dashboard, etc. |
| `principal@seeds.edu.pk` | School Admin (`isPrincipal: true`) | `ChangeMe123!` | Same permissions as `admin@`, distinct identity for testing principal-specific UI/copy |
| `accounts@seeds.edu.pk` | Accounts | `ChangeMe123!` | Fees + Admissions nav only, not full admin surface |
| `teacher@seeds.edu.pk` | Teacher | `ChangeMe123!` | Class teacher of section **3A** (Gulistan-e-Jauhar campus) |
| `teacher2@seeds.edu.pk` | Teacher | `ChangeMe123!` | Class teacher of section **4B** (Gulistan-e-Jauhar campus) |
| `teacher3@seeds.edu.pk` | Teacher | `ChangeMe123!` | Class teacher of section **5C** (Gulshan-e-Iqbal campus) |
| `parent-a@seeds.edu.pk` | Parent | `ChangeMe123!` | Linked to Eshaal Sample (GR-1001, section 3A) only |
| `parent-b@seeds.edu.pk` | Parent | `ChangeMe123!` | Linked to all three seeded students (3A, 4B, 5C) — use this account to test the multi-child switcher |

Student GR numbers for login/lookup: `GR-1001` (Eshaal, 3A), `GR-1002` (Ibrahim, 4B), `GR-1003`
(Hania, 5C).

## Testing

```bash
# Backend — unit + e2e (needs the local Postgres DB from "Getting started" above, migrated)
cd backend
npm test                                          # unit
npx jest --config test/jest-e2e.json              # e2e (jest-e2e.json already pins maxWorkers to 1)

# Staff console
cd staff-console
npm test              # vitest run
npm run type-check    # vue-tsc --build — run this separately; it can pass locally on a stale
                       # incremental cache and only catch real errors on a clean run. Delete any
                       # local .tsbuildinfo before trusting a green result if in doubt.

# Parent app
cd parent-app
flutter analyze
flutter test
```

Run each client's `lint`/`type-check`/`build` (or `flutter analyze`) before committing, and don't
trust a `vue-tsc --build` pass alone if you suspect the incremental cache is stale — this repo's
history has more than one case of a defect that unit tests missed, the type-checker's own
incremental cache silently hid, but CI (a clean checkout every time) or a real browser render caught.

## Environment variables

`backend/.env` (see `.env.example` for the full, current list with inline explanations):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma datasource — a `postgresql://...` connection string, required in every environment (no SQLite fallback) |
| `CORS_ORIGINS` | Allow-listed client origins; a `localhost`/`127.0.0.1` carve-out applies automatically in development/test only |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets — the `.env.example` placeholders are dev-only; the backend fails fast at boot if either is unset outside `NODE_ENV=development`/`test` |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Token lifetimes (default `15m` / `30d`) |
| `JAZZCASH_*` / `EASYPAISA_*` | JazzCash/EasyPaisa payment adapter credentials — leave entirely unset to use the stub gateway in dev/test |
| `PAYMENT_STUB_WEBHOOK_SECRET` | Required outside dev/test if the stub payment-webhook route is reachable |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | FCM push notification credentials — leave unset to fall back to a logging no-op adapter |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Forgot/reset-password email — leave unset to log the reset link instead of emailing it |
| `FRONTEND_URL` | Base URL used to build the reset-password link; defaults to the staff-console dev origin |
| `ANTHROPIC_API_KEY` | Enables real AI drafting ("Suggest draft" on circulars/diary); unset uses a labeled stub suggestion |

## Documentation

- [`PROJECT-STATUS.md`](./PROJECT-STATUS.md) — the living, per-sprint changelog and pending-work
  tracker; always the most current source of truth for engineering status.
- `plan/docs/FEATURES.txt` — the full FEAT-001..014 specification the original MVP was implemented
  against.
- `docs/Plan-Ideas/PHASE-1/` and `docs/Plan-Ideas/PHASE-2/` — the Post-MVP planning set: a repo
  audit, gap analysis & feature prioritization, competitor research, UI/UX audit, the Post-MVP
  roadmap (Sprints A–Q), and the Phase 2 "Master Implementation & Validation Prompt" that Sprints
  N–Q were executed against.
- `build/MASTER-PROMPT-TRACKER.md` — per-item evidence tracker cross-referencing the master prompt's
  sections against actual repo state as of 2026-09-12 (predates Sprints L–Q; update alongside this
  file and `PROJECT-STATUS.md`).
- `docs/superpowers/plans/` — dated implementation plans for each feature/hardening pass, each
  paired with its design spec under `docs/superpowers/specs/` where one exists.
- `docs/wireframe/` — the UX mockups behind the wireframe-driven design pass.

## Deployment readiness

Sprint L (2026-09-12) added tenant-scoping (`User.schoolId`) to the access-control layer, so the
authorization model is no longer single-tenant-only. The product is still *operated* as a single
school today, though: self-service tenant provisioning, billing, and per-tenant admin creation are
all still out of scope. The backend has run on PostgreSQL (not SQLite) since Sprint B. Before any
staging/production deployment or pilot rollout, see `PROJECT-STATUS.md`'s "Sprint 11-12 — Hardening +
Pilot" section for the concrete remaining checklist: real secrets (rotate the dev-only JWT secrets),
S3-compatible storage, a real Firebase project for push, real JazzCash/EasyPaisa merchant credentials,
real WhatsApp Business/SMS gateway credentials, a real `ANTHROPIC_API_KEY`, Play Store submission for
FEAT-014, and a scoped pilot (one campus/class, 20-50 parents) before full cutover.
