# Troubleshooting Runbooks

> **Status:** PARTIAL — derived from code behaviour, **not from production experience** (none exists) · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Operations/Deployment Owner
> Each entry states the symptom, the code-derived cause(s), and what to check. The incident/support model below is **DECIDED (2026-09-20) but not yet operational**; it must exist before production launch (BL-56).

## Incident and support process (decided; pilot)
- **Roles:** the Engineering/Operations owner handles technical incidents; the **school admin is the first operational contact** for school-side issues and escalates to the designated support channel (a dedicated support e-mail/helpdesk address — address `[support-email]`, RD-2/RD-13).
- **Internal severity levels** (no contractual SLA in the pilot; exact response targets are defined after pilot validation):
| Level | Meaning (working definition) | Handling |
|---|---|---|
| P1 Critical | production down, data loss/corruption or suspected breach/cross-school data exposure | immediate operational attention; Security Owner engaged for suspected breach; breach-notification process (Product Owner, counsel) applies |
| P2 High | major function unusable (login, attendance, fees) for a school | acknowledged as soon as practical |
| P3 Medium | degraded or workaround exists | normal queue |
| P4 Low | cosmetic/minor request | backlog |
- Critical production incidents are acknowledged as soon as practical. Record each P1/P2 with timeline, cause, fix and follow-ups. Named on-call owners: `REQUIRES-DECISION` (RD-5).

| Symptom | Likely cause (evidence) | Check / action |
|---|---|---|
| API refuses to start: "JWT_ACCESS_SECRET must be set…" | `NODE_ENV` is not development/test and the variable is unset (`jwt-secret.ts`) | Set the secret |
| API refuses to start: "PAYMENT_STUB_WEBHOOK_SECRET…" / partial provider config error | Some but not all variables of a provider (SMTP, Firebase, JazzCash, EasyPaisa, WhatsApp, SMS) are set (`*-config.ts`) | Set all or none; see [ENVIRONMENT](ENVIRONMENT.md) |
| Users cannot log in: "Account temporarily locked" | 5 failed attempts → 15-minute lock (`auth.constants.ts`) | Wait 15 min or clear `failedLoginCount`/`lockedUntil` on the `User` row (direct SQL; no admin unlock endpoint exists) |
| Login works then everything returns 401 after ~15 min | access token expired and refresh failed (refresh token expired/revoked, or clock/secret change) | Re-login; if after a secret change, expected |
| Password-reset emails never arrive | SMTP unset ⇒ link is only in the API log (KG-4); or wrong `FRONTEND_URL` | Set SMTP; check `[mail:not-configured]` log lines; verify `FRONTEND_URL` |
| 429 Too Many Requests on login | 5/min auth throttle (per IP); behind a proxy many users may share an IP (KG-13) | Inspect proxy forwarding; wait 60 s |
| CORS errors in the staff console | origin not in `CORS_ORIGINS` (`cors.config.ts`) | Add exact origin (scheme+host+port) |
| Push notifications not arriving | FCM unset ⇒ logging no-op (`[push:noop]`), or device token not registered (`POST /me/device-tokens`) | Configure Firebase; check `DeviceToken` rows |
| SMS not delivered | sender targets a placeholder URL (`sms-sender.ts:18`) | Requires code/provider work |
| Payment stays pending | webhook not reaching `/payments/webhook/:gateway`, or signature invalid (401) | Check gateway callback config and signature settings; reconcile manually (`POST /fee-vouchers/:id/reconcile`) |
| Voucher shows unpaid after a failed payment | expected — allocation zeroed on failure so it can be retried (`fee-payments.service.ts:95-101`) | Retry payment |
| "No active academic session" on student create / voucher issue | no session with `isActive = true` (`student.service.ts:69`) | Activate a session (note: activation deactivates all others) |
| Students/vouchers land in the wrong session in a multi-school setup | Global active-session lookup (Q1, KG-7) | Correct data manually; needs product decision |
| Attendance cannot be marked | section has no class teacher, or the day is a holiday (`attendance.service.ts`) | Assign class teacher; check holidays |
| Leave cannot be approved | section has no class teacher (`leave.service.ts:109`) — **defect vs the decided rule** (KI-26, BL-29) | Assign a class teacher as a workaround until BL-29 ships |
| Uploaded files missing after redeploy | `UPLOADS_DIR` on ephemeral disk | Mount persistent storage; restore files ([BACKUP-RESTORE](BACKUP-RESTORE.md)) |
| Digest/risk jobs run twice | two backend instances (ADR-0008) | Run one instance |
| Deleting a record returns 400 "still referenced" | FK restriction (`prisma-delete-guard.ts`) | Remove/relocate dependents first |
| Parents see another school's circular | KG-1 | Known defect (BL-20) |
