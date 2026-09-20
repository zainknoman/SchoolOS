# Documentation Cleanup Manifest (Phase 1A)

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Produced by:** Phase 1A · **Consumed by:** Phase 1B
> Gate G1 was approved by the project owner with the instruction "approve anything recommended". Every disposition below is the *recommended* one; nothing is deleted (default = ARCHIVE via `git mv`).
> Snapshot tag: `docs-pre-cleanup` (local, created at Phase 1A).

Scope: all **455 tracked non-code files** (root, `docs/`, `plan/`, sub-project READMEs, CI). Excluded (untracked/ignored scratch): `.claude/worktrees/`, `.worktrees/`, `.superpowers/`, `backend/uploads/`, `node_modules`, `dist`, and everything outside `build/`.

## 1. Disposition table

| # | Path | Purpose | Current? | Accurate? | Duplicate / conflict (evidence) | Disposition | Canonical for |
|---|---|---|---|---|---|---|---|
| 1 | `README.md` | Entry | Partly | Partly — D1, D8, D9 | Lists Principal as role; seed stats; `plan/docs` links | **REWRITE (Ph 2)** | Entry/navigation |
| 2 | `PROJECT-STATUS.md` (1,721 ln) | Build log + status | Partly | Mixed — D3, D5, D6, D7 | Overlaps #3, #4 | **MOVE log → `docs/archive/project-status-build-log.md`; write new short PROJECT-STATUS.md** | Status (new) |
| 3 | `MASTER-PROMPT-TRACKER.md` | Checklist vs 2026-09-12 master prompt | No | Broken link D4; sprint table stale | Overlaps #2 | **ARCHIVE** (readiness backlog → Ph 12) | — |
| 4 | `progress.md` | Access-control scoping status | Partly | Still true for 4 endpoints (verified: `Subject`, `FeeStructure`, `Term`, `AcademicSession` have no school path) | Duplicated inside #2 | **ARCHIVE** (content → Ph 8 `KNOWN-GAPS.md`; summarized in new status) | — |
| 5 | `DESIGN.md` v2.0.0 | Design-system spec | Yes | Yes (memory: reconciled 2026-09-18; refs MASTER.md) | Complements #6 (not duplicate) | **KEEP** | Design |
| 6 | `staff-console/design-system/schoolos-staff-console/MASTER.md` | Token/master spec | Yes | Referenced by `base.css`, `app_theme.dart`, DESIGN.md | Not duplicate of DESIGN.md (token layer) | **KEEP** (code refs it) | Design tokens |
| 7 | `docs/Figma/*` (5 files) | Aug-2026 Figma handoff | No | Pre-rebrand, pre-redesign | Overlaps DESIGN.md | **ARCHIVE → `docs/archive/figma/`** | — |
| 8 | `docs/audit/2026-09-18-ui-design-system-audit/` (5) | Dated UI audit | Yes | Dated record | — | **KEEP** (add `MASTER-PROMPT-TRACKER`/UI-Screenshots link fixes) | Audit record |
| 9 | `docs/wireframe/` (png, html, 4 folders + 4 zips) | MVP wireframes | No | Pre-build | zips duplicate the folders | **MOVE → `docs/design-reference/wireframe/`** (no deletion) | — |
| 10 | `docs/UI-Screenshots/sample4/` | Current design comps (html/pdf) | Yes | Design reference | — | **MOVE → `docs/design-reference/UI-Screenshots/sample4/`** | Design refs |
| 11 | `docs/UI-Screenshots/archive/` (zips of #10 + older samples) | Older comps | No | zips duplicate #10 | Yes | **MOVE → `docs/design-reference/UI-Screenshots/archive/`** | — |
| 12 | `docs/timetable-samples/` (3 images) | Timetable design refs | No | — | — | **MOVE → `docs/design-reference/timetable-samples/`** | — |
| 13 | `docs/database/data-model-design.md` | Data model design | Partly | **Lags**: 0 mentions of Gradebook/Assessment/Promotion/Complaint/Holiday/ReportCard/AttendanceRiskFlag/DeviceToken (57 models exist) | Overlaps #14 | **KEEP IN PLACE, rewrite Ph 7** (code comments in `backend/src/hiring/*` cite this path) | DB (after Ph 7) |
| 14 | `docs/database/full-data-model-audit.md` | Phase-1 audit | No | References 6 migrations (13 exist) | — | **ARCHIVE → `docs/archive/database/`** | — |
| 15 | `docs/database/migration-plan.md` | Migration strategy | Partly | Covers sub-projects 1 & 3 only | Overlaps #13 | **KEEP IN PLACE, rewrite Ph 7** | DB migrations (after Ph 7) |
| 16 | `docs/database/seed-data.ts`, `seed-expanded.ts` | Code inside docs | No | Differ from `backend/prisma/seed.ts` (479/524 vs 296 lines) | **Duplicate** | **ARCHIVE → `docs/archive/database/`** (not deleted) | — |
| 17 | `docs/api/*.postman_*.json` | Postman | Verify Ph 7 | 185 requests vs 185 route decorators — count matches; contents unverified | — | **KEEP** | API supplementary |
| 18 | `plan/docs/PRD.md`, `PRD.txt` | Original PRD | No | Five-app vision cut | PRD.md ≈ PRD.txt | **ARCHIVE → `docs/archive/original-mvp-plan/`** | — |
| 19 | `plan/docs/FEATURES.txt` | FEAT-001..014 | Partly | IDs cited in trackers | — | **ARCHIVE (IDs mapped in Ph 3 Feature Catalog)** | FEAT-ID origin |
| 20 | `plan/docs/ARCHITECTURE.md`, `TECH-STACK.md` | Original arch/stack | No | TECH-STACK says SQLite/Node 20 → D2 | vs code | **ARCHIVE** | — |
| 21 | `plan/docs/CURRENT-SYSTEM-ANALYSIS.md`, `DESIGN-BRIEF.md`, `DATA-MODEL-CORRECTION-PLAN.md` | Historical | No | SQLite-era | — | **ARCHIVE** | — |
| 22 | `docs/Plan-Ideas/PHASE-1/*` (6), `PHASE-2/*` (2) | Audits/roadmap/prompts | No | `SchoolPortal-*` names; roadmap checklist stale | — | **ARCHIVE → `docs/archive/plan-ideas/`** | — |
| 23 | `docs/superpowers/plans/*` (36), `specs/*` (23) | Sprint plans/designs | Historical | Rationale only | — | **KEEP IN PLACE**; add HISTORICAL index (Ph 1B) | Input to Ph 3 rules |
| 24 | `docs/production-readiness/raw-plan-…md` | Phase-0 brief | Yes | — | — | **KEEP until Ph 12** | — |
| 25 | `docs/PLAN-DOCUMENTATION-PRODUCTION-READINESS.md` | Program plan | Yes | — | — | **KEEP** | Program record |
| 26 | `backend/README.md`, `staff-console/README.md`, `parent-app/README.md` | Boilerplate | — | Template text | — | **REWRITE (Ph 2)** | Per-app quickstart |
| 27 | `.github/workflows/ci.yml` | CI | Yes | Yes | Comment cites PROJECT-STATUS "Security Hardening Pass" | **KEEP** (comment pointer → log archived; CODE-adjacent, not edited) | CI config |

## 2. Conflicts D1–D10 resolved with evidence

| # | Verdict | Evidence |
|---|---|---|
| D1 | Confirmed | `enum Role {SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, ACCOUNTS, PARENT}`; `User.isPrincipal` (schema:139); `dashboard.controller.ts:33-34` |
| D2 | Confirmed | `schema.prisma` datasource `postgresql`; `prisma.config.ts`; CI `postgres:16` |
| D3 | Confirmed | Migration `20260908000000_postgres_baseline` exists; PROJECT-STATUS "Sprint 11-12" still lists the switch as open |
| D4 | Confirmed | `MASTER-PROMPT-TRACKER.md` cites `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-…`; real file is `docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` |
| D5 | Confirmed | `storage.module.ts` provides only `LocalDiskStorageAdapter` |
| D6 | Confirmed | `seed.ts` uses `@schoolportal.local`; PROJECT-STATUS cites `parent-a@schoolos.edu.pk` |
| D7 | Confirmed | Only `backend/`, `staff-console/`, `parent-app/` exist; no Next.js project on any local/remote branch |
| D8 | Partly | Seed: 2 schools, 8 grades; other counts derive from loops (not re-derived; README numbers **removed**, not re-asserted) |
| D9 | Confirmed | `SchoolPortal` remains in seed emails, DB name `schoolportal`, `.env.example`, Plan-Ideas filenames (rebrand exclusions) |
| D10 | Confirmed | Terminology gate G4 — documented as flag-on-SCHOOL_ADMIN |

## 3. New findings (not in the Phase-0 plan)

| ID | Finding | Type |
|---|---|---|
| N1 | `AcademicSession` **has no `schoolId`**. `AcademicSessionService.create/update` with `isActive` **deactivates every other active session platform-wide** (`academic-session.service.ts:49-53,167-171`). Three call sites use `academicSession.findFirst({isActive:true})` (`student.service.ts:69`, `fee-vouchers.service.ts:30`, `students-bulk-import.service.ts:100`). Effect: with 2+ schools, only one school can have the "active" session; the other's students/vouchers attach to the wrong one. | `CODE ISSUE DISCOVERED` → business-rule decision Q1 |
| N2 | `prisma/seed.ts` creates `isActive:true` session **per school** (line 154) and passes `schoolId` in an in-memory object but not to Prisma (line 156) — contradicts the API's single-active rule. | `CODE ISSUE DISCOVERED` |
| N3 | Sub-project docs `docs/UI-Screenshots/sample4/**` contain vendored `react.js` / `react-dom.js` (design comps). Non-documentation payload in the docs tree. | Note (kept; moved) |
| N4 | Unmerged local branches: `rebrand/schoolos` (1 commit ahead of main), `staff-hiring-console-ui`, worktree branches (0 ahead). Worktree `schoolos-design-chunk0` is registered. | Worktrees **left untouched** (recommendation: prune only after owner confirms nothing is unpushed) |
| N5 | `gradebook/` has **0** colocated unit specs (only `gradebook.e2e-spec.ts` exists) — testing-doc input. | Note for Ph 10 |
| N6 | Code comments cite `PROJECT-STATUS.md` (`ci.yml:42`, `firebase_options.dart:5`, `AppShell.vue:81`); these will point to a now-archived log. | Recorded; not edited (no code changes in doc phases). New status file cross-references `docs/archive/project-status-build-log.md`. |

## 4. Inbound-link map (non-archive docs → moved targets)
`README.md` → `plan/docs`, `Plan-Ideas`, `docs/Figma`, `FEATURES.txt` (all replaced in Ph 2). `PROJECT-STATUS.md` → many (file replaced). `docs/audit/.../architecture.md` → `UI-Screenshots`, `MASTER-PROMPT-TRACKER` (repaired in 1B). `DESIGN.md` → `PROJECT-STATUS`, `docs/audit`, `MASTER.md` (verify in 1B). Code comments → `docs/database/data-model-design.md` (path preserved) and `docs/superpowers/specs/…` (preserved).

## 5. Gate G1/G2 decisions applied (recommended options)
| Gate | Decision |
|---|---|
| G1 | All ARCHIVE/MOVE above approved; **no deletions**; `docs/superpowers` stays; large binaries stay in git (no LFS change); local tag `docs-pre-cleanup` created; worktrees not pruned |
| G2 | New folders `docs/design-reference/` and `docs/archive/`; `plan/docs` → `docs/archive/original-mvp-plan/`; `.gitignore` **not edited** (its `plan/*` lines become inert) |

## 6. Phase 1B execution record (2026-09-20)

All approved moves executed with `git mv` (rename history preserved) **except** `docs/UI-Screenshots/sample4/`, which stays in place: Windows refused the rename (`Permission denied`, a file/folder lock) and two files inside it (`bulk-upload/parents-sample (1).csv` and `.csv.bak`) show uncommitted content changes that this program did not make. `docs/UI-Screenshots/archive/` **was** moved to `docs/design-reference/UI-Screenshots/archive/`. Follow-up (owner): close whatever holds `sample4/` open, then `git mv docs/UI-Screenshots/sample4 docs/design-reference/UI-Screenshots/sample4` and remove the empty `docs/UI-Screenshots/`. Nothing was deleted. `.gitignore` untouched. Worktrees untouched.
