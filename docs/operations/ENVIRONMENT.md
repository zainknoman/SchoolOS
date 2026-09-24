# Environment Variables

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** every `process.env.*` / `config.get('…')` read under `backend/src`, `backend/prisma`, `backend/prisma.config.ts`; `backend/.env.example`; `staff-console/src/lib/api.ts`; `parent-app/lib/main.dart` · **Owner:** Operations/Deployment Owner
> Build method: union of variables read by code compared with `.env.example` (scripted grep, 2026-09-20). "Fail" = behaviour when missing/partial.

## Backend (`backend/`)
| Variable | Req.? | Default / fallback | Secret | Notes and failure mode |
|---|---|---|---|---|
| `DATABASE_URL` | **Required** everywhere | none | Yes | PostgreSQL URL (`postgresql://user:pass@host:5432/db?schema=public`); read by `prisma.config.ts` and `PrismaService`. Missing ⇒ Prisma error at start |
| `NODE_ENV` | **Required everywhere** (BL-51) | none — the API refuses to start when unset or not one of `development`, `test`, `staging`, `production` | No | `development`/`test` enable local fallbacks (JWT secret, stub webhook secret, localhost CORS, provider stubs); `test` relaxes throttling. Anything else is strict |
| `PORT` | No | `3000` | No | `main.ts` |
| `BOOTSTRAP_SUPER_ADMIN_IDENTIFIER` / `BOOTSTRAP_SUPER_ADMIN_PASSWORD` | Only for the one-time `npm run bootstrap:super-admin` (BL-22) | none | **Yes** (password) | Password ≥ 12 characters; remove after the run. `BOOTSTRAP_SUPER_ADMIN_DISABLED=true` makes the command refuse |
| `ADMIN_PASSWORD_RESET` | No | `auto` | No | BL-64 admin-assisted parent reset: `auto` = enabled only while SMTP is unset (the pilot fallback), `enabled`/`disabled` force it. When off, the endpoint answers 409 |
| `CLAMAV_HOST` / `CLAMAV_PORT` | No | unset ⇒ no malware scanning; port `3310` | No | BL-52: when set, every upload is streamed to clamd (INSTREAM) before storage; infected ⇒ 422 + audit `file.rejected-malware`; clamd unreachable ⇒ upload refused (503, fail-closed) |
| `LOG_FORMAT` / `LOG_LEVEL` | No | `json` outside dev/test (else `pretty`) / `log` | No | BL-11 structured logs ([MONITORING-LOGGING](MONITORING-LOGGING.md)) |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` / `APP_RELEASE` | No | reporting off / `NODE_ENV` / unset | DSN: Yes | BL-11 error reporting (Sentry-envelope protocol, provider-agnostic); invalid DSN refuses to boot |
| `TRUST_PROXY` | **Required behind a reverse proxy** (BL-12) | unset ⇒ trust no proxy (`X-Forwarded-For` ignored) | No | Express `trust proxy` (`config/app-security.ts`): hop count (`1` behind one TLS proxy/load balancer), `true`/`false`, or addresses/subnets. Without it, every client behind the proxy shares one rate-limit bucket |
| `CORS_ORIGINS` | Required outside dev/test | `http://localhost:5173` | No | comma-separated origins; dev/test additionally allow any localhost origin |
| `JWT_ACCESS_SECRET` | **Required** outside dev/test | `dev-only-change-me-access` in dev/test | Yes | Boot error if unset outside dev/test; **any non-empty value is accepted, including `change-me`** (KG-2) |
| `JWT_ACCESS_TTL` | No | `15m` | No | `ms`-style string; invalid value fails at JWT module registration |
| `FRONTEND_URL` | Required for password-reset links | `http://localhost:5173` | No | Base URL placed in reset emails (`auth.service.ts:168`); a single URL — how parent-app users complete a reset from a link is **UNKNOWN** |
| `STORAGE_DRIVER` | **`s3` required outside development/test** (BL-10) | `local` | No | `local` writes to `UPLOADS_DIR` (development/test only; boot validation refuses it elsewhere); `s3` uses the S3-compatible bucket below |
| `S3_BUCKET` / `S3_REGION` / `S3_ENDPOINT` / `S3_FORCE_PATH_STYLE` / `S3_KEY_PREFIX` | `S3_BUCKET` required with `STORAGE_DRIVER=s3` | region `us-east-1`; endpoint = AWS; path-style `false`; prefix none | No | Any S3-compatible provider (vendor TBD, RD-3): set `S3_ENDPOINT` and usually `S3_FORCE_PATH_STYLE=true` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | With `STORAGE_DRIVER=s3` unless the host provides credentials (instance role) | SDK default chain | **Yes** | Bucket-scoped credentials only |
| `UPLOADS_DIR` | No | `./uploads` (process cwd) | No | Local-disk file store (development/test), and the source directory for `npm run storage:copy-to-s3` |
| `SEED_PASSWORD` | Only for `npm run prisma:seed` | none (seed throws) | Yes | Never set in production |
| `JAZZCASH_MERCHANT_ID`, `_PASSWORD`, `_INTEGRITY_SALT`, `_RETURN_URL`, `_API_URL` | Optional as a group | all unset ⇒ gateway disabled | Yes (first three) | Partial set ⇒ startup error outside dev/test |
| `EASYPAISA_STORE_ID`, `_HASH_KEY`, `_RETURN_URL`, `_API_URL` | Optional as a group | all unset ⇒ disabled | Yes (`HASH_KEY`) | same rule |
| `PAYMENT_STUB_WEBHOOK_SECRET` | Required outside dev/test | `dev-only-stub-webhook-secret` in dev/test | Yes | `gateway-config.ts:56-61` |
| `FIREBASE_PROJECT_ID`, `_CLIENT_EMAIL`, `_PRIVATE_KEY` | Optional as a group | unset ⇒ logging no-op push (all envs) | Yes | private key with literal `\n` sequences |
| `SMTP_HOST`, `_PORT`, `_USER`, `_PASS`, `_FROM` | Optional as a group | unset ⇒ `LoggingMailAdapter` **logs reset links** (all envs, KG-4) | Yes (`PASS`) | partial set ⇒ startup error outside dev/test |
| `WHATSAPP_BUSINESS_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN` | Optional as a group | unset ⇒ logging adapter | Yes | Meta Graph API; **missing from `.env.example`** |
| `SMS_GATEWAY_API_KEY`, `SMS_GATEWAY_SENDER_ID` | Optional as a group | unset ⇒ logging adapter | Yes | sender calls a **placeholder URL** (`sms-sender.ts:18`); **missing from `.env.example`** |
| `ANTHROPIC_API_KEY` | Optional | unset ⇒ stub drafting provider | Yes | |

**Boot-time validation (BL-51, `src/config/env.validation.ts`).** Outside `development`/`test` the API refuses to start — listing every problem at once — unless `JWT_ACCESS_SECRET` is at least 32 characters and not a placeholder (`change-me`, `secret`, `example`, `dev-only`, …) and `DATABASE_URL`, `CORS_ORIGINS` and `FRONTEND_URL` are set. An empty value counts as unset. Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

`JWT_REFRESH_SECRET`/`JWT_REFRESH_TTL` were removed from `.env.example` (2026-09-24): refresh tokens are opaque and fixed at 30 days (`auth.constants.ts`). **Read by code but absent from `.env.example`:** `PORT`, `UPLOADS_DIR`, `WHATSAPP_*`, `SMS_GATEWAY_*`.

## Decided environment policy (owner, 2026-09-20) — not all implemented
- **Separate secrets per environment** (development, staging, production); nothing shared. `NODE_ENV` must be set explicitly (`staging`/`production` on servers) and placeholder secrets are rejected at startup — **implemented 2026-09-24 (BL-51)**.
- Variables the decided design **adds** (names indicative, `NOT IMPLEMENTED`): object-storage endpoint/bucket/credentials (BL-10); Sentry DSN and scrubbing settings (BL-11); bootstrap SUPER_ADMIN credentials, consumed once (BL-22); separate parent reset base URL/deep-link scheme (BL-35); per-integration feature flags, default **off** for payment gateways, WhatsApp and AI drafting (Q34, Q38, Q39); SMS/e-mail provider selection variables (Q36, Q37).
- `FRONTEND_URL` remains a single staff-console URL today; parents must not be sent to it (KI-7 -> BL-35).
- Signing keys, keystores, Firebase service accounts and store credentials are **never committed** (Q32); the parent app's `firebase_options.dart` placeholder is replaced per environment (BL-34, BL-43).
- `.env.example` and `backend/.env` still contain `schoolportal` naming (DB name); the rename is decided (BL-34) but needs an explicit keep/rename decision for existing local databases.

## Staff console (Vite)
| Variable | Default | Notes |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:3000` | baked at build time (`src/lib/api.ts:1`); no `.env.example` exists |

## Parent app (Flutter)
| Setting | Default | Notes |
|---|---|---|
| `--dart-define=API_BASE_URL=…` | `http://localhost:3000` | compile-time (`main.dart:20`); Android emulator needs `http://10.0.2.2:3000` |
| Firebase options | placeholder `firebase_options.dart` | no real Firebase project wired |

## CI environment
`ci.yml` sets `DATABASE_URL` for Postgres 16 and copies `.env.example` to `.env`.
