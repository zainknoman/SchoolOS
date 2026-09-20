# Authentication

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/src/auth/**` (`auth.service.ts`, `auth.controller.ts`, `auth.constants.ts`, `strategies/jwt.strategy.ts`, `jwt-secret.ts`, `guards/*`), `common/normalize-identifier.ts` · **Owner:** project owner

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
| Refresh token | opaque random string; stored as SHA-256 hash in `RefreshToken`; **30 days**; revoked when used and a new one issued | `auth.service.ts:109-129,255-265` |
| Reset token | random; hashed; valid 1 hour; single use | `auth.constants.ts:13` |
| Secret handling | If `JWT_ACCESS_SECRET` is unset outside development/test the app refuses to boot; in development an insecure built-in fallback is used | `jwt-secret.ts:7-21` |
| Token in query string | `?access_token=` is accepted **only** on four exact download routes (`/files/:id`, `/fee-vouchers/:id/pdf`, `/fee-payments/:id/receipt.pdf`, `/report-cards/:id/pdf`) | `jwt.strategy.ts:22-41` |

## Behaviour
- `identifier` is an email or a GR number; both are stored in `User.identifier` (normalised by `normalize-identifier.ts`). Failure text is the generic "Invalid credentials".
- 5 failed attempts lock the account for 15 minutes ("Account temporarily locked. Try again later."); a successful login resets the counter (`auth.constants.ts`).
- Passwords hashed with argon2 (library defaults; parameters not customised in code).
- `mustChangePassword` is returned to the client, which redirects to change-password; **the server does not block other endpoints while it is true** (no check outside `auth.service.ts` — `CODE ISSUE DISCOVERED` AUTH-2).
- The JWT strategy does **not** re-read the user: a locked, deleted or role-changed account keeps working until its access token expires (≤ 15 min) (`CODE ISSUE DISCOVERED` AUTH-1; refresh does re-check).

## Client storage
Staff console: whole session (both tokens) in browser `localStorage` (`staff-console/src/stores/auth.ts:77`) — `CODE ISSUE DISCOVERED` AUTH-3 (readable by any script on the origin). Parent app: `flutter_secure_storage` (`parent-app/lib/src/auth/token_store.dart`).

## Not implemented
SSO/OAuth, MFA, device/session listing, logout-all/refresh-token revocation endpoint (no logout endpoint exists in `auth.controller.ts`; clients discard tokens locally), password complexity rules (new passwords only require `MinLength(8)` in `reset-password.dto.ts` and `change-password.dto.ts`).
