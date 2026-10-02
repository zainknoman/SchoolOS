# Rollback Procedure

> **Status:** PARTIAL — procedure defined and **rehearsed locally 2026-10-02** ([record](RESTORE-REHEARSAL-2026-10-02.md)); the staging rehearsal (B5) is still open · **Verified:** 2026-10-02 · **Owner:** Engineering Lead and Product Owner

Principle: application rollback is redeploying the previous build; **database rollback is a restore**, because migrations have no down scripts ([MIGRATIONS](../database/MIGRATIONS.md)).

| Situation | Action |
|---|---|
| Bad release, **no migration** in it | Redeploy the previous backend/console build. Parent app: staged rollout halt / previous store version (no procedure documented) |
| Bad release **with additive migration**, no data written by new features | Redeploy the previous backend build; the extra tables/columns are harmless to old code (additive policy) — no restore needed |
| Bad release with migration **and** data written that must be discarded, or migration failed midway | Stop the API → `npm run db:restore -- --file <pre-release dump> --target-url <production url> --overwrite <db>` (or the provider's point-in-time restore) **and** restore the bucket to the same point → redeploy the previous build → `npm run smoke` |
| Secret compromise | Rotate `JWT_ACCESS_SECRET` (all sessions end), gateway/SMTP/API keys; investigate logs |
| Mistaken bulk import / promotion | No undo endpoint. Promotions write `StudentPromotion` + closed enrollments; correction is manual data repair or restore |

## Checklist
- [ ] Decision owner named and decision time-boxed
- [ ] Pre-release backup identified (path/time) and restorable
- [ ] Previous build artifacts kept (at least the last two)
- [ ] After rollback: smoke test, notify users, record the incident, add a regression test before re-releasing

## Gaps
No scheduled backups yet (provider-dependent), no staging rehearsal yet, no artifact registry, no blue/green or canary, no feature flags. Until these exist, treat any migration release as irreversible without downtime.
