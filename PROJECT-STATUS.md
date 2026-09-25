# SchoolOS — Project Status

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` (code inspection **plus test suites executed on this date**: backend unit 579 ✓, backend e2e 196 ✓ (fresh database), staff console 512 ✓, Flutter 100 ✓; backend lint failing — details in [`docs/testing/TESTING-STRATEGY.md`](docs/testing/TESTING-STRATEGY.md)) · **Owner:** Product Owner
> This page replaces the former 1,721-line build log, now at [`docs/archive/project-status-build-log.md`](docs/archive/project-status-build-log.md) (historical; contains stale items).
> Status words: `IMPLEMENTED` · `PARTIALLY IMPLEMENTED` · `CONFIGURATION REQUIRED` · `EXTERNAL SERVICE REQUIRED` · `STUB` · `PLANNED` · `NOT IMPLEMENTED` · `UNKNOWN`. "IMPLEMENTED" means code exists and is wired; it is **not** a production-readiness claim.

## Owner decisions (2026-09-20)

The Product Owner answered the open product, legal, operations and integration questions ([`docs/product/OWNER-DECISIONS.md`](docs/product/OWNER-DECISIONS.md)). **These are decisions, not implemented behaviour:** everything below still describes what the code does today. The decided engineering work is scheduled in [`docs/release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md`](docs/release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md) and [`docs/product/requirements/BACKLOG.md`](docs/product/requirements/BACKLOG.md). Pilot: one school, campuses as needed, ~500–2,000 students, single instance; first production release will be **1.0.0**. Licence: proprietary (placeholder entity). All 15 follow-up items (RD-1…RD-15) were answered; only placeholder/TBD values remain ([`OWNER-DECISIONS`](docs/product/OWNER-DECISIONS.md#remaining-unresolved-decisions--tbds-only)). Pilot gateways OFF; attendance and leave will not require a class teacher; lifecycle terms ACTIVE/TRANSFERRED/WITHDRAWN/GRADUATED — **all decided, none implemented**.

## Overall

SchoolOS is a working **pre-production** application: one NestJS 11 / Prisma 7 / PostgreSQL API (`backend/`), a Vue 3 staff console (`staff-console/`), and a Flutter parent app (`parent-app/`). No deployment target, container image, health endpoint, or live integration verification exists yet. Verdict: **not production-ready** — see "Known gaps" below and [`docs/release/PRODUCTION-READINESS.md`](docs/release/PRODUCTION-READINESS.md).

## Applications

| App | Status | Notes |
|---|---|---|
| `backend/` | IMPLEMENTED | 41 controllers, 185 route handlers under `/api/v1`, 57 Prisma models, 13 migrations |
| `staff-console/` | IMPLEMENTED | Vue 3 + Vite + Pinia; English + Urdu (RTL); role-gated routes `/teacher/*`, `/admin/*`, `/principal/*` |
| `parent-app/` | IMPLEMENTED | Flutter; English + Urdu; offline last-response cache; push token registration |
| Parent web portal (Next.js) | PLANNED | No code exists on any branch |
| Public website | NOT PART OF THIS REPO | Static prototype in the parent folder, outside `build/` |

## Subsystems

Automated-test column lists the backend e2e spec (`backend/test/`) that exercises the area; "unit only" = colocated `*.spec.ts` files (Prisma mocked); counts are not asserted here.

| Subsystem | Status | e2e evidence | Notes |
|---|---|---|---|
| Auth (login by email or GR number, refresh rotation, lockout, forgot/reset/change password) | IMPLEMENTED | `auth`, `auth-password-reset`, `rate-limiting`, `cors` | Reset email needs SMTP or falls back to a logging adapter |
| Schools / campuses / provisioning (incl. principal user) | IMPLEMENTED | `org-provisioning`, `org-structure` | SUPER_ADMIN only |
| Academic sessions, classes, sections, terms | IMPLEMENTED | `org-structure`, `sections-access`, `gradebook` | **AcademicSession has no school scope; activating one deactivates all others platform-wide** (see Known gaps) |
| Subjects | PARTIALLY IMPLEMENTED | none | Read-only list; no management endpoint/UI |
| Students + student profile (medical, emergency, documents, previous school) | IMPLEMENTED | `people-crud`, `cross-tenant-boundary` | |
| Parents/guardians & child linking | IMPLEMENTED | `people-crud`, `me` | |
| Teachers | IMPLEMENTED | `people-crud` | |
| Staff + profile (experience, emergency, documents) | IMPLEMENTED | unit only | No dedicated e2e |
| Hiring (candidates → applications → approve/reject) | IMPLEMENTED | unit only | No dedicated e2e |
| Admissions (applicant → application → approve/reject → student) | IMPLEMENTED | `admissions` | |
| Enrollment history & promotion/re-enrollment | IMPLEMENTED | `promotions` | Rules need product confirmation |
| Timetable | IMPLEMENTED | `timetable-attendance` | |
| Attendance + attendance-risk flags (daily cron) | IMPLEMENTED | `timetable-attendance` (risk: unit only) | In-process `@Cron` |
| Diary / homework | IMPLEMENTED | `diary-circulars` | |
| Circulars | IMPLEMENTED | `diary-circulars` | |
| Gradebook (terms, categories, assessments, marks, grades) | IMPLEMENTED | `gradebook` | No colocated unit specs |
| Report cards | PARTIALLY IMPLEMENTED (*decided: generated from gradebook, PDF — BL-06*) | `holidays-complaints-report-cards` | Teacher-uploaded/attached record + PDF; not auto-generated from marks (**verify**, Phase 4) |
| Holidays, complaints | IMPLEMENTED | `holidays-complaints-report-cards` | |
| Leave requests | IMPLEMENTED | `leave` | |
| Fees (structures, vouchers, payments, receipts, reconcile) | IMPLEMENTED | `fees` | Payments below |
| Messages (conversations) & notifications | IMPLEMENTED | `messages-notifications` | Channels below |
| Bulk import (students, parents, teachers, staff; preview/commit) | IMPLEMENTED | `bulk-import` | |
| Files (upload/download) | PARTIALLY IMPLEMENTED | none dedicated | Local-disk storage only |
| AI drafting (diary/circular suggestions) | EXTERNAL SERVICE REQUIRED | unit only | Stub provider unless `ANTHROPIC_API_KEY` set |
| Dashboards (SuperAdmin network, School Admin ops, Principal overview/academics, Teacher My Day/Gradebook) | IMPLEMENTED | `me` (partial) | |

## Integrations (none verified against a live service)

| Integration | Status |
|---|---|
| JazzCash, EasyPaisa payment adapters | CONFIGURATION REQUIRED + EXTERNAL SERVICE REQUIRED; never sandbox-verified; EasyPaisa hash field order unconfirmed |
| Payment stub gateway + stub checkout | STUB (development/test only) |
| FCM push (Firebase) | CONFIGURATION REQUIRED; logging no-op when unset (all environments) |
| SMTP email | CONFIGURATION REQUIRED; logging adapter when unset |
| WhatsApp | EXTERNAL SERVICE REQUIRED (Meta Graph API sender; unverified) |
| SMS | EXTERNAL SERVICE REQUIRED — sender calls a placeholder URL (`api.sms-gateway.example.pk`), no provider chosen |
| Anthropic AI | EXTERNAL SERVICE REQUIRED (stub fallback) |
| Object storage (S3-style) | NOT IMPLEMENTED — only `LocalDiskStorageAdapter` |

## Known gaps (carried forward; details in later phases)

`CODE ISSUE DISCOVERED` items are recorded, **not fixed**, by documentation phases.

1. **Cross-school leakage:** school-wide circulars are delivered to every parent in the database (`circulars.service.ts:55`); holidays with no campus apply to all schools (`holidays.service.ts:40-70`) — [`docs/security/KNOWN-GAPS.md`](docs/security/KNOWN-GAPS.md) KG-1/KG-6.
2. **Unsafe defaults:** `NODE_ENV` unset ⇒ development fallbacks; `.env.example` ships `change-me` JWT secret; password-reset links are logged when SMTP is unset (KG-2/3/4). Backend `npm audit`: 18 vulnerabilities (9 high) (KG-5).
3. **AcademicSession is global** (*decided: school-scoped — BL-01*). No `schoolId`; create/update with `isActive` deactivates every other active session; `student.service.ts:69`, `fee-vouchers.service.ts:30`, `students-bulk-import.service.ts:100` use `findFirst({isActive:true})`. With more than one school this can attach records to the wrong session. The seed (`prisma/seed.ts:154`) creates one active session per school, contradicting that rule.
4. **Subjects cannot be managed** (*decided: school-scoped CRUD + yearly syllabus — BL-02/BL-26*): `GET /subjects` is the only subjects endpoint; no create/update/delete exists in API or UI (subjects come from the seed/DB). `CODE ISSUE DISCOVERED` (Phase 3).
5. **Unscoped list endpoints** (no school path in schema): `GET /academic-sessions`, `/terms`, `/subjects`, `/fee-structures` (see archived `access-control-scoping-progress.md`).
6. **No health/readiness endpoint, no security headers (`helmet`), no structured logging/metrics, no Dockerfile/deploy config.**
7. **Local-disk file storage only**; not safe across multiple instances.
8. **In-process scheduled jobs** (`attendance-risk`, `digest-dispatch`) — single-instance assumption.
9. **Licence is decided as proprietary (`LICENSE` is a placeholder notice; `package.json`: UNLICENSED); no backups/restore, deployment target, monitoring; SMS sender uses a placeholder URL.** (CHANGELOG, SECURITY.md and runbooks now exist as documentation — the *capabilities* do not.)
10. Backend lint fails with 2,014 errors (mostly formatting) and is non-blocking in CI.
11. ~~Rebrand residue~~ — done 2026-09-26 (BL-34): seed (Demo School North/South, `@schoolos.local`), `.env.example`/CI database name `schoolos`, Postman, test fixtures, console locale key, Firebase placeholder. Kept on purpose: archived/historical docs; the harness's refusal list still names `schoolportal`.

## Where things live

Full issue lists: [`docs/security/KNOWN-GAPS.md`](docs/security/KNOWN-GAPS.md), [`docs/release/KNOWN-ISSUES.md`](docs/release/KNOWN-ISSUES.md). Documentation index: [`docs/README.md`](docs/README.md). Design system: [`DESIGN.md`](DESIGN.md). Program plan for the documentation/production-readiness effort: [`docs/PLAN-DOCUMENTATION-PRODUCTION-READINESS.md`](docs/PLAN-DOCUMENTATION-PRODUCTION-READINESS.md). Code comments that cite this file's old sections (`.github/workflows/ci.yml`, `parent-app/lib/firebase_options.dart`, `staff-console/src/components/AppShell.vue`) refer to the archived build log.
