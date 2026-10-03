# Release and Production Readiness

> **Status:** CURRENT · **Verified:** 2026-09-20 · **Owner:** Engineering Lead and Product Owner

| Document | Purpose |
|---|---|
| [PRODUCTION-READINESS](PRODUCTION-READINESS.md) | go/no-go assessment, gap classification, pilot blockers |
| [GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN](GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md) | decided-vs-built gaps and the phased engineering plan (pilot scope order) |
| [EXECUTION-PLAN](EXECUTION-PLAN.md) | ordered waves, schema/migration dependencies, regeneration matrix, rollback rules |
| [PILOT-EXIT-CHECKLIST](PILOT-EXIT-CHECKLIST.md) | signable pilot exit review (Q33, BL-57): security review, restore test, monitoring, defects, school sign-off, staging load run, screen-reader pass, privacy gates, owner-gated BL-43/BL-54/BL-14 — evidence, owner and sign-off per item |
| [RELEASE-CHECKLIST](RELEASE-CHECKLIST.md) | steps for cutting and deploying a release |
| [MIGRATION-CHECKLIST](MIGRATION-CHECKLIST.md) | database change safety |
| [ROLLBACK](ROLLBACK.md) | how to revert |
| [OPEN-TASKS](OPEN-TASKS.md) | what is left after Wave 8: owner/infrastructure tasks and decisions needed |
| [RESTORE-REHEARSAL-2026-10-02](RESTORE-REHEARSAL-2026-10-02.md) | local backup → verified restore → deploy → rollback rehearsal record |
| [ACCESSIBILITY-AUDIT](ACCESSIBILITY-AUDIT.md) | staff console WCAG 2.1 AA audit: automated gates, fixes, open screen-reader pass (BL-55) |
| [LOAD-TEST-REPORT](LOAD-TEST-REPORT.md) | load and performance test against the Q44 targets: method, results, fixes, staging steps, availability plan (BL-15) |
| [KNOWN-ISSUES](KNOWN-ISSUES.md) | engineering defects and gaps (security items: [KNOWN-GAPS](../security/KNOWN-GAPS.md)) |
| [`../testing/RELEASE-VALIDATION.md`](../testing/RELEASE-VALIDATION.md) | validation gates and the **production smoke-test** procedure (kept there to avoid duplication) |
| [`../../CHANGELOG.md`](../../CHANGELOG.md) | reconstructed history; no releases exist (first release will be 1.0.0) |
| Release notes | none yet; template: *version · date · changes · migrations · config changes · known issues · rollback notes* |

The original planning brief for this documentation effort is kept in git history at `docs/archive/production-readiness-brief.md` (tag `docs-history-2026-10-01`).
