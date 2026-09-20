> **ARCHIVED 2026-09-20** — Superseded by PROJECT-STATUS.md and (later) docs/release/. Contains broken paths. Do not treat as current documentation.

# SchoolOS — Master Validation Prompt Tracker

Tracks progress against the "SchoolOS — Master Implementation & Validation Prompt" given
2026-09-12 (repo audit → validate → implement → test → document workflow, sections 1–23).

This is a **different axis** from the other two living trackers in this repo — keep all three in sync,
don't let this one replace them:
- `PROJECT-STATUS.md` — detailed per-feature build history (what was built, sprint by sprint).
- `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md` — roadmap-level sprint checklist (Sprint A–K+).
- **This file** — checklist against the master prompt's own P0/P1 priority list and validation asks.

Status vocabulary (per the master prompt's own Section 1 classification, use precisely, never overclaim):
`Implemented` · `Partially implemented` · `Broken` · `Tested` · `Untested` · `Integration-ready` ·
`Sandbox-verified` · `Production-verified` · `Not implemented` · `Intentionally deferred` · `Pending audit`

**Update this file after every task completed against the master prompt** (append to the row, don't
just flip a checkbox — note the commit/date/evidence).

---

## Sequenced Implementation Plan (added 2026-09-12)

Every gap below is tracked as its own numbered sprint in
`docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md`'s living Implementation Checklist
(Sprints L–Q), in priority order. None have a spec yet — per this repo's own workflow
([[project-dev-workflow]]) and the `writing-plans` skill's scope-check rule, each is an independent
subsystem and gets its own brainstorm → spec → plan cycle before any bite-sized TDD implementation
plan is written. This section is the sequencing/priority layer; the roadmap doc carries the detail;
update both when a sprint starts or ships.

| Priority | Sprint | Scope | Why this order |
|---|---|---|---|
| 1 | **Sprint L ✅ DONE** | Fix `StudentAccessService` cross-campus/cross-role access gap (scope grew to include tenant/`schoolId` scoping, per explicit direction) | Confirmed live security hole, not a missing feature — highest priority per master prompt §7 |
| 2 | **Sprint M ✅ DONE** | Staff-console + parent-app UI test coverage for the 5 Sprint I/J/K modules | Closes an already-tracked, lower-risk, smaller-scope gap; can run in parallel with Sprint L once both are spec'd |
| 3 | **Sprint N** | Structured gradebook (weighted assessment categories, calculated grades) | Core academic correctness gap per master prompt §10; report cards currently a static upload, not calculated data |
| 4 | **Sprint O** | Admissions/enrollment pipeline (applicant → application → review → approval → student) | Extends the existing narrow `EnrollmentService`; was already the roadmap's own unscoped "Phase 8 remainder" item |
| 5 | **Sprint P** | Bulk import/export (Students/Parents/Teachers via CSV/Excel) | No existing foundation to extend; validation/duplicate-detection/audit-logging needs real design |
| 6 | **Sprint Q** | `StatusPill.vue` + remaining accessibility audits | UI polish/consistency — lowest urgency relative to security and data-correctness gaps above |
| 7 | **Sprint R** | Student Promotion / Re-Enrollment (un-deferred 2026-09-17, see Production-Ready Backlog below) | Extends existing `Enrollment` historical-record pattern (Sprint 6.5); spec + plan written 2026-09-17, not yet implemented |
| — | **Blocked, not schedulable** | JazzCash/EasyPaisa/FCM/WhatsApp/SMS live sandbox verification | Needs external credentials (merchant account, Firebase project, gateway credentials) this environment doesn't have — re-check when available, don't fabricate verification |

**Documentation sync gap found 2026-09-17:** Sprints N (gradebook), O (admissions), P (bulk import),
and Q (StatusPill/accessibility) all have real code in `backend/src/` (`gradebook/`, `admissions/`,
`bulk-import/` modules exist; `add_gradebook`/`add_admissions` migrations are applied) and a written
plan file each (`docs/superpowers/plans/2026-09-13-sprint-{n,o,p,q}-*.md`), plus two more shipped
sub-projects with no status-file entry at all: "Staff & Hiring Foundation" (`add_staff_and_hiring`
migration, `backend/src/staff/`/`hiring/` modules, plan:
`docs/superpowers/plans/2026-09-14-staff-hiring-foundation.md` +
`2026-09-14-staff-hiring-console-ui.md`) and "School/Campus contact fields"
(`add_school_campus_contact_fields` migration, 2026-09-16). None of these six were ever marked done
in this table, `PROJECT-STATUS.md`, or the PostMVP roadmap checklist — the living docs fell behind
the actual shipped work. **Not fabricating verification numbers for them here** (this file's own
Section 8 conclusion explicitly warns against that) — see `PROJECT-STATUS.md`'s new "Documentation
Sync Gap" note for the queued follow-up to re-verify and backfill each one's real test-suite status.

**Next action:** brainstorm + spec Sprint L (the security fix) first, since it's both highest-priority
and already well-understood in scope (one chokepoint service, extend to check campus/section
membership for staff roles). Sprints M–Q can be spec'd afterward in the order above, or reordered on
request.

---

## 0. Repository Audit (Master Prompt Section 2)

| Item | Status | Evidence |
|---|---|---|
| Locate actual app repo | Done | `build/` is the real SchoolOS repo (NestJS backend, Vue staff-console, Flutter parent-app); the parent `D:\Personal\Projects\SchoolApp` is an unrelated agentic-suite scaffold — see [[project-dev-workflow]] memory |
| Git state at audit start | Done | `main`, clean, up to date with origin @ `b726199` (2026-09-12) |
| Latest completed sprint | Done | Sprint I/J/K (remaining feature gaps, accessibility/localization, AI drafting + predictive analytics), plus follow-ups: Report Cards teacher upload, Teacher Complaints section-scoping, `Modal.vue`→`AppModal.vue` rename |
| Full roadmap-checklist cross-check (§ of the roadmap doc still open) | Done | Read in full; Sprints A–K are all shipped and verified. The old unscoped "Phase 8 remainder" line has been replaced with fully-scoped Sprints L–Q (see Sequenced Implementation Plan above) |
| `.worktrees/` cleanliness | Done | Only one worktree existed transiently (`p0-test-coverage-backfill`, created and merged/cleaned in this session's task below) |

---

## P0 — Production Readiness (Master Prompt Section 8)

| Item | Status | Evidence |
|---|---|---|
| JazzCash adapter | Implemented, **not** sandbox-verified | `PROJECT-STATUS.md:765-772` — `JazzCashAdapter`/`JazzCashSigner` built to public `pp_SecureHash` spec, no live sandbox credentials available |
| EasyPaisa adapter | Implemented, **not** sandbox-verified | `PROJECT-STATUS.md:765-772` — exact field order for EasyPaisa could not be confirmed against an authoritative doc; explicitly documented as a hedge, not fabricated verification |
| Webhook signature verification | Implemented, tested locally | `PROJECT-STATUS.md:778-822` — payment confirmation moved to signed-webhook-only (`POST /api/v1/payments/webhook/:gateway`), idempotent by `reference`, unsigned webhook confirmed rejected (401) in tests |
| Payment reconciliation / state transitions | Partially implemented | Idempotent webhook handling exists; no dedicated reconciliation job/report found this session — **needs a closer look, not yet audited in depth** |
| FCM push notifications | Integration-ready, structurally complete | `PROJECT-STATUS.md:856-879` — real adapter code path exists, gracefully degrades to logging no-op without live Firebase project; not sandbox-verified |
| WhatsApp adapter | Integration-ready | `PROJECT-STATUS.md:969-981` — implements same adapter interface as FCM; needs real WhatsApp Business credentials to verify |
| SMS adapter | Integration-ready, **field names unconfirmed** | `PROJECT-STATUS.md:981` — SMS gateway's exact field names still `// TODO: confirm`, honestly flagged, not guessed |

**Conclusion:** Payments and notifications are architecturally sound and defensively built (webhook-only confirmation, idempotency, graceful degradation) but **none are sandbox/production-verified** — this session had no live credentials to test against, consistent with the master prompt's Section 8 instruction not to fabricate verification.

---

## P0 — Test Coverage (Master Prompt Section 9)

| Item | Status | Evidence |
|---|---|---|
| Backend unit + e2e tests for holidays, complaints, report-cards, ai-drafting, attendance-risk, forgot/reset-password, bulk attendance, timetable-conflict detection | **✅ Completed 2026-09-12** | Plan: `docs/superpowers/plans/2026-09-12-p0-test-coverage-backfill.md`; merge commit `67aa03b`. Backend unit **360/360** passing (up from 309), e2e **97/97** passing (up from 79), `npm run build` clean, lint clean on every touched/new file. **Independently re-verified in this session** (not just trusted from the implementing agent's self-report) by re-running `npm run test`, `npm run test:e2e`, `npm run build`, and `npx eslint` against only the new/changed files. |
| RBAC test coverage | Pending audit | Not specifically re-verified this session beyond what the new e2e specs cover (role-gating asserted for the 5 newly-tested modules) |
| Multi-campus/cross-tenant boundary | **✅ Fixed 2026-09-12 — Sprint L, scoped to the plan's 8 routes** | `StudentAccessService.assertCanAccessStudent`/new `assertCanAccessSection` rewritten with per-role branches (`SUPER_ADMIN` unrestricted, `SCHOOL_ADMIN`/`ACCOUNTS` scoped to `User.schoolId`, `TEACHER` scoped to `Teacher.campusId`, `PARENT` unchanged link-check). The 8 routes enumerated in this sprint's plan (across 5 controllers, 4 of which were write paths with zero check at all — mark attendance, diary entry, complaint, report-card upload) are fixed and verified end-to-end against a real second `School` (`backend/test/cross-tenant-boundary.e2e-spec.ts`, added in this session's final-review fix wave). **Not in scope, named here as an explicit follow-up** — the same way `GET /sections` (list-all) was already documented as a non-goal in the spec: `GET /students`, `GET /teachers`, `GET /leave-requests`, `GET /fee-structures`, the non-`TEACHER` branch of `GET /attendance-risk`, `GET /dashboard-summary`, and `POST /fee-vouchers` (accepts an arbitrary `studentIds[]` with no per-student ownership/tenant check) all remain tenant-unaware admin-facing collection endpoints. Plan: `docs/superpowers/plans/2026-09-12-cross-tenant-access-control.md`. Verified: backend unit 369/369, e2e 105/105, staff-console 239/239, all clean, independently reviewed per-task (10 tasks) via subagent-driven-development, plus a final whole-branch review fix wave (see `.superpowers/sdd/2026-09-12-cross-tenant-access-control/final-review-fix-report.md`). See also the enrollment-status note below — a **Sprint O** consideration. |
| Staff access and non-`ACTIVE` enrollment | **Latent gap, not yet actionable** | Staff access (`SCHOOL_ADMIN`/`ACCOUNTS`/`TEACHER`, via `StudentAccessService`) currently depends on a student having an `ACTIVE` enrollment to resolve their campus/school scope — the same way `PARENT` access briefly and incorrectly did during Sprint L before being fixed to use a `StudentParent` link check independent of enrollment status. The same historical-records argument (a withdrawn/transferred/graduated student's staff-visible records shouldn't vanish) likely applies to staff too, but nothing in this codebase sets any `EnrollmentStatus` other than `ACTIVE` today, so this can't be tested against real data and resolving it now would be premature. Flagged here for **Sprint O**'s (admissions/enrollment pipeline) future spec to address once transfer/withdrawal is real. |
| Staff-console UI test coverage (same 5 modules) | **✅ Closed 2026-09-13 — Sprint M** | `HolidaysView`, `ComplaintsQueueView`, `ReportCardsView` given new spec files (4/3/4 tests); "Suggest draft" covered on `DiaryView`/`CircularsView`; attendance-risk panel covered on `AdminHomeView` (3 new tests). staff-console 255/255 (up from 239). Full detail: `build/PROJECT-STATUS.md`'s Sprint M entry. |
| Parent-app UI test coverage (`complaints_screen.dart`, `report_cards_screen.dart`) | **✅ Closed 2026-09-13 — Sprint M** | 3 tests each, mirroring the existing `leave_screen_test.dart` template. parent-app 94/94 (up from 88). Same entry. |

---

## P1 — Structured Academics / Gradebook (Master Prompt Section 10)

| Item | Status | Evidence |
|---|---|---|
| Report cards: structured DB data vs. uploaded document | **Uploaded file, not structured** | `backend/src/report-cards/report-cards.service.ts:36-51` — `upload()` stores a `fileId` reference to an uploaded PDF; no marks/grades/weights modeled anywhere in the report-cards module |
| Weighted assessment-category gradebook (assignments/quizzes/midterm/final %) | **Not implemented** | No `gradebook`/`assessment categor*`/`weighted categor*` hits anywhere in `PROJECT-STATUS.md` or backend source |

**Conclusion:** This is a real, confirmed gap matching the master prompt's Section 10 concern exactly. Not started — sequenced as **Sprint N**, needs its own spec.

---

## P1 — Admissions / Enrollment (Master Prompt Section 11)

| Item | Status | Evidence |
|---|---|---|
| Existing "Enrollment" concept | Implemented, narrow scope | `backend/src/enrollment/enrollment.service.ts` only has `getCurrentEnrollment()` / `getEnrollmentForDate()` — i.e. "which class/section is this already-created student enrolled in," not an admissions pipeline |
| Applicant → application → review → approval/rejection → student creation pipeline | **Not implemented** | `PROJECT-STATUS.md:1272` — "admissions/lottery — is not yet spec'd" |

**Conclusion:** A foundation exists to extend (the enrollment data model), but the actual admissions workflow the master prompt describes does not exist yet. Sequenced as **Sprint O**.

---

## P1 — Bulk Import/Export (Master Prompt Section 12)

| Item | Status | Evidence |
|---|---|---|
| Students/Parents/Teachers bulk import via Excel/CSV | **Not implemented** — sequenced as **Sprint P** | No `csv`/`xlsx`/bulk-import hits anywhere in `backend/src` |

---

## UI Accessibility (Master Prompt Section 13)

| Item | Status | Evidence |
|---|---|---|
| Command Palette component | Implemented | `staff-console/src/components/CommandPalette.vue` + its own spec file exist |
| `StatusPill` shared component | **Not implemented** — sequenced as **Sprint Q** | `PROJECT-STATUS.md:1230,1279` — explicitly named as a scoped-but-not-started follow-up ("spec/plan not yet written") from the Staff Console Shell Redesign |
| Attendance segmented-control keyboard/focus/screen-reader audit | Pending audit — sequenced as **Sprint Q** | Not reviewed this session |
| Dashboard chart accessible names | Pending audit — sequenced as **Sprint Q** | Not reviewed this session |

---

## Deferred Features (Master Prompt Section 14)

Per the master prompt's own instruction, these are **intentionally deferred**, not gaps: fee installments,
QR attendance, RFID, full payroll, full accounting ERP, full LMS, AI tutor, hostel management, alumni
management, GPS/transport, canteen wallet. No action expected unless the repo or an explicit ask
changes this.

**Un-deferred 2026-09-17:** promotion/re-enrollment was removed from this list at the project owner's
explicit direction, following an external architecture review (see Production-Ready Backlog below) —
now tracked as **Sprint R** in the Sequenced Implementation Plan above. Spec:
`docs/superpowers/specs/2026-09-17-sprint-r-promotion-reenrollment-design.md`. Plan:
`docs/superpowers/plans/2026-09-17-sprint-r-promotion-reenrollment.md`.

---

## Production-Ready Backlog — External Review 2026-09-17

The project owner shared two external (ChatGPT-authored) architecture-review prompts covering (1)
School/Campus/Staff-HR/Hiring/Admissions domain expansion and (2) Student→Enrollment→AcademicSession
historical-data architecture and Staff/Teacher assignment history. Both were written assuming an
early-stage schema and recommended rebuilding substantial parts of what this repo already has. Each
recommendation was checked against the actual current code (not assumed) before being filed below.
This also marks the project's own phase transition: **MVP is complete; the project is now in a
Production-Ready hardening/expansion phase** (mirrored in `PROJECT-STATUS.md`'s phase note and
`docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md`'s Product Maturity Roadmap).

| Recommendation | Source | Disposition | Why |
|---|---|---|---|
| Student → Enrollment → AcademicSession never-overwrite historical model | Prompt 2 | **Already built** (Sprint 6.5, 2026-08) | `EnrollmentService`/`Enrollment` already exist for exactly this reason |
| Student Promotion / Re-Enrollment workflow | Prompt 2 | **Accepted — Sprint R**, un-deferred 2026-09-17 | See above |
| Staff/Teacher `StaffAssignment`/`TeachingAssignment` history | Prompt 2 | **Rejected for now** | No staff/teacher transfer feature exists yet to protect (`Staff.campusId`/`Teacher.campusId` have no `update()` path at all) — building history infrastructure for a feature nobody can trigger is premature. Revisit when a real transfer request lands; already flagged as a **Sprint O** follow-up consideration in `PROJECT-STATUS.md`'s "Teacher Subject/Class Assignment Scoping" section for the closely-related non-`ACTIVE`-enrollment staff-access gap |
| `AcademicSession`/`Subject`/`FeeStructure` school-scoping decision | Both (Prompt 1's Subject-uniqueness concern, Prompt 2's per-school session concern) | **Real, already-tracked gap — needs its own sprint, not yet numbered** | Independently confirmed in `PROJECT-STATUS.md`'s "Teacher Subject/Class Assignment Scoping" section (2026-09-14): 4 endpoints deliberately left unscoped pending this exact decision; `StudentService.create()`'s `findFirst({ isActive: true })` is silently wrong the moment a second school exists. Sequence this as the next sprint after R given Sprint L's own note that "the product will be multi-tenant SaaS in the future" |
| Free-text status fields → enums (`HiringApplication.status`, `Application.status`, `LeaveRequest.status`, `Complaint.status`, `FeePayment.status`/`method`, `Circular.scope`/`priority`) | Prompt 1 | **Accepted, low priority** | Cheap, low-risk, matches this codebase's own `EnrollmentStatus`/`StudentStatus`/`PromotionDecision` enum convention. Queue as a small dedicated sprint after the school-scoping decision above (touches many files, best done as one focused pass, not folded into Sprint R) |
| Full HR/Recruitment/Admissions domain expansion (`Department`, `JobPosition`, `StaffEducation`, `StaffCertification`, `HiringInterview`, `HiringOffer`, etc.) | Prompt 1 | **Rejected — explicit project-owner decision 2026-09-17** | Current `Staff`/`Hiring`/`Admissions` modules already cover the MVP-and-beyond need (all shipped within the last week — see Documentation Sync Gap above); none of Prompt 1's additional entities are named anywhere in this project's own roadmap. Revisit only when a specific real requirement shows up, not speculatively |
| Full School/Campus profile expansion (logo, registration number, principal/head, facilities, departments, etc.) | Prompt 1 | **Rejected for now, same reasoning as above** | No current feature reads any of these fields; `School`/`Campus` already gained contact fields 2026-09-16 to close a real gap (see Documentation Sync Gap). Add fields when a screen actually needs them |

---

## Session Log

- **2026-09-12** — Repo audit performed (see Section 0). P0 backend test-coverage backfill (holidays,
  complaints, report-cards, ai-drafting, attendance-risk, forgot/reset-password, bulk attendance,
  timetable-conflict) completed, independently re-verified (360/360 unit, 97/97 e2e, build+lint clean),
  and merged to local `main` (16 commits, `67aa03b`), then pushed to `origin/main` (`89b917f`). Confirmed
  real cross-campus/cross-role access gap in `StudentAccessService` — documented, not fixed (needs its
  own spec). Confirmed gradebook, admissions pipeline, bulk import, and `StatusPill` are all genuinely
  not implemented (not just undocumented).
- **2026-09-12 (cont'd)** — Added a **Sequenced Implementation Plan** (see section above) covering every
  gap found in this audit, and mirrored it into
  `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md`'s living Implementation Checklist as
  Sprints L (security fix), M (UI test coverage), N (gradebook), O (admissions), P (bulk import), Q
  (StatusPill/accessibility) — none spec'd yet, priority order set, ready to brainstorm one at a time.
- **2026-09-12 (cont'd)** — Sprint L brainstormed, spec'd, planned, and implemented in a git worktree
  via subagent-driven-development (10 tasks, each independently reviewed; one fix-round on the core
  `StudentAccessService` task closed a role-branching maintainability finding before it could matter).
  Scope grew mid-brainstorm at the user's explicit direction to include tenant (`schoolId`) scoping
  alongside campus scoping, since the product will be multi-tenant SaaS in the future. Two real
  regressions were caught and fixed during implementation before merge, not shipped: (1) an early
  draft made parent access depend on enrollment status, breaking a real pre-existing guarantee that a
  parent can see a withdrawn child's historical records; (2) two separate e2e-fixture audit gaps
  (missing `campusId` on an HTTP test payload, missing `schoolId` on several `SCHOOL_ADMIN` fixtures)
  surfaced and were fixed proactively rather than one at a time. Result: 8 previously-unguarded routes
  across 5 controllers fixed, 4 of which had zero ownership check at all (not just campus-blind).
  Verified: backend unit 369/369 (up from 360), e2e 105/105 (up from 97), staff-console 239/239 (up
  from 238), build clean, staff-console lint/type-check clean. Full detail:
  `build/PROJECT-STATUS.md`'s Sprint L entry.
- **2026-09-13** — Sprint M (P0 test coverage, UI half) implemented task-by-task against its plan and
  merged to local `main` (`b6092b8..eb6671d`, 9 commits). Staff-console spec coverage added for
  `HolidaysView`, `ComplaintsQueueView`, `ReportCardsView`, the "Suggest draft" button on
  `DiaryView`/`CircularsView`, and the attendance-risk panel on `AdminHomeView`; parent-app spec
  coverage added for `complaints_screen.dart`/`report_cards_screen.dart`. Caught during the plan's own
  Task 9 full-suite re-verification (not during that task's individual verification step): the
  `DiaryView.spec.ts` commit had shipped with only the `suggestDiaryDraft` mock plumbing, missing the
  actual test case the plan specified — found by re-checking the file's test count against the plan
  rather than trusting the commit message, fixed in a follow-up commit. Verified: backend unit
  373/373, e2e 111/111 (unaffected, no backend files touched), staff-console 255/255 (up from 239,
  +16 new tests), `vue-tsc` clean, parent-app `flutter analyze` clean, parent-app 94/94 (up from 88,
  +6 new tests). Full detail: `build/PROJECT-STATUS.md`'s Sprint M entry.
