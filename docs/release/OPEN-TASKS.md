# Open Tasks and Decisions (after Wave 8)

> **Status:** CURRENT · **Verified:** 2026-10-03 against `main` · **Owner:** Product Owner with the Technical Owner
> Everything engineering could do without outside accounts, infrastructure or owner decisions is done ([EXECUTION-PLAN §0](EXECUTION-PLAN.md)). This file lists what is left: **Part A** — tasks that need accounts, infrastructure or a person; **Part B** — decisions needed before the remaining post-pilot items can be built. Tick items here as they close and record evidence in [PILOT-EXIT-CHECKLIST](PILOT-EXIT-CHECKLIST.md).

## Part A — Still-open tasks

### A1. Staging and production environments (BL-13) — do this first; A4 and A5 depend on it
- [ ] Choose the hosting provider and region (RD-3); record the decision in [DEPLOYMENT](../operations/DEPLOYMENT.md).
- [ ] Register the production domain (RD-2) and plan hosts on **one registrable domain**, e.g. `console.<domain>` and `api.<domain>` (the console session cookie is `SameSite=Strict`, BL-36).
- [ ] Create **managed PostgreSQL 16+** for staging and production: TLS, private network, least-privilege app role, **daily backups / point-in-time recovery, retention ≥ 30 days** (Q26).
- [ ] Create an **S3-compatible bucket** per environment with **versioning on**; set `STORAGE_DRIVER=s3` and `S3_*` ([ENVIRONMENT](../operations/ENVIRONMENT.md)).
- [ ] HTTPS in front of the API and the console; set `TRUST_PROXY` to the number of proxy hops (usually `1`).
- [ ] Per-environment secrets in a secret store: `JWT_ACCESS_SECRET` (≥ 32 random characters), `DATABASE_URL`, `CORS_ORIGINS` = the console's exact origin, `FRONTEND_URL`, `NODE_ENV=production`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `APP_RELEASE`.
- [ ] Deploy the API: `npm ci && npx prisma generate && npm run build` → `npx prisma migrate deploy` → `npm run start:prod`; health check `GET /health/ready`.
- [ ] Deploy the console with `VITE_API_BASE_URL=https://api.<domain>`; SPA fallback routing; set the **Content-Security-Policy response header** with `frame-ancestors 'none'` (example in DEPLOYMENT).
- [ ] Create the first super admin with `npm run bootstrap:super-admin` (never the demo seed).
- [ ] Monitoring: external uptime probes on `/health/live` and `/health/ready`, Sentry with PII scrubbing checked on a test event, log shipping with access control, every alert rule in [MONITORING-LOGGING](../operations/MONITORING-LOGGING.md) configured and fired once to the on-call contact (A3).
- [ ] Schedule `npm run db:backup` before every release that has a migration (in addition to the provider's PITR).
- [ ] Decide whether `/api/docs` is on in staging (`OPENAPI_UI=enabled`); leave it off in production.

### A2. Staging runs (need A1)
- [ ] **Smoke test:** create test accounts for every role on a **test school**, then run `npm run smoke` with `SMOKE_BASE_URL`, `SMOKE_CONSOLE_URL`, `SMOKE_<ROLE>_*`, `SMOKE_WRITES=1` + `SMOKE_SECTION_ID` / `SMOKE_STUDENT_ID` / `SMOKE_SUBJECT_ID`, `SMOKE_FOREIGN_STUDENT_ID`, `SMOKE_CHECK_RATE_LIMIT=1` ([RELEASE-VALIDATION §3](../testing/RELEASE-VALIDATION.md)); save the output.
- [ ] **Load test (B1):** `npm run load:data` into a staging database named `*load*`, run `npm run load:test` per [LOAD-TEST-REPORT §6](LOAD-TEST-REPORT.md); targets CRUD p95 < 500 ms, auth p95 < 1 s, errors < 1 %; drop the load database afterwards.
- [ ] **Restore test (A2):** restore the managed database (PITR) **and** the bucket to one point in time into a scratch environment; `npm run db:restore` for the pre-deploy dump; measure time (RTO ≤ 4 h) and data age (RPO ≤ 24 h); smoke test; write a dated record like [RESTORE-REHEARSAL-2026-10-02](RESTORE-REHEARSAL-2026-10-02.md).
- [ ] **Rollback rehearsal (B5):** deploy a release with a migration, then roll back per [ROLLBACK](ROLLBACK.md) (restore the pre-deploy backup + previous build), smoke test, record it.
- [ ] **Data migration (B6, only if the pilot school's existing data is imported):** `npm run migration:dry-run` on a production copy, run backfills M1–M8, resolve every `MigrationReviewItem`, record the reconciliation in [MIGRATION-STRATEGY](../database/MIGRATION-STRATEGY.md).

### A3. Firebase / push notifications (BL-43, BL-14 FCM part)
- [ ] Create **two Firebase projects** (staging, production) owned by the organisation; record the owner (`[FIREBASE_OWNER]`).
- [ ] Register the Android app `pk.edu.schoolos.*` (and iOS if needed) in each; run `flutterfire configure` to regenerate `firebase_options.dart` — fix the iOS bundle id mismatch (`…parent_app` vs Xcode `…parentApp`, see BACKLOG BL-34).
- [ ] Create a service account for the API; set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (all three together) in the secret store per environment.
- [ ] Verify (C3): one push delivered on staging to a **release build**; check `Notification.deliveryStatus = SENT`.

### A4. E-mail / SMTP (BL-14 SMTP part, BL-35)
- [ ] Choose an e-mail provider (or decide e-mail stays off in the pilot — then the admin-assisted reset BL-64 is the reset path and `ADMIN_PASSWORD_RESET=auto` stays).
- [ ] Verify the sending domain (SPF, DKIM, DMARC) on the production domain.
- [ ] Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` (all together), `FRONTEND_URL` (console reset page) and `PARENT_RESET_URL` (app deep link or parent web page).
- [ ] Verify: a staff and a parent password-reset e-mail arrive on staging and the links work (C3); check that no reset link appears in logs.

### A5. Play Console and app release (BL-43)
- [ ] Create the **organisation-owned** Google Play developer account (`[PLAY_DEVELOPER_ACCOUNT]`); invite the people who need access and document the access list.
- [ ] Create the **upload/signing key** and keep it outside Git (secret store); enrol in Play App Signing.
- [ ] Set production app identifiers, version code/name and the store listing (privacy notice link — needs A7).
- [ ] Build a **signed AAB** from CI or the secure store with `--dart-define=API_BASE_URL=https://api.<domain>` and upload to the **internal testing** track; record the release (C1).

### A6. Real-device matrix (BL-54)
- [ ] Run the matrix on real devices and record it in `docs/release/`: Android 9+, a low-memory device, slow network, a small screen, TalkBack, large font scaling.
- [ ] Include sign-in, children, attendance, diary, fees/vouchers, report cards, messages, leave, complaints **with a file attachment** (`file_picker`), password change and reset, push received.
- [ ] Fix or accept every blocking defect (C2).

### A7. People and approvals
- [ ] **Screen-reader pass (BL-55, B2):** a person runs NVDA (Windows) and, if available, VoiceOver through the checklist in [ACCESSIBILITY-AUDIT §5](ACCESSIBILITY-AUDIT.md); record tester, date and results; fix or accept findings.
- [ ] **A4 sign-off:** the Product Owner accepts the severity triage in [KNOWN-ISSUES](KNOWN-ISSUES.md) (no open Critical/High) and sets up the pilot defect tracker.
- [ ] **Privacy gates G1–G5 (BL-56, B3):** counsel reviews [PRIVACY-OPERATIONS](../security/PRIVACY-OPERATIONS.md), [PRIVACY-NOTICE](../security/PRIVACY-NOTICE.md) and [DATA-PROTECTION](../security/DATA-PROTECTION.md); fill in notification timelines, role holders and a live `[SUPPORT_EMAIL]`; rehearse the incident process once — all **before real data is entered**.
- [ ] **Placeholders (RD-1, RD-2, KG-21):** legal entity name in `LICENSE`, `[SECURITY_EMAIL]` in `SECURITY.md`, production domain.
- [ ] **Leaked credentials:** rotate the credentials of the unrelated project whose test accounts were committed in `695f4a1` (if it is live); decide whether to rewrite git history (needs a force-push) — see the [housekeeping inspection §7](../audit/2026-09-20-housekeeping-inspection.md).
- [ ] **Optional clean-up:** delete the merged remote branches `origin/sprint-a-stabilization` and `origin/sprint-b/task-1-fee-payment-restrict`; decide on Git LFS for design binaries.
- [ ] **Optional channels (off for the pilot, RD-4):** if wanted later — SMS (`SMS_PROVIDER` + provider account), WhatsApp (Business account + an **approved template**), AI drafting (`AI_DRAFTING=enabled` + `ANTHROPIC_API_KEY`); each needs a live test before use.

### A8. Pilot exit
- [ ] Work through [PILOT-EXIT-CHECKLIST](PILOT-EXIT-CHECKLIST.md) A1–A6, B1–B6, C1–C3 with evidence and sign-offs, then the final sign-off by the six roles.

## Part B — Decisions needed (remaining post-pilot items)
Three items are large features without defined requirements; building them now would mean guessing.

| Item | What is unclear | Questions for the Product Owner |
|---|---|---|
| **BL-46** Public online admissions | An unauthenticated public form invites spam and abuse and collects children's data from strangers | Who may apply (any visitor, or only with an invite/link per school)? Which anti-abuse measures — CAPTCHA (which provider), rate limits, e-mail/phone verification by OTP (needs SMS/e-mail, A4)? Which fields and documents? Consent and privacy notice wording (counsel, A7)? Does an application create anything automatically, or always wait for staff review? Fee or deposit online (gateways are off, RD-14)? |
| **BL-09** Parent web portal | A whole new application | Same features as the parent app, or a subset (fees and report cards only)? Separate web app or a parent area in the console? Which domain (must share the registrable domain for the cookie session)? Urdu/RTL from day one? Priority versus the mobile app? |
| **BL-59** Advanced accounting and advanced analytics | Only the words exist | Accounting: general ledger and chart of accounts, expense tracking, bank reconciliation, payroll, tax/withholding, export to an accounting package (which one)? Analytics: which reports and for whom (owner, principal, accounts) — trends of attendance, results, fee collection, comparisons across campuses? Exports or dashboards? |

**Proposed now (clearly defined — can be built without further input once approved):**
| Item | Plan |
|---|---|
| **BL-45** Per-period attendance | Optional per-period marks alongside the daily mark (timetable periods); the daily record stays the source for summaries and risk; additive migration; console marking by period for teachers of that period |
| **BL-59** (part) Campus-level attendance-risk overrides | A campus may override its school's risk thresholds; the job uses the campus value when set; console setting for principals |
| **BL-47** Student login | A design note only (the backlog says *do not implement*): identity model, roles and scope, which screens, what the architecture must keep open |
| **BL-16** Multi-tenant SaaS | An audit document of everything that assumes a single tenant today (data, config, jobs, storage, domains) and the options, before any refactor |

**Decision:** approve the four proposed items, and answer the questions for BL-46, BL-09 and BL-59 (accounting/analytics) — or mark any of them out of scope.
