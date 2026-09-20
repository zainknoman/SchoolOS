# Release Checklist

> **Status:** CURRENT (procedure; never yet executed — no release exists) · **Verified:** 2026-09-20 · **Owner:** project owner
> Versioning is `REQUIRES-DECISION` (gate G11); suggested: semantic versions tagged `vMAJOR.MINOR.PATCH` on `main`, one tag covering backend + both clients, recorded in [`CHANGELOG.md`](../../CHANGELOG.md).

## Before cutting a release
- [ ] All CI jobs green on the release commit (`ci.yml`); backend lint status recorded (currently failing, non-blocking)
- [ ] Full validation run per [RELEASE-VALIDATION](../testing/RELEASE-VALIDATION.md) §1–§2
- [ ] [KNOWN-GAPS](../security/KNOWN-GAPS.md) and [KNOWN-ISSUES](KNOWN-ISSUES.md): every High item fixed or accepted **in writing** by the owner
- [ ] `npm audit` reviewed (backend, staff-console); `flutter pub outdated` reviewed
- [ ] Migration checklist completed ([MIGRATION-CHECKLIST](MIGRATION-CHECKLIST.md)) if the release adds migrations
- [ ] Hardening checklist configuration items confirmed for the target environment
- [ ] CHANGELOG updated; release notes drafted (what changed, migrations, config changes, known issues)
- [ ] Docs updated: `PROJECT-STATUS.md`, any changed API/DB/ops docs; `Verified:` headers refreshed

## Cut and deploy
- [ ] Tag the commit; build backend (`npm ci`, `prisma generate`, `npm run build`), staff console (`VITE_API_BASE_URL` set), parent app (`--dart-define=API_BASE_URL=…`)
- [ ] Take a database + uploads backup ([BACKUP-RESTORE](../operations/BACKUP-RESTORE.md)) and note its location
- [ ] `npx prisma migrate deploy` (staging first)
- [ ] Deploy backend (single instance), then staff console; publish the parent app via store process (no signing/store configuration is documented)
- [ ] Run production smoke test ([RELEASE-VALIDATION](../testing/RELEASE-VALIDATION.md) §3)

## After
- [ ] Watch logs/alerts for the agreed window; confirm scheduled jobs ran
- [ ] Announce; record deployment date, version, migration ids, and any deviations
- [ ] If any smoke check fails: follow [ROLLBACK](ROLLBACK.md)

## Not available yet (needed to make this checklist real)
Deployment automation, environments (staging/production) definition, release tagging convention, store-publishing configuration for the parent app, an on-call/owner for incidents.
