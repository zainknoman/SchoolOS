# SchoolOS

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · Maturity: **pre-production** (see [Known limitations](#known-limitations))

SchoolOS is a school management platform for a multi-school, multi-campus setting. One NestJS + Prisma + PostgreSQL API serves two clients: a Vue **staff console** (school staff) and a Flutter **parent app** (parents). Both clients speak English and Urdu (RTL).

Repository: <https://github.com/zainknoman/SchoolOS> · Live status: [`PROJECT-STATUS.md`](PROJECT-STATUS.md) · All docs: [`docs/README.md`](docs/README.md)

## What it does today

Status per area (`IMPLEMENTED` = code exists and is wired; not a production-readiness claim). Full table: [`PROJECT-STATUS.md`](PROJECT-STATUS.md).

| Area | Status |
|---|---|
| Schools, campuses, academic sessions, classes, sections, terms | IMPLEMENTED (academic sessions are platform-global; subjects are read-only) |
| Students (with profile), parents/guardians, teachers, staff, hiring pipeline | IMPLEMENTED |
| Admissions pipeline, enrollment history, promotion/re-enrollment | IMPLEMENTED |
| Timetable, attendance (+ risk flags), diary/homework, circulars | IMPLEMENTED |
| Gradebook (categories, assessments, marks), report cards, holidays, complaints, leave | IMPLEMENTED (report cards: PARTIALLY) |
| Fees, vouchers, payments, receipts | IMPLEMENTED — real gateways CONFIGURATION REQUIRED, never live-verified |
| Messages and notifications (push/email/SMS/WhatsApp) | IMPLEMENTED — channels EXTERNAL SERVICE REQUIRED |
| Bulk import (students, parents, teachers, staff) | IMPLEMENTED |
| AI drafting (diary/circular suggestions) | EXTERNAL SERVICE REQUIRED (stub without a key) |

**Not part of SchoolOS today:** student logins, a parent web portal, object-storage (S3) uploads, deployment tooling.

## Applications

```text
backend/          NestJS 11 API (only backend; both clients use /api/v1/...)
staff-console/    Vue 3 SPA — Teacher, School Admin, Accounts, Super Admin (and Principal views)
parent-app/       Flutter app — Parent
docs/             Documentation (index: docs/README.md)
DESIGN.md         Design system      PROJECT-STATUS.md  Status & known gaps
```

Per-app quickstarts: [backend](backend/README.md) · [staff console](staff-console/README.md) · [parent app](parent-app/README.md).

**Roles** (`enum Role`): `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `ACCOUNTS`, `PARENT`. "Principal" is a `SCHOOL_ADMIN` user with `isPrincipal = true` (unlocks `/principal/*` views), not a separate role. Details: [`docs/product/PERSONAS-AND-ROLES.md`](docs/product/PERSONAS-AND-ROLES.md).

**Security model (summary):** JWT access + rotating refresh tokens, argon2 password hashing, account lockout, server-enforced role guards (`@Roles`), school/campus scoping in services, request validation (`ValidationPipe` whitelist), rate limiting. Status of every control and known gaps: [`docs/security/`](docs/security/SECURITY-OVERVIEW.md).

## Tech stack

| Layer | Stack (from `package.json` / `pubspec.yaml`) |
|---|---|
| Backend | NestJS 11, Prisma 7 + PostgreSQL (`@prisma/adapter-pg`), Passport-JWT, argon2, class-validator, `@nestjs/schedule`, `@nestjs/throttler` |
| Staff console | Vue 3, Vite, Pinia, Vue Router, vue-i18n, Vitest (Node `^22.18` or `>=24.12`) |
| Parent app | Flutter (Dart `^3.13`), `provider`, `go_router`, secure storage, Firebase Messaging |
| CI | GitHub Actions (`.github/workflows/ci.yml`): Postgres 16, Node 24, Flutter 3.47.1 |

## Quick start (local development)

Prerequisites: Node 24 (or a version allowed by the staff-console `engines`), PostgreSQL 16, Flutter SDK for the parent app.

```bash
# 1. Backend — http://localhost:3000
cd backend
npm install
cp .env.example .env        # set DATABASE_URL and SEED_PASSWORD; change JWT secrets
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed         # fresh dev database only
npm run start:dev

# 2. Staff console — http://localhost:5173
cd staff-console
npm install
npm run dev                 # API URL: VITE_API_BASE_URL (default http://localhost:3000)

# 3. Parent app
cd parent-app
flutter pub get
flutter run -d chrome       # API URL: --dart-define=API_BASE_URL=... (default http://localhost:3000;
                            #   Android emulator: http://10.0.2.2:3000)
```

*These commands match the package scripts; they were not executed as part of the documentation pass.*

**Demo accounts** come from `backend/prisma/seed.ts` (password = your `SEED_PASSWORD`): `superadmin@schoolportal.local`, per-school `admin@…`, `principal@…`, `accounts@…`, per-section teachers, and per-student parent accounts (`father.gr-00001@parent.schoolportal.local` pattern). The `schoolportal` naming is a known rebrand leftover. Seed content and caveats: [`docs/database/SEEDING.md`](docs/database/SEEDING.md).

## Configuration

Backend environment variables are documented in `backend/.env.example` (database, CORS, JWT secrets/TTL, payment gateways, Firebase, SMTP, `FRONTEND_URL`, `ANTHROPIC_API_KEY`). A provider whose variables are all unset falls back to a development stub/logging adapter; **partially set variables are a startup error outside development/test**. Full reference: [`docs/operations/ENVIRONMENT.md`](docs/operations/ENVIRONMENT.md).

## Testing

```bash
cd backend        && npm test && npm run test:e2e     # e2e needs PostgreSQL (DATABASE_URL)
cd staff-console  && npm test && npm run type-check && npm run lint
cd parent-app     && flutter analyze && flutter test
```

Strategy and results (2026-09-20: backend unit 579, e2e 196, staff console 512, Flutter 100 — all green; backend lint failing/non-blocking): [`docs/testing/`](docs/testing/TESTING-STRATEGY.md).

## Integrations

| Integration | Status |
|---|---|
| JazzCash / EasyPaisa | CONFIGURATION REQUIRED; not sandbox-verified |
| Firebase Cloud Messaging | CONFIGURATION REQUIRED; logging no-op when unset |
| SMTP (password reset) | CONFIGURATION REQUIRED; logs the link when unset |
| SMS / WhatsApp | EXTERNAL SERVICE REQUIRED |
| Anthropic (AI drafting) | EXTERNAL SERVICE REQUIRED; stub when unset |
| File storage | Local disk only |

## Known limitations

- **Not production-ready** — see [`docs/release/PRODUCTION-READINESS.md`](docs/release/PRODUCTION-READINESS.md).
- Pre-production: no deployment tooling (Dockerfile/IaC), no health/readiness endpoint, no security headers (`helmet`), no structured logging or metrics, no backup/restore documentation.
- Academic sessions are platform-global; activating one deactivates all others. Four list endpoints are not school-scoped (`academic-sessions`, `terms`, `subjects`, `fee-structures`).
- Subjects are read-only (no create/edit in API or UI; seed/DB only).
- File uploads use local disk only; scheduled jobs run in-process (single-instance assumption).
- Payment/messaging/AI integrations have never been verified against live services; the SMS sender targets a placeholder URL.
- Cross-school data-isolation defects exist (e.g. school-wide circulars reach all parents; platform-wide holidays) and the backend has 9 high-severity dependency vulnerabilities — see [`docs/security/KNOWN-GAPS.md`](docs/security/KNOWN-GAPS.md).
- `NODE_ENV` must be set to `production`; an unset value enables development fallbacks.
- No LICENSE; [`CHANGELOG.md`](CHANGELOG.md) is a reconstructed pre-1.0 history.

Full list and evidence: [`PROJECT-STATUS.md`](PROJECT-STATUS.md).

## Documentation

[`docs/README.md`](docs/README.md) is the index. Highlights: [status](PROJECT-STATUS.md) · [design system](DESIGN.md) · [product](docs/product/PRODUCT-OVERVIEW.md) · [workflows](docs/workflows/PRODUCT-JOURNEY.md) · [architecture](docs/architecture/SYSTEM-OVERVIEW.md) · [API](docs/api/API-OVERVIEW.md) · [database](docs/database/DATA-MODEL.md) · [security](docs/security/SECURITY-OVERVIEW.md) · [operations](docs/operations/ENVIRONMENT.md) · [testing](docs/testing/TESTING-STRATEGY.md) · [user guides](docs/user-guides/README.md) · [release](docs/release/README.md) · [documentation plan](docs/PLAN-DOCUMENTATION-PRODUCTION-READINESS.md) · [history/archive](docs/archive/).

## Roadmap (PLANNED, not implemented)

Parent web portal · object storage adapter · deployment and monitoring tooling · school-scoped academic sessions (needs a product decision) · live payment/messaging verification. Backlog: [`docs/product/requirements/BACKLOG.md`](docs/product/requirements/BACKLOG.md).
