# Changelog

> **Status:** CURRENT · Reconstructed 2026-09-20 from git history (`main@15362b7`, 438 commits) and the archived build log (`docs/archive/project-status-build-log.md`). **No versions or tags have ever been released**; everything below is pre-1.0 history grouped by date range and sprint, not a release record. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
Documentation program (2026-09-19/20): canonical docs under `docs/`, rewritten README and status, archive of superseded material. No application code changed. See `docs/release/PRODUCTION-READINESS.md`.
Owner decisions recorded 2026-09-20 (`docs/product/OWNER-DECISIONS.md`): business rules Q1–Q19, proprietary licence notice, `SECURITY.md` placeholders, operations targets, decided engineering backlog (BL-01…BL-59) and phased plan (`docs/release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md`). Second ruling (RD-1…RD-15) incorporated the same day: placeholders, ownership roles, retention categories, attendance without class teacher, complaint scope, lifecycle terms, migration principles, internal incident targets, gateways off for the pilot; backlog extended to BL-64. Wave 0 correction pass (findings F1–F10): attendance root cause, guardian scope correction, circular/holiday anchors, leave recommender/decider, storage-key correction, lifecycle migration rule, new BL-65/BL-66 and `docs/release/EXECUTION-PLAN.md`. Documentation only — **no behaviour has changed**.
Wave 0 foundations (branch `wave-0/foundations`, 2026-09-20/24): backend lint backlog cleared (BL-37 part 1), reproducible doc generators (BL-66), migration test harness (BL-65), read-only BL-62 dry-run (`npm run migration:dry-run`) and the draft existing-school migration strategy (`docs/database/MIGRATION-STRATEGY.md`, approved 2026-09-24 with D1–D8 as recommended); failing-first e2e scaffold (BL-18).
Wave 1 (2026-09-24): **behaviour change** — the API now refuses to start with an unset/unknown `NODE_ENV`, and outside development/test with a short or placeholder `JWT_ACCESS_SECRET` or without `DATABASE_URL`/`CORS_ORIGINS`/`FRONTEND_URL`; the no-SMTP mail fallback no longer logs message bodies (reset links); `JWT_REFRESH_*` removed from `.env.example`; `npm run start:prod` path fixed (BL-51). Local `.env` files need `NODE_ENV="development"`.
BL-12: `helmet` security headers on every response; `TRUST_PROXY` controls client-IP detection for rate limiting (unset = trust no proxy); CI fails on High/Critical `npm audit` findings; High findings fixed (multer, platform-express, qs; Prisma's `deepmerge-ts`/`mysql2` via overrides).
BL-21: **behaviour change** — every API request re-checks the account (disabled/deleted/revoked sessions get 401 at once; role read from the database); `mustChangePassword` is enforced by the API (403 `PASSWORD_CHANGE_REQUIRED`); new `POST /auth/logout`, `POST /auth/logout-all` and admin `POST /admin/users/:id/disable|enable|revoke-sessions`; password change/reset ends other sessions; migration `add_user_token_version`. The console revokes the refresh token on sign-out.
BL-64: admin-assisted parent password reset (`POST /admin/parents/:id/reset-password`, one-time password shown once, parent must change it; on only while SMTP is unset unless `ADMIN_PASSWORD_RESET` says otherwise); console **Reset password** action; parent app gains a change-password screen, honours `PASSWORD_CHANGE_REQUIRED` and revokes its session on sign-out.
BL-22: `npm run bootstrap:super-admin` creates the first SUPER_ADMIN from environment/secret-store credentials (refuses once one exists; `mustChangePassword`; audited); the demo seed now refuses outside development/test.
BL-52: **behaviour change** — uploads are accepted only when their bytes are an allowed type (PDF, PNG/JPEG/GIF/WebP/HEIC, Office, text/CSV) matching the extension; the stored MIME type is the detected one; optional clamd malware scanning (`CLAMAV_HOST`, fail-closed).
BL-60 (migration M1): **behaviour change** — attendance marking and leave approval no longer require a class teacher; every attendance write records the real actor (`markedByUserId`) and a Teacher only when the actor is one; `npm run backfill:m1` fills legacy rows from the audit log.

**Versioning policy (decided):** Semantic Versioning with Git tags; the first production release will be **1.0.0**. Everything below is pre-1.0 history and carries no version numbers.

## Pre-release history (reconstructed, newest first)

### 2026-09-17 → 2026-09-19 — Design system, org provisioning, campus scoping
- Design-system rollout (role-differentiated dashboards, UI sprints 1–6), `DESIGN.md` v2.
- Rebrand SEEDS/SchoolPortal → SchoolOS (branch `rebrand/schoolos`; seed identifiers intentionally unchanged).
- School/campus provisioning with principal logins; campus-scoped users (`User.campusId`); extended school/campus and parent profile fields (migrations `…extend_school_campus_profile`, `…add_parent_profile_fields`, `…add_user_campus_scope`).
- Student promotion / re-enrollment (Sprint R; migration `…add_student_promotion`).
- Postman collection and local environment (`docs/api`).

### 2026-09-13 → 2026-09-16 — Gradebook, admissions, profiles, staff & hiring, bulk import
- Structured gradebook (terms, weighted categories, assessments, marks) — Sprint N.
- Admissions pipeline (applicant → application → approval) — Sprint O.
- Bulk import for students, parents, teachers, staff — Sprint P; `StatusPill` and accessibility — Sprint Q.
- Student profile foundation (addresses, previous school, medical, emergency contacts, documents) and UI.
- Staff & hiring foundation and console UI; school/campus contact fields.

### 2026-09-10 → 2026-09-12 — Payments, push, communication depth, access control
- Payment gateway adapters: JazzCash and EasyPaisa signers/adapters, webhook verification, stub gateway — Sprint E (**never live-verified**).
- Push notifications (FCM, both clients) — Sprint F; WhatsApp/SMS adapters and digest bundling — Sprint H.
- Remaining feature gaps, accessibility/localisation, AI drafting, attendance-risk analytics — Sprints I/J/K.
- Cross-tenant/cross-campus access control (`StudentAccessService`, `OrgScopeService`) — Sprint L; test coverage backfill — Sprint M.
- Component extraction, dev/test CORS for parent-app preview.

### 2026-09-05 → 2026-09-09 — Hardening and stabilization
- Security hardening pass (JWT secret via `ConfigService`, fail-fast on missing secret outside dev/test, throttling, validation), Sprints A–D stabilization, PostgreSQL baseline migration (`20260908000000_postgres_baseline`) replacing the SQLite era, CI workflow.
- People CRUD (students, parents, teachers), org-structure CRUD.

### 2026-08-27 → 2026-09-04 — MVP build (FEAT-001..014)
- Foundation: data model, auth + RBAC, multi-campus/multi-child model, staff console shell, parent app shell.
- Timetable, attendance, diary/homework, circulars, messages, notifications, fees, leave applications.
- Data-model correction: `Enrollment` history entity; parent app offline cache; wireframe-driven UI refresh.
