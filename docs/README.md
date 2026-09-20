# SchoolOS Documentation Index

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Product Owner

## Rules

1. **Truth order:** running code (controllers, services, DTOs) → `schema.prisma` + migrations → e2e tests → unit tests → config (`.env.example`, `ci.yml`, `package.json`) → client code → canonical docs → design docs → historical docs → ideas. Docs describe what **is** implemented; planned work lives only in clearly labelled roadmap/backlog sections.
2. **Every canonical doc starts with a status header:** `Status · Verified <date> against main@<sha> · Sources · Owner`. Doc status values: `CURRENT`, `PARTIAL`, `HISTORICAL`, `DEPRECATED`, `ARCHIVED`, `REQUIRES-DECISION`.
3. **Feature/control status words (inside tables):** `IMPLEMENTED`, `PARTIALLY IMPLEMENTED`, `CONFIGURATION REQUIRED`, `EXTERNAL SERVICE REQUIRED`, `STUB`, `PLANNED`, `NOT IMPLEMENTED`, `DEPRECATED`, `UNKNOWN`. Undecided rules: `REQUIRES-DECISION`.
4. **Documentation completeness is not production readiness.** Readiness is assessed separately (`release/`).
5. Documentation phases never change application code. Problems found are logged as `CODE ISSUE DISCOVERED`.
6. **Decisions are not implementation.** An owner decision is recorded as `DECIDED` (with date) and gets a backlog item; the current behaviour stays documented as current until the code changes. Where code conflicts with a decided product rule, the rule stands and the code is the defect.

## Canonical documents

| Topic | Location | State |
|---|---|---|
| Entry point | [`../README.md`](../README.md) | CURRENT |
| Live status & known gaps | [`../PROJECT-STATUS.md`](../PROJECT-STATUS.md) | CURRENT |
| Design system | [`../DESIGN.md`](../DESIGN.md), [`../staff-console/design-system/schoolos-staff-console/MASTER.md`](../staff-console/design-system/schoolos-staff-console/MASTER.md) | CURRENT |
| Product foundation (overview, roles, features, rules, glossary) | [`product/`](product/) | CURRENT (Phase 3) |
| **Owner decisions register** (50 answers, open items RD-1…RD-15) | [`product/OWNER-DECISIONS.md`](product/OWNER-DECISIONS.md) | CURRENT (2026-09-20) |
| Requirements | [`product/requirements/`](product/requirements/README.md) | CURRENT (Phase 5; traceability completed in Phase 10) |
| Journeys & workflows | [`workflows/`](workflows/) | CURRENT (Phase 4) |
| Architecture / ADRs | [`architecture/`](architecture/README.md), [`decisions/`](decisions/README.md) | CURRENT |
| API | [`api/`](api/API-OVERVIEW.md) (overview, authN/authZ, generated endpoint reference, Postman collection) | CURRENT |
| Database | [`database/`](database/DATA-MODEL.md) (model, generated dictionary + ERD, tenancy, migrations, seeding, history) | CURRENT (`data-model-design.md` and `migration-plan.md` are deprecated stubs kept only because code comments cite them) |
| Security | [`security/`](security/SECURITY-OVERVIEW.md), root [`SECURITY.md`](../SECURITY.md) | CURRENT (inventory; contact is a placeholder pending RD-2) |
| Operations | [`operations/`](operations/ENVIRONMENT.md) (environment, deployment requirements, backup, monitoring, runbooks, integrations) | PARTIAL — several capabilities NOT IMPLEMENTED and documented as such |
| Testing | [`testing/`](testing/TESTING-STRATEGY.md) | CURRENT (suites executed 2026-09-20) |
| User guides | [`user-guides/`](user-guides/README.md) | PARTIAL (not click-tested) |
| Release / readiness | [`release/`](release/README.md), [`../CHANGELOG.md`](../CHANGELOG.md) | CURRENT — verdict: **not production-ready** |
| **Gap analysis and phased implementation plan** | [`release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md`](release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md) | CURRENT (plan; nothing implemented) |
| Licence / security policy | [`../LICENSE`](../LICENSE) (proprietary placeholder), [`../SECURITY.md`](../SECURITY.md) (placeholder contact) | PARTIAL — owner inputs pending |

## Reference and history

| Location | Meaning | State |
|---|---|---|
| [`PLAN-DOCUMENTATION-PRODUCTION-READINESS.md`](PLAN-DOCUMENTATION-PRODUCTION-READINESS.md) | Program plan for this documentation effort | CURRENT |
| [`audit/`](audit/) | Dated audits (UI/design-system audit 2026-09-18; documentation audit 2026-09-20; housekeeping inspection 2026-09-20) | CURRENT (dated records) |
| [`superpowers/`](superpowers/README.md) | Per-sprint plans and design specs (tool-managed) | HISTORICAL — rationale, not truth |
| [`design-reference/`](design-reference/) | Wireframes, screenshot/comps, timetable samples | HISTORICAL/REFERENCE |
| `UI-Screenshots/` (this folder) | Current design comps — **pending move** into `design-reference/` (blocked by a Windows file lock on 2026-09-20) | REFERENCE |
| [`archive/`](archive/) | Superseded material with ARCHIVED banners: original MVP plan, Plan-Ideas, Figma handoff, old build log, old trackers, stale DB docs. Cleanup record: [`archive/CLEANUP-MANIFEST.md`](archive/CLEANUP-MANIFEST.md) | ARCHIVED |
