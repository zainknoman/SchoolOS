# Release Checklist

> **Status:** CURRENT (procedure; never yet executed — no release exists) · **Verified:** 2026-09-20 · **Owner:** Engineering Lead and Product Owner
> **Decided (owner, 2026-09-20):** Semantic Versioning `MAJOR.MINOR.PATCH`; Git tags (`vMAJOR.MINOR.PATCH`); **first production release = 1.0.0**; PR-based development — **no direct commits to the production/`main` branch**; flow = feature development → PR/review → staging deployment → automated tests → acceptance verification → production release/tag; **production releases require explicit Product/Engineering owner approval**. One tag covers backend + both clients; recorded in [`CHANGELOG.md`](../../CHANGELOG.md). Not yet exercised (no tags exist; no automation).

## Before cutting a release
- [ ] Changes merged via reviewed PR (no direct commits to `main`); the release commit deployed to **staging** and acceptance-verified
- [ ] Product/Engineering owner approval recorded for production
- [ ] All CI jobs green on the release commit (`ci.yml`); backend lint status recorded (currently failing and non-blocking; decided to become blocking after the backlog is cleaned — BL-37)
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
- [ ] Deploy backend (single instance), then staff console; publish the parent app to **Google Play first** (organisation-owned account; signing keys never in Git — BL-43; App Store later)
- [ ] Run production smoke test ([RELEASE-VALIDATION](../testing/RELEASE-VALIDATION.md) §3)

## After
- [ ] Watch logs/alerts for the agreed window; confirm scheduled jobs ran
- [ ] Announce; record deployment date, version, migration ids, and any deviations
- [ ] If any smoke check fails: follow [ROLLBACK](ROLLBACK.md)

## Not available yet (needed to make this checklist real)
Deployment automation and the staging/production environments (BL-13), CI release job, Play publishing configuration (BL-43), a named incident owner and the support process (BL-56, RD-5). The tagging convention and approval rule are decided (above).
