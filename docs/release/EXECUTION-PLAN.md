# Pilot-Readiness Execution Plan (Waves 0–7)

> **Status:** CURRENT (plan; **nothing is implemented**) · **Verified:** 2026-09-20 against `main@15362b7` (schema, services, tests read on this date) · **Sources:** [BACKLOG](../product/requirements/BACKLOG.md), [GAP-ANALYSIS](GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md), `backend/prisma/schema.prisma`, `attendance.service.ts`, `leave.service.ts`, `circulars.service.ts`, `promotions.service.ts`, `create-parent-with-user.ts` · **Owner:** Engineering Lead (Technical Owner)
> Companion to the gap analysis: this file fixes the **order of execution**, the **schema/migration dependencies that must precede application code**, the affected layers, the docs to regenerate, and rollback rules. Findings F1–F10 (2026-09-20) are folded in. Item detail and acceptance criteria live in the BACKLOG.

## 1. Findings folded in (F1–F10)
| # | Finding | Where handled |
|---|---|---|
| F1 | `Attendance.markedById` is a **required FK to `Teacher`**; admins are attributed to the class teacher or refused; the actor exists only in `AuditLog` | BL-60, migration M1 |
| F2 | Parent `User` rows have **no `schoolId`**; identity (`User.identifier`, `ParentProfile.cnic`) is already global; the work is relationships, cross-school linking/PII boundary, fan-out, dedupe | BL-23, BL-04 (M6) |
| F3 | `Circular` and `Holiday` have no school anchor | BL-20, M2 |
| F4 | `Complaint` lacks category, assignee, internal notes, resolution, attachments | BL-30, M10 |
| F5 | `LeaveRequest` lacks recommender/decider | BL-29, M1b |
| F6 | `File.storageKey` is already an S3-style key | BL-10 (adapter + copy tool, no schema redesign) |
| F7 | Session dependents: `Class`, `Enrollment`, `FeeVoucher`, `ReportCard`, `Term`, `Application`; subject dependents: `Timetable`, `Assessment`, `DiaryEntry` | BL-62, M3, M4 |
| F8 | Docs generators were throwaway scripts, not in the repo | **BL-66** |
| F9 | No migration test harness | **BL-65** |
| F10 | Gaps in BL numbering (BL-42/44/50 unassigned); BL-17 folded into BL-01/BL-34 | BACKLOG legacy map |

## 2. Dependency chain
`Wave 0 (BL-62 strategy · BL-65 harness · BL-66 generators · BL-37 part 1 · BL-18 scaffold)` → `Wave 1 (BL-51 · BL-12 · BL-21 → BL-64 · BL-22 · BL-52 · BL-60 [M1])` → `Wave 2 (BL-10 · BL-11 · BL-39 · BL-40 ∥ BL-13 infra)` → `Wave 3 (M2/BL-20 · M3/BL-01 · M4/BL-02 · M5/BL-03 · BL-33 · BL-32 · BL-53 · BL-34)` → `Wave 4 (M6/BL-23+BL-04 · M7/BL-61 → BL-05 · M8/BL-25 · M9/BL-07+BL-63 · BL-41)` → `Wave 5 (BL-26 · BL-27 · BL-06 · BL-28 · BL-29 [M1b])` → `Wave 6 (BL-08 · BL-30 · BL-35 · BL-43 · BL-54 · BL-14 FCM)` → `Wave 7 (BL-15 · BL-55 · BL-36 · BL-37 part 2 · BL-56 · BL-57 · BL-58)`.
Hard gates: **BL-62 approved + BL-65 available** before any of BL-01, BL-02, BL-03, BL-20 (M2), BL-23, BL-61 executes; **BL-21 before BL-64**; **BL-60 (M1) before BL-29 (M1b)**; **BL-61 before BL-05**; **BL-40 (pagination) before new list screens**; **BL-34 before BL-43** (identifiers created once); **BL-66 before the first regeneration of docs**.

## 3. Schema / migration order (schema before application code)
Every data-changing migration uses **expand → backfill → contract** (contract one release later), an idempotent backfill script, a dry-run reconciliation report, and is rehearsed on the BL-65 harness first.
| M | Change | Item | Backfill / ambiguity handling |
|---|---|---|---|
| M1 | `Attendance.markedById` nullable; add `markedByUserId` (→ `User`) | BL-60 | from `AuditLog` actions `attendance.mark`, `attendance.mark-bulk`, `leave-request.approve` (no `attendance.update` exists — corrected 2026-09-24); unresolved stays null (keeps old `markedById`) |
| M1b | `LeaveRequest`: recommender/decider ids, timestamps, notes | BL-29 | none (new columns) |
| M2 | `Circular.schoolId`, `Holiday.schoolId` | BL-20 | Holiday from campus; Circular from section→class→campus→school, else author's school; SUPER_ADMIN author or ambiguity → manual review |
| M3 | `AcademicSession.schoolId` (+ `legacySessionId`, unique `(schoolId,label)`) | BL-01 | shared global sessions split per school and dependents re-pointed; ambiguity → review, never an arbitrary "current" session |
| M4 | `Subject.schoolId`, `isActive`, unique `(schoolId,name)` | BL-02 | referenced subjects cloned per school; dependents re-pointed; unreferenced rule set in BL-62 |
| M5 | `FeeStructure.schoolId` + lifecycle; `Term` follows session | BL-03 | school via vouchers' students; ambiguity → review |
| M6 | `StudentParent.relationshipType` (from the existing free-text `relationship`), `primarySlot` 1–2 (unique per student; `isPrimary` already exists since `20260919090000`) | BL-04, BL-23 | rules G4/G5 of [MIGRATION-STRATEGY](../database/MIGRATION-STRATEGY.md): known texts mapped, others → `OTHER`; > 2 primaries → review. **No `schoolId` on the guardian identity** |
| M7 | Add `StudentStatus.TRANSFERRED`; rename `PromotionDecision.TRANSFERRED_OUT`→`TRANSFERRED`; add `PROMOTED_WITH_CONDITIONS` | BL-61, BL-05 | **`LEFT` + matching `TRANSFERRED_OUT` promotion → `TRANSFERRED`; all other `LEFT` → manual review; never renamed blindly**; `LEFT` removed only when zero rows remain; `EnrollmentStatus` unchanged |
| M8 | `TeachingAssignmentHistory` | BL-25 | from current section/timetable, start date flagged unknown |
| M9 | `archivedAt`; `RetentionPolicy` (periods null) | BL-07, BL-63 | none |
| M10 | Complaint fields + `ComplaintNote`, `ComplaintAttachment`; syllabus; grading scale; report-card source/snapshot/version; risk settings; promotion config | BL-30/26/27/06/28/05 | additive |
| M11 | `UserPermission` grants | BL-32 | preserve current ACCOUNTS behaviour, then restrict |
| M12 | one ACTIVE enrolment per student; one voucher per student/session/month | BL-53 | pre-check duplicates; raw-SQL partial unique index |
| M13 | job lock (or advisory locks) | BL-39 | — |

## 4. Layers touched per wave
| Wave | Backend / schema | Staff console | Parent app | Tests (new or replaced) |
|---|---|---|---|---|
| 0 | scripts, harness, formatting | — | — | harness self-tests; failing e2e scaffolds |
| 1 | config guards, `helmet`, account controls, bootstrap command, admin parent reset, upload checks, **M1 + attendance service** | parent "reset password" action; forced-change flow exists | — | boot-refusal, headers, rate-limit-by-IP, reset e2e (no password in logs); **replace** `attendance.service.spec.ts:113`; admin-marks-without-class-teacher e2e |
| 2 | S3 adapter + copy tool, health, JSON logs, exception filter, Sentry, job lock, pagination | paging controls | — | S3 emulator e2e, scrub test, two-instance job test |
| 3 | M2–M5, M11, M12, scoped queries, seed rewrite (`Demo School`) | subject management, session/fee pickers scoped, copy-structure for SCHOOL_ADMIN | — | cross-tenant e2e per entity; harness runs per migration |
| 4 | M6–M9; guardian linking, fan-out, dedupe report, archive, export | guardian relationship UI, promotion indicators, archive views | school-labelled children | cross-tenant guardian e2e (written first); lifecycle migration test |
| 5 | syllabus, grading scales, report-card generation, risk settings, leave workflow (M1b) | corresponding screens | report-card view | **replace** `leave.service.spec.ts:175`; weights-total test |
| 6 | fee scope, complaints, parent reset deep link | fees/defaulters, complaint queue | complaint form, reset link handling | fees, complaints (internal notes hidden) e2e |
| 7 | load test, a11y, hardening | axe/keyboard fixes | device matrix | k6-style load report; WCAG audit |

## 5. Generated docs to regenerate (after BL-66)
| Trigger | Regenerate |
|---|---|
| controller/route/`@Roles` change | ENDPOINTS, API-OVERVIEW counts, Postman collection, PERSONAS role matrix |
| schema change | DATA-DICTIONARY, ERD, DATA-MODEL (generated parts), TENANCY, HISTORY, MIGRATIONS |
| new/changed tests | TEST-MATRIX, TESTING-STRATEGY (executed counts and date) |
| behaviour change | BUSINESS-RULES, FEATURE-CATALOG, FR/TRACEABILITY, GLOSSARY, user guides |
| new env vars | ENVIRONMENT, `.env.example` |
| closed defect | KNOWN-GAPS, KNOWN-ISSUES, PRODUCTION-READINESS, PROJECT-STATUS, CHANGELOG |
Every wave also refreshes the `Verified:` header (date and commit).

## 6. Separation of work classes
| Class | Items |
|---|---|
| **Code** | all BL items except those below |
| **Infrastructure/configuration (Ops owner)** | BL-13 (host, managed Postgres, S3, TLS, secrets, backups, restore rehearsal), Sentry/uptime accounts (BL-11), Firebase project and Play account (BL-43, FCM part of BL-14) |
| **Legal / owner inputs** | BL-56 wording and timelines, retention periods, placeholders (domain, e-mail, entity), BL-58 authorisation |
| **Prerequisites that never substitute for engineering** | FCM project, staging host, S3 backup/restore, privacy notice, incident process — each gates go-live/exit **in addition to** the code items |

## 7. Migration risks and rollback
- **Highest risk:** M3 (session split), M4 (subject clone), M6 (guardians), M7 (lifecycle). All are gated by BL-62 and BL-65. The BL-62 rules, review queue and execution procedure are in [MIGRATION-STRATEGY](../database/MIGRATION-STRATEGY.md) (draft, awaiting approval).
- **Rollback = restore the pre-migration backup and redeploy the previous build.** Expand steps are backward-compatible so the previous build keeps working; contract steps ship a release later. Keep `legacy*Id` columns for traceability.
- Never merge guardians on name similarity; never expose one school's students to another school's staff; ambiguous rows are exported for manual review, never guessed.
- No migration runs on shared/production data without an approved BL-62 strategy, a passing BL-65 rehearsal and a fresh verified backup.
