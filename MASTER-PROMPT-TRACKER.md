# SchoolPortal — Master Validation Prompt Tracker

Tracks progress against the "SchoolPortal — Master Implementation & Validation Prompt" given
2026-09-12 (repo audit → validate → implement → test → document workflow, sections 1–23).

This is a **different axis** from the other two living trackers in this repo — keep all three in sync,
don't let this one replace them:
- `PROJECT-STATUS.md` — detailed per-feature build history (what was built, sprint by sprint).
- `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` — roadmap-level sprint checklist (Sprint A–K+).
- **This file** — checklist against the master prompt's own P0/P1 priority list and validation asks.

Status vocabulary (per the master prompt's own Section 1 classification, use precisely, never overclaim):
`Implemented` · `Partially implemented` · `Broken` · `Tested` · `Untested` · `Integration-ready` ·
`Sandbox-verified` · `Production-verified` · `Not implemented` · `Intentionally deferred` · `Pending audit`

**Update this file after every task completed against the master prompt** (append to the row, don't
just flip a checkbox — note the commit/date/evidence).

---

## 0. Repository Audit (Master Prompt Section 2)

| Item | Status | Evidence |
|---|---|---|
| Locate actual app repo | Done | `build/` is the real SchoolPortal repo (NestJS backend, Vue staff-console, Flutter parent-app); the parent `D:\Personal\Projects\SchoolApp` is an unrelated agentic-suite scaffold — see [[project-dev-workflow]] memory |
| Git state at audit start | Done | `main`, clean, up to date with origin @ `b726199` (2026-09-12) |
| Latest completed sprint | Done | Sprint I/J/K (remaining feature gaps, accessibility/localization, AI drafting + predictive analytics), plus follow-ups: Report Cards teacher upload, Teacher Complaints section-scoping, `Modal.vue`→`AppModal.vue` rename |
| Full roadmap-checklist cross-check (§ of the roadmap doc still open) | **Pending audit** | Not yet re-read this session line-by-line; `PROJECT-STATUS.md:1272` says the roadmap's last spec'd sprint is done and **Phase 8 remainder (fee installments, admissions/lottery) is not yet spec'd** |
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
| Multi-campus boundary test coverage | **Gap confirmed, not yet fixed** | `backend/src/common/student-access.service.ts:24-26` — any `TEACHER`/`SCHOOL_ADMIN`/`ACCOUNTS`/`SUPER_ADMIN` bypasses all checks with **no campus scoping anywhere in the call chain** (confirmed via `attendance.service.ts`, where `campusId` is only used for holiday-calendar lookups, never access control). Affects every module built on `StudentAccessService`: Timetable, Attendance, Diary, Circulars, Fees, Report Cards, Complaints. Documented in `PROJECT-STATUS.md`'s 2026-09-12 entry; **not fixed** — needs its own spec/plan per the repo's brainstorm→spec→plan workflow before implementation (it's an architecture-wide change, not a quick patch). |
| Staff-console UI test coverage (same 5 modules) | Not implemented | Explicitly named as still-open in `PROJECT-STATUS.md`'s 2026-09-12 entry |
| Parent-app UI test coverage (`complaints_screen.dart`, `report_cards_screen.dart`) | Not implemented | Same entry |

---

## P1 — Structured Academics / Gradebook (Master Prompt Section 10)

| Item | Status | Evidence |
|---|---|---|
| Report cards: structured DB data vs. uploaded document | **Uploaded file, not structured** | `backend/src/report-cards/report-cards.service.ts:36-51` — `upload()` stores a `fileId` reference to an uploaded PDF; no marks/grades/weights modeled anywhere in the report-cards module |
| Weighted assessment-category gradebook (assignments/quizzes/midterm/final %) | **Not implemented** | No `gradebook`/`assessment categor*`/`weighted categor*` hits anywhere in `PROJECT-STATUS.md` or backend source |

**Conclusion:** This is a real, confirmed gap matching the master prompt's Section 10 concern exactly. Not started — would need its own spec.

---

## P1 — Admissions / Enrollment (Master Prompt Section 11)

| Item | Status | Evidence |
|---|---|---|
| Existing "Enrollment" concept | Implemented, narrow scope | `backend/src/enrollment/enrollment.service.ts` only has `getCurrentEnrollment()` / `getEnrollmentForDate()` — i.e. "which class/section is this already-created student enrolled in," not an admissions pipeline |
| Applicant → application → review → approval/rejection → student creation pipeline | **Not implemented** | `PROJECT-STATUS.md:1272` — "admissions/lottery — is not yet spec'd" |

**Conclusion:** A foundation exists to extend (the enrollment data model), but the actual admissions workflow the master prompt describes does not exist yet.

---

## P1 — Bulk Import/Export (Master Prompt Section 12)

| Item | Status | Evidence |
|---|---|---|
| Students/Parents/Teachers bulk import via Excel/CSV | **Not implemented** | No `csv`/`xlsx`/bulk-import hits anywhere in `backend/src` |

---

## UI Accessibility (Master Prompt Section 13)

| Item | Status | Evidence |
|---|---|---|
| Command Palette component | Implemented | `staff-console/src/components/CommandPalette.vue` + its own spec file exist |
| `StatusPill` shared component | **Not implemented** | `PROJECT-STATUS.md:1230,1279` — explicitly named as a scoped-but-not-started follow-up ("spec/plan not yet written") from the Staff Console Shell Redesign |
| Attendance segmented-control keyboard/focus/screen-reader audit | Pending audit | Not reviewed this session |
| Dashboard chart accessible names | Pending audit | Not reviewed this session |

---

## Deferred Features (Master Prompt Section 14)

Per the master prompt's own instruction, these are **intentionally deferred**, not gaps: fee installments,
promotion/re-enrollment, QR attendance, RFID, full payroll, full accounting ERP, full LMS, AI tutor,
hostel management, alumni management, GPS/transport, canteen wallet. No action expected unless the
repo or an explicit ask changes this.

---

## Session Log

- **2026-09-12** — Repo audit performed (see Section 0). P0 backend test-coverage backfill (holidays,
  complaints, report-cards, ai-drafting, attendance-risk, forgot/reset-password, bulk attendance,
  timetable-conflict) completed, independently re-verified (360/360 unit, 97/97 e2e, build+lint clean),
  and merged to local `main` (16 commits, `67aa03b`). Confirmed real cross-campus/cross-role access gap
  in `StudentAccessService` — documented, not fixed (needs its own spec). Confirmed gradebook, admissions
  pipeline, bulk import, and `StatusPill` are all genuinely not implemented (not just undocumented).
