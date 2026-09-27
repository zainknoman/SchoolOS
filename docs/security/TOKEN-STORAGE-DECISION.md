# Staff-console token storage — decision record (BL-36)

> **Status:** PROPOSED — the storage option (§5) **awaits an owner choice**; the query-string part (KG-15, §6) is **implemented** · **Date:** 2026-09-28 · **Owner:** Security Owner (Engineering Lead until assigned)
> Covers Q42 ([OWNER-DECISIONS](../product/OWNER-DECISIONS.md)), KG-9 and KG-15 ([KNOWN-GAPS](KNOWN-GAPS.md)), backlog item BL-36.

## 1. Question

The staff console keeps the access token **and** the 30-day refresh token in `localStorage` (KG-9). Q42 asks for a review before this is treated as the production design: HttpOnly Secure SameSite cookies, refresh rotation, CSRF — without breaking the current login flow. BL-36 accepts either **adopt** (cookies, CSRF tested, tokens absent from `localStorage`) or **accept with mitigation**, and in both cases removes query-string token acceptance (KG-15).

## 2. Current flow (audited 2026-09-28)

| Piece | Behaviour | Where |
|---|---|---|
| Access token | HS256 JWT `{sub, role, tv}`, 15 min (`JWT_ACCESS_TTL`). Accepted **only** from `Authorization: Bearer` (since BL-36). | `auth.service.ts` `issueSession`, `strategies/jwt.strategy.ts` |
| Per-request recheck | Every request re-reads the user: deleted, disabled (`isLocked`) or `tv ≠ tokenVersion` → 401 (BL-21). Role comes from the database. | `jwt.strategy.ts` `validate` |
| Refresh token | 32 random bytes, stored as SHA-256, 30 days. **Rotated on use** (the presented token is revoked, a new pair issued). A disabled user cannot refresh. | `auth.service.ts` `refresh` |
| Reuse detection | **None.** Presenting an already-rotated token fails, but does not revoke the rest of that session's chain. | `auth.service.ts` `refresh` |
| Revocation | `POST /auth/logout` revokes one refresh token; `logout-all`, disable and password change/reset bump `tokenVersion` and revoke every refresh token. | `auth.controller.ts`, `auth.service.ts` |
| Console storage | The whole login response (both tokens, role, grants, scope) in `localStorage['schoolos.auth']`; read on load. | `staff-console/src/stores/auth.ts` |
| Console refresh | `fetchInterceptor` retries a 401 once after a single-flight refresh; `403 PASSWORD_CHANGE_REQUIRED` routes to change-password. | `staff-console/src/lib/fetchInterceptor.ts` |
| Console logout | Clears state and storage at once; revokes the refresh token best-effort. | `stores/auth.ts` `logout` |
| CORS | Static allow-list (`CORS_ORIGINS`) outside dev/test; **no credentials** (no cookies cross-origin). | `config/cors.config.ts`, `main.ts` |
| Security headers | helmet on **API responses** (CSP, HSTS, nosniff, frame, referrer), CORP `cross-origin` (BL-12). The console is a static SPA on a separate host and **has no CSP of its own** (host not chosen). | `config/app-security.ts`, [DEPLOYMENT](../operations/DEPLOYMENT.md) |
| XSS surface in the console | Vue template escaping everywhere; **no `v-html`** in application code; runtime dependencies are only `vue`, `pinia`, `vue-router`, `vue-i18n`; no third-party scripts. User-supplied files (complaint attachments, documents) are now saved as `application/octet-stream`, never rendered on the console origin (BL-36). | `staff-console/src`, `package.json` |
| Parent app | Bearer tokens in `flutter_secure_storage` (Keychain/Keystore) — not browser storage, **not affected by KG-9**. Affected by KG-15: it opened PDFs and attachments with `?access_token=` URLs; now uses download links (§6). | `parent-app/lib/src/auth/token_store.dart`, `api_client.dart` |

## 3. Threat model

| | `localStorage` + bearer (today) | HttpOnly cookie |
|---|---|---|
| **XSS** in the console | Script can **read and exfiltrate** both tokens. The refresh token gives the attacker a 30-day session **from their own machine**, surviving the victim closing the tab. Rotation does not stop it: whoever refreshes first wins, and without reuse detection the loser is simply logged out. | Script can still **act as the user while the page is open** (session riding) — no storage option stops that — but cannot read the token, so there is no persistent, off-device session. |
| **CSRF** | Not possible: the browser never attaches a bearer header on its own. | Possible for any cookie-authenticated endpoint. Needs SameSite, an Origin check and a CSRF token or required custom header. |
| **Token in URLs** (KG-15) | Access token was in download URLs → server/proxy logs, browser history, Referer. **Closed** (§6). | Same-site downloads could use the cookie directly. |
| **Shared/kiosk PCs** (school offices) | Tokens survive browser restart until logout; anyone reading storage later takes the session. | Cookie also survives restart unless it is a session cookie; not readable by later scripts. |

The deciding question is **how much a single XSS bug should cost**: today it costs a 30-day account takeover; with the refresh token out of JavaScript's reach it costs "whatever the attacker does while the victim's tab is open".

## 4. Options

### A. Accept with mitigation (keep bearer + `localStorage`)
- **CSP on the console host:** `default-src 'self'; script-src 'self'; connect-src 'self' <API origin>; img-src 'self' blob: data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. Makes injected inline script fail — the most effective XSS control available.
- **Refresh-token reuse detection:** give refresh tokens a family id; presenting a revoked token of a family revokes the whole family (and bumps `tokenVersion`). Turns "attacker keeps the session" into "both sides are logged out and the event is audited".
- **Shorter staff refresh lifetime** (for example 12 h idle / 7 days absolute instead of 30 days) — owner policy.
- **Cost:** S (reuse detection ~1 day incl. tests; CSP is host configuration, needs the host). **No deployment coupling.**
- **Residual:** an XSS still exfiltrates a refresh token valid until the next rotation or the idle limit.

### B. Hybrid — refresh token in an HttpOnly cookie, access token in memory (recommended)
- Console login/refresh answer the access token in the body as now **and** set the refresh token as `__Host-`-style cookie: `HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth`. The access token lives only in memory (Pinia state, not persisted); a page reload calls `/auth/refresh` with `credentials: 'include'`.
- **Nothing sensitive in `localStorage`** (only non-secret UI state such as role for the first paint, or nothing).
- **CSRF surface is two endpoints** (`/auth/refresh`, `/auth/logout`): refresh returns tokens only in a response body that a cross-site page cannot read (CORS), logout is at worst a nuisance. Still enforce: exact `Origin` allow-list check and a required custom header (`X-SchoolOS-CSRF: 1`, which forces a CORS preflight) on both; e2e tests for missing header, foreign Origin and cross-site request.
- Every other API call stays bearer — the ~60 `api.ts` call sites, the interceptor and the parent app are untouched. The parent app keeps body-based refresh (the cookie path is opt-in per client, e.g. `POST /auth/login` with `{ session: 'cookie' }`).
- **Needs:** CORS `credentials: true` (exact origins only — already the case), **console and API on the same registrable domain** (e.g. `console.example.pk` + `api.example.pk`) so `SameSite=Strict` works and third-party-cookie blocking (Safari ITP, Chrome) cannot break refresh. Multi-tab: rotation must tolerate two tabs refreshing at once (a short grace window for the just-rotated token, or a `BroadcastChannel` leader). Plus the §4A mitigations.
- **Cost:** M (backend cookie issue/clear + CSRF checks + e2e; console store + interceptor + reload flow + tests; deployment docs; ~3–4 days).
- **Residual:** session riding during an XSS; no offline takeover.

### C. Full cookie session (access and refresh tokens both in cookies)
- JwtStrategy reads a cookie for the console; **every state-changing route** needs CSRF protection (double-submit token or custom header + Origin check); downloads could become plain same-site links.
- **Cost:** L (the global guard accepts two credential kinds; CSRF must be proven on every mutating route; larger regression surface across 60+ call sites). Security gain over B is small: B already keeps the long-lived credential away from script, and the 15-minute access token in memory is readable by an XSS either way.

| | A | B | C |
|---|---|---|---|
| XSS → persistent takeover | yes (limited by idle TTL, reuse detection) | **no** | no |
| CSRF work | none | 2 endpoints | every mutating route |
| Deployment coupling | none | same-site domains, credentialed CORS | same-site domains, credentialed CORS |
| Parent app change | none | none | none |
| Effort | S | M | L |

## 5. Recommendation

1. **Adopt B (hybrid)**, gated on the owner's domain decision (RD-2): the console and the API must be served under one registrable domain. If the pilot cannot guarantee that, run **A** for the pilot and schedule B for when the domains are fixed.
2. **Do A's reuse detection and console CSP in either case** — both help under B too.
3. **Do not choose C:** most of its cost buys little over B.

### Owner-gated (not started until chosen)

| Decision | Why it is the owner's |
|---|---|
| A, B or C | Security/effort trade-off and whether it lands before the pilot (Q42 allows a separate hardening phase) |
| Console and API domains (same registrable domain) | RD-2 is open; B and C do not work reliably cross-site |
| Staff session lifetime (idle/absolute) | A policy choice for school office PCs |
| Console CSP | Needs the chosen static host (DEPLOYMENT: host not selected) |
| Forced re-login at rollout | B/C invalidate existing `localStorage` sessions once |

## 6. Implemented now: no token in any query string (KG-15)

- **Backend:** `JwtStrategy` accepts an access token **only** from the `Authorization` header. `?access_token=` is ignored on every route (e2e: 401 on all five former download routes).
- **Download links:** `POST /api/v1/auth/download-link {path}` (bearer-authenticated) returns `{url, expiresAt}` where `url` is the path plus `?dl=<token>`. The token is a JWT `{sub, tv, typ: 'dl', path}`:
  - signed with a key **derived from** the access secret (HMAC of a fixed label), so a link token never verifies as an access token and an access token never verifies as a link token;
  - valid only for the **exact path** it was minted for, only on `GET`, only on the five download route shapes (`/files/:id`, `/fee-vouchers/:id/pdf`, `/fee-payments/:id/receipt.pdf`, `/report-cards/:id/pdf`, `/report-cards/generated/:id/pdf`; ids are `[\w-]+`, so no `..`);
  - expires after **120 s**; carries `tokenVersion`, so logout-all, disable and password change kill outstanding links; the route's own authorization still runs as the user.
  - Not single-use on purpose: PDF viewers and browsers may re-request (range requests, retries) within the window.
  - `?dl=` values are scrubbed from logs like `?access_token=` was; access logs never contain query strings.
- **Parent app:** asks for a link just before opening a file or PDF in the system browser (`ApiClient.downloadLink`, `openDownload` shows a snackbar on failure).
- **Staff console:** puts **no credential in any URL**. Files and PDFs are fetched with the bearer header (so the 401-refresh interceptor applies — fixes the old "download link with an expired token" gap) and shown as blob URLs (logos, photos) or saved as `application/octet-stream` downloads (attachments, receipts, report cards), so an uploaded HTML file can never render on the console origin.
- **Tests:** `backend/test/download-links.e2e-spec.ts` (written failing first: 11 of 12 failed before the change), updated `diary-circulars`, `fees`, `generated-report-cards`, `observability` e2e; unit `download-link.spec.ts`, `jwt.strategy.spec.ts`; console `lib/authedFile.spec.ts` and the affected view specs; parent app `test/api/api_client_download_link_test.dart`.
- **Residual:** a `?dl=` URL in a parent's browser history opens one document for at most two minutes after it was minted.
