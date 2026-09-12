# SEEDS Digital Platform

A school management platform for a single school running multiple campuses: one NestJS + Prisma
backend serving two clients — a Vue **staff console** (Teacher / School Admin / Accounts, one
role-gated app) and a Flutter **parent app**. Built feature-by-feature against a validated MVP plan;
current status is tracked in [`PROJECT-STATUS.md`](./PROJECT-STATUS.md), which is the source of
truth for what's actually done versus pending — this file is a map of the codebase, not a status
report.

## Status at a glance

All MVP features (FEAT-001 through FEAT-013), the Org Structure and People CRUD screens, and a
security hardening pass are done. FEAT-014 (offline caching) is partially done — see
[`PROJECT-STATUS.md`](./PROJECT-STATUS.md) for the authoritative, up-to-date checklist of what
remains before a pilot rollout (PostgreSQL migration, real S3/Firebase wiring, secret rotation,
Play Store submission).

## Architecture

```
backend/         NestJS + Prisma API — the only backend, serves both clients
staff-console/   Vue 3 SPA for Teacher / School Admin / Accounts / Principal roles
parent-app/      Flutter app for parents (Android/iOS/web/desktop targets)
docs/            Design specs, implementation plans, wireframes (superpowers-driven-development artifacts)
plan/            Original MVP plan and full feature spec (FEAT-001..014)
```

- **One backend, two clients.** Both clients talk to the same REST API at `/api/v1/...`; there's no
  separate backend-for-frontend layer.
- **Role-gated, not app-per-role.** The staff console is a single Vue app — Teacher and Admin/
  Accounts/Principal see different nav items and routes based on their JWT role, enforced
  server-side (`@Roles()` guards), never just hidden in CSS.
- **Server is the only source of truth on authorization.** Every write path re-checks role and
  ownership on the backend; a hidden button on the frontend is never the security boundary.
- **Swappable infrastructure adapters.** File storage (`STORAGE_ADAPTER`), payment gateway
  (`PaymentGatewayAdapter`), and push notifications (`PushAdapter`) are all behind interface tokens
  so the current stub/local implementations can be swapped for S3, JazzCash/EasyPaisa, and Firebase
  Cloud Messaging respectively without touching call sites.
- **Audit-logged writes.** Every state-changing endpoint writes an `AuditLog` row — who did what, to
  which entity, when.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | NestJS 11, Prisma 7 (SQLite locally via `better-sqlite3`, PostgreSQL-ready), Passport-JWT + argon2, class-validator, pdfkit |
| Staff console | Vue 3, TypeScript, Vite, Pinia, Vue Router, Vitest |
| Parent app | Flutter (Dart), `flutter_secure_storage`, `shared_preferences` (offline caching) |
| Testing | Jest (backend unit + e2e), Vitest (staff-console), `flutter test` (parent-app) |

## Backend module map

`backend/src/` — one NestJS module per concern:

| Module | Responsibility |
|---|---|
| `auth/` | Login, JWT access+refresh, RBAC guards, account lockout |
| `me/` | Authenticated parent's own profile + linked children |
| `school/`, `campus/`, `academic-session/`, `class/`, `sections/` | Org structure CRUD (School → Campus → Class → Section, academic sessions) |
| `student/`, `parent/`, `teacher/`, `teachers/` | People CRUD (Student/Parent/Teacher create with linked `User` accounts) |
| `timetable/`, `attendance/` | Class schedules and daily attendance marking |
| `diary/`, `circulars/` | Homework/diary entries and school-wide/section-wide announcements |
| `messages/`, `notifications/` | Scoped parent↔staff messaging and an in-app notification center |
| `fees/` | Fee structures, voucher issuance, PDF generation, in-app payment (stubbed gateway) |
| `leave/` | Leave applications and approval, feeding into attendance |
| `files/` | Generic file upload/download behind `STORAGE_ADAPTER` |
| `dashboard/` | Admin dashboard aggregate stats |
| `common/`, `storage/`, `enrollment/`, `subjects/` | Shared guards/helpers, storage adapter interface, student↔section enrollment resolution, subject reference data |

Full endpoint-level detail lives in `plan/docs/FEATURES.txt` (FEAT-001..014) and the per-sprint
sections of `PROJECT-STATUS.md`.

## Getting started (local development)

Three processes, none of which auto-start — a blank client screen almost always means one of these
isn't running.

### 1. Backend (NestJS API, port 3000)

```bash
cd backend
npm install
cp .env.example .env          # defaults to a local SQLite file, dev-only JWT secrets
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

The seed script creates a school with 2 campuses, 3 classes/sections, teachers, an admin/accounts/
principal/super-admin, 2 parents with linked children, timetables, attendance history, and one of
each of diary/circular/message/notification/fee-voucher/leave-request, so every screen has real data
on first run.

**Seeded accounts** (all `ChangeMe123!`, dev-only):

| Identifier | Role |
|---|---|
| `superadmin@seeds.edu.pk` | Super Admin |
| `admin@seeds.edu.pk` | School Admin |
| `principal@seeds.edu.pk` | School Admin (Principal) |
| `accounts@seeds.edu.pk` | Accounts |
| `teacher@seeds.edu.pk` / `teacher2@` / `teacher3@` | Teacher (one per section) |
| `parent-a@seeds.edu.pk` / `parent-b@seeds.edu.pk` | Parent |

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

`backend/dev.db` is git-ignored — each checkout (including git worktrees) has its own SQLite file
that won't pick up new migrations automatically:

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

## Testing

```bash
# Backend — unit + e2e
cd backend
npm test                                          # unit
npx jest --config test/jest-e2e.json --runInBand  # e2e (--runInBand avoids shared-SQLite lock contention)

# Staff console
cd staff-console
npm test

# Parent app
cd parent-app
flutter test
```

Run each client's `lint`/`type-check`/`build` (or `flutter analyze`) before committing — this
repo's history has more than one case of a defect that unit tests missed but the type-checker or a
real browser render caught.

## Environment variables

`backend/.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Prisma datasource — `file:./dev.db` locally, a `postgresql://...` URL before staging/production |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets — the `.env.example` placeholders are dev-only and must be rotated before any real deployment |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Token lifetimes (default `15m` / `30d`) |

## Documentation

- [`PROJECT-STATUS.md`](./PROJECT-STATUS.md) — the living, per-sprint changelog and pending-work
  tracker; always the most current source of truth.
- `plan/docs/FEATURES.txt` — the full FEAT-001..014 specification this build was implemented against.
- `docs/superpowers/plans/` — dated implementation plans for each feature/hardening pass, each
  paired with its design spec under `docs/superpowers/specs/` where one exists.
- `docs/wireframe/` — the UX mockups behind the wireframe-driven design pass.

## Deployment readiness

Sprint L (2026-09-12) added tenant-scoping (`User.schoolId`) to the access-control layer, so the
authorization model is no longer single-tenant-only. The product is still *operated* as a single
school today, though: self-service tenant provisioning, billing, and per-tenant admin creation are
all still out of scope and were not part of that sprint. The backend has run on PostgreSQL (not
SQLite) since Sprint B. Before any staging/production deployment or pilot rollout, see the "Sprint
11-12 — Hardening + Pilot" and "Environment / one-time setup" sections of `PROJECT-STATUS.md` for
the concrete remaining checklist (real secrets, S3-compatible storage, a Firebase project for push
notifications, and a scoped pilot before full cutover).
