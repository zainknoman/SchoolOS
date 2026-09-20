# Environment Variables

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** every `process.env.*` / `config.get('…')` read under `backend/src`, `backend/prisma`, `backend/prisma.config.ts`; `backend/.env.example`; `staff-console/src/lib/api.ts`; `parent-app/lib/main.dart` · **Owner:** Operations/Deployment Owner
> Build method: union of variables read by code compared with `.env.example` (scripted grep, 2026-09-20). "Fail" = behaviour when missing/partial.

## Backend (`backend/`)
| Variable | Req.? | Default / fallback | Secret | Notes and failure mode |
|---|---|---|---|---|
| `DATABASE_URL` | **Required** everywhere | none | Yes | PostgreSQL URL (`postgresql://user:pass@host:5432/db?schema=public`); read by `prisma.config.ts` and `PrismaService`. Missing ⇒ Prisma error at start |
| `NODE_ENV` | **Effectively required in production** | unset ⇒ treated as `development` | No | `development`/`test` enable insecure fallbacks (JWT secret, stub webhook secret, localhost CORS, provider stubs). `test` relaxes throttling. **Set `production`** (KG-3) |
| `PORT` | No | `3000` | No | `main.ts` |
| `CORS_ORIGINS` | Required outside dev/test | `http://localhost:5173` | No | comma-separated origins; dev/test additionally allow any localhost origin |
| `JWT_ACCESS_SECRET` | **Required** outside dev/test | `dev-only-change-me-access` in dev/test | Yes | Boot error if unset outside dev/test; **any non-empty value is accepted, including `change-me`** (KG-2) |
| `JWT_ACCESS_TTL` | No | `15m` | No | `ms`-style string; invalid value fails at JWT module registration |
| `FRONTEND_URL` | Required for password-reset links | `http://localhost:5173` | No | Base URL placed in reset emails (`auth.service.ts:168`); a single URL — how parent-app users complete a reset from a link is **UNKNOWN** |
| `UPLOADS_DIR` | No | `./uploads` (process cwd) | No | Local-disk file store; not in `.env.example` |
| `SEED_PASSWORD` | Only for `npm run prisma:seed` | none (seed throws) | Yes | Never set in production |
| `JAZZCASH_MERCHANT_ID`, `_PASSWORD`, `_INTEGRITY_SALT`, `_RETURN_URL`, `_API_URL` | Optional as a group | all unset ⇒ gateway disabled | Yes (first three) | Partial set ⇒ startup error outside dev/test |
| `EASYPAISA_STORE_ID`, `_HASH_KEY`, `_RETURN_URL`, `_API_URL` | Optional as a group | all unset ⇒ disabled | Yes (`HASH_KEY`) | same rule |
| `PAYMENT_STUB_WEBHOOK_SECRET` | Required outside dev/test | `dev-only-stub-webhook-secret` in dev/test | Yes | `gateway-config.ts:56-61` |
| `FIREBASE_PROJECT_ID`, `_CLIENT_EMAIL`, `_PRIVATE_KEY` | Optional as a group | unset ⇒ logging no-op push (all envs) | Yes | private key with literal `\n` sequences |
| `SMTP_HOST`, `_PORT`, `_USER`, `_PASS`, `_FROM` | Optional as a group | unset ⇒ `LoggingMailAdapter` **logs reset links** (all envs, KG-4) | Yes (`PASS`) | partial set ⇒ startup error outside dev/test |
| `WHATSAPP_BUSINESS_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN` | Optional as a group | unset ⇒ logging adapter | Yes | Meta Graph API; **missing from `.env.example`** |
| `SMS_GATEWAY_API_KEY`, `SMS_GATEWAY_SENDER_ID` | Optional as a group | unset ⇒ logging adapter | Yes | sender calls a **placeholder URL** (`sms-sender.ts:18`); **missing from `.env.example`** |
| `ANTHROPIC_API_KEY` | Optional | unset ⇒ stub drafting provider | Yes | |

**In `.env.example` but not read by code:** `JWT_REFRESH_SECRET`, `JWT_REFRESH_TTL` (refresh tokens are opaque and fixed at 30 days — `auth.constants.ts`). **Read by code but absent from `.env.example`:** `NODE_ENV`, `PORT`, `UPLOADS_DIR`, `WHATSAPP_*`, `SMS_GATEWAY_*`.

## Decided environment policy (owner, 2026-09-20) — not all implemented
- **Separate secrets per environment** (development, staging, production); nothing shared. `NODE_ENV=production` must be set explicitly in staging and production (KG-3, BL-51). Placeholder values such as `change-me` must be rejected at startup (BL-51).
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
