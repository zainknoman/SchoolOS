# SchoolOS Digital Platform

A school management platform for a multi-school, multi-campus environment: one NestJS + Prisma backend serving a Vue **staff console** and Flutter **parent app**. The Prisma schema supports richer Student, Parent, Staff/Hiring, Admission, Enrollment, timetable, diary, attendance, document, address and medical data. Current implementation status is tracked in [`PROJECT-STATUS.md`](./PROJECT-STATUS.md).

## Architecture

```text
backend/               NestJS + Prisma API — the only backend, serves both clients
staff-console/         Vue 3 SPA for Teacher / School Admin / Accounts / Principal roles
parent-app/            Flutter app for parents
plan/docs/             Original MVP plan and feature specification
docs/superpowers/      Per-sprint implementation plans and design specifications
docs/database/         Database audit, design and migration documentation
docs/Plan-Ideas/       Post-MVP planning, gap analysis and roadmap
docs/Figma/            Figma design-system handoff
```

- **One backend, two clients.** Both clients use the same REST API at `/api/v1/...`.
- **Role-gated staff console.** Teacher/Admin/Accounts/Principal access is enforced server-side with JWT roles and guards.
- **Tenant and campus isolation.** Backend access paths enforce school and campus ownership.
- **Swappable infrastructure adapters.** Storage, payments, push notifications and AI drafting use adapter interfaces with development/test fallbacks.
- **Audit-logged writes.** State-changing endpoints record audit information.

## Tech stack

| Layer | Stack |
|---|---|
| Backend | NestJS 11, Prisma 7 + PostgreSQL (`@prisma/adapter-pg`), Passport-JWT + argon2, class-validator |
| Staff console | Vue 3, TypeScript, Vite, Pinia, Vue Router, vue-i18n, Vitest |
| Parent app | Flutter (Dart), secure storage, shared preferences, Firebase Messaging, Flutter localization |
| Testing | Jest, Vitest, Flutter Test |

## Expanded data model

The current Prisma schema is additive and covers:

- **Organization:** School, Campus, AcademicSession, Class and Section.
- **Identity/RBAC:** User, roles, refresh tokens and tenant ownership.
- **Students:** GR number, structured name, preferred name, gender, DOB, place of birth, nationality, religion, B-Form number, status, admission/leaving information, student contact information and current/permanent addresses.
- **Student profile satellites:** previous school, leaving-certificate information, emergency contacts, medical information and student documents.
- **Parents/guardians:** ParentProfile plus StudentParent relationships.
- **Enrollment:** campus, section, academic session, roll number, promotion date, remarks and enrollment status.
- **Staff:** employee type, personal/contact information, CNIC, addresses, employment status, experience, emergency contacts and documents; teachers remain linked to the existing Teacher model.
- **Hiring:** HiringCandidate and HiringApplication pipeline.
- **Admissions:** Applicant and Application pipeline with desired class, academic session, status, decision notes and approved-student linkage.
- **Academic operations:** subjects, timetables, diary/homework, attendance, holidays, assessments/gradebook and report cards.
- **Communication/finance:** circulars, messages, notifications, fees, payments, receipts, complaints and leave.

## Seed data

`backend/prisma/seed.ts` is aligned with the expanded Prisma schema and is designed for a fresh development database. It creates relational demo data rather than the former small single-school sample.

### Seeded organization

| Item | Quantity |
|---|---:|
| Schools | 2 |
| Branches/campuses | 5 |
| Academic sessions | 2 per school (2025-2026 and 2026-2027) |
| Grades | 1–8 |
| Sections | 2 per grade per campus = 80 |
| Students | 20 per section = 1,600 |
| Parent accounts | 2 per student = 3,200 |
| Class teachers | 1 per section = 80 |

The two seeded schools are **Test School A** (3 branches) and **Test School B** (2 branches) —
placeholder demo names, not real institutions.

Each seeded student receives:

- Structured identity and contact information.
- GR number and B-Form number.
- Current and permanent address records.
- Previous-school record including leaving-certificate details.
- Emergency contact and medical information.
- Active enrollment with campus, class, section, academic session, roll number and remarks.
- Father and mother linked through `StudentParent`.
- Timetable and diary activity through the student's section/class teacher.

### Academic operations seed

- Monday-Friday timetable for every section, with six periods per day and a break between periods 3 and 4.
- Attendance records for every student using all five schema statuses: `PRESENT`, `ABSENT`, `LATE`, `LEAVE`, and `HOLIDAY`.
- Homework diary entries and classroom activities for every section.
- Admissions data for each branch using the `Applicant` and `Application` models.
- Hiring candidate/application examples for the expanded Staff/Hiring model.

### Seed password

The seed reads the development password from `SEED_PASSWORD`. Do not hard-code a development password into source control. Set it in the backend `.env` or shell environment before running the seed.

## Getting started

### Prerequisites

- Node.js version specified by the repository `package.json` engines.
- PostgreSQL 16+ reachable at the configured `DATABASE_URL`.
- Flutter SDK 3.47.x for the parent app.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Set DATABASE_URL and SEED_PASSWORD in .env
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run start:dev
```

The expanded seed is intended for an empty development database. For a clean local rebuild, reset/recreate the development database using your normal PostgreSQL workflow, then run migrations and the seed again.

### 2. Staff console

```bash
cd staff-console
npm install
npm run dev
```

### 3. Parent app

```bash
cd parent-app
flutter pub get
flutter run -d chrome
```

### After pulling schema changes

```bash
cd backend
npx prisma generate
npx prisma migrate deploy
```

## Seeded account patterns

The seed creates school-level Admin, Principal and Accounts users, one Teacher login per seeded section, and two Parent accounts per seeded student.

Teacher identifiers follow this pattern (`school1`/`school2` denote the two seeded test schools):

```text
school1.g1a@schoolportal.local
school1.g1b@schoolportal.local
...
school2.g8a@schoolportal.local
school2.g8b@schoolportal.local
```

Parent identifiers follow this pattern:

```text
father.gr-00001@parent.schoolportal.local
mother.gr-00001@parent.schoolportal.local
```

The exact password is supplied through `SEED_PASSWORD` and is intentionally not documented in the repository.

## Testing

```bash
cd backend
npm test
npx jest --config test/jest-e2e.json

cd ../staff-console
npm test
npm run type-check

cd ../parent-app
flutter analyze
flutter test
```

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string; required in every environment |
| `SEED_PASSWORD` | Development-only password used for generated seed login accounts |
| `CORS_ORIGINS` | Allow-listed client origins |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing secrets |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL` | Access/refresh token lifetimes |
| `JAZZCASH_*` / `EASYPAISA_*` | Payment adapter credentials |
| `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` | FCM credentials |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Password-reset email configuration |
| `FRONTEND_URL` | Password-reset link base URL |
| `ANTHROPIC_API_KEY` | Enables real AI drafting instead of the development stub |

## Documentation

- [`PROJECT-STATUS.md`](./PROJECT-STATUS.md) — current implementation/status source of truth.
- `plan/docs/FEATURES.txt` — original FEAT-001..014 specification.
- `docs/Plan-Ideas/PHASE-1/` and `docs/Plan-Ideas/PHASE-2/` — planning, audit, roadmap and implementation prompts.
- `docs/superpowers/plans/` — dated implementation plans.
- `docs/superpowers/specs/` — feature/design specifications.
- `docs/database/` — database audit, design and migration documentation.

## Deployment readiness

The repository is PostgreSQL-only and has tenant/campus access-control hardening. Before staging or production, replace development secrets, configure real storage/Firebase/payment/WhatsApp-SMS integrations, configure real AI credentials if required, validate migrations on staging, and perform a scoped pilot before full rollout.
