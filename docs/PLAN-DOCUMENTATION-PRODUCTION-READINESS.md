# SchoolOS — Documentation Cleanup, Product Journey & Production Readiness Plan

**Status:** **ALL PHASES 0–13 EXECUTED (2026-09-19/20)** — see the Task Tracker below. Documentation is complete to the extent the code allows; **the system is not production-ready** (`docs/release/PRODUCTION-READINESS.md`). Human-decision gates were resolved with the recommended option under the owner's instruction "approve anything recommended"; items that need real owner knowledge remain `REQUIRES-DECISION`.
**Date:** 2026-09-19 · **Branch inspected:** `main` @ `15362b7` (438 commits)
**Scope of this run:** read-only discovery + this one file. No source, test, schema, README or other doc was touched.

> **Documentation completeness does NOT equal production readiness.** This plan produces accurate
> documentation *and* an honest gap list. Closing engineering gaps is a separate, later effort that
> needs its own authorization (§24).

---

---

## TASK TRACKER (live status of this plan)

**Legend:** ✅ done · ⚠ done with an exception or open item · ⏳ remaining (owner/engineering action, not documentation)

| Phase | Name | Status | Date | Main outputs | Gates / notes |
|---|---|---|---|---|---|
| 0 | Discovery & planning | ✅ | 2026-09-19 | this plan | G0 approved |
| 1A | Inventory & disposition manifest | ✅ | 2026-09-20 | `docs/archive/CLEANUP-MANIFEST.md`, tag `docs-pre-cleanup` | G1 resolved (recommended options); new findings N1–N6 |
| 1B | Cleanup execution | ⚠ | 2026-09-20 | `git mv` of 100+ files into `docs/archive/` and `docs/design-reference/`; `docs/README.md`; `docs/superpowers/README.md`; new short `PROJECT-STATUS.md` | G2 resolved. **Exception:** `docs/UI-Screenshots/sample4/` could not be moved (Windows lock) — still at old path |
| 2 | README & entry points | ✅ | 2026-09-20 | `README.md` + 3 sub-project READMEs | commands match scripts; quick-start not executed end-to-end |
| 3 | Product foundation | ✅ | 2026-09-20 | `docs/product/*` (overview, roles, feature catalog, business rules, glossary) | G3/G4/G5: Principal = flag; SchoolOS naming; Q1–Q9 left `REQUIRES-DECISION`. Role matrix corrected in Phase 13 |
| 4 | Product journey & workflows | ✅ | 2026-09-20 | `docs/workflows/*` (6 docs) | — |
| 5 | Requirements | ✅ | 2026-09-20 | `docs/product/requirements/*` (FR, NFR, traceability, backlog) | some acceptance criteria `UNVERIFIED` |
| 6 | Architecture & ADRs | ✅ | 2026-09-20 | `docs/architecture/*` (5), `docs/decisions/` (9 retroactive ADRs) | G6: only evidence-backed ADRs |
| 7 | API & database | ✅ | 2026-09-20 | `docs/api/*` (generated endpoint reference), `docs/database/*` (model, generated dictionary + ERD, tenancy, migrations, seeding, history) | G7: hand-written API docs; OpenAPI is backlog BL-19; Postman verified 185/185; old DB docs archived + stubs |
| 8 | Security | ✅ | 2026-09-20 | `docs/security/*`, `SECURITY.md` | G8: contact left `REQUIRES-DECISION`; `npm audit` run (18 backend vulns) |
| 9 | Operations & integrations | ✅ | 2026-09-20 | `docs/operations/*` (6) | G9: hosting undecided → requirements documented, `NOT IMPLEMENTED` stated |
| 10 | Testing & traceability | ✅ | 2026-09-20 | `docs/testing/*` (3), traceability completed | suites **executed**: unit 579 ✓, e2e 196 ✓ (scratch DB, dropped), console 512 ✓, Flutter 100 ✓, analyze ✓; backend lint ✗ (2,014 errors) |
| 11 | User guides | ⚠ | 2026-09-20 | `docs/user-guides/*` (5 guides + index) | G10: no screenshots; **not click-tested** |
| 12 | Release & production readiness | ✅ | 2026-09-20 | `docs/release/*`, `CHANGELOG.md` (reconstructed) | G11: license/versioning left to owner; original brief archived; verdict **NO-GO as-is** |
| 13 | Final documentation audit | ✅ | 2026-09-20 | `docs/audit/2026-09-20-documentation-audit.md` | script: 250 links, 0 broken; 141 citations valid; 7 defects found & fixed in docs |

### Remaining work (not documentation — needs the owner or authorized engineering)
| # | Item | Type | Reference |
|---|---|---|---|
| R1 | Move `docs/UI-Screenshots/sample4` after releasing the file lock; review its two uncommitted CSV edits | housekeeping | manifest §6 |
| R2 | Independent human review + click-test of user guides and role matrix | review | audit §8 |
| R3 | Decide Q1–Q9 (sessions, subjects, fee scoping, guardians, promotion, report cards, retention, risk parameters, fee extras) | product decision | BUSINESS-RULES §8 |
| R4 | Decide license, security contact, hosting, versioning/release convention, incident process | owner decision | G8, G9, G11 |
| R5 | Fix High items: KG-1 circulars, KG-6 holidays, KG-2/3/4 unsafe defaults, KG-5 dependencies, KG-7 sessions | **engineering (separately authorized)** | KNOWN-GAPS |
| R6 | Build deployment target, backups + restore rehearsal, health endpoint, monitoring/logging | engineering/ops | PRODUCTION-READINESS §3 |
| R7 | Verify payment gateways, FCM, SMTP, WhatsApp in sandbox; choose/implement SMS provider; S3 adapter | external + engineering | INTEGRATIONS |
| R8 | Add regression tests for known defects; e2e for staff, hiring, files, jobs; make backend lint blocking after fixing backlog | engineering | TEST-MATRIX |
| R9 | Prune stale worktrees (`.claude/worktrees/*`) once nothing unpushed | housekeeping | manifest N4 |
| R10 | Commit the documentation changes (nothing is committed) | owner | — |
| R11 | Keep docs current: refresh `Verified:` headers, regenerate ENDPOINTS/DATA-DICTIONARY/ERD after code changes | ongoing | docs/README rules |

### Execution deviations from the plan (for the record)
1. Phases 1A–13 were run in sequence in one working session with recommended gate answers, per owner instruction; gates that require real owner knowledge were **not** answered (left `REQUIRES-DECISION`).
2. Phase 5 traceability was completed in Phase 10, as planned in §1. Architecture/security summaries were folded into `SYSTEM-OVERVIEW.md` rather than separate files, to avoid duplicate concepts; `docs/production-readiness/` was archived rather than folded into `release/`.
3. `docs/database/data-model-design.md` and `migration-plan.md` remain as deprecated stubs because code comments cite the paths.
4. Two scanner-derived tables were built in Phase 3 from a flawed first scan; the Phase 13 audit found and corrected them (generated docs use the corrected scan).
5. New findings not anticipated by the plan (session activation semantics, circular/holiday leakage, SMS placeholder URL, unused `JWT_REFRESH_*`, unsafe `NODE_ENV` default, reset links in logs, `npm audit` results) are recorded in KNOWN-GAPS / KNOWN-ISSUES; **none was fixed**.

---

## 1. Executive Summary

**What exists.** SchoolOS is a real, far-advanced application: NestJS 11 + Prisma 7 + PostgreSQL backend
(41 controllers, 57 models, 13 migrations, ~78 unit-spec files, 22 e2e specs), a Vue 3 staff console
(~50 views, EN/UR i18n), and a Flutter parent app (29 test files, EN/UR). The *code* is well ahead of the
*documents*.

**What is wrong with the docs.** There are ~2,800 lines of root-level status docs plus ~60 sprint
plans/specs, but no accurate description of "what SchoolOS is today". The main failures:

1. **`PROJECT-STATUS.md` (1,721 lines / 147 KB) is a chronological build log, not a status document.** It
   contradicts itself (e.g. still lists "Switch Prisma from SQLite to PostgreSQL" as pending; the schema is
   PostgreSQL), and has *no entries* for six shipped subsystems (Gradebook, Admissions, Bulk Import,
   StatusPill, Staff/Hiring, Promotion/Sprint R) — the file itself admits this ("Documentation Sync Gap").
2. **`README.md` is a partial entry point** — good architecture skeleton, but it lists "Principal" as a role
   (Principal is a *flag* on `SCHOOL_ADMIN`, not a Role), embeds seed-data tables as if they were product
   description, links "original MVP plan" as a doc index item, and carries no honest production-readiness
   status beyond one paragraph.
3. **Four "living trackers" overlap** (`PROJECT-STATUS.md`, `MASTER-PROMPT-TRACKER.md`, `progress.md`,
   the PostMVP roadmap) and reference each other with **broken paths**
   (`docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-…` does not exist; real path is `docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-…`).
4. **`plan/docs/` is original-plan material still described as current** — `TECH-STACK.md` says SQLite;
   `PRD.md`/`FEATURES.txt` describe a five-app vision that was cut.
5. **Design documentation is triplicated** (DESIGN.md, `docs/Figma/`, `staff-console/design-system/…/MASTER.md`).
6. **Zero operational, security, API-reference, user-guide or release documentation exists.** No Dockerfile,
   no deploy config, no CHANGELOG, no LICENSE, no SECURITY.md, no health endpoint (by grep), no security
   headers (no `helmet`).

**The approach.** Fourteen controlled phases (0–13, with Phase 1 split into 1A/1B). Phase 1 is
*cleanup and reconciliation*, executed as **classify → human approval → move/merge/archive**, so nothing is
deleted without sign-off. Every later phase writes only docs that are verified against code, using a strict
source-of-truth hierarchy (§5) and a status vocabulary (§23). Discovered code problems are logged as
`CODE ISSUE DISCOVERED`, never fixed.

**Deviations from your suggested phase order (evidence-based, see §27):**
- Phase 1 is split: **1A** produces a disposition manifest and stops for approval; **1B** executes it.
- **Requirements (Phase 5) do not carry a finished traceability matrix.** Traceability needs API, DB and test
  docs that don't exist until Phases 7 and 10. Phase 5 writes FR/NFR + acceptance criteria with trace columns
  stubbed; **Phase 10 completes the matrix.**
- **Business Rules move into Phase 3 with an explicit "requires product decision" register** — the code shows
  at least three unresolved rule questions (§14) that would otherwise silently become "requirements."
- A **Phase 9.5-style split is not needed**; but Security (8) intentionally precedes Operations (9) because
  operations docs (secrets, rotation, headers, rate limits) depend on security findings.

---

## 2. Current Documentation State

### 2.1 Where the repo actually is
The git repository root is **`D:\Zain\Projects\SchoolApp\build\`** (`.git` is there). The parent folder
contains **non-repo material** that must be excluded from every phase:

| Outside repo (`SchoolApp/`) | What it is |
|---|---|
| `website/` (index.html, `Template/classdojo`) | Static public-site prototype; not part of `build/` |
| `admin-dashboard.png`, `skills-lock.json`, `.agents/`, `.claude/` (skills), `.playwright-mcp/` | Tooling debris/screenshots |

Inside `build/`, git-ignored scratch that must **not** be inventoried as docs (but *is* physically present and
pollutes naive searches): `.claude/worktrees/` (a registered worktree `schoolos-design-chunk0` — a near-full
copy of `docs/` that has **already diverged**: Figma files and `seed-expanded.ts` differ from `main`),
`.claude/worktrees/staff-hiring-foundation-plan/` (old copy), `.worktrees/`, `.superpowers/sdd`,
`backend/uploads/` (63 files incl. uploaded `.md` test artifacts), `backend/dist`, `node_modules`.
→ **HUMAN DECISION REQUIRED** (Phase 1A): prune/remove stale worktrees.

### 2.2 Existing documentation, by category
| Category | Location | Size | State |
|---|---|---|---|
| Entry point | `README.md` | 210 lines | Partially accurate; see §8 |
| Status/trackers | `PROJECT-STATUS.md`, `MASTER-PROMPT-TRACKER.md`, `progress.md` | 1,721 / 222 / 72 lines | Overlapping, stale in parts |
| Design | `DESIGN.md` v2.0.0, `docs/Figma/*` (5 files), `staff-console/design-system/…/MASTER.md`, `docs/audit/2026-09-18-…` (5 files) | 581 + … | DESIGN.md is recent & reconciled (memory: 3-brand conflict resolved); Figma set is Aug-2026 and predates SchoolOS rebrand/redesign |
| Original plan | `plan/docs/` (8 files: PRD.md, PRD.txt, FEATURES.txt, ARCHITECTURE.md, TECH-STACK.md, CURRENT-SYSTEM-ANALYSIS.md, DESIGN-BRIEF.md, DATA-MODEL-CORRECTION-PLAN.md) | ~2,000 lines | Historical; SQLite-era |
| Planning/ideas | `docs/Plan-Ideas/PHASE-1/` (6 files, ~5,000 lines incl. competitor research), `PHASE-2/` (2 MasterPrompts) | | Historical; filenames still say `SchoolPortal` |
| Sprint plans/specs | `docs/superpowers/plans/` (~45 plans), `specs/` (23) | ~90k lines | Historical build artifacts (tool-managed by the brainstorming/writing-plans workflow) |
| Database docs | `docs/database/` (`data-model-design.md` 534, `full-data-model-audit.md` 308, `migration-plan.md` 148, `seed-data.ts`, `seed-expanded.ts`) | | Living-but-lagging; `.ts` files are code inside docs |
| API | `docs/api/` (Postman collection + local env) | 2 JSON | Only API artifact; unverified against 41 controllers |
| Visual references | `docs/UI-Screenshots/` (47 MB, `archive/` + `sample4/`), `docs/wireframe/` (2.8 MB incl. zips), `docs/timetable-samples/` (3 images) | | Reference assets, not documentation |
| Sub-project READMEs | `backend/README.md` (NestJS boilerplate), `staff-console/README.md` (Vite boilerplate), `parent-app/README.md` ("A new Flutter project") | | **Template boilerplate — zero project content** |
| CI | `.github/workflows/ci.yml` | 3 jobs | Accurate; backend lint is `continue-on-error` |
| Absent | CHANGELOG, LICENSE, SECURITY.md, CONTRIBUTING, Dockerfile/compose, deploy config, `.env.example` for staff-console/parent-app, runbooks | — | Missing |

### 2.3 Implementation facts gathered (evidence for later phases)
- **Roles:** `enum Role { SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, ACCOUNTS, PARENT }`. **No PRINCIPAL role and no
  STUDENT role.** Principal = `User.isPrincipal = true` on a `SCHOOL_ADMIN` (`dashboard.controller.ts:33-34`; router
  `requiresPrincipal`). `EmployeeType` also has a `PRINCIPAL` value (staff record classification — a different concept).
  No student login was found (students exist only as records; parents log in). Login accepts email **or GR number**.
- **Auth:** Passport-JWT + argon2, access/refresh tokens, refresh **rotation-on-use with revocation**, 5-attempt
  lockout, `mustChangePassword`, password-reset via email token, `@Public()`/`@Roles()` guards, `ThrottlerGuard`
  global (`app.module.ts:92`) with per-route `@Throttle` on auth.
- **Tenancy:** `schoolId`/`campusId` on `User`; `OrgScopeService`, `StudentAccessService`, `FilesAccessService`;
  e2e `cross-tenant-boundary`, `sections-access`, `cascade-delete-restrictions`. PROJECT-STATUS documents 4 endpoints
  **still unscoped** (`academic-sessions`, `terms`, `subjects`, `fee-structures`) because the schema has no
  school path. `AcademicSession` is effectively global.
- **Modules present (`backend/src/`):** academic-session, admissions, ai-drafting, attendance, attendance-risk, auth,
  bulk-import, campus, circulars, class, common, complaints, config, dashboard, diary, enrollment, fees, files,
  gradebook, hiring, holidays, leave, me, messages, notifications, parent, prisma, promotions, report-cards, school,
  sections, staff, storage, student, subjects, teacher, teachers, timetable.
- **Integrations (all adapter-based, dev fallbacks):** JazzCash + EasyPaisa (+stub webhook), FCM push, SMTP mail
  (falls back to logging adapter), SMS, WhatsApp, Anthropic AI drafting (stub fallback), storage = **`LocalDiskStorageAdapter`
  only** (no S3 adapter exists), digest bundling. PROJECT-STATUS itself states none is live-verified.
- **Scheduled jobs:** two in-process `@Cron` jobs (`attendance-risk.job.ts`, `digest-dispatch.job.ts`) — no external queue.
- **Staff console:** Vue Router with `requiresRole` meta (+`requiresPrincipal`), Pinia `auth` store, route groups
  `/teacher/*`, `/admin/*`, `/principal/*`; `en.json`/`ur.json`.
- **Parent app:** Flutter; screens for home, calendar, circulars, fees/voucher/stub checkout, messages, notifications,
  leave, complaints, report cards, student info, login/forgot/reset; offline last-response cache; FCM token registrar.
- **Not present (grep):** `helmet`/security headers, health/readiness endpoint, Swagger/OpenAPI, structured logger,
  metrics/error tracking, S3 storage, Dockerfile, Next.js parent web portal (PROJECT-STATUS calls it an "active
  greenfield track, not yet started" — **PLANNED, no code**).
- **Seed:** `backend/prisma/seed.ts` still generates `@schoolportal.local` identifiers and DB name `schoolportal`
  (rebrand memory: intentionally excluded), while PROJECT-STATUS text references `parent-a@schoolos.edu.pk` — an older seed.

---

## 3. Repository Documentation Inventory

Legend — **Disp:** KEEP · REWRITE · MERGE→X · ARCHIVE · DELETE? (delete only with approval) · **Canon:** canonical for that topic.
"Verify" = must be checked against code in Phase 1A before final disposition. All ARCHIVE/DELETE = `HUMAN DECISION REQUIRED`.

| Document | Purpose | Current? | Accurate? | Duplicate? | Conflicts | Disp | Canon |
|---|---|---|---|---|---|---|---|
| `README.md` | Entry point | Partly | Partly (Principal-as-role, seed-table bloat, stale doc links) | Overlaps PROJECT-STATUS | Role list vs `Role` enum; `plan/docs` "original MVP plan" | **REWRITE (Ph 2)** | **Yes — entry/nav** |
| `PROJECT-STATUS.md` | Build log + status | Partly | Mixed; missing 6 subsystems; SQLite item stale | Overlaps tracker/roadmap | Sprint 11-12 "SQLite→Postgres pending"; "Next.js portal" | **REWRITE→ short status page; move log to `docs/archive/`** | Status: yes (after rewrite) |
| `MASTER-PROMPT-TRACKER.md` | Validation checklist vs a 2026-09-12 master prompt | Partly | Broken links; sprint table stale | Yes (with PROJECT-STATUS) | Path to roadmap wrong | **MERGE→ status + ARCHIVE** | No |
| `progress.md` | Access-control scoping status | Partly | Partly (says 4 endpoints deferred — still true) | Yes (duplicated in PROJECT-STATUS "Teacher Subject… Scoping") | — | **MERGE→ security docs (known-gaps) + ARCHIVE** | No |
| `DESIGN.md` | Design system spec v2.0.0 | Yes | Verify vs `assets/base.css` + `MASTER.md` | Overlaps `MASTER.md`, Figma | Resolved (memory) | **KEEP** | **Yes — design** |
| `staff-console/design-system/…/MASTER.md` | Token/master spec | Verify | Verify | Overlaps DESIGN.md | Verify | KEEP or MERGE→DESIGN.md (Ph 1A decides) | Verify |
| `docs/Figma/*` (5) | Aug-2026 Figma handoff | No | Pre-rebrand/pre-redesign | Overlaps DESIGN.md | Tokens vs DESIGN.md | **ARCHIVE** (historical) | No |
| `docs/audit/2026-09-18-ui-design-system-audit/` (5) | UI audit | Yes | Yes (dated) | — | — | **KEEP (dated audit)** | Audit record |
| `docs/wireframe/` | MVP wireframes | No | Pre-build | zips duplicate folders | — | **ARCHIVE**; zips DELETE? | No |
| `docs/UI-Screenshots/` (47 MB) | Screenshot refs | Partly | n/a | `archive/` vs `sample4/` overlap | — | **KEEP `sample4`, ARCHIVE `archive`**; evaluate size | No |
| `docs/timetable-samples/` | 3 images | No | n/a | — | — | ARCHIVE (fold into design-reference) | No |
| `docs/database/data-model-design.md` | Model design (living) | Partly | Verify vs 57 models/13 migrations | Overlaps audit | — | **REWRITE→ verified data model (Ph 7)** | **Yes — DB** (after verify) |
| `docs/database/full-data-model-audit.md` | Phase-1 audit | No (refs 6 migrations) | Historical | — | — | ARCHIVE | No |
| `docs/database/migration-plan.md` | Migration strategy | Partly | Verify | Overlaps design doc | — | MERGE→ DB docs | No |
| `docs/database/seed-data.ts`, `seed-expanded.ts` | Code in docs | No | Diverge from `backend/prisma/seed.ts` | **Yes** | Diverged from worktree copy too | **DELETE?/ARCHIVE** | No |
| `docs/api/*.json` | Postman | Verify | Verify vs controllers | — | — | KEEP; verify (Ph 7) | Supplementary |
| `plan/docs/PRD.md`, `PRD.txt` | Original PRD | No | 5-app vision cut | PRD.md≈PRD.txt | Scope vs reality | **ARCHIVE** (dedupe .txt) | No |
| `plan/docs/FEATURES.txt` | FEAT-001..014 | Partly | IDs referenced across trackers | — | — | **ARCHIVE but preserve IDs** (see risk R6) | Feature-ID origin |
| `plan/docs/ARCHITECTURE.md`, `TECH-STACK.md` | Original arch/stack | No | **TECH-STACK says SQLite/Node 20** | vs README | **Contradicts code** | ARCHIVE; replaced Ph 6 | No |
| `plan/docs/CURRENT-SYSTEM-ANALYSIS.md` | Legacy-app teardown | Historical | — | — | — | ARCHIVE | No |
| `plan/docs/DESIGN-BRIEF.md` | Original brief | No | — | vs DESIGN.md | — | ARCHIVE | No |
| `plan/docs/DATA-MODEL-CORRECTION-PLAN.md` | Sprint 6.5 plan (SQLite) | No | Done work | Also in worktrees | — | ARCHIVE | No |
| `docs/Plan-Ideas/PHASE-1/*` (6) | Audits/roadmap/competitors | No | `SchoolPortal-*` names, pre-build audit | Repo-audit vs current | Roadmap checklist stale | **ARCHIVE**; roadmap checklist facts → status | No |
| `docs/Plan-Ideas/PHASE-2/*` | Master prompts | No | — | — | — | ARCHIVE | No |
| `docs/superpowers/plans/*` (~45) | Sprint plans | Historical | Not truth | — | — | **KEEP in place** (tool-managed; mark HISTORICAL in index) | No |
| `docs/superpowers/specs/*` (23) | Sprint designs | Historical | Sources for rules (verify) | — | — | **KEEP in place**; mine for business rules | Input only |
| `docs/production-readiness/raw-plan-…md` | Your Phase-0 brief | Yes | — | — | — | KEEP until Ph 12; then archive | No |
| `backend/README.md`, `staff-console/README.md`, `parent-app/README.md` | Boilerplate | — | Wrong (template text) | — | — | **REWRITE (short, real)** (Ph 2) | Per-app quickstart |
| `.github/workflows/ci.yml` | CI | Yes | Yes | — | Documents "~672 Prettier errors" | KEEP (source of truth for CI) | Config |
| `.claude/worktrees/*`, `.worktrees/` | Scratch | No | Diverged copies | **Yes** | — | **Out of scope; prune (HUMAN DECISION)** | No |

Full per-file table for the ~68 superpowers files and screenshot subfolders is deliberately deferred to Phase 1A
(generated as the disposition manifest, not hand-typed here).

---

## 4. Documentation Problems

**A. Obsolete** — `plan/docs/TECH-STACK.md` (SQLite, Node 20), `ARCHITECTURE.md` (`plan/state/`),
`docs/database/full-data-model-audit.md` (six migrations; there are 13), `seed-*.ts` under `docs/`,
`docs/Figma/*` tokens, Sprint 11-12 checklist items in PROJECT-STATUS.

**B. Future plan presented as fact** — PROJECT-STATUS header: "a greenfield Next.js/React/Tailwind parent web
portal" (no code exists); README "Deployment readiness" implies near-ready while storage is local-disk-only;
`plan/docs/PRD.md` five-app scope; FEATURES.txt FEAT-014 remaining (Play Store, security review).

**C. Duplicate** — 4 status trackers; DESIGN.md vs Figma vs `MASTER.md`; PRD.md vs PRD.txt; `docs/` copies inside
worktrees; seed copies in `docs/database/`; wireframe folders vs their `.zip`s; screenshot `archive/` vs `sample4/`.

**D. Conflicting**
| # | Claim | Reality (evidence) |
|---|---|---|
| D1 | README: roles "Teacher / School Admin / Accounts / Principal" | `Role` has 5 values; Principal is a flag (`isPrincipal`) on `SCHOOL_ADMIN` |
| D2 | TECH-STACK: SQLite | `datasource provider = "postgresql"`; CI uses postgres:16 |
| D3 | PROJECT-STATUS: "Switch datasource to PostgreSQL" pending | Done (baseline `20260908000000_postgres_baseline`) |
| D4 | Tracker → `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-…` | Real path `docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-…` |
| D5 | PROJECT-STATUS "Wire real S3-compatible storage" (implied planned) | Only `LocalDiskStorageAdapter`; no S3 adapter |
| D6 | PROJECT-STATUS: parent-a@schoolos.edu.pk login | Current seed uses `@schoolportal.local` patterns |
| D7 | Header: "three clients" incl. Next.js portal | Two clients exist |
| D8 | README seed section: fully-specified counts (1,600 students…) | Depends on `seed.ts` (verify) |
| D9 | Terminology: "SchoolPortal" in filenames/seed/DB name vs "SchoolOS" | Rebrand partially applied (some exclusions by design) |
| D10 | Roles user-stated (PRINCIPAL as role) vs code | Needs terminology decision (§26 G4) |

**E. Historical, worth keeping** — sprint plans/specs (design rationale), competitor research, Plan-Ideas gap
analysis, UI audit, wireframes/screenshots, DATA-MODEL-CORRECTION-PLAN (explains Enrollment design).

**F. Missing entirely** — see §7 target list: product, journey, roles matrix, feature catalog, business rules,
requirements, architecture, API reference, security, operations, testing, user guides, release, ADRs, glossary.

**G. Structural** — 147 KB single file is unreadable and un-diffable; sprint IDs (A–R, I/J/K, "Sprint 7-8") are
not a stable feature taxonomy; no doc has a status header.

---

## 5. Source-of-Truth Hierarchy

Ordering adjusted for this repo: **the migrations directory outranks `schema.prisma`** for *history*, but
`schema.prisma` outranks it for *current shape*; and **e2e tests outrank unit tests** for behavior because unit tests
here mock `PrismaService` (the plan docs say so).

| Rank | Source | Notes / how to use |
|---|---|---|
| 1 | **Running backend behavior**: controllers (routes, `@Roles`, `@Public`), services, DTOs/validation | Authoritative for behavior & permissions |
| 2 | **`schema.prisma` + `migrations/`** | Authoritative for data shape/constraints/onDelete |
| 3 | **e2e specs** (`backend/test/*.e2e-spec.ts`) | Proves behavior; a rule with no e2e is *unproven*, not false |
| 4 | **Unit specs** (mocked Prisma) | Evidence of intent, weaker than e2e |
| 5 | **Config**: `.env.example`, `app.module.ts`, `ci.yml`, `package.json` | Authoritative for env vars, required-vs-optional, versions |
| 6 | **Client code**: router `meta`, stores, Flutter router/screens | Authoritative for what UI exposes; **never** for security (server decides) |
| 7 | **Current docs post-Phase-1** (canonical set) | Only after verification |
| 8 | **Design docs**: `DESIGN.md` | Authoritative for UI *intent*; code wins on conflict |
| 9 | **Historical**: specs, plans, PROJECT-STATUS log | Rationale only; never proof of implementation |
| 10 | **Ideas/roadmap** | Never evidence |

**Rules.**
1. Docs describe implemented behavior only. Unimplemented → a separate "Roadmap" section with status `PLANNED`.
2. A claim needs a code/test citation (file path, optionally line) in the *source* column of tables it lives in.
3. Code vs. docs disagree → code wins; log conflict; if the *code* looks wrong → `CODE ISSUE DISCOVERED`, do not fix.
4. "Test passes" ≠ "works in production"; integrations are never PRODUCTION-READY without live verification evidence.
5. Numbers (test counts, model counts) are stamped with the date and command used to obtain them.

**Feature status vocabulary (used in tables):** `IMPLEMENTED` · `PARTIALLY IMPLEMENTED` · `CONFIGURATION REQUIRED` ·
`EXTERNAL SERVICE REQUIRED` · `STUB` · `PLANNED` · `NOT IMPLEMENTED` · `DEPRECATED` · `UNKNOWN`.

---

## 6. Documentation Cleanup Strategy

**Principles:** (1) inventory before action; (2) *nothing is deleted without approval* — default is `ARCHIVE` to
`docs/archive/` (git preserves history anyway); (3) moves use `git mv` so history follows; (4) after every
move, repair inbound links (grep-driven); (5) one commit per logical step, reviewable.

**Steps (Phase 1A → 1B):**
1. Snapshot: tag `docs-pre-cleanup` (HUMAN gate before tagging/pushing).
2. Generate the **Disposition Manifest** (`docs/archive/CLEANUP-MANIFEST.md`, a Phase-1A output): one row per doc
   with the §3 columns for *every* file, including all superpowers files.
3. Verify each "Verify" cell against code (spot-check, evidence quoted).
4. Human approves/edits manifest → **Gate G1**.
5. **1B**: execute approved moves/merges; write `docs/README.md` (documentation index + status legend + rules);
   shrink `PROJECT-STATUS.md` (log → `docs/archive/project-status-build-log.md`; live page ≤ ~150 lines: what
   exists, subsystem status table, known gaps, pointer to release docs); fold `MASTER-PROMPT-TRACKER.md` and
   `progress.md` into it / security-known-gaps; fix all broken links; add stale-banner to anything kept but
   historical.
6. Link check: script/grep verifies zero broken relative links among non-archived docs.

**What Phase 1 must NOT do:** edit code/tests/schema; rewrite README (that's Phase 2); author new product/architecture
docs; delete unapproved files; touch `docs/superpowers/**` content (index it only).

**Special handling**
- `docs/superpowers/plans|specs`: **keep in place** (workflow tooling writes there — moving them breaks the
  brainstorming/writing-plans convention). Add an index file marking them `HISTORICAL`.
- `plan/docs/FEATURES.txt`: FEAT-IDs are cited by trackers and code comments; archive **with a redirect stub** or keep
  path until the Feature Catalog (Ph 3) maps every FEAT-ID → current feature.
- Large binaries (`UI-Screenshots` 47 MB, zips): HUMAN DECISION whether to keep in git, move to Git LFS, or drop.

---

## 7. Proposed Final Documentation Architecture

Adapted to the repo: minimal renames, no new concept duplicated, tool-managed folders untouched.

```text
README.md                       ← canonical entry & navigation (Ph 2)
CHANGELOG.md                    ← from release history (Ph 12)   [new]
SECURITY.md                     ← vuln reporting stub (Ph 8)     [new; HUMAN: contact]
LICENSE                         ← HUMAN DECISION (currently UNLICENSED in package.json)
PROJECT-STATUS.md               ← REWRITTEN short live status (Ph 1B)
DESIGN.md                       ← KEEP canonical design
backend/README.md               ← real quickstart (Ph 2)
staff-console/README.md         ← real quickstart (Ph 2)
parent-app/README.md            ← real quickstart (Ph 2)
docs/
├── README.md                   ← doc index + status legend + source-of-truth rules (Ph 1B)
├── PLAN-DOCUMENTATION-PRODUCTION-READINESS.md   ← this file (KEEP as program record)
├── product/                    ← overview, personas, ROLE-MATRIX, FEATURE-CATALOG, BUSINESS-RULES, GLOSSARY, requirements/
├── workflows/                  ← PRODUCT-JOURNEY + per-lifecycle docs (Ph 4)
├── architecture/               ← system, backend, staff-console, parent-app, data, security, integrations
├── decisions/                  ← ADRs (only genuine decisions, §16)
├── api/                        ← API-OVERVIEW + endpoint reference + Postman (existing) (Ph 7)
├── database/                   ← KEEP folder: DATA-MODEL (rewritten), DATA-DICTIONARY, migrations & seed strategy
├── security/                   ← Ph 8
├── operations/                 ← Ph 9 (env vars, deploy, backup/restore, monitoring, runbooks, integrations)
├── testing/                    ← STRATEGY, TEST-MATRIX, RELEASE-VALIDATION (Ph 10)
├── user-guides/                ← per implemented role (Ph 11)
├── release/                    ← readiness assessment, checklists, notes (Ph 12)  ← absorbs `production-readiness/`
├── design-reference/           ← RENAME candidate: Figma (archived), wireframe, UI-Screenshots, timetable-samples
├── audit/                      ← KEEP as dated audits (existing UI audit; later readiness/doc audits)
├── superpowers/                ← KEEP IN PLACE (tool-managed; HISTORICAL)
└── archive/                    ← plan/docs, Plan-Ideas, status build log, stale DB docs, Figma, tracker files
```

**Folder decisions** (all `HUMAN DECISION REQUIRED` at G1/G2):
| Folder | Decision | Reason |
|---|---|---|
| `docs/superpowers/` | KEEP in place | Workflow-managed; not truth |
| `docs/database/` | KEEP + rewrite contents | Correct concept name already exists |
| `docs/api/` | KEEP + extend | Already holds Postman |
| `docs/audit/` | KEEP | Dated audits fit the concept |
| `docs/Figma/`, `wireframe/`, `UI-Screenshots/`, `timetable-samples/` | MERGE under `docs/design-reference/` (or leave, if renaming is refused) | Four folders, one concept; capitalisation inconsistent (`Figma`, `UI-Screenshots`) |
| `docs/Plan-Ideas/` | ARCHIVE → `docs/archive/plan-ideas/` | Historical |
| `plan/` (repo root, gitignored except `plan/docs`) | ARCHIVE `plan/docs` → `docs/archive/original-mvp-plan/`; remove `plan/` from root and `.gitignore` entry | Second doc tree at root is confusing |
| `docs/production-readiness/` | Fold into `docs/release/` at Ph 12 | Avoid duplicate concept |
| `docs/testing` vs `docs/release` | Kept separate: testing = how we test; release = go/no-go | |

Naming: UPPER-KEBAB for canonical docs; each canonical doc opens with the status header (§23).

---

## 8. README Strategy (Phase 2)

**Role:** the *entry point and index*, ≤ ~200 lines, no seed-data tables, no per-sprint history. Every claim
sourced from code; every link resolves.

| Section | Content rule |
|---|---|
| Title + one-paragraph overview | What SchoolOS is *today*: multi-school/multi-campus SIS; two clients + one API |
| Status badge line | `Pre-production` + link to `docs/release/PRODUCTION-READINESS.md` (Phase 12; until then link PROJECT-STATUS) |
| What it does today | Module list with status vocabulary (IMPLEMENTED / STUB / CONFIG REQUIRED); **no** planned features here |
| Applications | backend, staff-console, parent-app; explicitly **no student login, no parent web portal** |
| Roles | The 5 `Role` values + "Principal = SCHOOL_ADMIN with `isPrincipal`" (**pending gate G4**) |
| Architecture (1 diagram + 5 bullets) | Link to `docs/architecture/` |
| Tech stack table | Versions read from `package.json`/`pubspec.yaml` at execution time |
| Repo layout | Real tree incl. `docs/` map |
| Quick start | prerequisites → backend → staff console → parent app; commands **executed or verified against package.json scripts** |
| Configuration | Short env table for *required* vars only; link to `docs/operations/ENVIRONMENT.md` |
| Seed/demo accounts | Pattern + pointer; password via `SEED_PASSWORD`; **note actual domain used by seed** |
| Testing | Commands only; link testing docs |
| Integrations | One table: integration · status · needs credentials |
| Known limitations | Honest 6–10 bullets (local-disk storage; integrations unverified; 4 unscoped endpoints; no health/metrics; …) |
| Docs index | Links to each `docs/` area |
| Roadmap | ≤5 bullets, labelled PLANNED, link to release/roadmap doc |
| Contributing/License/Security | Only if files exist by then |

**Must remove/relocate from current README:** the ~60-line seed statistics, "Expanded data model" list (→ DATA-MODEL),
deployment-readiness paragraph (→ release docs), "original MVP plan" index entries.

**Also in Phase 2:** replace the three boilerplate sub-project READMEs with 20–40-line real quickstarts.

---

## 9. Product Documentation Strategy (Phase 3)

Files under `docs/product/`: `PRODUCT-OVERVIEW.md`, `PERSONAS-AND-ROLES.md` (contains ROLE-MATRIX),
`FEATURE-CATALOG.md`, `BUSINESS-RULES.md`, `GLOSSARY.md`.

- **Overview:** problem, users, two-client model, scope boundaries (what SchoolOS is *not*: no student login,
  no LMS, no HR/payroll — *verify each*), current maturity.
- **Glossary:** terms *as the code uses them* — GR number, B-Form, Campus vs School vs Branch, Section, Enrollment,
  Applicant vs Application, Hiring candidate, Voucher, Allocation, Term, Assessment category, `isPrincipal`.
  Seed data still says "grades/branches/schoolportal" → glossary fixes canonical terms (gate G4).
- Each doc opens with status header; each capability row uses the §5 status vocabulary.

## 10. Product Journey Strategy (Phase 4)

Deliverable: `docs/workflows/PRODUCT-JOURNEY.md` (map) plus lifecycle files only where real behavior exists.
Each step is mapped to actor · UI route · API · model · status. **Preliminary mapping (to be verified in Phase 4):**

| Journey step | Repo evidence found | Preliminary status |
|---|---|---|
| School / Campus setup | `school/`, `campus/`, `/admin/schools`, `/admin/campuses`, migration `extend_school_campus_profile`, org-provisioning plan (2026-09-19) | IMPLEMENTED (SUPER_ADMIN) — verify provisioning of principal users |
| Academic session | `academic-session/`, `/admin/academic-sessions` | IMPLEMENTED but **global, not school-scoped** (rule question Q1) |
| Classes / Sections / Subjects | `class/`, `sections/`, `subjects/` (subjects globally unique by `name`) | IMPLEMENTED; Subject global (Q2) |
| Staff & Hiring | `staff/`, `hiring/`, `/admin/staff`, `/admin/hiring/*` | IMPLEMENTED (no fully-verified status entry in PROJECT-STATUS) |
| Admissions | `admissions/` (Applicant→Application→decision→Student), `/admin/admissions/*` | IMPLEMENTED — verify |
| Student / Parent linking | `student/`, `parent/`, `StudentParent`, `ParentProfile`, student/parent profile views | IMPLEMENTED — verify guardian rules |
| Enrollment / Section assignment | `enrollment/`, `Enrollment` w/ status, roll no. | IMPLEMENTED |
| Timetable | `timetable/`, teacher/admin views | IMPLEMENTED |
| Daily attendance (+risk flags) | `attendance/`, `attendance-risk/` (cron) | IMPLEMENTED |
| Diary / homework / activities | `diary/` | IMPLEMENTED |
| Assessments / gradebook | `gradebook/` (terms, categories, assessments, marks) | IMPLEMENTED — verify grade calc |
| Report card | `report-cards/` — **teacher upload of a file**, not generated from marks (per tracker) | PARTIALLY IMPLEMENTED — verify |
| Fees / payments | `fees/`, JazzCash/EasyPaisa adapters, stub checkout | IMPLEMENTED + EXTERNAL SERVICE REQUIRED (not live-verified) |
| Communication | `circulars/`, `messages/`, `notifications/` (push/SMS/WhatsApp/email adapters) | IMPLEMENTED; channels EXTERNAL SERVICE REQUIRED |
| Leave / Complaints | `leave/`, `complaints/` | IMPLEMENTED |
| Session completion → Promotion | `promotions/`, `StudentPromotion`, `/admin/promotions`, Sprint R plan | IMPLEMENTED (no status entry) — verify |
| Historical record | `Enrollment` history, `StudentPromotion` | PARTIALLY — verify teacher/staff history (likely NOT IMPLEMENTED) |
| New academic session | session create only; rollover automation unknown | UNKNOWN |

Lifecycle documents (created only if evidence supports them): `STUDENT-LIFECYCLE.md`, `STAFF-LIFECYCLE.md`,
`ADMISSIONS.md`, `ACADEMIC-SESSION-LIFECYCLE.md`, `ATTENDANCE.md`, `ASSESSMENT.md`, `FEES.md`, `PARENT-JOURNEY.md`,
`COMMUNICATION.md`, `PROMOTION-AND-HISTORY.md`. Unimplemented steps appear in a "Not yet supported" block, never inline.

## 11. Workflow Documentation Strategy
Same location (`docs/workflows/`). Format: actor → precondition → steps (UI route + API call) → resulting state
changes → failure paths → authorization → tests covering it. Sequence diagrams as Mermaid text (renders on GitHub,
diffable). **One workflow doc per lifecycle, no duplicates of BUSINESS-RULES** — workflows *link* to rule IDs.

## 12. Role & Persona Documentation
Derived only from `@Roles(...)` decorators (counted: SCHOOL_ADMIN+SUPER_ADMIN 38 endpoints; TEACHER-inclusive groups;
7 SUPER_ADMIN-only; 4 PARENT-only), router `requiresRole`, service-level scoping (`OrgScopeService`,
`StudentAccessService`), and e2e specs.

`ROLE-MATRIX.md` columns: role · surface (staff-console / parent-app / none) · scope (platform / school / campus /
own sections / own children) · modules · C/R/U/D per module · approvals (admissions decision, leave, promotion) ·
reports/dashboards · restrictions · evidence file.

| Role | Preliminary note |
|---|---|
| SUPER_ADMIN | Platform-wide; creates schools/campuses/academic sessions; dashboard `SuperAdminDashboardView` |
| SCHOOL_ADMIN | School-scoped (and campus-scoped after 2026-09-19 provisioning) |
| **PRINCIPAL** | **Not a `Role`.** `isPrincipal` flag on SCHOOL_ADMIN unlocks `/principal/*` + `principal-academics-summary`. Also `EmployeeType.PRINCIPAL` on Staff (distinct). **Gate G4.** |
| ACCOUNTS | Fees/vouchers/payments; school-scoped |
| TEACHER | Scoped to assigned sections/subjects (`getTeacherSectionIds`), class-teacher semantics — verify |
| PARENT | Own children only (`/me/children`); Flutter app |
| STUDENT | **No role, no login** (verify in Phase 3; document as NOT IMPLEMENTED) |

## 13. Feature Catalog Strategy
`docs/product/FEATURE-CATALOG.md` — one row per feature, stable IDs `F-<AREA>-<nn>` (replaces Sprint-letter taxonomy;
includes a legacy column mapping FEAT-001..014 and Sprint A–R).

`Feature · Actor(s) · Rule IDs · Workflow doc · UI route/component · API endpoints · Models · Authz (roles+scope) ·
Tests (unit/e2e/ui) · Docs · Status · Evidence`

This *is* the traceability spine: later docs cite feature IDs. Built by walking `controllers → routes → views`
(generated inventory, then human-readable curation). Ambiguous rows are `UNKNOWN`, not guessed.

## 14. Business Rules Strategy
`docs/product/BUSINESS-RULES.md` — IDs `BR-<AREA>-<nn>`; each rule: statement · enforcement point
(`file:function`) · test evidence · status · source (code / decision needed).

Where rules live today (to mine in Phase 3): service methods (`enrollment`, `promotions`, `admissions`, `fees`,
`leave`, `gradebook`, `attendance`), DTO validators, Prisma constraints/`onDelete: Restrict`, `prisma-create-guard.ts` /
`prisma-delete-guard.ts`, `normalize-identifier.ts`, e2e specs, and `docs/superpowers/specs/*` (rationale).

**Rule questions already visible — must be `REQUIRES-DECISION`, not documented as requirements:**
- **Q1** `AcademicSession` global vs per-school; `findFirst({isActive:true})` in `StudentService.create()` (can pick wrong session).
- **Q2** `Subject` global catalog by unique name — intentional?
- **Q3** `FeeStructure`/`Term` school scoping (4 deferred endpoints).
- **Q4** Guardian limits/relationships, parent-login-by-GR semantics.
- **Q5** Promotion eligibility/grade-threshold rules (Sprint R) vs manual decision.
- **Q6** Report-card issuance: upload vs generated-from-marks.
- **Q7** Retention/deletion of student & staff records (privacy/legal) — no policy found.

## 15. Requirements Strategy (Phase 5)
`docs/product/requirements/`: `FUNCTIONAL-REQUIREMENTS.md`, `NON-FUNCTIONAL-REQUIREMENTS.md`,
`TRACEABILITY.md` (skeleton). FR derived from *implemented* features (IDs `FR-…` mapped to feature IDs) with
Given/When/Then acceptance criteria taken from existing e2e assertions where they exist; where none exist mark
`ACCEPTANCE: UNVERIFIED`. NFR: derived from observed config (throttling, lockout, token TTLs, i18n EN/UR/RTL,
accessibility work in Sprint J/Q, mid-range Android/offline cache) and marked ASPIRATIONAL where only stated in
the old PRD. **Planned FRs live in a separate "Backlog" doc; never mixed.** Traceability completed in Phase 10.

## 16. Architecture Documentation Strategy (Phase 6)
`docs/architecture/`: `SYSTEM-OVERVIEW.md`, `BACKEND.md` (module map, guards, common services, adapters, jobs),
`STAFF-CONSOLE.md` (routing/guards/stores/design-system layer/i18n/testing), `PARENT-APP.md` (state, cache, push,
theming, l10n), `DATA-ARCHITECTURE.md` (summary; details in `docs/database`), `SECURITY-ARCHITECTURE.md` (summary;
details in `docs/security`), `INTEGRATIONS.md` (adapter pattern).

**ADRs (`docs/decisions/`) — only decisions that are real, load-bearing, and evidenced.** Candidate list
(confirm at Gate G3; write *only* ones with clear evidence, otherwise mark as "retroactive, rationale from
spec X"):
1. Single NestJS backend serving both clients (README/ARCHITECTURE).
2. Principal as flag on SCHOOL_ADMIN rather than a Role.
3. Enrollment as dated history entity (Sprint 6.5).
4. Adapter pattern for storage/payments/push/SMS/mail/AI with dev fallbacks and fail-fast partial-config.
5. Additive-only migrations (documented in `migration-plan.md`).
6. Tenancy via `schoolId`/`campusId` + service-level scoping (no Postgres RLS — explicitly excluded in old plan).
7. PostgreSQL-only (SQLite → Postgres move).
8. In-process `@Cron` jobs rather than a queue.
9. Refresh-token rotation-on-use with hashed storage.
**Not ADRs:** UI polish sprints, per-feature designs (those stay in superpowers specs).

## 17. API Documentation Strategy (Phase 7)
No OpenAPI/Swagger exists (grep). Options for **HUMAN DECISION (G5):** (a) hand-written `docs/api/` Markdown generated
from controller scan, or (b) add `@nestjs/swagger` (that's a **code change → later phase, not documentation**). This plan
defaults to (a) and records (b) as a recommended engineering task.
Files: `API-OVERVIEW.md` (base path `/api/v1`, versioning = path prefix, auth header, error shape as observed —
ValidationPipe `whitelist+transform`, throttling 429), `AUTHENTICATION.md`, `AUTHORIZATION.md` (Roles + scoping
services), `ENDPOINTS.md` (generated table: method · path · roles · DTO · scope logic · e2e coverage), plus verify /
refresh the Postman collection against it. Pagination/filter/sort conventions documented **only as they actually
exist** (likely inconsistent — record as CODE ISSUE if so).

## 18. Database Documentation Strategy (Phase 7)
`docs/database/`: `DATA-MODEL.md` (rewritten from `data-model-design.md`, verified against 57 models/13 enums),
`DATA-DICTIONARY.md` (generated from `schema.prisma`: model → fields → types → nullability → relations → onDelete),
`ERD` (Mermaid, grouped by domain), `MIGRATIONS.md` (13 migrations: what each did; additive-only policy; deploy vs
dev; no down-migrations → rollback = restore), `SEEDING.md` (what `seed.ts` creates; dev-only; `SEED_PASSWORD`),
`TENANCY.md` (school/campus columns, which models have **no** tenant path — `AcademicSession`, `Subject`,
`FeeStructure`, `Term`), `HISTORY.md` (Enrollment, StudentPromotion, AuditLog; **staff/teacher history: verify—likely absent**).
Archive `full-data-model-audit.md`, `seed-*.ts`.

## 19. Security Documentation Strategy (Phase 8)
`docs/security/`: `SECURITY-OVERVIEW.md`, `AUTHN-AUTHZ.md`, `TENANT-ISOLATION.md`, `DATA-PROTECTION.md` (PII: CNIC,
B-Form, medical, addresses, documents), `HARDENING-CHECKLIST.md`, `KNOWN-GAPS.md` (absorbs `progress.md`),
plus root `SECURITY.md`. Every row classified: **Implemented · Partial · Configuration required · External
dependency · Missing · Unknown**, with evidence.

Preliminary classification from discovery (to be verified in Phase 8):
| Control | Prelim. | Evidence |
|---|---|---|
| Password hashing (argon2) | Implemented | `auth.service.ts` |
| JWT access/refresh, TTL env | Implemented / Config required (secrets `change-me` in example) | `.env.example`, `jwt-secret.ts` |
| Refresh rotation + revocation | Implemented | `auth.service.ts:123-129` |
| Account lockout | Implemented | FEAT-002 |
| Rate limiting | Partial (global throttler + auth routes; verify limits/proxy IP) | `app.module.ts`, `throttler.config.ts` |
| Input validation | Implemented (global ValidationPipe whitelist) | `main.ts` |
| CORS allow-list | Implemented / Config required | `cors.config.ts` |
| RBAC | Implemented | `@Roles` on controllers |
| Tenant/campus isolation | Partial (4 known unscoped endpoints; global AcademicSession) | `progress.md`, e2e `cross-tenant-boundary` |
| Object-level authz (students/files) | Implemented (services) — verify coverage | `StudentAccessService`, `FilesAccessService` |
| Audit logging | Partial (many services write AuditLog; not proven for all writes — README claims "state-changing endpoints") | grep list |
| Security headers | **Missing** | no `helmet` |
| CSRF | Likely N/A (bearer tokens) — verify token storage in staff-console (localStorage ⇒ XSS exposure) | `stores/auth.ts` |
| File upload security | Partial — verify size/type limits, path traversal, serving | `files.service.ts`, multer |
| Secrets management | Config required; no vault | env-only |
| Payment webhook auth | Config required (`PAYMENT_STUB_WEBHOOK_SECRET`, signer) | `.env.example` |
| Error leakage / logging of PII | Unknown | — |
| Dependency vulnerability scanning | Missing in CI | `ci.yml` |
| SQL injection | Implemented by construction (Prisma) — verify no raw queries | grep `$queryRaw` |
| Backup encryption / at-rest | External dependency | — |

## 20. Operations Documentation Strategy (Phase 9)
`docs/operations/`: `ENVIRONMENT.md` (every env var: required?/default/secret?/failure mode — derived from
`.env.example` **and** code reads of `process.env`), `DEPLOYMENT.md` (**no deploy target exists** — document required
topology + explicit `NOT IMPLEMENTED: no Dockerfile/IaC`), `DATABASE.md` (migrate deploy, rollback = restore),
`BACKUP-RESTORE.md`, `MONITORING-LOGGING.md` (as-is: Nest logger only; gaps), `RUNBOOKS.md` (login lockouts,
password-reset email not sent, payment webhook failures, cron jobs not firing, disk storage full), `SCHEDULED-JOBS.md`
(2 crons; single-instance assumption), `FILE-STORAGE.md` (local-disk, non-portable across instances),
`INTEGRATIONS.md` (§25), `SCALING.md` (constraints: in-process cron, local disk, no health probe).
**Rule:** anything not implemented (backups, alerting, DR) is written as a *requirement/recommendation with
`NOT IMPLEMENTED` status*, never as a procedure that pretends to exist.

## 21. Testing Documentation Strategy (Phase 10)
`docs/testing/`: `TESTING-STRATEGY.md`, `TEST-MATRIX.md` (feature ID → unit / e2e / UI / Flutter → last run), `RELEASE-VALIDATION.md`.
Facts to gather **by running, not by reading docs** (numbers in PROJECT-STATUS are historical claims):
`npm test`, `npm run test:e2e` (needs Postgres), `staff-console npm test`, `flutter test` → record counts + date.
Known: unit tests mock Prisma; e2e uses real Postgres; backend lint non-blocking in CI; no coverage threshold seen;
**no migration tests, no load/security/smoke tests found**; staff-console has axe-core (a11y) dev dep; e2e suite
includes authz/tenant specs (`cross-tenant-boundary`, `sections-access`, `rate-limiting`, `cors`).
Gaps (`Missing`): production smoke suite, migration up-from-N tests, dependency audit, security scanning, payment/FCM live tests.
Phase 10 also **completes the requirement traceability matrix**.

## 22. User Guide Strategy (Phase 11)
Guides only for real, verified flows; task-oriented, screenshot-optional (reuse `docs/UI-Screenshots/sample4` where current).

| Guide | Create? | Basis |
|---|---|---|
| `SUPER-ADMIN-GUIDE.md` | Yes | schools/campuses/sessions/provisioning |
| `SCHOOL-ADMIN-GUIDE.md` (incl. Principal section) | Yes | biggest surface (≈30 routes) |
| `ACCOUNTS-GUIDE.md` | Yes (small) | fees/vouchers/payments |
| `TEACHER-GUIDE.md` | Yes | attendance, diary, timetable, gradebook, complaints, report cards, messages |
| `PARENT-GUIDE.md` | Yes | Flutter app screens (EN/UR) |
| `STUDENT-GUIDE.md` | **No** (no student login) | — |
Each guide notes which features need external services configured (e.g. push, WhatsApp) so users aren't promised them.

## 23. Release Documentation Strategy & Document Status System

**Release docs (`docs/release/`, Phase 12):** `PRODUCTION-READINESS.md` (assessment, §24), `RELEASE-CHECKLIST.md`,
`MIGRATION-CHECKLIST.md`, `SMOKE-TESTS.md`, `ROLLBACK.md`, `KNOWN-ISSUES.md` (absorbs `CODE ISSUE DISCOVERED` log),
`CHANGELOG.md` (root; reconstructed from git tags/sprint history: *no version tags/changelog exist today*),
`RELEASE-NOTES-<ver>.md` template. Consolidates `MASTER-PROMPT-TRACKER.md` "Production-Ready Backlog" content and
the Sprint 11-12 pending items.

**Status system (lightweight — a 4-line header, not a workflow):** every canonical doc starts with

```markdown
> **Status:** CURRENT · **Verified:** 2026-MM-DD against `main@<sha>` · **Sources:** <paths> · **Owner:** <role>
```
- Doc-level values: `CURRENT` · `PARTIAL` · `HISTORICAL` · `DEPRECATED` · `ARCHIVED` · `REQUIRES-DECISION`.
- **Feature/control-level** values (inside tables): the §5 vocabulary (`IMPLEMENTED`, `STUB`, `PLANNED`, …).
- Archived docs get a one-line banner: `ARCHIVED <date> — superseded by <link>; do not treat as current.`
- No per-doc approval process, no version numbers except DESIGN.md/CHANGELOG. "Verified" date + commit is the whole mechanism.

---

## 24. Production Readiness Strategy

Assessment doc produced in Phase 12; this table is the *preliminary* read from discovery.
**Legend:** ✅ implemented in code · 📄 documentation-only gap · 🔧 engineering gap (needs code/infra) · ❓ unknown (verify) · 🔑 needs external credentials/service.

| Area | Item | Prelim. | Notes |
|---|---|---|---|
| Application | Core functionality across modules | ✅ | Wide; 22 e2e specs |
| | Authorization / validation | ✅ | Guards + ValidationPipe; 4 endpoints unscoped 🔧 |
| | Error handling | ❓ | No global exception filter seen; verify shape |
| | Auditability | ✅/❓ | AuditLog in many services; completeness unproven |
| Database | Migrations | ✅ | 13; additive; no rollbacks 📄 |
| | Backups / restore | 📄🔧 | Nothing documented or automated |
| | Indexing / constraints | ❓ | Review schema `@@index`; `onDelete: Restrict` used |
| | Historical records | ✅/🔧 | Enrollment/Promotion yes; staff/teacher history likely no |
| Security | AuthN/RBAC | ✅ | |
| | Tenant isolation | 🔧 | Global AcademicSession/Subject/FeeStructure/Term |
| | Security headers | 🔧 | No helmet |
| | Secrets | 📄🔧 | Example uses `change-me` |
| | Rate limiting | ✅/❓ | Verify behind proxy |
| | Dependency scanning | 🔧 | Not in CI |
| Infrastructure | Deployment (Docker/IaC/host) | 🔧📄 | None exists |
| | Health checks | 🔧 | None found |
| | Monitoring / logging / alerting | 🔧📄 | Default Nest logger only |
| | Scaling | 🔧 | In-process cron, local disk |
| Integrations | Payments (JazzCash/EasyPaisa) | 🔑 | Built to spec, never live-verified |
| | Push (FCM), SMS, WhatsApp, SMTP | 🔑 | Adapters exist; unverified |
| | Storage | 🔧 | Local disk only |
| | AI drafting | 🔑 | Optional; stub default |
| Testing | Unit/e2e/UI/Flutter | ✅ | Numbers must be re-measured |
| | Smoke / regression / security / load | 🔧 | Absent |
| Operations | Runbooks, incident response, DR, support | 📄🔧 | Absent |
| Release | Versioning, changelog, release process | 📄 | No tags/CHANGELOG |
| Legal/Privacy | License, PII retention, privacy policy | ❓ | `UNLICENSED`; student PII (CNIC, medical) stored |

**Output of Phase 12:** a go/no-go matrix with three lists — *Documentation gaps (closed by this program)*,
*Engineering gaps (not closed; each becomes a separate, explicitly authorized work item)*, *External blockers*.

## 25. External Integration Documentation
`docs/operations/INTEGRATIONS.md` (Phase 9), one section per integration with fixed fields: implementation
(adapter/file) · config vars · credentials needed · dev fallback · production dependency · webhooks · failure
handling · retry · monitoring · security · test strategy · **verification status** (never above `Sandbox-verified` without evidence).

| Integration | Code found | Prelim. status |
|---|---|---|
| JazzCash | `JazzCashAdapter`/`Signer`, `/payments` webhook | CONFIGURATION REQUIRED; not live-verified |
| EasyPaisa | adapter (field order unconfirmed per PROJECT-STATUS) | CONFIGURATION REQUIRED; **unverified hash order** |
| Payment stub | stub adapter + stub webhook (secret required outside dev/test) | STUB (dev only) |
| FCM push | `fcm-push.adapter.ts`, `device_tokens`, Flutter registrar | CONFIGURATION REQUIRED; logging no-op fallback in **all** envs |
| SMTP | `smtp-mail.adapter.ts` (fallback logs reset link) | CONFIGURATION REQUIRED |
| SMS / WhatsApp | `sms.adapter.ts`, `whatsapp.adapter.ts` + config | EXTERNAL SERVICE REQUIRED (provider unclear — UNKNOWN) |
| Anthropic AI drafting | `ai-drafting/` | EXTERNAL SERVICE REQUIRED; stub fallback |
| Object storage | only local disk | NOT IMPLEMENTED (S3) |
| Auth providers (SSO/OAuth) | none | NOT IMPLEMENTED |

---

## 26. Human Decision Gates

Marked `HUMAN DECISION REQUIRED`. Each phase prompt must **stop and ask** at its gates.

| Gate | Phase | Decision |
|---|---|---|
| **G0** | 0→1 | Approve this plan; approve/adjust phase order and deviations (§1) |
| **G1** | 1A→1B | Approve the Disposition Manifest: every ARCHIVE / MERGE / DELETE; worktree pruning; `docs/superpowers` stays; large-binary policy; git tag/branch for snapshot |
| **G2** | 1B | Folder renames (`design-reference/`, `archive/` layout, removal of root `plan/`, `.gitignore` edit) |
| **G3** | 2–3 | Product terminology (School vs Campus vs Branch; "grade" vs "class"; SchoolOS vs SchoolPortal residue), scope statement ("what SchoolOS is not") |
| **G4** | 3 | **Role definitions** — document Principal as flag-on-SCHOOL_ADMIN (code reality) vs propose as Role (would be code change → out of scope); STUDENT = none |
| **G5** | 3/5 | Business rules Q1–Q7 (§14): document as-is + flag, or decide intended behavior. **Docs may never invent the answer** |
| **G6** | 6 | Which ADRs to write; retroactive-ADR wording |
| **G7** | 7 | API docs approach (hand-written vs adding OpenAPI = engineering change) |
| **G8** | 8 | Security disclosure contact/policy; any statement that a control is "sufficient" |
| **G9** | 9 | Target hosting/environment to document (none exists) — document *requirements* or a chosen target |
| **G10** | 11 | Which roles get guides; screenshot inclusion (PII in screenshots?) |
| **G11** | 12 | License choice; changelog reconstruction baseline; "production-ready" claim wording |
| **G12** | 13 | Accept final audit; approve archive of `raw-plan-production-readiness.md`; list of engineering work items to spin off |

Also always requires approval: deleting any file, changing any product term, documenting uncertain behavior as
a requirement, promoting planned features into product docs, restructuring folders.

## 27. Phase Dependency Diagram

```text
PHASE 0  Discovery / Planning  (this document)                     ── G0
   │
PHASE 1A Inventory + Disposition Manifest (no moves)               ── G1
   │
PHASE 1B Cleanup execution + docs index + status-page shrink       ── G2
   │
PHASE 2  README + sub-project READMEs
   │
PHASE 3  Product foundation: overview, roles, features, rules, glossary   ── G3 G4 G5
   │
PHASE 4  Product journey & workflows
   │
PHASE 5  Requirements (FR/NFR/acceptance; trace skeleton)
   │
PHASE 6  Architecture + ADRs                                       ── G6
   │
PHASE 7  API & Database                                            ── G7
   │
PHASE 8  Security                                                  ── G8
   │
PHASE 9  Operations & Integrations                                 ── G9
   │
PHASE 10 Testing docs + COMPLETE traceability matrix
   │
PHASE 11 User guides                                               ── G10
   │
PHASE 12 Release & Production-readiness assessment                 ── G11
   │
PHASE 13 Final documentation audit                                 ── G12
```
Hard dependencies: 2←1B · 3←2 (terminology) · 4←3 (feature IDs, rule IDs) · 5←3,4 · 7←6 · 8←6,7 · 9←8 ·
10←5,7 · 11←4,10 · 12←8,9,10 · 13←all. Phases 6 & 7 could be parallelized by two people; run sequentially by default.

---

## 28. Detailed Phase Plan

**Shared inputs for every phase:** this plan; the previous phase's report; the code as the source of truth (§5).
**Shared exclusions:** application code, tests, schema, migrations, routes, APIs, UI, auth, `docs/superpowers/**` content.

### PHASE 0 — Discovery & Planning ✅ (this run)
Output: this file. Only file created. Validation: no other file changed (`git status` shows only
`docs/PLAN-…` and the pre-existing untracked `docs/production-readiness/`).

### PHASE 1A — Inventory & Disposition Manifest
- **Objective:** enumerate every doc-like artifact; classify; verify "Verify" cells; **no moves**.
- **Inputs:** §3, §4; git ls-files; grep for inbound links.
- **Creates:** `docs/archive/CLEANUP-MANIFEST.md`, `docs/archive/BROKEN-LINKS.md` (or a section). **Modifies:** nothing.
- **Claude tasks:** list all tracked docs (excluding node_modules, worktrees, uploads); one manifest row each; extract inbound-link map; quote conflict evidence (D1–D10); recommend disposition; flag `CODE ISSUE DISCOVERED`.
- **Human decisions:** G1.
- **Validation:** every tracked doc appears exactly once; every Verify cell resolved with cited evidence; no repo file changed except the manifest(s).
- **Completion:** manifest reviewed and approved. **Risks:** missing non-`.md` docs (PDF/HTML/JSON); size of superpowers set → summarize by group with a sample-verified note.
- **Expected output:** manifest + summary of counts by disposition.

### PHASE 1B — Cleanup Execution
- **Objective:** apply the approved manifest.
- **Creates:** `docs/README.md` (index, status legend, source-of-truth rules), `docs/archive/` tree, `docs/superpowers/README.md` (HISTORICAL index). **Modifies:** `PROJECT-STATUS.md` (shrunk), `.gitignore` (only if G2 approves). **Moves:** approved `git mv` list. **Archives:** trackers, plan/, Plan-Ideas, Figma, stale DB docs.
- **Claude tasks:** tag snapshot (if approved); `git mv`; add archive banners; write PROJECT-STATUS summary (each subsystem status from **code**, not the old log); merge unique content of MASTER-PROMPT-TRACKER/progress.md into status/`docs/security/KNOWN-GAPS` seed (or record for Phase 8); fix links; run link check.
- **Validation:** link check = 0 broken among non-archived; `git diff --stat` shows only docs; `git status` clean of code changes; every archived file has banner; nothing deleted that wasn't approved.
- **Risks:** breaking references from code comments/CI (grep `plan/docs`, `PROJECT-STATUS` in `src`/`.github`); losing FEAT-ID references (R6).

### PHASE 2 — README & Entry Points
- **Creates/modifies:** `README.md` (rewrite), `backend|staff-console|parent-app/README.md` (rewrite). **Sources:** package.json scripts, `.env.example`, `ci.yml`, router, `Role` enum.
- **Tasks:** write per §8; actually run/verify quickstart commands where the environment allows (or mark UNVERIFIED with reason); status table only with §5 vocabulary.
- **Validation:** every command matches a real script; every link resolves; every "IMPLEMENTED" claim cites a module; no planned feature outside Roadmap/limitations; README ≤ ~250 lines.
- **Risks:** stale numbers; over-claiming readiness.

### PHASE 3 — Product Foundation
- **Creates:** `docs/product/{PRODUCT-OVERVIEW,PERSONAS-AND-ROLES,FEATURE-CATALOG,BUSINESS-RULES,GLOSSARY}.md`.
- **Tasks:** generate controller/route/view inventories → feature catalog with stable IDs and legacy FEAT/Sprint map; role matrix from `@Roles` + services + e2e; rules with enforcement citations; Q1–Q7 register.
- **Human decisions:** G3, G4, G5.
- **Validation:** every controller and every router entry maps to ≥1 feature row (script-checked); every role cell cites evidence; zero rule without citation or `REQUIRES-DECISION`.
- **Risks:** inventing rules; conflating flags with roles.

### PHASE 4 — Product Journey & Workflows
- **Creates:** `docs/workflows/PRODUCT-JOURNEY.md` + lifecycle docs per §10/§11.
- **Validation:** every journey step has status + evidence; not-implemented steps isolated; each workflow cites feature IDs/rule IDs (no restated rules).
- **Risks:** narrating intended flows; promotion/history claims beyond `StudentPromotion`.

### PHASE 5 — Requirements
- **Creates:** `docs/product/requirements/*`. **Validation:** every FR maps to a feature ID; every acceptance criterion cites a test or is flagged UNVERIFIED; NFRs distinguish observed vs aspirational.

### PHASE 6 — Architecture & ADRs
- **Creates:** `docs/architecture/*`, `docs/decisions/ADR-*.md` (approved list).
- **Tasks:** module dependency map from `*.module.ts`; guard/decorator chain; adapter registry; client architectures; Mermaid diagrams.
- **Validation:** diagram nodes exist as real modules/dirs; ADR evidence cited; Not-implemented items labelled.

### PHASE 7 — API & Database
- **Creates:** `docs/api/*.md`, `docs/database/{DATA-MODEL,DATA-DICTIONARY,MIGRATIONS,SEEDING,TENANCY,HISTORY}.md`; **modifies:** Postman collection only if G7 and only for documentation accuracy (else record diff).
- **Validation:** endpoint count equals controller scan; model/enum count equals `schema.prisma` (57/enums); each migration described; unscoped-model list matches code.

### PHASE 8 — Security
- **Creates:** `docs/security/*`, root `SECURITY.md`. **Validation:** every control classified with evidence; no "secure" adjectives without evidence; `CODE ISSUE DISCOVERED` list handed to Phase 12.

### PHASE 9 — Operations & Integrations
- **Creates:** `docs/operations/*` (§20, §25). **Validation:** env-var table equals union of `.env.example` and `process.env` reads (scripted diff); each integration has all fields; unimplemented ops capabilities are labelled.

### PHASE 10 — Testing & Traceability
- **Creates:** `docs/testing/*`; **modifies:** requirements `TRACEABILITY.md` (completed).
- **Tasks:** run suites (needs Postgres) and record counts/date/commit; map spec files → features; list gaps.
- **Validation:** every feature has a test row (or an explicit "no test"); numbers reproducible via listed commands.

### PHASE 11 — User Guides
- **Creates:** guides per §22. **Validation:** every step navigable via a real route/screen; dependent-integration warnings present; no Student guide.

### PHASE 12 — Release & Production Readiness
- **Creates:** `docs/release/*`, `CHANGELOG.md`, (LICENSE only if G11 decides). Folds `docs/production-readiness/`.
- **Validation:** every §24 row has a final classification (✅/📄/🔧/🔑/❓→resolved) with evidence; go/no-go stated.

### PHASE 13 — Final Audit
- **Creates:** `docs/audit/<date>-documentation-audit.md`. **Tasks:** re-run link check; sample-verify ≥ N claims per doc against code; confirm status headers; confirm no orphan docs; confirm README index complete; produce open-items list.
- **Validation:** §33 Definition of Done satisfied.

---

## 29. Required Claude Prompt for Each Phase

**How to use:** paste the **Standing Rules Block (29.0)** first, then the phase prompt. Each phase prompt states
"DO NOT EXECUTE ANY OTHER PHASE." explicitly.

### 29.0 Standing Rules Block (prefix for every phase)
```text
You are working on the SchoolOS repository (git root = D:\Zain\Projects\SchoolApp\build).
Read docs/PLAN-DOCUMENTATION-PRODUCTION-READINESS.md first, and the previous phase's report.

STANDING RULES
1. Source of truth = code (Plan §5). Docs describe what is IMPLEMENTED. Never document planned
   functionality as implemented. Never treat a document or a passing test as proof of production readiness.
2. Inspect the repository BEFORE writing. Cite file paths for every factual claim.
3. NON-DESTRUCTIVE: do not modify application code, tests, schema, migrations, routes, APIs, UI,
   authentication or authorization. If you find a code problem, record it as `CODE ISSUE DISCOVERED`
   (file, evidence, impact) and DO NOT fix it.
4. Do not delete anything. Archive only what was approved. Use `git mv`. Ignore `.claude/worktrees/`,
   `.worktrees/`, `node_modules/`, `backend/uploads/`, `dist/`.
5. Use the status vocabulary (Plan §5, §23). Unknown = UNKNOWN, undecided = REQUIRES-DECISION. Do not invent
   features, roles, permissions or business rules.
6. Stop at every `HUMAN DECISION REQUIRED` gate listed for this phase and ask; do not assume an answer.
7. Make ONLY this phase's changes. Do not jump ahead. Do not create files that belong to a later phase.
8. When finished, validate against this phase's validation list, then report:
   files changed · files created · files archived/moved · claims marked UNKNOWN · CODE ISSUES DISCOVERED ·
   unresolved questions · validation results. Then STOP. Do not commit unless told to.
```

### PHASE 1A PROMPT — Inventory & Disposition Manifest
```text
[Paste Standing Rules Block]
PHASE 1A — Documentation Inventory. Previous output: PLAN (Phase 0), approved at Gate G0.
Task: enumerate EVERY tracked documentation artifact (md, txt, json docs, html, pdf, ts-in-docs, images grouped by
folder) and produce docs/archive/CLEANUP-MANIFEST.md with columns: Document | Purpose | Current? | Accurate? |
Duplicate of | Conflicts (cite code) | Disposition (KEEP/MERGE→x/REWRITE/ARCHIVE/DELETE?) | Canonical for | Inbound links.
Resolve every "Verify" cell in Plan §3 with quoted evidence. Resolve conflicts D1–D10 with evidence.
Also record: broken relative links, docs referenced by code/CI, worktree/scratch dirs, large binaries.
Only create the manifest (and, if useful, a BROKEN-LINKS section inside it). MOVE, EDIT and DELETE NOTHING.
Stop for Gate G1 (approval of all ARCHIVE/MERGE/DELETE, worktree pruning, binary policy, snapshot tag).
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 1B PROMPT — Cleanup Execution
```text
[Paste Standing Rules Block]
PHASE 1B — Documentation Cleanup. Inputs: the APPROVED docs/archive/CLEANUP-MANIFEST.md (with my edits), Plan §6–§7.
Execute exactly the approved dispositions with `git mv`; add the ARCHIVED banner to every archived file; create
docs/README.md (index, status legend, source-of-truth rules) and docs/superpowers/README.md (HISTORICAL index only —
do not edit plan/spec contents); rewrite PROJECT-STATUS.md as a short live status page derived from CODE, moving the
old log to the archive; merge/absorb MASTER-PROMPT-TRACKER.md and progress.md per manifest; repair all broken links;
re-run the link check. Do NOT rewrite README.md (Phase 2), do NOT write product/architecture/other new docs.
Gate G2 before any folder rename or .gitignore change.
Validate: 0 broken links outside archive; git diff touches docs only; no unapproved deletions; every archived file bannered.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 2 PROMPT — README & Entry Points
```text
[Paste Standing Rules Block]
PHASE 2 — README. Inputs: Phase 1B report, canonical docs index, Plan §8.
Rewrite README.md and the three sub-project READMEs from CODE ONLY (package.json scripts, .env.example, ci.yml,
Role enum, router, modules). Follow the Plan §8 section table; README is an entry/navigation doc (≤ ~250 lines);
remove seed statistics and sprint history; add honest Known Limitations and production-readiness status (link only
to docs that exist; mark future docs as PLANNED). Verify each quickstart command against scripts (run where possible,
else mark UNVERIFIED). Do not create product/architecture/etc. docs.
Validate: commands real, links resolve, no planned feature presented as implemented, roles match the Role enum.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 3 PROMPT — Product Foundation
```text
[Paste Standing Rules Block]
PHASE 3 — Product docs. Inputs: Phase 2 report, Plan §9, §12–§14.
Create docs/product/{PRODUCT-OVERVIEW,PERSONAS-AND-ROLES,FEATURE-CATALOG,BUSINESS-RULES,GLOSSARY}.md.
Build the feature catalog by scanning controllers -> router -> views (stable IDs F-<AREA>-<nn>, legacy FEAT/Sprint map).
Build the role matrix from @Roles + scoping services + e2e; document Principal per the G4 decision; verify no student login.
Build BUSINESS-RULES.md with enforcement citations; put Q1–Q7 and any new unclear rule under REQUIRES-DECISION.
Stop at G3/G4/G5 for terminology, role definitions and rule decisions. Do not write journey/requirements docs.
Validate: every controller & route mapped; every rule cited or flagged; no invented rule/role/permission.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 4 PROMPT — Product Journey & Workflows
```text
[Paste Standing Rules Block]
PHASE 4 — Journey. Inputs: Phase 3 docs (feature/rule IDs), Plan §10–§11.
Create docs/workflows/PRODUCT-JOURNEY.md and only those lifecycle docs that real behavior supports. Map every journey step
(School…New Academic Session) to actor, route, API, model, status and evidence; isolate unsupported steps in a
"Not yet supported" section. Link rules by ID; do not restate them.
Validate: every step has status+evidence; unimplemented behavior never in the main flow.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 5 PROMPT — Requirements
```text
[Paste Standing Rules Block]
PHASE 5 — Requirements. Inputs: Phase 3–4 outputs, Plan §15.
Create docs/product/requirements/{FUNCTIONAL-REQUIREMENTS,NON-FUNCTIONAL-REQUIREMENTS,TRACEABILITY}.md.
FRs only for IMPLEMENTED features with acceptance criteria drawn from existing tests (else UNVERIFIED). NFRs separate
observed config from aspirational. TRACEABILITY = skeleton with test/API/DB columns left for Phases 7 and 10.
Planned requirements go to a separate backlog section. Validate: each FR -> feature ID; no planned item in FR list.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 6 PROMPT — Architecture & ADRs
```text
[Paste Standing Rules Block]
PHASE 6 — Architecture. Inputs: Phase 5 report, Plan §16.
Create docs/architecture/* (system, backend, staff-console, parent-app, data, security, integrations summaries) with Mermaid
diagrams derived from *.module.ts, guards, router, Flutter router. Propose the ADR candidate list from Plan §16; stop at G6;
then write only approved ADRs in docs/decisions/ (Context, Decision, Evidence, Consequences, Status).
Validate: every diagram node exists in code; ADR claims cite evidence.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 7 PROMPT — API & Database
```text
[Paste Standing Rules Block]
PHASE 7 — API & DB. Inputs: Phase 6 report, Plan §17–§18.
Create docs/api/{API-OVERVIEW,AUTHENTICATION,AUTHORIZATION,ENDPOINTS}.md from a controller scan; document conventions only as
they exist (record inconsistencies as CODE ISSUE DISCOVERED). Verify the Postman collection against ENDPOINTS.md (report
diff; edit only with G7 approval). Rewrite docs/database/DATA-MODEL.md, add DATA-DICTIONARY, MIGRATIONS, SEEDING, TENANCY,
HISTORY from schema.prisma, migrations, seed.ts. Complete the API/DB columns of TRACEABILITY.md.
Validate: endpoint/model/enum counts equal code; all 13 migrations described; unscoped-model list matches code.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 8 PROMPT — Security
```text
[Paste Standing Rules Block]
PHASE 8 — Security docs. Inputs: Phases 6–7, Plan §19.
Create docs/security/* and root SECURITY.md (contact = G8). Inspect actual code/config for every control in Plan §19 and
classify: Implemented / Partial / Configuration required / External dependency / Missing / Unknown, with file evidence.
Do NOT fix anything and do NOT declare the system "secure". Absorb progress.md content into KNOWN-GAPS.md.
Validate: each control has classification + evidence; every Missing/Partial is listed as CODE ISSUE DISCOVERED.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 9 PROMPT — Operations & Integrations
```text
[Paste Standing Rules Block]
PHASE 9 — Operations. Inputs: Phase 8 report, Plan §20, §25.
Create docs/operations/*. Build ENVIRONMENT.md from the union of .env.example and every process.env read (show required/
default/secret/failure mode). Document each integration with all fixed fields and a verification status that is never
above what evidence supports. Where operations capability does not exist (deploy target, backups, alerting, health checks,
DR), state NOT IMPLEMENTED and write requirements/recommendations, not procedures. Stop at G9.
Validate: env-var diff script clean; every integration complete; no fictional procedure.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 10 PROMPT — Testing & Traceability
```text
[Paste Standing Rules Block]
PHASE 10 — Testing. Inputs: Phases 5, 7 and 9, Plan §21.
Create docs/testing/{TESTING-STRATEGY,TEST-MATRIX,RELEASE-VALIDATION}.md. RUN the suites (backend unit, backend e2e with
Postgres, staff-console, flutter) and record counts, date and commit — do not copy numbers from old docs. If a suite
cannot run, say so and why. Map spec files to feature IDs; list missing categories (smoke, migration, security, load).
Complete TRACEABILITY.md. Do not add or change tests.
Validate: every feature has test rows or an explicit "none"; numbers reproducible.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 11 PROMPT — User Guides
```text
[Paste Standing Rules Block]
PHASE 11 — User guides. Inputs: Phases 3, 4, 10, Plan §22.
Create docs/user-guides/ for SUPER-ADMIN, SCHOOL-ADMIN (incl. Principal), ACCOUNTS, TEACHER, PARENT only. Task-based,
navigating real routes/screens, EN/UR mentions where implemented, and clear "requires <integration> configured" notes.
No student guide. Stop at G10 regarding screenshots/PII.
Validate: every documented step exists in the UI; no planned feature presented.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 12 PROMPT — Release & Production Readiness
```text
[Paste Standing Rules Block]
PHASE 12 — Release. Inputs: all previous reports, Plan §23–§24.
Create docs/release/{PRODUCTION-READINESS,RELEASE-CHECKLIST,MIGRATION-CHECKLIST,SMOKE-TESTS,ROLLBACK,KNOWN-ISSUES}.md and
root CHANGELOG.md (reconstruct from git history; state baseline). Complete the Plan §24 table with final classification
and evidence; consolidate every CODE ISSUE DISCOVERED into KNOWN-ISSUES.md; fold docs/production-readiness/. LICENSE only per G11.
State go/no-go plainly; separate Documentation gaps / Engineering gaps / External blockers.
Validate: every readiness row classified with evidence; no readiness claim without evidence.
DO NOT EXECUTE ANY OTHER PHASE.
```

### PHASE 13 PROMPT — Final Audit
```text
[Paste Standing Rules Block]
PHASE 13 — Final documentation audit. Inputs: everything, Plan §33–§34.
Create docs/audit/<date>-documentation-audit.md only. Run the link check; verify every doc has a status header; sample-verify
factual claims from EVERY canonical doc against code (record method + results); confirm no orphan/duplicate concepts; confirm
README docs index is complete; check §34 checklist. Do not fix docs in this phase except trivial link typos (list them);
report findings for another pass.
Validate: §33 Definition of Done evaluated line by line.
DO NOT EXECUTE ANY OTHER PHASE.
```

---

## 30. Validation Criteria for Each Phase (summary)

| Phase | Mechanical checks | Judgment checks |
|---|---|---|
| 1A | Manifest row count = tracked doc count; no file modified | Verify-cells evidenced; dispositions justified |
| 1B | Broken-link scan = 0 (non-archive); `git diff --stat` docs-only; all moves `R` (rename) in `git status` | Nothing lost; archived banners; status page truthful |
| 2 | Scripts/commands ⊆ package.json; links resolve; line budget | No overclaim; entry point usable by a new dev |
| 3 | Controller/route coverage script = 100%; every rule cited | Roles match `Role` enum; unknowns flagged |
| 4 | Each step: status + evidence | Unsupported steps isolated |
| 5 | FR→feature 100%; criteria cite tests | Planned vs implemented separation |
| 6 | Diagram nodes ⊆ real dirs/modules | ADRs evidenced |
| 7 | Endpoint/model counts equal code; migrations 13/13 | Conventions match reality |
| 8 | Every control classified + evidenced | No "secure" claims; issues logged |
| 9 | Env-var diff = ∅; integration fields complete | No fictional procedures |
| 10 | Suites executed; counts dated | Traceability complete |
| 11 | Steps map to real screens | Task-oriented; integration caveats |
| 12 | All §24 rows resolved | Go/no-go honest |
| 13 | §33 met | Open-items list produced |

Universal check after every phase: `git diff --name-only` contains **no** path under `backend/src`, `backend/test`,
`backend/prisma`, `staff-console/src`, `parent-app/lib`, `parent-app/test`, `.github/workflows` (unless a phase explicitly says so).

---

## 31. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Archiving something still referenced by code comments/CI | Grep inbound refs in Phase 1A; leave redirect stubs |
| R2 | Losing history/context of sprint decisions | Keep `docs/superpowers` in place; `git mv` preserves history; snapshot tag |
| R3 | Docs drift again immediately | "Verified: date @ sha" header; Phase 13 audit; recommend a doc-check step in release checklist |
| R4 | Writing intended behavior as rules (esp. Q1–Q7) | Gate G5; `REQUIRES-DECISION` status |
| R5 | Over-claiming integrations/readiness | Verification-status ceilings; §5 rule 4 |
| R6 | FEAT-IDs / Sprint letters cited everywhere | Legacy map in feature catalog before archiving `FEATURES.txt` (or leave stub) |
| R7 | Test numbers in docs are stale/fabricated-by-copy | Phase 10 re-runs suites |
| R8 | e2e needs Postgres; environment may lack it | Mark UNVERIFIED with reason; do not copy old counts |
| R9 | Screenshots/PII in docs and user guides (47 MB set) | G1 binary policy; G10 |
| R10 | Worktree copies polluting greps/inventory | Excluded explicitly; prune decision at G1 |
| R11 | Scope creep into code fixes | `CODE ISSUE DISCOVERED` rule; §30 universal check |
| R12 | Rebrand residue (`schoolportal`) causing wrong "canonical" naming | Glossary + G3 |
| R13 | Single-person review bottleneck across 14 phases | Small phases; each ends with a reviewable report |
| R14 | Multi-tenant SaaS direction (memory) changes architecture docs soon | Architecture docs state current single-tenant-per-school design explicitly; ADR labelled with review trigger |

## 32. Known Unknowns (to resolve during the named phase)
1. Actual current test counts and whether all suites pass today (Ph 10).
2. Whether `PROJECT-STATUS.md` subsystem claims (Sprints N–R, Staff/Hiring, Promotions) hold — the file says they were never re-verified (Ph 1B/3).
3. Report-card behavior: upload-only vs generated (Ph 3/4).
4. Promotion/re-enrollment rules and whether new-session rollover is automated (Ph 4).
5. Exact permissions of TEACHER by class-teacher vs subject-teacher (Ph 3).
6. Which SMS/WhatsApp providers the adapters target (Ph 9).
7. Whether staff/teacher assignment history exists (Ph 7).
8. Global exception filter / error response shape; pagination conventions (Ph 7).
9. Token storage in staff-console (XSS exposure) and Flutter secure storage (Ph 8).
10. File upload limits/types and access paths (Ph 8).
11. Whether Postman collection matches routes (Ph 7).
12. Intended production hosting and whether any deployment already exists outside the repo (Ph 9, G9).
13. Whether the Next.js parent web portal has any code on any branch (none found on `main`) (Ph 1A).
14. What `docs/UI-Screenshots/archive/New folder` and duplicated PDF/HTML contain (Ph 1A).
15. License and privacy/retention policy owner (G11).

## 33. Documentation Completion Definition
The program is complete when **all** hold:
1. Every canonical doc has a status header with a verified date + commit, and its claims are cite-able to code.
2. `README.md` is the single entry point; docs index (`docs/README.md`) reaches every canonical doc; zero broken links outside `docs/archive/`.
3. No non-archived doc contradicts code; conflicts D1–D10 resolved or explicitly logged.
4. Exactly one canonical source per topic (status, design, data model, API, security, ops, testing, release).
5. Product, journey, roles, features, business rules, requirements, architecture, API, database, security, operations,
   integrations, testing, user guides, release docs exist and match §7's target tree (or their absence is justified in the audit).
6. Every business rule question is either decided (with owner) or visibly `REQUIRES-DECISION`.
7. Feature → rule → workflow → UI → API → DB → authz → test trace exists for every IMPLEMENTED feature.
8. Every engineering gap is listed in `KNOWN-ISSUES.md`/`PRODUCTION-READINESS.md`; **none is hidden or "fixed" in docs.**
9. Final audit (Phase 13) passes with an open-items list; human sign-off at G12.
10. Zero application code/test/schema changes were made by the documentation program.

## 34. Final Production Documentation Checklist

**Foundation** ☐ docs index ☐ status header on every doc ☐ archive banners ☐ snapshot tag ☐ no broken links
**Entry** ☐ README ☐ backend/staff-console/parent-app READMEs ☐ PROJECT-STATUS (short, truthful)
**Product** ☐ overview ☐ personas & role matrix ☐ feature catalog ☐ business rules (+decision register) ☐ glossary
**Journey** ☐ product journey ☐ student ☐ staff ☐ admissions ☐ session ☐ attendance ☐ assessment ☐ fees ☐ parent ☐ communication ☐ promotion/history
**Requirements** ☐ FR ☐ NFR ☐ acceptance criteria ☐ traceability matrix (complete)
**Architecture** ☐ system ☐ backend ☐ staff console ☐ parent app ☐ data ☐ security ☐ integrations ☐ ADRs (approved set)
**API** ☐ overview ☐ auth ☐ authz ☐ endpoint reference ☐ conventions (as-is) ☐ Postman verified
**Database** ☐ data model + ERD ☐ dictionary ☐ migrations ☐ seeding ☐ tenancy ☐ history
**Security** ☐ overview ☐ authN/authZ ☐ tenant isolation ☐ data protection/PII ☐ hardening checklist ☐ known gaps ☐ SECURITY.md
**Operations** ☐ environment vars ☐ deployment (or explicit NOT IMPLEMENTED) ☐ DB ops ☐ backup/restore ☐ monitoring/logging ☐ runbooks ☐ scheduled jobs ☐ file storage ☐ integrations ☐ scaling
**Testing** ☐ strategy ☐ test matrix ☐ release validation ☐ smoke-test spec
**User guides** ☐ super-admin ☐ school-admin (+principal) ☐ accounts ☐ teacher ☐ parent
**Release** ☐ production-readiness assessment ☐ release checklist ☐ migration checklist ☐ rollback ☐ known issues ☐ CHANGELOG ☐ release notes template ☐ LICENSE decision
**Audit** ☐ final documentation audit ☐ open-items/engineering backlog handed off

---
*End of Phase 0 plan. Next step: your review (Gate G0). No phase will run until you approve or amend this plan.*
