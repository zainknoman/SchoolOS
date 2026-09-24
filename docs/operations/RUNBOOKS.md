# Troubleshooting Runbooks

> **Status:** PARTIAL — derived from code behaviour, **not from production experience** (none exists) · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Operations/Deployment Owner
> Each entry states the symptom, the code-derived cause(s), and what to check. The incident/support model below is **DECIDED (2026-09-20) but not yet operational**; it must exist before production launch (BL-56).

## Incident and support process (decided; pilot)
- **Roles:** the Engineering/Operations owner handles technical incidents; the **school admin is the first operational contact** for school-side issues and escalates to the designated support channel (support channel `[SUPPORT_EMAIL]`; owner `[SUPPORT_OWNER]`).
- **Internal severity levels and acknowledgement targets** (RD-13). These are **internal operational targets, not contractual SLA commitments**; a customer-facing SLA is a future business decision.
| Level | Meaning (working definition) | Internal target | Handling |
|---|---|---|---|
| P1 Critical | production down, data loss/corruption or suspected breach/cross-school data exposure | acknowledge ≤ 30 minutes; continuous investigation until mitigated | immediate operational attention; Security Owner engaged for suspected breach; breach-notification process (Product Owner, counsel) applies |
| P2 High | major function unusable (login, attendance, fees) for a school | acknowledge ≤ 2 business hours | as soon as practical |
| P3 Medium | degraded or workaround exists | acknowledge ≤ 1 business day | normal queue |
| P4 Low | cosmetic/minor request | acknowledge ≤ 3 business days | backlog |
- Critical production incidents are acknowledged as soon as practical. Record each P1/P2 with timeline, cause, fix and follow-ups. Roles: `[OPS_OWNER]` (technical incidents), `[SECURITY_OWNER]` (suspected breach), `[PRIVACY_ADMINISTRATOR]` (breach notification), `[SUPPORT_OWNER]` (first-line). Persons assigned to the roles are recorded outside the repository.

| Symptom | Likely cause (evidence) | Check / action |
|---|---|---|
| API refuses to start: "Refusing to start — invalid configuration: …" | Boot-time validation (BL-51, `config/env.validation.ts`): `NODE_ENV` unset/unknown, or outside dev/test a short/placeholder `JWT_ACCESS_SECRET` or missing `DATABASE_URL`/`CORS_ORIGINS`/`FRONTEND_URL`. Every problem is listed | Fix each listed variable; never set `NODE_ENV=development` on a server to get past it |
| API refuses to start: "JWT_ACCESS_SECRET must be set…" | `NODE_ENV` is not development/test and the variable is unset (`jwt-secret.ts`) | Set the secret |
| API refuses to start: "PAYMENT_STUB_WEBHOOK_SECRET…" / partial provider config error | Some but not all variables of a provider (SMTP, Firebase, JazzCash, EasyPaisa, WhatsApp, SMS) are set (`*-config.ts`) | Set all or none; see [ENVIRONMENT](ENVIRONMENT.md) |
| Users cannot log in: "Account temporarily locked" | 5 failed attempts → 15-minute lock (`auth.constants.ts`) | Wait 15 min or clear `failedLoginCount`/`lockedUntil` on the `User` row (direct SQL; no admin unlock endpoint exists) |
| A staff/parent account is compromised or a staff member leaves | — | SCHOOL_ADMIN (own-school accounts) or SUPER_ADMIN: `POST /api/v1/admin/users/:id/disable` — every session ends on the next request and sign-in is refused; `…/enable` restores it (also clears a failed-login lockout); `…/revoke-sessions` signs the user out everywhere without disabling. A parent with children in two schools can only be disabled by SUPER_ADMIN. All three are audited (`account.*`) |
| After deploying migration `20260925090000_m1_attendance_marked_by_user` (BL-60) | Legacy attendance rows have no `markedByUserId` | Run `npm run backfill:m1` once (idempotent, transactional; prints resolved/unresolved counts). Unresolved rows stay null by design — they keep their `markedById` |
| New system: nobody can sign in | No SUPER_ADMIN yet | `npm run bootstrap:super-admin` with `BOOTSTRAP_SUPER_ADMIN_*` set ([DEPLOYMENT](DEPLOYMENT.md)); refuses once any SUPER_ADMIN exists. A lost sole SUPER_ADMIN password is recovered by another SUPER_ADMIN, or by a documented DB-level procedure with an audit note — the bootstrap will not run again |
| A parent forgot their password and e-mail is not configured | Pilot has no SMTP (B-1) | School admin: parent profile → **Reset password** (`POST /api/v1/admin/parents/:id/reset-password`, BL-64). The one-time password is shown once, never logged; audited as `account.admin-password-reset` |
| Every request answers 403 `PASSWORD_CHANGE_REQUIRED` | The account has `mustChangePassword` (provisioned login or admin reset) — enforced by the API since BL-21 | The user changes their password (`POST /auth/change-password`); the console redirects automatically |
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
| Attendance cannot be marked | an **admin** marker and the section has no class teacher (`Attendance.markedById` is a required Teacher FK; teachers are unaffected — **defect vs the decided rule, RD-8 → BL-60**), or the day is a holiday (`attendance.service.ts`) | Assign a class teacher as a workaround until BL-60 ships; check holidays |
| Leave cannot be approved | section has no class teacher (`leave.service.ts:109`) — **defect vs the decided rule** (KI-26, BL-29) | Assign a class teacher as a workaround until BL-29 ships |
| Uploaded files missing after redeploy | `STORAGE_DRIVER` not `s3` (only possible in development/test) or wrong bucket/prefix | Check `S3_*`; for a migrated system re-run `npm run storage:copy-to-s3` (idempotent) and read its `missing` list ([BACKUP-RESTORE](BACKUP-RESTORE.md)) |
| Downloads fail with 500 after switching to S3 | Credentials/endpoint/path-style wrong, or objects not copied | `npm run storage:copy-to-s3 -- --dry-run` shows what is not in the bucket; fix `S3_*` |
| Digest/risk jobs run twice | two backend instances (ADR-0008) | Run one instance |
| Deleting a record returns 400 "still referenced" | FK restriction (`prisma-delete-guard.ts`) | Remove/relocate dependents first |
| Parents see another school's circular | KG-1 | Known defect (BL-20) |
