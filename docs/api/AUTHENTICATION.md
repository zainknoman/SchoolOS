# Authentication

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/src/auth/**` (`auth.service.ts`, `auth.controller.ts`, `auth.constants.ts`, `strategies/jwt.strategy.ts`, `jwt-secret.ts`, `guards/*`), `common/normalize-identifier.ts` · **Owner:** Engineering Lead

## Endpoints
| Endpoint | Auth | Body | Result |
|---|---|---|---|
| `POST /auth/login` | public, throttled 5/min | `{ identifier, password }` | `SessionResult` |
| `POST /auth/refresh` | public | `{ refreshToken }` | new `SessionResult` (old refresh token revoked) |
| `POST /auth/forgot-password` | public, throttled | `{ identifier }` | always the same generic message |
| `POST /auth/reset-password` | public, throttled | `{ token, newPassword }` | success or generic error |
| `POST /auth/change-password` | bearer, throttled | `{ currentPassword, newPassword }` | success; new must differ |

`SessionResult` = `{ accessToken, refreshToken, role, isPrincipal, mustChangePassword, campusId, schoolId }` (`auth.service.ts:19-27`).

## Tokens
| Item | Value | Evidence |
|---|---|---|
| Access token | JWT signed with `JWT_ACCESS_SECRET`; payload **only** `{ sub: userId, role }`; TTL `JWT_ACCESS_TTL` (default `15m`) | `jwt.strategy.ts`, `auth.constants.ts` |
| Refresh token | opaque random string; stored as SHA-256 hash in `RefreshToken`; **30 days**; revoked when used and a new one issued. **Cookie mode** (staff console, BL-36): with `X-SchoolOS-Session: cookie` on login/refresh/logout/change-password it travels only as the HttpOnly cookie `__Secure-schoolos-rt` (`Secure; SameSite=Strict; Path=/api/v1/auth`) and is left out of the body; the Origin must be on `CORS_ORIGINS`. Without the header (parent app) it is sent and returned in the body | `auth.service.ts`, `session-cookie.ts` |
| Reset token | random; hashed; valid 1 hour; single use | `auth.constants.ts:13` |
| Secret handling | If `JWT_ACCESS_SECRET` is unset outside development/test the app refuses to boot; in development an insecure built-in fallback is used | `jwt-secret.ts:7-21` |
| Token in query string | **Never** accepted (BL-36, KG-15): an access token is read only from `Authorization: Bearer` | `jwt.strategy.ts` |
| Download link | `POST /auth/download-link {path}` (bearer) → `{url, expiresAt}`; `url` = path + `?dl=<token>`, valid 120 s for that one GET download route (`/files/:id`, `/fee-vouchers/:id/pdf`, `/fee-payments/:id/receipt.pdf`, `/report-cards/:id/pdf`, `/report-cards/generated/:id/pdf`), signed with a key derived from the access secret (not usable as an access token), carries `tokenVersion`. Used by the parent app to open files in the system browser; the staff console fetches files with the bearer header instead ([TOKEN-STORAGE-DECISION](../security/TOKEN-STORAGE-DECISION.md)) | `download-link.ts`, `auth.service.ts` |

## Behaviour
- `identifier` is an email or a GR number; both are stored in `User.identifier` (normalised by `normalize-identifier.ts`). Failure text is the generic "Invalid credentials".
- 5 failed attempts lock the account for 15 minutes ("Account temporarily locked. Try again later."); a successful login resets the counter (`auth.constants.ts`).
- Passwords hashed with argon2 (library defaults; parameters not customised in code).
- `mustChangePassword` is returned to the client, which redirects to change-password; **the server does not block other endpoints while it is true** (no check outside `auth.service.ts` — `CODE ISSUE DISCOVERED` AUTH-2).
- The JWT strategy does **not** re-read the user: a locked, deleted or role-changed account keeps working until its access token expires (≤ 15 min) (`CODE ISSUE DISCOVERED` AUTH-1; refresh does re-check).

## Client storage
Staff console (since BL-36): access token in memory only, refresh token in the HttpOnly cookie; a reload restores the session through `/auth/refresh` (`staff-console/src/stores/auth.ts`). Closes AUTH-3. Parent app: `flutter_secure_storage` (`parent-app/lib/src/auth/token_store.dart`).

## Not implemented
SSO/OAuth, MFA, device/session listing, logout-all/refresh-token revocation endpoint (no logout endpoint exists in `auth.controller.ts`; clients discard tokens locally), password complexity rules (new passwords only require `MinLength(8)` in `reset-password.dto.ts` and `change-password.dto.ts`).
