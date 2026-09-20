# External Integrations

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/src/fees/gateways/*`, `notifications/*`, `ai-drafting/*`, `storage/*`, `.env.example`, unit specs · **Owner:** Operations/Deployment Owner
> **Owner decisions (2026-09-20) do not change any verification status:** all integrations must be **configurable and must never block the core platform when credentials are unavailable** (feature flags default off; manual payment recording is the fallback).
**Rule:** an adapter existing is **not** production readiness. "Verification status" uses only: `Unit-tested with fakes` (colocated specs, no network), `Sandbox-verified`, `Production-verified`. **No integration below has been sandbox- or production-verified** (the archived status log states this for payments/FCM/WhatsApp/SMS; nothing in the repository contradicts it). Architecture: [`../architecture/INTEGRATIONS.md`](../architecture/INTEGRATIONS.md). Variables: [ENVIRONMENT](ENVIRONMENT.md).

Common facts: no retry, back-off, circuit breaker, queue or dead-letter handling exists for any outbound call (`grep retry` in adapters: none); no HTTP timeouts are set on the `fetch` senders; failures of notification/mail sends are caught, logged and swallowed (`notifications.service.ts:72`, `auth.service.ts:179`); no integration-specific monitoring exists.

| Integration | Implementation | Configuration / credentials | Dev fallback | Prod dependency | Webhook | Failure handling | Verification | Status |
|---|---|---|---|---|---|---|---|---|
| **JazzCash** | `fees/gateways/jazzcash.adapter.ts`, `jazzcash.signer.ts` (built to the public `pp_SecureHash` spec) | `JAZZCASH_MERCHANT_ID/PASSWORD/INTEGRITY_SALT/RETURN_URL/API_URL` (all-or-none) | stub gateway (dev/test only) | Merchant account | `POST /payments/webhook/jazzcash`, signature verified, idempotent | payment pending until webhook; failed ⇒ allocation zeroed; no polling/reconcile job | Unit-tested with fakes | CONFIGURATION REQUIRED + EXTERNAL SERVICE REQUIRED |
| **EasyPaisa** | `easypaisa.adapter.ts`, `easypaisa.signer.ts` | `EASYPAISA_STORE_ID/HASH_KEY/RETURN_URL/API_URL` | stub | Merchant account | `POST /payments/webhook/easypaisa` | same | Unit-tested; **hash field order unconfirmed** against an authoritative document (source comment `easypaisa.signer.ts:11`) | CONFIGURATION REQUIRED + EXTERNAL SERVICE REQUIRED |
| **Payment stub** | `stub-webhook.signer.ts`, stub adapter, parent-app `stub_checkout_screen` | `PAYMENT_STUB_WEBHOOK_SECRET` outside dev/test | — | none (must not be reachable in production) | `POST /payments/webhook/stub` | — | e2e `fees` | STUB |
| **Firebase Cloud Messaging** | `fcm-push.adapter.ts`, `fcm-sender.ts` (`firebase-admin`), device tokens via `POST /me/device-tokens`; Flutter `firebase_messaging` | `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY` (all-or-none); Flutter `firebase_options.dart` is a placeholder | logging no-op **in every environment** | Firebase project + apps registered | n/a | errors logged and swallowed; invalid-token cleanup: verify | Unit-tested with fakes | CONFIGURATION REQUIRED |
| **SMTP email** (password reset) | `smtp-mail.adapter.ts` (nodemailer) | `SMTP_HOST/PORT/USER/PASS/FROM`, `FRONTEND_URL` | `LoggingMailAdapter` — **logs the reset link** (KG-4) | SMTP provider | n/a | caught + logged; user still sees the generic message | Unit-tested | CONFIGURATION REQUIRED |
| **WhatsApp** | `whatsapp.adapter.ts`, `whatsapp-sender.ts` → Meta Graph API `graph.facebook.com/<version>/<phoneNumberId>/messages` | `WHATSAPP_BUSINESS_PHONE_ID`, `WHATSAPP_ACCESS_TOKEN` (not in `.env.example`) | logging adapter | WhatsApp Business account, approved templates (not modelled: free-text send) | none for delivery status | swallowed | Unit-tested with a fake sender | EXTERNAL SERVICE REQUIRED |
| **SMS** | `sms.adapter.ts`, `sms-sender.ts` → **`https://api.sms-gateway.example.pk/v1/send` (placeholder)** | `SMS_GATEWAY_API_KEY`, `SMS_GATEWAY_SENDER_ID` (not in `.env.example`) | logging adapter | An actual Pakistani SMS provider — **none chosen** | none | swallowed | Unit-tested with a fake sender | **STUB-LEVEL** — cannot send until the URL/provider is implemented (code issue) |
| **Anthropic (AI drafting)** | `anthropic-drafting.provider.ts` (`@anthropic-ai/sdk`) behind `ai-drafting-provider.ts` | `ANTHROPIC_API_KEY` | `stub-drafting.provider.ts` (labelled placeholder text) | Anthropic account, cost control | n/a | error path: verify | Unit-tested | EXTERNAL SERVICE REQUIRED (optional) |
| **File storage** | `LocalDiskStorageAdapter` only | `UPLOADS_DIR` | itself | persistent disk | n/a | read/write errors surface as 500 | Unit-tested | PARTIALLY IMPLEMENTED (no S3/object adapter) |
| **PDF generation** | `pdfkit` in-process (vouchers, receipts, report cards) | none | — | none | n/a | — | e2e (fees) | IMPLEMENTED |
| Auth providers / SSO | none | — | — | — | — | — | — | NOT IMPLEMENTED |

## Retry, monitoring and test strategy (all integrations)
Retry: none. Monitoring: none (see [MONITORING-LOGGING](MONITORING-LOGGING.md)). Test strategy today: adapter unit specs with injected fakes; gateway signers have signer specs; e2e uses stubs. Needed before production: sandbox runs with real credentials for each integration, recorded in `docs/release/`; a timeout/retry policy; delivery-status handling for messaging.

## Decided provider direction (owner, 2026-09-20)
| Integration | Decision | Launch role | Work item |
|---|---|---|---|
| JazzCash, EasyPaisa | Supported behind feature configuration; activated only with merchant accounts and sandbox/production credentials; **manual payment recording is the launch fallback** | Not a launch blocker; post-pilot | BL-14 |
| Firebase / FCM | Dedicated SchoolOS Firebase project; separate staging and production projects where practical; parent push + app config | Pilot (notifications operational) | BL-43, BL-14 |
| SMTP / transactional e-mail | Production provider behind a provider abstraction, env-configured; **provider not chosen** (RD-4) | Pilot (reset, notifications) | BL-14 |
| SMS | Behind an adapter/interface, **not coupled to the placeholder URL**; **provider not chosen** (RD-4) | Post-pilot unless required | BL-38 |
| WhatsApp | Future; official Business/Cloud API; **approved message templates** required (no unrestricted free text) | Post-pilot | BL-48 |
| AI drafting | Optional, **feature-flagged**, off by default; org-provided credentials, server-side only; configurable usage/cost limits; redact child data where possible | Post-pilot | BL-49 |
| File storage | **S3-compatible object storage** behind the storage service (student documents, report cards, certificates, admission documents, profile images); no persistent local disk | Pilot blocker | BL-10 |
| Parent password-reset delivery | Parent-app/web-compatible link (deep link), short-lived single-use token, separate from staff reset | Pilot blocker | BL-35 |

Verification: **unchanged** — no integration is sandbox- or production-verified. Recorded evidence (date, environment, result) is required in `docs/release/` before any status changes.
