# Changelog

> **Status:** CURRENT · Reconstructed 2026-09-20 from git history (`main@15362b7`, 438 commits) and the archived build log (`docs/archive/project-status-build-log.md`). **No versions or tags have ever been released**; everything below is pre-1.0 history grouped by date range and sprint, not a release record. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]
Documentation program (2026-09-19/20): canonical docs under `docs/`, rewritten README and status, archive of superseded material. No application code changed. See `docs/release/PRODUCTION-READINESS.md`.
Owner decisions recorded 2026-09-20 (`docs/product/OWNER-DECISIONS.md`): business rules Q1–Q19, proprietary licence notice, `SECURITY.md` placeholders, operations targets, decided engineering backlog (BL-01…BL-59) and phased plan (`docs/release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md`). Documentation only — **no behaviour has changed**.

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
