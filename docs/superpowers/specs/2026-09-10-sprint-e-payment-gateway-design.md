# Sprint E — Payment Gateway & Local Rails (Phase 2)

Status: approved (design), ready for implementation planning.
Spec source: `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`, Implementation Checklist
lines 53-57 ("Sprint E — Payment Gateway & Local Rails (Phase 2)"):
- `PaymentGateway` adapter interface + JazzCash/EasyPaisa implementation
- PDF voucher generation
- Cash/manual-payment reconciliation workflow
- Webhook signature verification on the gateway callback endpoint

## Reconciliation with the roadmap doc before scoping work

The roadmap's own Sprint E section describes this as greenfield ("No payment-gateway adapter exists
today (confirmed absent by the Repo Audit)") — that's stale. The Repo Audit it cites is anchored to
commit `1e74697`; Sprint 9-10 (Fees + Leave, `2026-09-03-fees-leave-design.md`) already landed before
this roadmap was compiled and built:

- A real `PaymentGatewayAdapter` interface (`backend/src/fees/payment-gateway-adapter.ts`) with a
  `StubPaymentGatewayAdapter`, following the `StorageAdapter`/`PushAdapter` swappable-adapter
  precedent.
- `FeesPdfService` (`backend/src/fees/fees-pdf.service.ts`, pdfkit) — voucher and receipt PDFs,
  wired to `GET /fee-vouchers/:id/pdf` and `GET /fee-payments/:id/receipt.pdf`.
- `FeePayment.method`/`.reference` fields already shaped for this work (`method` comment already
  lists `"jazzcash" | "easypaisa" | "manual"`; `reference` is `@unique`, already commented "lets a
  retried webhook be a no-op instead of a duplicate payment").

So of the four checklist lines: **PDF voucher generation is already done** (verify only, no new
work). The other three are real, and this spec scopes exactly those three.

## Constraint that shapes everything below

No real JazzCash or EasyPaisa merchant account exists in this environment (confirmed with the user).
Decision (confirmed): build both adapters to their publicly documented request/signature shape,
behind the existing interface, selectable via env config — but they cannot be exercised against a
real sandbox, and this is called out explicitly rather than implied as "done."

- **JazzCash**: field names (`pp_Version`, `pp_TxnType`, `pp_MerchantID`, `pp_Amount`,
  `pp_TxnRefNo`, `pp_SecureHash`, etc.) are confirmed via JazzCash's own sandbox docs
  (`sandbox.jazzcash.com.pk/SandboxDocumentation`). The secure-hash algorithm itself (sort `pp_*`
  fields alphabetically, `&`-join values, prepend the Integrity Salt, HMAC-SHA256 keyed by the
  salt, uppercase hex output) is **not published on those pages** — it's gated behind a
  merchant-onboarding PDF we don't have. This spec uses the algorithm consistently reproduced
  across independent third-party JazzCash integrations as the best available basis, flagged as
  **unverified against JazzCash's current official spec** — confirm against the real merchant PDF
  before ever pointing this at a live sandbox.
- **EasyPaisa**: exact field order/encoding varies by product line (Hosted Checkout vs. Mobile
  Account API vs. older APIs) per every source consulted, including the two the user asked to be
  checked. The adapter will conform to the shared `PaymentGatewayAdapter` interface and wire real
  HMAC-SHA256 verification plumbing, but the exact field list/order is left as an explicit
  `// TODO: confirm against your EasyPaisa merchant integration doc` rather than asserted as fact.
- A third-party aggregator (e.g. rapidgateway.pk, surfaced while researching this) is a real
  alternative to direct integration, offering one unified API instead of two gateway-specific ones.
  Out of scope for this sprint (not evaluated for cost/reliability/lock-in) — noted here so it isn't
  silently forgotten if direct integration proves painful later.

## Security fix this sprint makes mandatory

Today, `POST /fee-payments/:id/confirm` is called **directly by the paying parent's client** after
the stub "checkout" screen completes — there is no server-to-server callback at all. Against a real
gateway this is a hole: nothing stops a client from calling it to mark its own payment completed
without ever paying. This is *why* "webhook signature verification" is a meaningful, non-optional
line item, not a nice-to-have.

**Decision (confirmed):** a signed webhook becomes the only way a payment is marked completed/failed.
The client-callable confirm route is removed.

## Design

### 1. Gateway adapter factory

`PaymentGatewayAdapter` shrinks to just `initiate()`. Its `confirm()` method existed only to serve
the old client-driven design being removed in §2 below — once a signed webhook is the *only* path
to a completed/failed payment, nothing ever calls `adapter.confirm()` again, on any adapter
(stub included). Carrying it forward as a method every adapter must implement but nothing calls
is dead-code weight, not a real abstraction; it's dropped rather than kept-but-unused.
`StubPaymentGatewayAdapter.confirm()` is deleted for the same reason. Add:

```ts
// backend/src/fees/payment-gateway-adapter-factory.ts
export const PAYMENT_GATEWAY_ADAPTER_FACTORY = 'PAYMENT_GATEWAY_ADAPTER_FACTORY';

export interface PaymentGatewayAdapterFactory {
  getAdapter(method: 'jazzcash' | 'easypaisa' | 'stub'): PaymentGatewayAdapter;
}
```

- `JazzCashAdapter implements PaymentGatewayAdapter` (`backend/src/fees/jazzcash.adapter.ts`) —
  builds the `pp_*` payload, computes `pp_SecureHash` via a standalone `JazzCashSigner`
  (`sign`/`verify`, HMAC-SHA256, isolated from the adapter so the webhook handler can reuse
  `verify` without depending on the whole adapter). Config: `JAZZCASH_MERCHANT_ID`,
  `JAZZCASH_PASSWORD`, `JAZZCASH_INTEGRITY_SALT`, `JAZZCASH_RETURN_URL`, `JAZZCASH_API_URL`.
- `EasyPaisaAdapter implements PaymentGatewayAdapter` (`backend/src/fees/easypaisa.adapter.ts`) —
  same shape, `EasyPaisaSigner`, field list marked TODO per the caveat above. Config:
  `EASYPAISA_STORE_ID`, `EASYPAISA_HASH_KEY`, `EASYPAISA_RETURN_URL`, `EASYPAISA_API_URL`.
- `PaymentGatewayAdapterFactoryImpl` — in `development`/`test`, or when a provider's env vars are
  unset, `getAdapter('jazzcash'|'easypaisa')` falls back to `StubPaymentGatewayAdapter` (so local
  dev/CI need zero real config, matching every prior sprint's dev-friendliness). Outside
  `development`/`test`, requesting a provider with incomplete config throws a clear
  `PaymentGatewayConfigError` — same fail-fast spirit as `resolveAccessTokenSecret()`
  (Sprint A), applied per-provider instead of at boot (a school might only ever enable one of the
  two gateways).
- `FeePaymentsService.pay()` picks the adapter via `method` (a new required field on the pay
  request, `'jazzcash' | 'easypaisa'` — parent chooses at checkout; no default, since guessing
  which wallet a parent has is not this service's job).

### 2. Webhook endpoint (signature verification lives here)

`POST /api/v1/payments/webhook/:gateway` (`gateway` = `jazzcash` | `easypaisa` | `stub`), **public,
no JWT guard** — gateways can't authenticate as a user. New `PaymentsWebhookController`:

1. Look up the signer for `:gateway` (`JazzCashSigner`/`EasyPaisaSigner`/a fixed dev-only
   `StubSigner`) and call `verify(body, providedSignature)`. Reject with 401 on mismatch — no
   payment lookup happens before a valid signature.
2. Resolve the `FeePayment` by its unique `reference` (already unique in schema, already commented
   for exactly this purpose).
3. If already `completed`/`failed`, no-op and return 200 (idempotent — gateways retry webhook
   delivery, per both sources consulted).
4. Otherwise apply the same `completed`/`failed` transition `FeePaymentsService.confirm()` already
   implements (zero-allocation-on-failure, receipt-on-success) — refactored into a method that
   takes a resolved status directly (`confirmFromWebhook(reference, status)`), since the webhook
   already *has* the gateway's verified status and must not call back out to `gateway.confirm()`
   (that round-trip belonged to the old client-driven design being removed).

`POST /fee-payments/:id/confirm` and `FeePaymentsService.confirm()`'s public/parent-facing shape
are **removed**. `GET /api/v1/fee-payments/:id` is **added** (ownership-checked, same pattern as
`getForStudent`) so a client can poll status after redirecting back from checkout — replaces the
client's former ability to declare its own payment completed with the ability to only ever read
what the (verified) webhook already decided.

**Stub mode**, so local dev/tests exercise the exact same webhook + signature-check path a real
gateway would hit: `StubPaymentGatewayAdapter.initiate()` returns a `redirectUrl` pointing at the
existing stub checkout screen; "Complete Payment" now calls the webhook endpoint (`gateway=stub`,
signed with a fixed dev-only shared secret) instead of the old direct confirm call. One code path,
one thing to test, no special-cased dev bypass of signature checking.

### 3. Cash / manual-payment reconciliation

New `POST /api/v1/fee-vouchers/:id/reconcile` — `@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')`.
Body: `{ amount, method: 'cash' | 'bank_transfer', note?: string }`. Creates a `FeePayment` directly
in `completed` status (no gateway involved — staff are asserting money was already received),
allocated against the voucher via the existing `FeePaymentAllocation` shape, receipt generated the
same way gateway confirmation does, audit-logged (`fee-payment.reconcile`). Rejects (400) an amount
exceeding the voucher's current `amountDue`, mirroring `pay()`'s existing fully-paid guard.

**UI (confirmed with user):** added to `FeeManagementView.vue`'s existing Student Ledger section — a
small form (amount, method dropdown, optional note) next to the ledger table, submits and reloads
both the voucher and payments lists. No new dedicated screen.

### 4. Client changes

**staff-console**: reconciliation form as above; no other change (issuance/ledger views are
otherwise untouched).

**parent-app**: `StubCheckoutScreen` still calls `payVoucher()`, but "Complete Payment" now POSTs to
the stub webhook route instead of `confirmPayment()` (which no longer exists), then polls the new
`GET /fee-payments/:id` once to reflect the real (webhook-set) status rather than assuming success.
For a real gateway's `redirectUrl` (once real credentials exist), open it via the existing
`url_launcher` dependency (already in `pubspec.yaml`) in an external browser tab — deliberately not
adding a `webview_flutter` dependency for a flow that can't be live-tested this sprint anyway
(YAGNI; add it later if an embedded-webview UX is actually wanted).

### 5. Data model

No migration. `FeePayment.method`/`.reference` already support everything above. Reconciliation
reuses `FeePayment`/`FeePaymentAllocation`/`Receipt` as-is.

### 6. Testing

- `JazzCashSigner`/`EasyPaisaSigner`: sign/verify round-trip, and a tampered-field rejection test.
  These are **self-consistency tests** (the signer verifying its own output) — they prove the code
  is internally correct, not that it matches JazzCash/EasyPaisa's real servers; that requires a live
  sandbox this environment doesn't have.
- e2e: full stub-webhook-driven voucher → pay → webhook → receipt loop.
- e2e: a repeated webhook call for an already-completed payment is a no-op (idempotency).
- e2e: an unsigned/badly-signed webhook call is rejected (401) and does not mutate payment state.
- e2e: the old `POST /fee-payments/:id/confirm` route no longer exists (404), closing the
  self-confirm hole as a regression-locked fact, not just a design intent.
- e2e: cash reconciliation — staff records a cash payment, voucher status/ledger updates, receipt
  PDF renders.
- e2e: reconciling more than `amountDue` is rejected (400).

### Out of scope this sprint

- A job runner / scheduled retry queue for webhook delivery failures — the roadmap flags this as a
  "decide once" item needed again in Phase 4/8; not needed here since the webhook handler is
  synchronous and gateways handle their own retry (per both sources consulted). Revisit when a real
  gateway account exists and real-world delivery failures are observable.
- Live verification against a real JazzCash/EasyPaisa sandbox — blocked on merchant onboarding
  (weeks of vendor lead time per the roadmap's own "Long-lead integrations" section), not an
  engineering task this sprint can close.
- Evaluating a payment-aggregator alternative (e.g. rapidgateway.pk) to direct gateway integration.
