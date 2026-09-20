# ADR-0009: Refresh tokens are opaque, hashed and rotated on use

**Status:** Accepted (retroactive) · **Verified:** 2026-09-20 against `main@15362b7`

## Context
Long-lived sessions for parents on mobile need revocation and theft detection.

## Decision
Refresh tokens are random values stored hashed in `RefreshToken`, valid 30 days, revoked when used and reissued.

## Evidence
- `auth/auth.service.ts:109-129`; `auth.constants.ts` (`REFRESH_TOKEN_TTL_DAYS = 30`).
- `JWT_REFRESH_SECRET`/`JWT_REFRESH_TTL` in `.env.example` are **not read by code**.

## Consequences
Replay of a used token fails; but no device/session management UI and no token-family revocation on reuse was verified.

## Review trigger
Revisit when adding session management or SSO.
