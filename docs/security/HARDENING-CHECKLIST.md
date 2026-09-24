# Production Hardening Checklist

> **Status:** CURRENT (checklist of configuration and controls to confirm **before** any production use) · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Security Owner (Engineering Lead until assigned)
> Each line is either a configuration step or an engineering gap. `[ ]` = not done/not verifiable from the repository. Engineering gaps cannot be closed by configuration and link to [KNOWN-GAPS](KNOWN-GAPS.md).

## Configuration (can be done without code changes)
- [ ] `NODE_ENV=production` set on the backend process (**mandatory**; the API refuses to start without it — BL-51)
- [ ] `JWT_ACCESS_SECRET` set to a long random value (≥ 32 characters, not a placeholder — enforced at boot since BL-51); rotate on a schedule
- [ ] `CORS_ORIGINS` set to the exact staff-console origin(s); confirm localhost is not allowed (only dev/test allows it)
- [ ] `DATABASE_URL` uses a least-privilege database role, TLS to the database, and a private network path
- [ ] TLS terminated in front of the API (HTTPS only, HSTS at the proxy); staff console served over HTTPS
- [ ] Reverse proxy sets/forwards client IP and the app trusts it appropriately, or rate limits are verified (KG-13)
- [ ] All provider variables set **together** or not at all: SMTP (`SMTP_*`, `FRONTEND_URL`), Firebase (`FIREBASE_*`), gateways (`JAZZCASH_*`/`EASYPAISA_*`), WhatsApp (`WHATSAPP_*`), SMS (`SMS_GATEWAY_*`), `ANTHROPIC_API_KEY`
- [ ] **SMTP configured**, so reset links are emailed and not logged (KG-4)
- [ ] `PAYMENT_STUB_WEBHOOK_SECRET` set (or the stub route unreachable) outside dev/test
- [ ] Seed **not** run; default/demo accounts absent; initial SUPER_ADMIN created by a controlled process (**no documented procedure exists** — engineering/ops gap)
- [ ] `UPLOADS_DIR` on encrypted, backed-up, single-instance storage (or accept the local-disk limits)
- [ ] Database backups scheduled, encrypted, and a restore rehearsed ([BACKUP-RESTORE](../operations/BACKUP-RESTORE.md))
- [ ] Log shipping with access control (logs may contain PII)
- [ ] Only one backend instance runs, or cron jobs are guarded (ADR-0008)

## Engineering gaps (need code/CI work; not configuration)
- [x] Security headers (`helmet`) — in the app since BL-12 (KG-12)
- [ ] `TRUST_PROXY` set to the proxy hop count behind a reverse proxy (KG-13)
- [x] High dependency vulnerabilities remediated; `npm audit --audit-level=high` gate in CI (KG-5, BL-12) — Moderate `firebase-admin` chain still open
- [ ] Tenant issues fixed or accepted: TENANT-1 (circulars), TENANT-2 (holidays), TENANT-3..5 (KG-1, KG-6, KG-7, KG-8)
- [ ] Session revocation model decided (KG-10); `mustChangePassword` enforced server-side (KG-11)
- [ ] Token storage in the staff console reviewed (KG-9)
- [ ] Health/readiness endpoint and monitoring in place ([MONITORING-LOGGING](../operations/MONITORING-LOGGING.md))
- [ ] Payment gateways verified in sandbox and production with signed test transactions (KG-18)
- [ ] Penetration test / independent review performed
- [ ] Privacy/retention policy decided (Q7)
