# Pilot-Readiness Execution Plan (Waves 0–7)

> **Status:** CURRENT — **Waves 0–6 done (owner-gated BL-43/BL-54/BL-14 carried forward), Wave 7 is the current wave** (see §0) · **Progress verified:** 2026-10-01 against `wave-0/foundations` (BL-57) · plan text verified 2026-09-20 against `main@15362b7` (schema, services, tests read on this date) · **Sources:** [BACKLOG](../product/requirements/BACKLOG.md), [GAP-ANALYSIS](GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md), `backend/prisma/schema.prisma`, `attendance.service.ts`, `leave.service.ts`, `circulars.service.ts`, `promotions.service.ts`, `create-parent-with-user.ts` · **Owner:** Engineering Lead (Technical Owner)
> Companion to the gap analysis: this file fixes the **order of execution**, the **schema/migration dependencies that must precede application code**, the affected layers, the docs to regenerate, and rollback rules. Findings F1–F10 (2026-09-20) are folded in. Item detail and acceptance criteria live in the BACKLOG.

## 0. Progress and handoff (updated 2026-10-02 — Wave 8 started: owner-independent work before the owner sets up Firebase/SMTP/Play Console — KG-16 done)

All work is on branch **`wave-0/foundations`** (repo `build/`, remote `origin` = github.com/zainknoman/SchoolOS), one commit per item, each pushed after its checks passed. Item detail and "Done" notes: [BACKLOG](../product/requirements/BACKLOG.md); migrations and rehearsals: [MIGRATION-STRATEGY](../database/MIGRATION-STRATEGY.md); deploy steps: [RUNBOOKS](../operations/RUNBOOKS.md).

| Wave | Item | Status | Commit |
|---|---|---|---|
| 0 | BL-65 harness · BL-62 strategy (D1–D8 approved) · BL-18 scaffold · BL-66 generators · BL-37 part 1 | ✅ | `8cd67ab` · `bde3e83`/`5077e73` · `81fabea` · `695f4a1` · `f2d2d81` |
| 1 | BL-51 · BL-12 · BL-21 · BL-64 · BL-22 · BL-52 · BL-60 (M1) | ✅ | `39e83a3` · `185bd3f` · `a1659ba`/`d9fe0ef` · `42020a8` · `37692c5` · `0a2aea5` · `3653be9` |
| 2 | BL-10 · BL-11 · BL-39 · BL-40 | ✅ (BL-13 = Ops, open) | `fd7e7f2` · `608ab16` · `c04c789` · `ca4d24e` |
| 3 | BL-20 (M2) · BL-01 (M3) · BL-02 (M4) · BL-03 (M5) · BL-33 · BL-32 (M11) · BL-53 (M12) · BL-34 | ✅ | `a2a7bf7` · `2339247` · `566f183` · `9f9f138` · `f49631f` · `896aef2` · `3384a60` · `b4f7f60` |
| 4 | BL-23 + BL-04 (M6) | ✅ | `5e4a352` |
| 4 | BL-61 (M7) · BL-05 · BL-25 (M8) · BL-07 + BL-63 (M9, + M8 fixes, KG-25) | ✅ | `79aabed` · `bb6e744` · `5225c4c` · `8889b12` |
| 4 | BL-41 (audited CSV export) | ✅ | `94f5c5f` |
| 5 | BL-26 syllabus (M10 part) | ✅ | `0b1175d` |
| 5 | BL-27 grading scales + result publication (M10 part, KI-16, KG-26) | ✅ | `e232068` |
| 5 | BL-06 generated report cards (M10 part) | ✅ | `5df46a8` |
| 5 | BL-28 attendance-risk settings (M10 part) | ✅ | `384f885` |
| 5 | BL-29 leave workflow (M1b, KG-27) | ✅ | `9c6ec52` |
| 6 | BL-08 fee ledger (discounts/scholarships, late fees, outstanding/defaulters, carry-forward; KG-28) | ✅ | `ec04451` |
| 6 | BL-30 complaints workflow (M10 complaint part; KG-29, KG-30) | ✅ | `5784b1d` |
| 6 | BL-35 parent password reset (separate flow, deep link) | ✅ code (delivery needs an SMTP provider; until then BL-64) | `ee2d4c6` |
| 6 | **Wave 6 closed 2026-09-27** — all engineering items done | ✅ | — |
| — | Carried forward from Wave 6 (owner-gated, not built): BL-43 (Play Console, Firebase projects, signing keys) · BL-54 (real-device matrix) · BL-14 FCM part (`[FIREBASE_PROJECT_ID]`, SMTP provider) | ⏸ **owner input**; still required before pilot go-live | — |
| 7 | BL-37 part 2 (CI: backend lint 0 warnings, format, type-check, build, unit, e2e blocking; KI-21) | ✅ | `c776294` |
| 7 | BL-55 accessibility: axe on every console spec + token contrast in CI, keyboard pass, 9 fixes ([ACCESSIBILITY-AUDIT](ACCESSIBILITY-AUDIT.md)); screen-reader pass needs a person | ✅ (SR pass ⏳ human) | `0b8aac7` |
| 7 | BL-36 token storage: decision ([TOKEN-STORAGE-DECISION](../security/TOKEN-STORAGE-DECISION.md)); KG-15 closed (no query-string tokens; path-bound download links) | ✅ | `0fb1940` |
| 7 | BL-36 option B (owner choice 2026-09-28): refresh token in an HttpOnly SameSite=Strict cookie, access token in memory, CSRF header + Origin check; KG-9 closed. Needs same-site console/API domains (RD-2) | ✅ | `50bd3dd` |
| 7 | BL-15 load test: data generator `npm run load:data`, runner `npm run load:test`, fixes (bulk attendance, dashboard, my-day, parent list, 2 indexes), local 100-user run passes (CRUD p95 135 ms, auth p95 152 ms) — [LOAD-TEST-REPORT](LOAD-TEST-REPORT.md); staging run still required | ✅ (staging run ⏳, needs BL-13) | `d872ab7` |
| 7 | BL-56 privacy operations (documents only): [PRIVACY-NOTICE](../security/PRIVACY-NOTICE.md) draft, [PRIVACY-OPERATIONS](../security/PRIVACY-OPERATIONS.md) (14 questions for counsel, breach process, privacy requests, rehearsal record), incident lifecycle + record in [RUNBOOKS](../operations/RUNBOOKS.md#incident-and-support-process-decided-pilot); placeholders only, notification timelines TBD | ✅ docs (PO approval, counsel review before real data, one rehearsal ⏳) | `2741d23` |
| 7 | BL-57 pilot exit checklist: [PILOT-EXIT-CHECKLIST](PILOT-EXIT-CHECKLIST.md) — Q33 criteria (security review, restore test, monitoring, no Critical/High, core workflows, school sign-off), BL-15 staging run, BL-55 screen-reader pass, BL-56 privacy gates, BL-13 environments, rollback, data migration, owner-gated BL-43/BL-54/BL-14; evidence, owner, checker and sign-off per item | ✅ checklist (nothing signed — signing is the pilot exit itself) | `6d98580` |
| 7 | BL-58 repository hygiene — authorised 2026-10-02, done in Wave 8 (see below) | ✅ | `BL58-COMMIT` |
| 8 | KG-16 route-scope declarations (BL-18 part): `@ScopeCheck`/`@ScopedRecord` on every route with input, `route-scope.spec.ts`; sweep closed KG-31 hiring, KG-32 admissions, KG-33 timetable (+ foreign teacher), KG-34 student create | ✅ | `485a3ad` |
| 8 | A4 severity triage: KNOWN-ISSUES severity column + scale, KNOWN-GAPS re-verified (KG-19 closed by BL-11, KG-18 accepted for the pilot), no open Critical/High; KI-29(a) confirmed | ✅ (Product Owner signs A4) | `691b323` |
| 8 | BL-36 follow-ups: refresh-token reuse detection (migration `bl36_refresh_token_family`) and console CSP | ✅ | `d8c2679` |
| 8 | KI-5 / KG-22 notification delivery: timeouts, delivery status, retry job with backoff, final-failure alert line (migration `ki5_notification_delivery`) | ✅ | `fbeb6b3` |
| 8 | Small KIs: KI-6 env example + test, KI-10 reporting validation pipe, KI-19 holiday dedupe, KI-29(a) approve prefill | ✅ | `154fb4a` |
| 8 | Automated release smoke test `npm run smoke` (RELEASE-VALIDATION §3; e2e `smoke-test`) | ✅ | `4a4b954` |
| 8 | Backup/restore tooling (`db:backup`, `db:restore`) + local restore and rollback rehearsal ([record](RESTORE-REHEARSAL-2026-10-02.md)); staging run still needs BL-13 | ✅ (local) | `5b49d6d` |
| 8 | BL-58 hygiene (worktrees, merged branches, CSV copies with pasted credentials, duplicate binaries) + owner note 4 (report-card sessions per student school) | ✅ (history rewrite/remote branches/LFS = owner) | `BL58-COMMIT` |

Extra fixes outside the plan: `763cd15` (undo accidental console reformat), `44a3cb1` (KG-24 — bulk import could write into another school); with BL-41, `fees.e2e-spec.ts` stopped using a due date (2026-09-25) that had passed, which made its voucher read "overdue".

**Migrations are expand-only so far.** Contract steps (NOT NULL on the new `schoolId` columns, dropping legacy fallbacks such as school-less sessions/subjects/fee structures, the legacy `StudentParent.relationship`/`isPrimary`) come in a later release. Deploy order per migration: `migrate deploy` → `npm run backfill:mN` (M1–M8) → resolve `MigrationReviewItem` rows (RUNBOOKS SQL). Before M12: `npm run migration:dry-run` must show no `M12_*` rows. The dev DB has 12 active sessions, so M3's backfill refuses on it until they are reduced to one per school.

**Working conventions (keep):**
- Per item: failing test first where practical → code → unit + lint + build → **full e2e on a scratch DB** (never the dev DB) → console tests/lint/build if the console changed → Flutter analyze/test if the parent app changed → docs: **status goes in exactly three places** — this §0 (row, commit, "Next step"), the BACKLOG "Done" note and the CHANGELOG; topic docs (BUSINESS-RULES, KNOWN-ISSUES/GAPS, guides, RUNBOOKS, ENVIRONMENT…) only when the item changes what they describe. GAP-ANALYSIS and DECISION-MATRIX are frozen (2026-10-01) — do not update them → `node scripts/docs/generate.mjs` → commit (ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`) → `git push`.
- Data-changing migration: expand SQL + `migration-harness/backfills/mN-*.mjs` + `backfill-mN-cli.mjs` + `npm run backfill:mN` + scenario `migration-harness/scenarios/mN-*.mjs` (idempotency is checked automatically) + `prisma migrate diff` shows no drift + record the rehearsal in MIGRATION-STRATEGY.
- Two-school e2e fixture: `backend/test/pending/two-school-fixture.ts` (`createTwoSchools(prefix)`); the BL-18 scaffold is fully graduated.
- **Do not** run `prettier --write` on `staff-console/**` or `backend/migration-harness/**` (it reformats whole files); backend `src/`/`test/` are fine. **Do not** commit `docs/UI-Screenshots/sample4` CSVs. Write multi-line edit scripts with a file (Git Bash heredocs mangle backslashes).
- Last verified counts (2026-10-02, backup tooling): backend unit 888, e2e 412 (55 suites), harness 10 scenarios + 13 tests (unchanged; additive migrations only), console 651, parent app 118.
- Route scope (KG-16): every new controller route with `@Param`/`@Body`/`@Query`/file input needs `@ScopedRecord(kind, param)` (RecordScopeGuard; kinds: student, staff, teacher, section, timetableEntry, hiringApplication, admissionApplication) or `@ScopeCheck('<function that checks>')` / `SELF` / `NO_SCHOOL_DATA` / `SHARED_IDENTITY`; `src/common/route-scope.spec.ts` enforces it.
- Additive migration SQL: `DATABASE_URL=<scratch> npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script -o prisma/migrations/<ts>_<name>/migration.sql`, then `migrate deploy` and the same diff with `--exit-code` (0 = no drift). `psql` is not installed; the scratch DB `schoolos_scratch_e2e` already exists and is reused.
- An e2e `afterAll` that throws before `f.close()` leaves the app open and Jest hangs (looks like a timeout) — keep cleanup queries valid. FKs from new history tables to Class/Term/Subject use `NoAction` so school-deletion cascades still work.
- Multi-line edits: write a Node script to the scratchpad and run it (normalise CRLF first); never put `﻿` in written content (it becomes a literal BOM).
- Full e2e on a scratch DB: create `schoolos_scratch_e2e` (drop first), `DATABASE_URL=<…/schoolos_scratch_e2e> npx prisma migrate deploy`, then the same `DATABASE_URL` for `npm run test:e2e`. Suites that call validated endpoints must install the global `ValidationPipe` (production does it in `main.ts`, `AppModule` does not).

**Wave 8 (owner instruction 2026-10-02):** Firebase, SMTP and Play Console (BL-43/BL-14/BL-54) are set up by the owner **last**; before that, everything without that dependency is done, including the post-pilot backlog, and BL-58 is authorised (keep `staff-hiring-console-ui` and `stash@{0}`). Order: KG-16 ✅ → A4 severity triage ✅ → BL-36 follow-ups ✅ → KI-5/KG-22 ✅ → small KIs ✅ → smoke test ✅ → backup/restore tooling + local rollback rehearsal ✅ (container images/host config wait for the BL-13 hosting choice) → BL-58 ✅ → post-pilot items (BL-19, BL-38, BL-49, BL-45, BL-46, BL-47, BL-48, BL-59, BL-09, BL-16 audit).

**Earlier next step (2026-10-01): Wave 7 has no engineering-doable item left.** Remaining work is gated: BL-13 staging/production (then the BL-15 staging run), the BL-55 screen-reader pass (a person), the owner inputs for BL-43/BL-54/BL-14, written authorisation for BL-58, and the pilot exit itself — work through [PILOT-EXIT-CHECKLIST](PILOT-EXIT-CHECKLIST.md) item by item (A4 first needs a severity triage of KNOWN-ISSUES, which has no severity column). BL-56 is done as documents: before real data is entered the Product Owner approves them, counsel reviews them (gates G1–G5 in [PRIVACY-OPERATIONS §0](../security/PRIVACY-OPERATIONS.md#0-gates-before-real-data-is-entered)) and the incident process is rehearsed once. BL-15 is done locally (all Q44 thresholds pass with 100 users and 2,000 students); its staging run follows [LOAD-TEST-REPORT §6](LOAD-TEST-REPORT.md) once staging exists (BL-13). BL-36 is done: KG-15 closed, and the owner chose option B, now built (KG-9 closed; the console and API must share a registrable domain — RD-2 is still open; refresh-reuse detection and a console CSP are recommended follow-ups). BL-37 part 2 and BL-55 are done (BL-55's screen-reader pass needs a person with NVDA/VoiceOver — checklist in [ACCESSIBILITY-AUDIT §5](ACCESSIBILITY-AUDIT.md)); BL-58 waits for written authorisation. Wave 6 is closed; its owner-gated items (BL-43 Play Console/Firebase/signing keys, BL-14 FCM `[FIREBASE_PROJECT_ID]` + SMTP, BL-54 real-device matrix) are carried forward and still gate pilot go-live — pick them up as soon as the owner provides the inputs.
- Console accessibility gate (BL-55): every console spec runs axe on its final state (`src/test-setup.ts`), so a new unlabelled control fails `npm test`; name controls with a `<label>`, `FormField`, or `aria-label`. Form-control borders use `--color-control-border`, not `--color-border`. Triage with `A11Y_REPORT=<file> npx vitest run`.
- Load test (BL-15): `npm run load:data` only into a database named `*load*`/`*scratch*`/`*e2e*` (`NODE_ENV=development`, `LOAD_PASSWORD`), then the production build against it and `npm run load:test`. Keep the laptop awake (a sleep mid-run produces 15-minute requests; discard that run). Do not run e2e at the same time — they share the CPU.
- Backend CI gates (BL-37): `npm run lint` fails on any warning; also run `npm run format:check` and `npm run typecheck` before committing.
- The parent app now depends on `file_picker` (complaint attachments); include it in the BL-54 device matrix.
- The two-school e2e fixture now removes its students' fee ledger itself (payments, reversals, carry-forward lines, vouchers) — suites no longer need their own fee cleanup.

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
`Wave 0 (BL-62 strategy · BL-65 harness · BL-66 generators · BL-37 part 1 · BL-18 scaffold)` → `Wave 1 (BL-51 · BL-12 · BL-21 → BL-64 · BL-22 · BL-52 · BL-60 [M1])` → `Wave 2 (BL-10 · BL-11 · BL-39 · BL-40 ∥ BL-13 infra)` → `Wave 3 (M2/BL-20 · M3/BL-01 · M4/BL-02 · M5/BL-03 · BL-33 · BL-32 · BL-53 · BL-34)` → `Wave 4 (M6/BL-23+BL-04 · M7/BL-61 → BL-05 · M8/BL-25 · M9/BL-07+BL-63 · BL-41)` → `Wave 5 (BL-26 · BL-27 · BL-06 · BL-28 · BL-29 [M1b])` → `Wave 6 ✅ (BL-08 · BL-30 · BL-35; BL-43 · BL-54 · BL-14 FCM carried forward, owner-gated)` → **current:** `Wave 7 (BL-15 · BL-55 · BL-36 · BL-37 part 2 · BL-56 · BL-57 · BL-58)`.
Hard gates: **BL-62 approved (✅ 2026-09-24) + BL-65 available (✅)** before any of BL-01, BL-02, BL-03, BL-20 (M2), BL-23, BL-61 executes; **BL-21 before BL-64**; **BL-60 (M1) before BL-29 (M1b)**; **BL-61 before BL-05**; **BL-40 (pagination) before new list screens**; **BL-34 before BL-43** (identifiers created once); **BL-66 before the first regeneration of docs**.

## 3. Schema / migration order (schema before application code)
✅ = migration shipped (see §0 for commits).
Every data-changing migration uses **expand → backfill → contract** (contract one release later), an idempotent backfill script, a dry-run reconciliation report, and is rehearsed on the BL-65 harness first.
| M | Change | Item | Backfill / ambiguity handling |
|---|---|---|---|
| M1 | `Attendance.markedById` nullable; add `markedByUserId` (→ `User`) | BL-60 ✅ | from `AuditLog` actions `attendance.mark`, `attendance.mark-bulk`, `leave-request.approve` (no `attendance.update` exists — corrected 2026-09-24); unresolved stays null (keeps old `markedById`) |
| M1b | `LeaveRequest`: recommender/decider ids, timestamps, notes | BL-29 ✅ | none (new columns) |
| M2 | `Circular.schoolId`, `Holiday.schoolId` | BL-20 ✅ | Holiday from campus; Circular from section→class→campus→school, else author's school; SUPER_ADMIN author or ambiguity → manual review |
| M3 | `AcademicSession.schoolId` (+ `legacySessionId`, unique `(schoolId,label)`) | BL-01 ✅ | shared global sessions split per school and dependents re-pointed; ambiguity → review, never an arbitrary "current" session |
| M4 | `Subject.schoolId`, `isActive`, unique `(schoolId,name)` | BL-02 ✅ | referenced subjects cloned per school; dependents re-pointed; unreferenced rule set in BL-62 |
| M5 | `FeeStructure.schoolId` + lifecycle; `Term` follows session | BL-03 ✅ | school via vouchers' students; ambiguity → review |
| M6 | `StudentParent.relationshipType` (from the existing free-text `relationship`), `primarySlot` 1–2 (unique per student; `isPrimary` already exists since `20260919090000`) | BL-04, BL-23 ✅ | rules G4/G5 of [MIGRATION-STRATEGY](../database/MIGRATION-STRATEGY.md): known texts mapped, others → `OTHER`; > 2 primaries → review. **No `schoolId` on the guardian identity** |
| M7 | Add `StudentStatus.TRANSFERRED`; rename `PromotionDecision.TRANSFERRED_OUT`→`TRANSFERRED`; add `PROMOTED_WITH_CONDITIONS` | BL-61, BL-05 ✅ | **`LEFT` + matching `TRANSFERRED_OUT` promotion → `TRANSFERRED`; all other `LEFT` → manual review; never renamed blindly**; `LEFT` removed only when zero rows remain; `EnrollmentStatus` unchanged |
| M8 | `TeachingAssignmentHistory` | BL-25 ✅ | from current section/timetable, start date flagged unknown |
| M9 | `archivedAt`; `RetentionPolicy` (periods null) | BL-07, BL-63 ✅ | none |
| M10 | Complaint fields + `ComplaintNote`, `ComplaintAttachment`; syllabus; grading scale; report-card source/snapshot/version; risk settings; promotion config | BL-30/26/27/06/28/05 (BL-30 part ✅: `Complaint` category/school/owner/resolution, `ComplaintNote`, `ComplaintAttachment`, `File.uploadedById`, `20260929100000_m10_complaints`; BL-05 part ✅: `PromotionPolicy`; BL-26 part ✅: `Syllabus`/`SyllabusUnit`, `20260928090000_m10_syllabus`; BL-27 part ✅: `GradingScale`/`GradeBand`/`ResultPublication`, `20260928100000_m10_grading`; BL-06 part ✅: `GeneratedReportCard`, `20260928110000_m10_report_cards`; BL-28 part ✅: `AttendanceRiskPolicy`, `20260928120000_m10_attendance_risk`) | additive |
| M11 | `UserPermission` grants | BL-32 ✅ | preserve current ACCOUNTS behaviour, then restrict |
| M12 | one ACTIVE enrolment per student; one voucher per student/session/month | BL-53 ✅ | pre-check duplicates; raw-SQL partial unique index |
| M13 | job lock (or advisory locks) | BL-39 ✅ | — |
| M14 | fee ledger: `FeeItem` kind/reason/actor/reversal/carry links, `FeeVoucher.kind`, `FeePayment` reversal/note/recorder, `StudentFeeConcession`, `FeePolicy`; triggers refusing edits of voucher lines, settled payments/allocations and receipts (`20260929090000_bl08_fee_ledger`) | BL-08 ✅ | none (additive; existing lines become `CHARGE`) |

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
- **Highest risk:** M3 (session split), M4 (subject clone), M6 (guardians), M7 (lifecycle). All are gated by BL-62 and BL-65. The BL-62 rules, review queue and execution procedure are in [MIGRATION-STRATEGY](../database/MIGRATION-STRATEGY.md) (approved 2026-09-24).
- **Rollback = restore the pre-migration backup and redeploy the previous build.** Expand steps are backward-compatible so the previous build keeps working; contract steps ship a release later. Keep `legacy*Id` columns for traceability.
- Never merge guardians on name similarity; never expose one school's students to another school's staff; ambiguous rows are exported for manual review, never guessed.
- No migration runs on shared/production data without an approved BL-62 strategy, a passing BL-65 rehearsal and a fresh verified backup.
