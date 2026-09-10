# Sprint E — Payment Gateway & Local Rails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give a parent a real (spec-shaped, not-yet-sandbox-verified) JazzCash/EasyPaisa payment path with signed-webhook confirmation, give staff a cash/bank-transfer reconciliation workflow, and close the self-confirm security hole in the existing stubbed payment flow.

**Architecture:** `PaymentGatewayAdapter.initiate()` stays the only outbound method (confirmation moves entirely to a signed webhook). A `PaymentGatewayAdapterFactory` selects JazzCash/EasyPaisa/stub per payment method, falling back to the stub in dev/test or when a provider's env vars are unset. A new `POST /api/v1/payments/webhook/:gateway` verifies a gateway-specific signature and is the only way a payment becomes `completed`/`failed`. Cash/bank payments skip the gateway entirely via a new staff-only reconcile endpoint.

**Tech Stack:** NestJS + Prisma (backend), Vue 3 + Vitest (staff-console), Flutter (parent-app). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-10-sprint-e-payment-gateway-design.md`

## Global Constraints

- No real JazzCash/EasyPaisa merchant account exists — adapters are built to publicly documented shape, explicitly flagged unverified against a live sandbox. Never claim live verification.
- JazzCash's secure-hash algorithm used here (sort `pp_*` fields alphabetically, `&`-join values, prepend Integrity Salt, HMAC-SHA256 keyed by the salt, uppercase hex) is community-standard, not confirmed against JazzCash's own merchant PDF — comment this in the code.
- EasyPaisa's exact field list/order is unconfirmed — implement the interface/HMAC plumbing, leave the field list as an explicit `// TODO: confirm against your EasyPaisa merchant integration doc`.
- `POST /fee-payments/:id/confirm` is removed entirely — a parent must never be able to mark their own payment completed. This is a deliberate breaking change, not an oversight.
- No schema migration — `FeePayment.method`/`.reference` already support everything here.
- No new npm/pub packages — reuse `crypto` (Node builtin) and the existing `url_launcher` (Flutter).
- Dev/test always falls back to the stub adapter regardless of `method` requested, so CI/local dev need zero real gateway config.

---

### Task 1: JazzCash signer + adapter + webhook verifier

**Files:**
- Modify: `backend/src/fees/payment-gateway-adapter.ts`
- Create: `backend/src/fees/gateways/webhook-signer.ts`
- Create: `backend/src/fees/gateways/jazzcash.signer.ts`
- Test: `backend/src/fees/gateways/jazzcash.signer.spec.ts`
- Create: `backend/src/fees/gateways/jazzcash.adapter.ts`
- Test: `backend/src/fees/gateways/jazzcash.adapter.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (this is the first task).
- Produces: `JazzCashSigner` (`sign(fields): string`, `verify(fields, providedHash?): boolean`), `JazzCashConfig` interface (`merchantId`, `password`, `integritySalt`, `returnUrl`, `apiUrl`, all `string`), `JazzCashAdapter implements PaymentGatewayAdapter` (constructor takes `JazzCashConfig`), `parseJazzCashWebhook(body): { reference: string; status: 'completed' | 'failed' }`, `JazzCashWebhookSigner implements PaymentWebhookSigner` (constructor takes `integritySalt: string`) — Task 4 wires all of these into the factory; Task 5's webhook controller consumes `PaymentWebhookSigner`.

- [ ] **Step 0: Shrink `PaymentGatewayAdapter` to just `initiate()`**

This must happen before writing any new adapter below — `JazzCashAdapter implements PaymentGatewayAdapter` only provides `initiate()`, so the interface has to already be initiate-only or it won't compile. Modify `backend/src/fees/payment-gateway-adapter.ts` to:

```ts
export interface PaymentInitiation {
  redirectUrl: string;
  gatewayReference: string;
}

/**
 * initiate() only. There is no confirm() — payment outcome only ever arrives via the signed
 * webhook (see PaymentsWebhookController, Task 5), never by an adapter calling back to its own
 * gateway. Carrying a confirm() every adapter must implement but nothing calls would be dead-code
 * weight, not a real abstraction.
 */
export interface PaymentGatewayAdapter {
  initiate(input: { amount: number; reference: string }): Promise<PaymentInitiation>;
}
```

This deletes the `PaymentConfirmation` interface and the `PAYMENT_GATEWAY_ADAPTER` token from this file. Nothing else in the codebase references either yet at this point in the plan (`fee-payments.service.ts`/`fees.module.ts`/its spec file are untouched until Task 4, and none of them import `PaymentConfirmation`), so this is safe in isolation. `StubPaymentGatewayAdapter` (existing) still has its own `confirm()` method — that's now just an extra method not required by the interface, which TypeScript allows; Task 4 deletes it for real as cleanup, not because leaving it would break anything before then.

Run `cd backend && npx tsc --noEmit` after this step — expect it to still pass (nothing yet depends on the removed `confirm()`/`PaymentConfirmation`).

- [ ] **Step 1: Write the failing signer test**

```ts
// backend/src/fees/gateways/jazzcash.signer.spec.ts
import { JazzCashSigner } from './jazzcash.signer';

describe('JazzCashSigner', () => {
  const salt = 'test-integrity-salt';
  const fields = {
    pp_Version: '1.1',
    pp_TxnType: 'MWALLET',
    pp_MerchantID: 'MC12345',
    pp_Amount: '500000',
    pp_TxnRefNo: 'pay_abc123',
  };

  it('produces a deterministic uppercase hex hash for the same fields', () => {
    const signer = new JazzCashSigner(salt);
    const hash1 = signer.sign(fields);
    const hash2 = signer.sign(fields);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9A-F]+$/);
  });

  it('verifies its own signed output', () => {
    const signer = new JazzCashSigner(salt);
    const hash = signer.sign(fields);
    expect(signer.verify(fields, hash)).toBe(true);
  });

  it('rejects a hash computed for different field values (tamper detection)', () => {
    const signer = new JazzCashSigner(salt);
    const hash = signer.sign(fields);
    const tampered = { ...fields, pp_Amount: '999999' };
    expect(signer.verify(tampered, hash)).toBe(false);
  });

  it('rejects a missing hash', () => {
    const signer = new JazzCashSigner(salt);
    expect(signer.verify(fields, undefined)).toBe(false);
  });

  it('ignores pp_SecureHash itself and non-pp_ fields when sorting/concatenating', () => {
    const signer = new JazzCashSigner(salt);
    const withExtras = { ...fields, pp_SecureHash: 'ignored-input-value', unrelatedField: 'x' };
    expect(signer.sign(withExtras)).toBe(signer.sign(fields));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/fees/gateways/jazzcash.signer.spec.ts`
Expected: FAIL — `Cannot find module './jazzcash.signer'`

- [ ] **Step 3: Implement the signer**

```ts
// backend/src/fees/gateways/jazzcash.signer.ts
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Implements JazzCash's pp_SecureHash scheme as consistently reproduced across independent
 * third-party JazzCash integrations: sort pp_* fields alphabetically (excluding pp_SecureHash
 * itself and empty values), '&'-join their values, prepend the Integrity Salt, HMAC-SHA256 keyed
 * by that same salt, uppercase hex output. NOT verified against JazzCash's own merchant-onboarding
 * PDF — no merchant account exists in this environment. Confirm against the real spec before
 * pointing this at a live sandbox (see docs/superpowers/specs/2026-09-10-sprint-e-payment-gateway-design.md).
 */
export class JazzCashSigner {
  constructor(private readonly integritySalt: string) {}

  sign(fields: Record<string, string>): string {
    const sortedValues = Object.keys(fields)
      .filter((key) => key.startsWith('pp_') && key !== 'pp_SecureHash' && fields[key] !== '')
      .sort()
      .map((key) => fields[key]);
    const stringToHash = [this.integritySalt, ...sortedValues].join('&');
    return createHmac('sha256', this.integritySalt).update(stringToHash).digest('hex').toUpperCase();
  }

  verify(fields: Record<string, string>, providedHash: string | undefined): boolean {
    if (!providedHash) return false;
    const expected = Buffer.from(this.sign(fields));
    const provided = Buffer.from(providedHash.toUpperCase());
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/fees/gateways/jazzcash.signer.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing adapter test**

```ts
// backend/src/fees/gateways/jazzcash.adapter.spec.ts
import { JazzCashAdapter, parseJazzCashWebhook, JazzCashWebhookSigner } from './jazzcash.adapter';
import { JazzCashSigner } from './jazzcash.signer';

const config = {
  merchantId: 'MC1',
  password: 'pw',
  integritySalt: 'salt',
  returnUrl: 'https://staff.example.com/pay/return',
  apiUrl: 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform',
};

describe('JazzCashAdapter', () => {
  it('initiate() returns a signed redirect URL carrying the reference as pp_TxnRefNo', async () => {
    const adapter = new JazzCashAdapter(config);
    const result = await adapter.initiate({ amount: 500000, reference: 'pay_abc123' });

    expect(result.gatewayReference).toBe('pay_abc123');
    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('pp_TxnRefNo')).toBe('pay_abc123');
    expect(url.searchParams.get('pp_Amount')).toBe('500000');
    expect(url.searchParams.get('pp_MerchantID')).toBe('MC1');

    const signer = new JazzCashSigner(config.integritySalt);
    const fields: Record<string, string> = {};
    url.searchParams.forEach((value, key) => (fields[key] = value));
    expect(signer.verify(fields, fields.pp_SecureHash)).toBe(true);
  });
});

describe('parseJazzCashWebhook', () => {
  it('maps pp_ResponseCode "000" to completed', () => {
    expect(parseJazzCashWebhook({ pp_TxnRefNo: 'pay_1', pp_ResponseCode: '000' })).toEqual({
      reference: 'pay_1',
      status: 'completed',
    });
  });

  it('maps any other response code to failed', () => {
    expect(parseJazzCashWebhook({ pp_TxnRefNo: 'pay_1', pp_ResponseCode: '124' })).toEqual({
      reference: 'pay_1',
      status: 'failed',
    });
  });
});

describe('JazzCashWebhookSigner', () => {
  it('verifyAndParse rejects a call with a bad pp_SecureHash', () => {
    const verifier = new JazzCashWebhookSigner(config.integritySalt);
    const result = verifier.verifyAndParse(
      { pp_TxnRefNo: 'pay_1', pp_ResponseCode: '000', pp_SecureHash: 'WRONG' },
      {},
    );
    expect(result.valid).toBe(false);
  });

  it('verifyAndParse accepts a correctly-signed completed callback', () => {
    const signer = new JazzCashSigner(config.integritySalt);
    const body = { pp_TxnRefNo: 'pay_1', pp_ResponseCode: '000' };
    const pp_SecureHash = signer.sign(body);
    const verifier = new JazzCashWebhookSigner(config.integritySalt);
    expect(verifier.verifyAndParse({ ...body, pp_SecureHash }, {})).toEqual({
      valid: true,
      reference: 'pay_1',
      status: 'completed',
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && npx jest src/fees/gateways/jazzcash.adapter.spec.ts`
Expected: FAIL — `Cannot find module './jazzcash.adapter'`

- [ ] **Step 7: Implement the adapter, webhook signer, and parser**

```ts
// backend/src/fees/gateways/jazzcash.adapter.ts
import { PaymentGatewayAdapter, PaymentInitiation } from '../payment-gateway-adapter';
import { PaymentWebhookSigner, WebhookVerificationResult } from './webhook-signer';
import { JazzCashSigner } from './jazzcash.signer';

export interface JazzCashConfig {
  merchantId: string;
  password: string;
  integritySalt: string;
  returnUrl: string;
  apiUrl: string;
}

function formatJazzCashDateTime(date: Date): string {
  return date.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

/**
 * Builds the redirect payload against JazzCash's publicly-documented Page Redirection / Mobile
 * Wallet request shape (pp_Version, pp_TxnType, pp_MerchantID, ... — confirmed via JazzCash's own
 * sandbox docs). Payment outcome never comes from this adapter — only from the signed webhook
 * (see PaymentsWebhookController) — so there is no confirm() method here.
 */
export class JazzCashAdapter implements PaymentGatewayAdapter {
  constructor(private readonly config: JazzCashConfig) {}

  async initiate(input: { amount: number; reference: string }): Promise<PaymentInitiation> {
    const signer = new JazzCashSigner(this.config.integritySalt);
    const now = new Date();
    const fields: Record<string, string> = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: this.config.merchantId,
      pp_Password: this.config.password,
      pp_TxnRefNo: input.reference,
      pp_Amount: String(input.amount),
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: formatJazzCashDateTime(now),
      pp_TxnExpiryDateTime: formatJazzCashDateTime(new Date(now.getTime() + 60 * 60 * 1000)),
      pp_BillReference: input.reference,
      pp_Description: 'SEEDS school fee payment',
      pp_ReturnURL: this.config.returnUrl,
    };
    const pp_SecureHash = signer.sign(fields);
    const query = new URLSearchParams({ ...fields, pp_SecureHash }).toString();

    return { redirectUrl: `${this.config.apiUrl}?${query}`, gatewayReference: input.reference };
  }
}

/** pp_ResponseCode "000" is JazzCash's documented success code. */
export function parseJazzCashWebhook(body: Record<string, string>): { reference: string; status: 'completed' | 'failed' } {
  return { reference: body.pp_TxnRefNo, status: body.pp_ResponseCode === '000' ? 'completed' : 'failed' };
}

export class JazzCashWebhookSigner implements PaymentWebhookSigner {
  private readonly signer: JazzCashSigner;
  constructor(integritySalt: string) {
    this.signer = new JazzCashSigner(integritySalt);
  }

  verifyAndParse(body: Record<string, string>): WebhookVerificationResult {
    if (!this.signer.verify(body, body.pp_SecureHash)) {
      return { valid: false };
    }
    return { valid: true, ...parseJazzCashWebhook(body) };
  }
}
```

This references `./webhook-signer`, created in Task 3 — write that file now too (small, shared by all three gateways):

```ts
// backend/src/fees/gateways/webhook-signer.ts
export interface WebhookVerificationResult {
  valid: boolean;
  reference?: string;
  status?: 'completed' | 'failed';
}

export interface PaymentWebhookSigner {
  verifyAndParse(
    body: Record<string, string>,
    headers: Record<string, string | undefined>,
  ): WebhookVerificationResult;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && npx jest src/fees/gateways/jazzcash`
Expected: PASS (all `jazzcash.signer.spec.ts` and `jazzcash.adapter.spec.ts` tests)

- [ ] **Step 9: Commit**

```bash
git add backend/src/fees/gateways/webhook-signer.ts backend/src/fees/gateways/jazzcash.signer.ts backend/src/fees/gateways/jazzcash.signer.spec.ts backend/src/fees/gateways/jazzcash.adapter.ts backend/src/fees/gateways/jazzcash.adapter.spec.ts
git commit -m "feat(fees): add JazzCash secure-hash signer, adapter, and webhook verifier"
```

---

### Task 2: EasyPaisa signer + adapter + webhook verifier

**Files:**
- Create: `backend/src/fees/gateways/easypaisa.signer.ts`
- Test: `backend/src/fees/gateways/easypaisa.signer.spec.ts`
- Create: `backend/src/fees/gateways/easypaisa.adapter.ts`
- Test: `backend/src/fees/gateways/easypaisa.adapter.spec.ts`

**Interfaces:**
- Consumes: `PaymentGatewayAdapter`, `PaymentInitiation` (`../payment-gateway-adapter`), `PaymentWebhookSigner`, `WebhookVerificationResult` (`./webhook-signer`, Task 1).
- Produces: `EasyPaisaConfig` (`storeId`, `hashKey`, `returnUrl`, `apiUrl`, all `string`), `EasyPaisaAdapter implements PaymentGatewayAdapter`, `EasyPaisaWebhookSigner implements PaymentWebhookSigner` — consumed by Task 4's factory.

Mirrors Task 1's structure exactly, with EasyPaisa's field list explicitly marked unverified (unlike JazzCash's, which at least has confirmed field *names*; EasyPaisa's field list itself is unconfirmed per the spec).

- [ ] **Step 1: Write the failing signer test**

```ts
// backend/src/fees/gateways/easypaisa.signer.spec.ts
import { EasyPaisaSigner } from './easypaisa.signer';

describe('EasyPaisaSigner', () => {
  const hashKey = 'test-hash-key';
  const fields = { storeId: 'ST1', amount: '5000.00', orderRefNum: 'pay_abc123' };

  it('produces a deterministic hex hash for the same fields', () => {
    const signer = new EasyPaisaSigner(hashKey);
    expect(signer.sign(fields)).toBe(signer.sign(fields));
    expect(signer.sign(fields)).toMatch(/^[0-9a-f]+$/);
  });

  it('verifies its own signed output', () => {
    const signer = new EasyPaisaSigner(hashKey);
    const hash = signer.sign(fields);
    expect(signer.verify(fields, hash)).toBe(true);
  });

  it('rejects a hash computed for different field values (tamper detection)', () => {
    const signer = new EasyPaisaSigner(hashKey);
    const hash = signer.sign(fields);
    expect(signer.verify({ ...fields, amount: '1.00' }, hash)).toBe(false);
  });

  it('rejects a missing hash', () => {
    const signer = new EasyPaisaSigner(hashKey);
    expect(signer.verify(fields, undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/fees/gateways/easypaisa.signer.spec.ts`
Expected: FAIL — `Cannot find module './easypaisa.signer'`

- [ ] **Step 3: Implement the signer**

```ts
// backend/src/fees/gateways/easypaisa.signer.ts
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * EasyPaisa's exact hash field order/encoding varies by product line (Hosted Checkout vs Mobile
 * Account API vs older APIs) and is NOT confirmed for any specific one in this codebase — every
 * source checked while building this (including the two URLs the user asked to be checked)
 * either hedges this explicitly or doesn't cover it. This implementation is a defensible,
 * swappable placement for a real algorithm, not an assertion that this exact field order/key
 * usage is correct: sorted field-name concatenation of values, HMAC-SHA256 keyed by the merchant
 * hash key, hex output. CONFIRM AGAINST YOUR EASYPAISA MERCHANT INTEGRATION DOC before any live
 * sandbox use (see docs/superpowers/specs/2026-09-10-sprint-e-payment-gateway-design.md).
 */
export class EasyPaisaSigner {
  constructor(private readonly hashKey: string) {}

  sign(fields: Record<string, string>): string {
    const sortedValues = Object.keys(fields)
      .filter((key) => fields[key] !== '')
      .sort()
      .map((key) => fields[key]);
    return createHmac('sha256', this.hashKey).update(sortedValues.join('')).digest('hex');
  }

  verify(fields: Record<string, string>, providedHash: string | undefined): boolean {
    if (!providedHash) return false;
    const expected = Buffer.from(this.sign(fields));
    const provided = Buffer.from(providedHash);
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/fees/gateways/easypaisa.signer.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Write the failing adapter test**

```ts
// backend/src/fees/gateways/easypaisa.adapter.spec.ts
import { EasyPaisaAdapter, EasyPaisaWebhookSigner } from './easypaisa.adapter';
import { EasyPaisaSigner } from './easypaisa.signer';

const config = {
  storeId: 'ST1',
  hashKey: 'hash-key',
  returnUrl: 'https://staff.example.com/pay/return',
  apiUrl: 'https://easypay.easypaisa.com.pk/easypay/Index.jsf',
};

describe('EasyPaisaAdapter', () => {
  it('initiate() returns a signed redirect URL carrying the reference as orderRefNum', async () => {
    const adapter = new EasyPaisaAdapter(config);
    const result = await adapter.initiate({ amount: 500000, reference: 'pay_abc123' });

    expect(result.gatewayReference).toBe('pay_abc123');
    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('orderRefNum')).toBe('pay_abc123');
    expect(url.searchParams.get('storeId')).toBe('ST1');

    const signer = new EasyPaisaSigner(config.hashKey);
    const fields: Record<string, string> = {};
    url.searchParams.forEach((value, key) => (fields[key] = value));
    const providedHash = fields.merchantHashedReq;
    delete fields.merchantHashedReq;
    expect(signer.verify(fields, providedHash)).toBe(true);
  });
});

describe('EasyPaisaWebhookSigner', () => {
  it('rejects a call with a bad merchantHashedReq', () => {
    const verifier = new EasyPaisaWebhookSigner(config.hashKey);
    const result = verifier.verifyAndParse(
      { orderRefNum: 'pay_1', status: 'SUCCESS', merchantHashedReq: 'WRONG' },
      {},
    );
    expect(result.valid).toBe(false);
  });

  it('accepts a correctly-signed successful callback', () => {
    const signer = new EasyPaisaSigner(config.hashKey);
    const body = { orderRefNum: 'pay_1', status: 'SUCCESS' };
    const merchantHashedReq = signer.sign(body);
    const verifier = new EasyPaisaWebhookSigner(config.hashKey);
    expect(verifier.verifyAndParse({ ...body, merchantHashedReq }, {})).toEqual({
      valid: true,
      reference: 'pay_1',
      status: 'completed',
    });
  });

  it('maps any non-SUCCESS status to failed', () => {
    const signer = new EasyPaisaSigner(config.hashKey);
    const body = { orderRefNum: 'pay_1', status: 'FAILED' };
    const merchantHashedReq = signer.sign(body);
    const verifier = new EasyPaisaWebhookSigner(config.hashKey);
    expect(verifier.verifyAndParse({ ...body, merchantHashedReq }, {}).status).toBe('failed');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && npx jest src/fees/gateways/easypaisa.adapter.spec.ts`
Expected: FAIL — `Cannot find module './easypaisa.adapter'`

- [ ] **Step 7: Implement the adapter and webhook signer**

```ts
// backend/src/fees/gateways/easypaisa.adapter.ts
import { PaymentGatewayAdapter, PaymentInitiation } from '../payment-gateway-adapter';
import { PaymentWebhookSigner, WebhookVerificationResult } from './webhook-signer';
import { EasyPaisaSigner } from './easypaisa.signer';

export interface EasyPaisaConfig {
  storeId: string;
  hashKey: string;
  returnUrl: string;
  apiUrl: string;
}

/**
 * TODO: confirm against your EasyPaisa merchant integration doc — field names/order below
 * (storeId, amount, orderRefNum, postBackURL, expiryDate) are a reasonable placement, not a
 * confirmed spec (see EasyPaisaSigner's own caveat and the design doc).
 */
export class EasyPaisaAdapter implements PaymentGatewayAdapter {
  constructor(private readonly config: EasyPaisaConfig) {}

  async initiate(input: { amount: number; reference: string }): Promise<PaymentInitiation> {
    const signer = new EasyPaisaSigner(this.config.hashKey);
    const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const fields: Record<string, string> = {
      storeId: this.config.storeId,
      amount: (input.amount / 100).toFixed(2),
      orderRefNum: input.reference,
      postBackURL: this.config.returnUrl,
      expiryDate,
    };
    const merchantHashedReq = signer.sign(fields);
    const query = new URLSearchParams({ ...fields, merchantHashedReq }).toString();

    return { redirectUrl: `${this.config.apiUrl}?${query}`, gatewayReference: input.reference };
  }
}

export class EasyPaisaWebhookSigner implements PaymentWebhookSigner {
  private readonly signer: EasyPaisaSigner;
  constructor(hashKey: string) {
    this.signer = new EasyPaisaSigner(hashKey);
  }

  verifyAndParse(body: Record<string, string>): WebhookVerificationResult {
    const { merchantHashedReq, ...rest } = body;
    if (!this.signer.verify(rest, merchantHashedReq)) {
      return { valid: false };
    }
    return { valid: true, reference: rest.orderRefNum, status: rest.status === 'SUCCESS' ? 'completed' : 'failed' };
  }
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && npx jest src/fees/gateways/easypaisa`
Expected: PASS (all `easypaisa.signer.spec.ts` and `easypaisa.adapter.spec.ts` tests)

- [ ] **Step 9: Commit**

```bash
git add backend/src/fees/gateways/easypaisa.signer.ts backend/src/fees/gateways/easypaisa.signer.spec.ts backend/src/fees/gateways/easypaisa.adapter.ts backend/src/fees/gateways/easypaisa.adapter.spec.ts
git commit -m "feat(fees): add EasyPaisa signer, adapter, and webhook verifier"
```

---

### Task 3: Stub webhook signer + per-provider env config resolution

**Files:**
- Create: `backend/src/fees/gateways/stub-webhook.signer.ts`
- Test: `backend/src/fees/gateways/stub-webhook.signer.spec.ts`
- Create: `backend/src/fees/gateways/gateway-config.ts`
- Test: `backend/src/fees/gateways/gateway-config.spec.ts`
- Modify: `backend/.env.example`

**Interfaces:**
- Consumes: `PaymentWebhookSigner`, `WebhookVerificationResult` (`./webhook-signer`, Task 1); `JazzCashConfig` (Task 1); `EasyPaisaConfig` (Task 2); `ConfigService` from `@nestjs/config`.
- Produces: `StubWebhookSigner implements PaymentWebhookSigner`, `resolveJazzCashConfig(config: ConfigService): JazzCashConfig | undefined`, `resolveEasyPaisaConfig(config: ConfigService): EasyPaisaConfig | undefined`, `resolveStubWebhookSecret(config: ConfigService): string` — all consumed by Task 4's factory.

- [ ] **Step 1: Write the failing stub signer test**

```ts
// backend/src/fees/gateways/stub-webhook.signer.spec.ts
import { StubWebhookSigner } from './stub-webhook.signer';

describe('StubWebhookSigner', () => {
  it('accepts a matching x-stub-signature header with a valid completed/failed status', () => {
    const signer = new StubWebhookSigner('secret-1');
    const result = signer.verifyAndParse(
      { reference: 'stub_1', status: 'completed' },
      { 'x-stub-signature': 'secret-1' },
    );
    expect(result).toEqual({ valid: true, reference: 'stub_1', status: 'completed' });
  });

  it('rejects a missing or wrong signature header', () => {
    const signer = new StubWebhookSigner('secret-1');
    expect(signer.verifyAndParse({ reference: 'stub_1', status: 'completed' }, {}).valid).toBe(false);
    expect(
      signer.verifyAndParse({ reference: 'stub_1', status: 'completed' }, { 'x-stub-signature': 'wrong' })
        .valid,
    ).toBe(false);
  });

  it('rejects a status that is neither completed nor failed', () => {
    const signer = new StubWebhookSigner('secret-1');
    const result = signer.verifyAndParse(
      { reference: 'stub_1', status: 'bogus' },
      { 'x-stub-signature': 'secret-1' },
    );
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/fees/gateways/stub-webhook.signer.spec.ts`
Expected: FAIL — `Cannot find module './stub-webhook.signer'`

- [ ] **Step 3: Implement the stub webhook signer**

```ts
// backend/src/fees/gateways/stub-webhook.signer.ts
import { PaymentWebhookSigner, WebhookVerificationResult } from './webhook-signer';

/**
 * The stub gateway has no real signing scheme to reproduce — this exists only so local dev/tests
 * exercise the *same* webhook-verification code path a real gateway would hit (see
 * PaymentsWebhookController), rather than special-casing "no signature check" for dev. A plain
 * shared-secret header compare, not HMAC — there is nothing to compute a real signature over
 * since the stub gateway doesn't exist server-side.
 */
export class StubWebhookSigner implements PaymentWebhookSigner {
  constructor(private readonly secret: string) {}

  verifyAndParse(
    body: Record<string, string>,
    headers: Record<string, string | undefined>,
  ): WebhookVerificationResult {
    if (headers['x-stub-signature'] !== this.secret) {
      return { valid: false };
    }
    if (body.status !== 'completed' && body.status !== 'failed') {
      return { valid: false };
    }
    return { valid: true, reference: body.reference, status: body.status };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/fees/gateways/stub-webhook.signer.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write the failing gateway-config test**

```ts
// backend/src/fees/gateways/gateway-config.spec.ts
import { ConfigService } from '@nestjs/config';
import { resolveJazzCashConfig, resolveEasyPaisaConfig, resolveStubWebhookSecret } from './gateway-config';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('resolveJazzCashConfig', () => {
  it('returns undefined (falls back to stub) when no JazzCash vars are set, in any environment', () => {
    expect(resolveJazzCashConfig(fakeConfig({ NODE_ENV: 'production' }))).toBeUndefined();
  });

  it('returns a full config object when all vars are set', () => {
    const config = resolveJazzCashConfig(
      fakeConfig({
        NODE_ENV: 'production',
        JAZZCASH_MERCHANT_ID: 'MC1',
        JAZZCASH_PASSWORD: 'pw',
        JAZZCASH_INTEGRITY_SALT: 'salt',
        JAZZCASH_RETURN_URL: 'https://x/return',
        JAZZCASH_API_URL: 'https://x/api',
      }),
    );
    expect(config).toEqual({
      merchantId: 'MC1',
      password: 'pw',
      integritySalt: 'salt',
      returnUrl: 'https://x/return',
      apiUrl: 'https://x/api',
    });
  });

  it('throws if only some JazzCash vars are set outside development/test', () => {
    expect(() =>
      resolveJazzCashConfig(fakeConfig({ NODE_ENV: 'production', JAZZCASH_MERCHANT_ID: 'MC1' })),
    ).toThrow(/Incomplete JazzCash configuration/);
  });

  it('does not throw on a partial config in development', () => {
    expect(
      resolveJazzCashConfig(fakeConfig({ NODE_ENV: 'development', JAZZCASH_MERCHANT_ID: 'MC1' })),
    ).toBeUndefined();
  });
});

describe('resolveEasyPaisaConfig', () => {
  it('returns undefined when no EasyPaisa vars are set', () => {
    expect(resolveEasyPaisaConfig(fakeConfig({ NODE_ENV: 'production' }))).toBeUndefined();
  });

  it('returns a full config object when all vars are set', () => {
    const config = resolveEasyPaisaConfig(
      fakeConfig({
        NODE_ENV: 'production',
        EASYPAISA_STORE_ID: 'ST1',
        EASYPAISA_HASH_KEY: 'key',
        EASYPAISA_RETURN_URL: 'https://x/return',
        EASYPAISA_API_URL: 'https://x/api',
      }),
    );
    expect(config).toEqual({
      storeId: 'ST1',
      hashKey: 'key',
      returnUrl: 'https://x/return',
      apiUrl: 'https://x/api',
    });
  });
});

describe('resolveStubWebhookSecret', () => {
  it('falls back to a fixed dev-only secret in development/test', () => {
    expect(resolveStubWebhookSecret(fakeConfig({ NODE_ENV: 'test' }))).toBe('dev-only-stub-webhook-secret');
  });

  it('throws outside development/test if unset', () => {
    expect(() => resolveStubWebhookSecret(fakeConfig({ NODE_ENV: 'production' }))).toThrow(
      /PAYMENT_STUB_WEBHOOK_SECRET/,
    );
  });

  it('uses the configured value when set', () => {
    expect(
      resolveStubWebhookSecret(fakeConfig({ NODE_ENV: 'production', PAYMENT_STUB_WEBHOOK_SECRET: 'real-secret' })),
    ).toBe('real-secret');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && npx jest src/fees/gateways/gateway-config.spec.ts`
Expected: FAIL — `Cannot find module './gateway-config'`

- [ ] **Step 7: Implement gateway-config.ts**

```ts
// backend/src/fees/gateways/gateway-config.ts
import { ConfigService } from '@nestjs/config';
import { JazzCashConfig } from './jazzcash.adapter';
import { EasyPaisaConfig } from './easypaisa.adapter';

const DEV_STUB_WEBHOOK_SECRET = 'dev-only-stub-webhook-secret';

function isDevOrTest(config: ConfigService): boolean {
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  return nodeEnv === 'development' || nodeEnv === 'test';
}

/**
 * A provider is either fully configured or fully absent — absent means "not enabled for this
 * deployment" (a school might run cash-only, or JazzCash-only) and falls back to the stub
 * adapter. A *partial* config outside dev/test is treated as a real misconfiguration and fails
 * loudly, same fail-fast spirit as resolveAccessTokenSecret (backend/src/auth/jwt-secret.ts).
 */
export function resolveJazzCashConfig(config: ConfigService): JazzCashConfig | undefined {
  const merchantId = config.get<string>('JAZZCASH_MERCHANT_ID');
  const password = config.get<string>('JAZZCASH_PASSWORD');
  const integritySalt = config.get<string>('JAZZCASH_INTEGRITY_SALT');
  const returnUrl = config.get<string>('JAZZCASH_RETURN_URL');
  const apiUrl = config.get<string>('JAZZCASH_API_URL');
  const values = [merchantId, password, integritySalt, returnUrl, apiUrl];
  const presentCount = values.filter((v) => !!v).length;

  if (presentCount === 0) return undefined;
  if (presentCount < values.length && !isDevOrTest(config)) {
    throw new Error(
      'Incomplete JazzCash configuration — JAZZCASH_MERCHANT_ID/PASSWORD/INTEGRITY_SALT/RETURN_URL/API_URL must all be set together, or all left unset to disable JazzCash.',
    );
  }
  if (presentCount < values.length) return undefined;
  return { merchantId: merchantId!, password: password!, integritySalt: integritySalt!, returnUrl: returnUrl!, apiUrl: apiUrl! };
}

export function resolveEasyPaisaConfig(config: ConfigService): EasyPaisaConfig | undefined {
  const storeId = config.get<string>('EASYPAISA_STORE_ID');
  const hashKey = config.get<string>('EASYPAISA_HASH_KEY');
  const returnUrl = config.get<string>('EASYPAISA_RETURN_URL');
  const apiUrl = config.get<string>('EASYPAISA_API_URL');
  const values = [storeId, hashKey, returnUrl, apiUrl];
  const presentCount = values.filter((v) => !!v).length;

  if (presentCount === 0) return undefined;
  if (presentCount < values.length && !isDevOrTest(config)) {
    throw new Error(
      'Incomplete EasyPaisa configuration — EASYPAISA_STORE_ID/HASH_KEY/RETURN_URL/API_URL must all be set together, or all left unset to disable EasyPaisa.',
    );
  }
  if (presentCount < values.length) return undefined;
  return { storeId: storeId!, hashKey: hashKey!, returnUrl: returnUrl!, apiUrl: apiUrl! };
}

export function resolveStubWebhookSecret(config: ConfigService): string {
  const secret = config.get<string>('PAYMENT_STUB_WEBHOOK_SECRET');
  if (!secret) {
    if (!isDevOrTest(config)) {
      throw new Error('PAYMENT_STUB_WEBHOOK_SECRET must be set outside development/test.');
    }
    return DEV_STUB_WEBHOOK_SECRET;
  }
  return secret;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd backend && npx jest src/fees/gateways/gateway-config.spec.ts src/fees/gateways/stub-webhook.signer.spec.ts`
Expected: PASS (all tests)

- [ ] **Step 9: Add the new env vars to `.env.example`**

Modify `backend/.env.example`, appending:

```
# Payment gateways — leave a provider's vars entirely unset to disable it (falls back to the
# stub adapter in development/test only). Setting only some of a provider's vars is a startup
# error outside development/test.
JAZZCASH_MERCHANT_ID=""
JAZZCASH_PASSWORD=""
JAZZCASH_INTEGRITY_SALT=""
JAZZCASH_RETURN_URL=""
JAZZCASH_API_URL=""
EASYPAISA_STORE_ID=""
EASYPAISA_HASH_KEY=""
EASYPAISA_RETURN_URL=""
EASYPAISA_API_URL=""
# Required outside development/test if the stub webhook route is reachable (it shouldn't be, in
# a real deployment, but this guards against it being left wired up by mistake).
PAYMENT_STUB_WEBHOOK_SECRET=""
```

- [ ] **Step 10: Commit**

```bash
git add backend/src/fees/gateways/stub-webhook.signer.ts backend/src/fees/gateways/stub-webhook.signer.spec.ts backend/src/fees/gateways/gateway-config.ts backend/src/fees/gateways/gateway-config.spec.ts backend/.env.example
git commit -m "feat(fees): add stub webhook signer and per-provider gateway config resolution"
```

---

### Task 4: Payment gateway adapter factory, wired into `pay()`

**Files:**
- Create: `backend/src/fees/payment-gateway-adapter-factory.ts`
- Test: `backend/src/fees/payment-gateway-adapter-factory.spec.ts`
- Delete: `backend/src/fees/stub-payment-gateway.adapter.ts`'s `confirm()` method (keep the class, drop the method)
- Modify: `backend/src/fees/stub-payment-gateway.adapter.spec.ts`
- Modify: `backend/src/fees/fee-payments.service.ts`
- Modify: `backend/src/fees/fee-payments.service.spec.ts`
- Create: `backend/src/fees/dto/pay-voucher.dto.ts`
- Modify: `backend/src/fees/fees.controller.ts`
- Modify: `backend/src/fees/fees.module.ts`

**Interfaces:**
- Consumes: `JazzCashAdapter`/`JazzCashConfig` (Task 1), `EasyPaisaAdapter`/`EasyPaisaConfig` (Task 2), `resolveJazzCashConfig`/`resolveEasyPaisaConfig`/`resolveStubWebhookSecret` (Task 3), `StubPaymentGatewayAdapter` (existing).
- Produces: `PAYMENT_GATEWAY_ADAPTER_FACTORY` DI token, `PaymentGatewayAdapterFactory` interface (`getAdapter(method): PaymentGatewayAdapter`), `PaymentGatewayAdapterFactoryImpl` (also implements `PaymentWebhookSignerRegistry`, consumed by Task 5), `FeePaymentsService.pay(voucherId, actingUserId, method)` (signature change — `method` is now required), `PayVoucherDto`.

- [ ] **Step 1: Drop the now-unused `confirm()` from the stub adapter**

(The `PaymentGatewayAdapter` interface itself was already shrunk to just `initiate()` in Task 1, Step 0 — this step is the deferred cleanup of the one adapter that still had a leftover `confirm()` method the now-smaller interface no longer requires.)

Modify `backend/src/fees/stub-payment-gateway.adapter.ts` — remove the `confirm()` method and its now-unused `PaymentConfirmation` import, keeping only:

```ts
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PaymentGatewayAdapter, PaymentInitiation } from './payment-gateway-adapter';

/**
 * No real JazzCash/EasyPaisa merchant account exists yet — this adapter simulates a gateway's
 * hosted-checkout redirect. Local dev/tests simulate the gateway's own webhook call afterward
 * (see PaymentsWebhookController + StubWebhookSigner) rather than this adapter confirming
 * anything itself.
 */
@Injectable()
export class StubPaymentGatewayAdapter implements PaymentGatewayAdapter {
  async initiate(input: { amount: number; reference: string }): Promise<PaymentInitiation> {
    const gatewayReference = `stub_${randomUUID()}`;
    return {
      redirectUrl: `/pay/stub-checkout?ref=${gatewayReference}&amount=${input.amount}`,
      gatewayReference,
    };
  }
}
```

Modify `backend/src/fees/stub-payment-gateway.adapter.spec.ts` — remove any test asserting on `.confirm()` (there is exactly one, per the existing file); keep the `initiate()` test as-is.

- [ ] **Step 2: Write the failing factory test**

```ts
// backend/src/fees/payment-gateway-adapter-factory.spec.ts
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayAdapterFactoryImpl } from './payment-gateway-adapter-factory';
import { StubPaymentGatewayAdapter } from './stub-payment-gateway.adapter';
import { JazzCashAdapter } from './gateways/jazzcash.adapter';
import { EasyPaisaAdapter } from './gateways/easypaisa.adapter';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('PaymentGatewayAdapterFactoryImpl', () => {
  it('falls back to the stub adapter for jazzcash when unconfigured', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(fakeConfig({ NODE_ENV: 'test' }));
    expect(factory.getAdapter('jazzcash')).toBeInstanceOf(StubPaymentGatewayAdapter);
  });

  it('returns a real JazzCashAdapter when fully configured', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(
      fakeConfig({
        NODE_ENV: 'production',
        JAZZCASH_MERCHANT_ID: 'MC1',
        JAZZCASH_PASSWORD: 'pw',
        JAZZCASH_INTEGRITY_SALT: 'salt',
        JAZZCASH_RETURN_URL: 'https://x/return',
        JAZZCASH_API_URL: 'https://x/api',
      }),
    );
    expect(factory.getAdapter('jazzcash')).toBeInstanceOf(JazzCashAdapter);
  });

  it('returns a real EasyPaisaAdapter when fully configured', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(
      fakeConfig({
        NODE_ENV: 'production',
        EASYPAISA_STORE_ID: 'ST1',
        EASYPAISA_HASH_KEY: 'key',
        EASYPAISA_RETURN_URL: 'https://x/return',
        EASYPAISA_API_URL: 'https://x/api',
      }),
    );
    expect(factory.getAdapter('easypaisa')).toBeInstanceOf(EasyPaisaAdapter);
  });

  it('getSigner("stub") returns a signer using the resolved dev-only secret', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(fakeConfig({ NODE_ENV: 'test' }));
    const signer = factory.getSigner('stub');
    expect(signer?.verifyAndParse({ reference: 'r1', status: 'completed' }, { 'x-stub-signature': 'dev-only-stub-webhook-secret' })).toEqual({
      valid: true,
      reference: 'r1',
      status: 'completed',
    });
  });

  it('getSigner returns undefined for an unconfigured real gateway', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(fakeConfig({ NODE_ENV: 'test' }));
    expect(factory.getSigner('jazzcash')).toBeUndefined();
  });

  it('getSigner returns undefined for an unknown gateway name', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(fakeConfig({ NODE_ENV: 'test' }));
    expect(factory.getSigner('bogus')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest src/fees/payment-gateway-adapter-factory.spec.ts`
Expected: FAIL — `Cannot find module './payment-gateway-adapter-factory'`

- [ ] **Step 4: Implement the factory**

```ts
// backend/src/fees/payment-gateway-adapter-factory.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayAdapter } from './payment-gateway-adapter';
import { StubPaymentGatewayAdapter } from './stub-payment-gateway.adapter';
import { JazzCashAdapter, JazzCashWebhookSigner } from './gateways/jazzcash.adapter';
import { EasyPaisaAdapter, EasyPaisaWebhookSigner } from './gateways/easypaisa.adapter';
import { StubWebhookSigner } from './gateways/stub-webhook.signer';
import { PaymentWebhookSigner } from './gateways/webhook-signer';
import { resolveJazzCashConfig, resolveEasyPaisaConfig, resolveStubWebhookSecret } from './gateways/gateway-config';

export const PAYMENT_GATEWAY_ADAPTER_FACTORY = 'PAYMENT_GATEWAY_ADAPTER_FACTORY';

export type PaymentMethod = 'jazzcash' | 'easypaisa';

export interface PaymentGatewayAdapterFactory {
  getAdapter(method: PaymentMethod): PaymentGatewayAdapter;
}

export interface PaymentWebhookSignerRegistry {
  getSigner(gateway: string): PaymentWebhookSigner | undefined;
}

/**
 * One class implements both interfaces — a payment's outbound gateway and its inbound webhook
 * verifier always come from the same provider config, so there is no value in splitting them
 * into two separately-injected services.
 */
@Injectable()
export class PaymentGatewayAdapterFactoryImpl implements PaymentGatewayAdapterFactory, PaymentWebhookSignerRegistry {
  constructor(private readonly config: ConfigService) {}

  getAdapter(method: PaymentMethod): PaymentGatewayAdapter {
    if (method === 'jazzcash') {
      const jazzCashConfig = resolveJazzCashConfig(this.config);
      return jazzCashConfig ? new JazzCashAdapter(jazzCashConfig) : new StubPaymentGatewayAdapter();
    }
    const easyPaisaConfig = resolveEasyPaisaConfig(this.config);
    return easyPaisaConfig ? new EasyPaisaAdapter(easyPaisaConfig) : new StubPaymentGatewayAdapter();
  }

  getSigner(gateway: string): PaymentWebhookSigner | undefined {
    if (gateway === 'stub') {
      return new StubWebhookSigner(resolveStubWebhookSecret(this.config));
    }
    if (gateway === 'jazzcash') {
      const jazzCashConfig = resolveJazzCashConfig(this.config);
      return jazzCashConfig ? new JazzCashWebhookSigner(jazzCashConfig.integritySalt) : undefined;
    }
    if (gateway === 'easypaisa') {
      const easyPaisaConfig = resolveEasyPaisaConfig(this.config);
      return easyPaisaConfig ? new EasyPaisaWebhookSigner(easyPaisaConfig.hashKey) : undefined;
    }
    return undefined;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/fees/payment-gateway-adapter-factory.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Add `PayVoucherDto`**

```ts
// backend/src/fees/dto/pay-voucher.dto.ts
import { IsIn } from 'class-validator';

export class PayVoucherDto {
  @IsIn(['jazzcash', 'easypaisa'])
  method!: 'jazzcash' | 'easypaisa';
}
```

- [ ] **Step 7: Update the failing/changed unit tests for `pay()`**

Modify `backend/src/fees/fee-payments.service.spec.ts` — replace the `PAYMENT_GATEWAY_ADAPTER` provider setup and the two `pay()` tests. Change the top of the file to:

```ts
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FeePaymentsService } from './fee-payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_GATEWAY_ADAPTER_FACTORY } from './payment-gateway-adapter-factory';

describe('FeePaymentsService', () => {
  let service: FeePaymentsService;
  let prisma: {
    feeVoucher: { findUnique: jest.Mock };
    feePayment: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    feePaymentAllocation: { deleteMany: jest.Mock; updateMany: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let gatewayFactory: { getAdapter: jest.Mock };
  let adapter: { initiate: jest.Mock };

  beforeEach(async () => {
    prisma = {
      feeVoucher: { findUnique: jest.fn() },
      feePayment: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
      feePaymentAllocation: { deleteMany: jest.fn(), updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    adapter = { initiate: jest.fn() };
    gatewayFactory = { getAdapter: jest.fn().mockReturnValue(adapter) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FeePaymentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PAYMENT_GATEWAY_ADAPTER_FACTORY, useValue: gatewayFactory },
      ],
    }).compile();
    service = moduleRef.get(FeePaymentsService);
  });

  it('pay() rejects a voucher that is already fully paid', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue({
      id: 'v1',
      items: [{ amount: 500000 }],
      allocations: [{ amount: 500000 }],
    });

    await expect(service.pay('v1', 'parent-1', 'jazzcash')).rejects.toThrow(BadRequestException);
    expect(adapter.initiate).not.toHaveBeenCalled();
  });

  it('pay() picks the adapter for the requested method and creates a pending payment tagged with it', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue({
      id: 'v1',
      items: [{ amount: 500000 }],
      allocations: [{ amount: 200000 }],
    });
    adapter.initiate.mockResolvedValue({ redirectUrl: '/pay/x', gatewayReference: 'stub_1' });
    prisma.feePayment.create.mockResolvedValue({ id: 'pay-1' });

    const result = await service.pay('v1', 'parent-1', 'easypaisa');

    expect(gatewayFactory.getAdapter).toHaveBeenCalledWith('easypaisa');
    expect(adapter.initiate).toHaveBeenCalledWith(expect.objectContaining({ amount: 300000 }));
    expect(prisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 300000,
          method: 'easypaisa',
          status: 'pending',
          allocations: { create: [{ feeVoucherId: 'v1', amount: 300000 }] },
        }),
      }),
    );
    expect(result).toEqual({ redirectUrl: '/pay/x', paymentId: 'pay-1' });
  });
```

The remaining `confirm()`-related tests in this file (idempotent, failed-zeroes-allocation, FK-intact, etc.) are replaced in Task 5, not here — leave them as-is for now; this task only touches `pay()` and the shared `beforeEach`, so those tests will fail to compile until Task 5 lands (expected — Task 5 is the very next task in this same plan).

- [ ] **Step 8: Update `FeePaymentsService.pay()`**

Modify `backend/src/fees/fee-payments.service.ts` — replace the constructor injection and `pay()`:

```ts
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_GATEWAY_ADAPTER_FACTORY, PaymentGatewayAdapterFactory, PaymentMethod } from './payment-gateway-adapter-factory';

export interface PaymentSummary {
  id: string;
  amount: number;
  method: string;
  status: string;
  voucherIds: string[];
  receiptId: string | null;
  createdAt: string;
}

@Injectable()
export class FeePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY_ADAPTER_FACTORY) private readonly gatewayFactory: PaymentGatewayAdapterFactory,
  ) {}

  async pay(
    voucherId: string,
    actingUserId: string,
    method: PaymentMethod,
  ): Promise<{ redirectUrl: string; paymentId: string }> {
    const voucher = await this.prisma.feeVoucher.findUnique({
      where: { id: voucherId },
      include: { items: true, allocations: true },
    });
    if (!voucher) {
      throw new NotFoundException('Fee voucher not found');
    }
    const totalAmount = voucher.items.reduce((sum, i) => sum + i.amount, 0);
    const alreadyAllocated = voucher.allocations.reduce((sum, a) => sum + a.amount, 0);
    const amountDue = totalAmount - alreadyAllocated;
    if (amountDue <= 0) {
      throw new BadRequestException('This voucher is already fully paid');
    }

    const reference = `pay_${randomUUID()}`;
    const adapter = this.gatewayFactory.getAdapter(method);
    const { redirectUrl, gatewayReference } = await adapter.initiate({ amount: amountDue, reference });

    const payment = await this.prisma.feePayment.create({
      data: {
        amount: amountDue,
        method,
        status: 'pending',
        reference: gatewayReference,
        allocations: { create: [{ feeVoucherId: voucherId, amount: amountDue }] },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'fee-payment.initiate',
        entity: 'FeePayment',
        entityId: payment.id,
        metadata: JSON.stringify({ voucherId, amount: amountDue, method }),
      },
    });

    return { redirectUrl, paymentId: payment.id };
  }

  // confirm(), getForStudent(), getById(), toSummary() are unchanged here — Task 5 replaces
  // confirm() with confirmFromWebhook() and changes toSummary()'s visibility. Leave them as they
  // are in the current file for this task.
}
```

Leave `confirm()`, `getForStudent()`, `getById()`, and the private `toSummary()` exactly as they already are in the file for this task — Task 5 is the one that touches them.

- [ ] **Step 9: Update the controller's `pay` route**

Modify `backend/src/fees/fees.controller.ts` — add the import and change the route:

```ts
import { PayVoucherDto } from './dto/pay-voucher.dto';
```

```ts
  @Roles('PARENT')
  @Post('fee-vouchers/:id/pay')
  async pay(@Param('id') id: string, @Body() dto: PayVoucherDto, @Req() req: AuthenticatedRequest) {
    const voucher = await this.feeVouchers.getById(id);
    await this.studentAccess.assertCanAccessStudent(req.user, voucher.studentId);
    return this.feePayments.pay(id, req.user.id, dto.method);
  }
```

- [ ] **Step 10: Wire the factory into `FeesModule`**

Modify `backend/src/fees/fees.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { FeeStructuresService } from './fee-structures.service';
import { FeeVouchersService } from './fee-vouchers.service';
import { FeePaymentsService } from './fee-payments.service';
import { FeesPdfService } from './fees-pdf.service';
import { FeesController } from './fees.controller';
import { StudentAccessService } from '../common/student-access.service';
import { PAYMENT_GATEWAY_ADAPTER_FACTORY, PaymentGatewayAdapterFactoryImpl } from './payment-gateway-adapter-factory';

@Module({
  providers: [
    FeeStructuresService,
    FeeVouchersService,
    FeePaymentsService,
    FeesPdfService,
    StudentAccessService,
    { provide: PAYMENT_GATEWAY_ADAPTER_FACTORY, useClass: PaymentGatewayAdapterFactoryImpl },
  ],
  controllers: [FeesController],
})
export class FeesModule {}
```

(Task 5 adds `PaymentsWebhookController` to this same module.)

- [ ] **Step 11: Run the affected unit tests to confirm current state**

Run: `cd backend && npx jest src/fees/payment-gateway-adapter-factory.spec.ts src/fees/stub-payment-gateway.adapter.spec.ts`
Expected: PASS. `npx jest src/fees/fee-payments.service.spec.ts` and `npx tsc --noEmit` are expected to still FAIL at this point (the `confirm()` tests reference removed code) — that's resolved in Task 5, not here.

- [ ] **Step 12: Commit**

```bash
git add backend/src/fees/payment-gateway-adapter.ts backend/src/fees/payment-gateway-adapter-factory.ts backend/src/fees/payment-gateway-adapter-factory.spec.ts backend/src/fees/stub-payment-gateway.adapter.ts backend/src/fees/stub-payment-gateway.adapter.spec.ts backend/src/fees/fee-payments.service.ts backend/src/fees/fee-payments.service.spec.ts backend/src/fees/dto/pay-voucher.dto.ts backend/src/fees/fees.controller.ts backend/src/fees/fees.module.ts
git commit -m "feat(fees): route pay() through a per-method gateway adapter factory"
```

---

### Task 5: Signed webhook confirmation, replacing client-initiated confirm

**Files:**
- Create: `backend/src/fees/payments-webhook.controller.ts`
- Modify: `backend/src/fees/fee-payments.service.ts`
- Modify: `backend/src/fees/fee-payments.service.spec.ts`
- Modify: `backend/src/fees/fees.controller.ts`
- Modify: `backend/src/fees/fees.module.ts`
- Modify: `backend/test/fees.e2e-spec.ts`

**Interfaces:**
- Consumes: `PAYMENT_GATEWAY_ADAPTER_FACTORY`/`PaymentWebhookSignerRegistry` (Task 4), `Public` decorator (`../auth/decorators/public.decorator`, existing).
- Produces: `FeePaymentsService.confirmFromWebhook(reference: string, status: 'completed' | 'failed'): Promise<PaymentSummary>`, public `FeePaymentsService.toSummary(...)` (visibility change), `GET /api/v1/fee-payments/:id` route — consumed by Task 9/10's client updates.

- [ ] **Step 1: Finish updating `fee-payments.service.spec.ts`**

Replace every remaining `confirm(...)`-based test in `backend/src/fees/fee-payments.service.spec.ts` (the file left mid-edit by Task 4) with `confirmFromWebhook(...)` tests. The full test block from `'confirm() completed creates a Receipt...'` through the end of the file becomes:

```ts
  it('confirmFromWebhook("completed") creates a Receipt and marks the payment completed', async () => {
    prisma.feePayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'pending',
      reference: 'stub_1',
      allocations: [],
      receipt: null,
    });
    prisma.feePayment.update.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'completed',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: { id: 'r1' },
      createdAt: new Date('2026-09-01'),
    });

    const result = await service.confirmFromWebhook('stub_1', 'completed');

    expect(prisma.feePayment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { reference: 'stub_1' } }),
    );
    expect(prisma.feePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed', receipt: { create: expect.anything() } }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ status: 'completed', receiptId: 'r1', voucherIds: ['v1'] }),
    );
  });

  it('confirmFromWebhook("failed") zeroes the allocation amount instead of leaving it counted against the voucher', async () => {
    prisma.feePayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      status: 'pending',
      reference: 'stub_1',
      allocations: [],
      receipt: null,
    });
    prisma.feePayment.update.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'failed',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: null,
      createdAt: new Date('2026-09-01'),
    });

    const result = await service.confirmFromWebhook('stub_1', 'failed');

    expect(prisma.feePaymentAllocation.updateMany).toHaveBeenCalledWith({
      where: { feePaymentId: 'pay-1' },
      data: { amount: 0 },
    });
    expect(prisma.feePaymentAllocation.deleteMany).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
  });

  it('confirmFromWebhook is idempotent — a payment already resolved is returned as-is on a repeat webhook call', async () => {
    prisma.feePayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      amount: 300000,
      method: 'jazzcash',
      status: 'completed',
      reference: 'stub_1',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: { id: 'r1' },
      createdAt: new Date('2026-09-01'),
    });

    const result = await service.confirmFromWebhook('stub_1', 'completed');

    expect(prisma.feePayment.update).not.toHaveBeenCalled();
    expect(result.status).toBe('completed');
  });

  it('confirmFromWebhook throws NotFoundException for an unknown reference', async () => {
    prisma.feePayment.findUnique.mockResolvedValue(null);
    await expect(service.confirmFromWebhook('unknown-ref', 'completed')).rejects.toThrow(NotFoundException);
  });

  it('getById throws NotFoundException for a missing payment', async () => {
    prisma.feePayment.findUnique.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/fees/fee-payments.service.spec.ts`
Expected: FAIL — `service.confirmFromWebhook is not a function`

- [ ] **Step 3: Replace `confirm()` with `confirmFromWebhook()` in the service**

Modify `backend/src/fees/fee-payments.service.ts` — delete the existing `confirm(paymentId, actingUserId)` method entirely and add in its place:

```ts
  /**
   * The only way a payment becomes completed/failed — called exclusively from
   * PaymentsWebhookController after that controller has already verified the calling gateway's
   * signature. Looks the payment up by its unique `reference`, never by an id a client could
   * supply, so nothing outside a verified webhook can move a payment out of "pending".
   */
  async confirmFromWebhook(reference: string, status: 'completed' | 'failed'): Promise<PaymentSummary> {
    const payment = await this.prisma.feePayment.findUnique({
      where: { reference },
      include: { allocations: true, receipt: true },
    });
    if (!payment) {
      throw new NotFoundException(`No payment found for reference "${reference}"`);
    }
    if (payment.status !== 'pending') {
      // Idempotent — gateways retry webhook delivery; a repeat call for an already-resolved
      // payment must not run the transition twice.
      return this.toSummary(payment);
    }

    if (status === 'failed') {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Zeroed, not deleted — see the identical comment this codebase already carries on the
        // old confirm()'s failure branch: keeps the FK intact so ownership resolution still works.
        await tx.feePaymentAllocation.updateMany({
          where: { feePaymentId: payment.id },
          data: { amount: 0 },
        });
        return tx.feePayment.update({
          where: { id: payment.id },
          data: { status: 'failed' },
          include: { allocations: true, receipt: true },
        });
      });

      await this.prisma.auditLog.create({
        data: {
          userId: null,
          action: 'fee-payment.webhook-confirm',
          entity: 'FeePayment',
          entityId: payment.id,
          metadata: JSON.stringify({ status: 'failed' }),
        },
      });

      return this.toSummary(updated);
    }

    const receiptNumber = `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${payment.id.slice(0, 6)}`;
    const updated = await this.prisma.feePayment.update({
      where: { id: payment.id },
      data: { status: 'completed', receipt: { create: { receiptNumber } } },
      include: { allocations: true, receipt: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: null,
        action: 'fee-payment.webhook-confirm',
        entity: 'FeePayment',
        entityId: payment.id,
        metadata: JSON.stringify({ status: 'completed' }),
      },
    });

    return this.toSummary(updated);
  }
```

Also change `private toSummary(...)` to a public method (drop the `private` keyword only — same signature and body) so the new webhook controller and `GET /fee-payments/:id` route can format results without duplicating this logic.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/fees/fee-payments.service.spec.ts`
Expected: PASS (all tests, including the ones from Task 4's `pay()` changes)

- [ ] **Step 5: Add the webhook controller**

```ts
// backend/src/fees/payments-webhook.controller.ts
import { Body, Controller, HttpCode, Inject, NotFoundException, Param, Post, UnauthorizedException, Headers } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { FeePaymentsService } from './fee-payments.service';
import { PAYMENT_GATEWAY_ADAPTER_FACTORY, PaymentWebhookSignerRegistry } from './payment-gateway-adapter-factory';

/**
 * Server-to-server only — a real gateway calls this directly, not through a browser/app session,
 * so it can never require a JWT. Signature verification (per-gateway, see
 * PaymentGatewayAdapterFactoryImpl.getSigner) is what stands in for authentication here.
 */
@Controller('api/v1/payments')
export class PaymentsWebhookController {
  constructor(
    @Inject(PAYMENT_GATEWAY_ADAPTER_FACTORY) private readonly signers: PaymentWebhookSignerRegistry,
    private readonly feePayments: FeePaymentsService,
  ) {}

  @Public()
  @Post('webhook/:gateway')
  @HttpCode(200)
  async webhook(
    @Param('gateway') gateway: string,
    @Body() body: Record<string, string>,
    @Headers() headers: Record<string, string | undefined>,
  ) {
    const signer = this.signers.getSigner(gateway);
    if (!signer) {
      throw new NotFoundException(`Unknown or unconfigured payment gateway "${gateway}"`);
    }
    const result = signer.verifyAndParse(body, headers);
    if (!result.valid || !result.reference || !result.status) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    await this.feePayments.confirmFromWebhook(result.reference, result.status);
    return { received: true };
  }
}
```

- [ ] **Step 6: Remove the client-callable confirm route; add `GET /fee-payments/:id`**

Modify `backend/src/fees/fees.controller.ts` — delete the entire `confirmPayment` method (the `@Roles('PARENT') @Post('fee-payments/:id/confirm')` block), and add in its place:

```ts
  @Get('fee-payments/:id')
  async getPayment(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const payment = await this.feePayments.getById(id);
    const studentId = payment.allocations[0]?.feeVoucher.studentId;
    if (!studentId) {
      throw new NotFoundException('Payment not found');
    }
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.feePayments.toSummary(payment);
  }
```

- [ ] **Step 7: Register the webhook controller**

Modify `backend/src/fees/fees.module.ts` — add the import and controller:

```ts
import { PaymentsWebhookController } from './payments-webhook.controller';
```

```ts
  controllers: [FeesController, PaymentsWebhookController],
```

- [ ] **Step 8: Rewrite the affected e2e test**

Modify `backend/test/fees.e2e-spec.ts` — replace the existing `'a parent pays a voucher end-to-end through the stub gateway...'` test (and add new ones alongside it) with:

```ts
  it('a parent pays a voucher end-to-end via the stub gateway webhook, and can then download the receipt PDF', async () => {
    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');

    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${ids.voucher}/pay`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ method: 'jazzcash' })
      .expect(201);
    expect(initiated.body.redirectUrl).toBeDefined();
    const paymentId = initiated.body.paymentId as string;
    const reference = new URL(`http://x${initiated.body.redirectUrl}`).searchParams.get('ref');

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/stub')
      .set('x-stub-signature', 'dev-only-stub-webhook-secret')
      .send({ reference, status: 'completed' })
      .expect(200);

    const payment = await request(app.getHttpServer())
      .get(`/api/v1/fee-payments/${paymentId}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(payment.body).toEqual(expect.objectContaining({ status: 'completed', voucherIds: [ids.voucher] }));

    const fees = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/fees`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(fees.body.find((v: { id: string }) => v.id === ids.voucher)).toEqual(
      expect.objectContaining({ amountDue: 0, status: 'paid' }),
    );

    const receipt = await request(app.getHttpServer())
      .get(`/api/v1/fee-payments/${paymentId}/receipt.pdf`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(receipt.headers['content-type']).toBe('application/pdf');
  });

  it('a repeated webhook call for an already-completed payment is a no-op', async () => {
    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${ids.voucher2}/pay`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ method: 'jazzcash' })
      .expect(201);
    const reference = new URL(`http://x${initiated.body.redirectUrl}`).searchParams.get('ref');

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/stub')
      .set('x-stub-signature', 'dev-only-stub-webhook-secret')
      .send({ reference, status: 'completed' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/stub')
      .set('x-stub-signature', 'dev-only-stub-webhook-secret')
      .send({ reference, status: 'completed' })
      .expect(200);

    const payments = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/fees/payments`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const matching = payments.body.filter((p: { voucherIds: string[] }) => p.voucherIds.includes(ids.voucher2));
    expect(matching).toHaveLength(1);
  });

  it('an unsigned webhook call is rejected and does not mutate payment state', async () => {
    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${ids.voucher3}/pay`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ method: 'jazzcash' })
      .expect(201);
    const reference = new URL(`http://x${initiated.body.redirectUrl}`).searchParams.get('ref');

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/stub')
      .set('x-stub-signature', 'wrong-secret')
      .send({ reference, status: 'completed' })
      .expect(401);

    const payment = await request(app.getHttpServer())
      .get(`/api/v1/fee-payments/${initiated.body.paymentId}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(payment.body.status).toBe('pending');
  });

  it('the old client-callable confirm route no longer exists', async () => {
    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');
    await request(app.getHttpServer())
      .post('/api/v1/fee-payments/some-id/confirm')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(404);
  });
```

These new tests need `ids.voucher2`/`ids.voucher3` — a second and third voucher for the same student, issued the same way `ids.voucher` already is earlier in this file's `beforeAll`. Add, right after the existing voucher-issuance block in `beforeAll`, two more vouchers for `ids.childA` following the exact same `prisma.feeVoucher.create` shape already used for `ids.voucher`, storing their ids as `ids.voucher2`/`ids.voucher3` — read the existing `beforeAll` block first to match its exact field values (student/session/items) before adding these two.

- [ ] **Step 9: Run the full backend test suite**

Run: `cd backend && npm run build && npm test && npm run test:e2e`
Expected: PASS — `npm run build` (type-check) clean, all unit suites green, e2e green (including the new webhook tests), run twice back-to-back per this repo's own e2e convention.

- [ ] **Step 10: Commit**

```bash
git add backend/src/fees/payments-webhook.controller.ts backend/src/fees/fee-payments.service.ts backend/src/fees/fee-payments.service.spec.ts backend/src/fees/fees.controller.ts backend/src/fees/fees.module.ts backend/test/fees.e2e-spec.ts
git commit -m "feat(fees): confirm payments only via a signed webhook, closing the client-self-confirm hole"
```

---

### Task 6: Cash / manual-payment reconciliation

**Files:**
- Create: `backend/src/fees/dto/reconcile-payment.dto.ts`
- Modify: `backend/src/fees/fee-payments.service.ts`
- Modify: `backend/src/fees/fee-payments.service.spec.ts`
- Modify: `backend/src/fees/fees.controller.ts`
- Modify: `backend/test/fees.e2e-spec.ts`

**Interfaces:**
- Consumes: `FeePaymentsService.toSummary` (public since Task 5).
- Produces: `FeePaymentsService.reconcile(voucherId, dto, actingUserId): Promise<PaymentSummary>`, `POST /api/v1/fee-vouchers/:id/reconcile` — consumed by Task 8's staff-console UI.

- [ ] **Step 1: Write the failing unit tests**

Add to `backend/src/fees/fee-payments.service.spec.ts`, before the closing `});`:

```ts
  it('reconcile() records a completed cash payment with a receipt, without touching the gateway', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue({
      id: 'v1',
      items: [{ amount: 500000 }],
      allocations: [{ amount: 200000 }],
    });
    prisma.feePayment.create.mockResolvedValue({
      id: 'pay-2',
      amount: 300000,
      method: 'cash',
      status: 'completed',
      allocations: [{ feeVoucherId: 'v1' }],
      receipt: { id: 'r2' },
      createdAt: new Date('2026-09-10'),
    });

    const result = await service.reconcile('v1', { amount: 300000, method: 'cash' }, 'admin-1');

    expect(adapter.initiate).not.toHaveBeenCalled();
    expect(prisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 300000, method: 'cash', status: 'completed' }),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ status: 'completed', receiptId: 'r2' }));
  });

  it('reconcile() rejects an amount greater than the voucher\'s remaining balance', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue({
      id: 'v1',
      items: [{ amount: 500000 }],
      allocations: [{ amount: 200000 }],
    });

    await expect(
      service.reconcile('v1', { amount: 999999, method: 'cash' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.feePayment.create).not.toHaveBeenCalled();
  });

  it('reconcile() throws NotFoundException for a missing voucher', async () => {
    prisma.feeVoucher.findUnique.mockResolvedValue(null);
    await expect(service.reconcile('missing', { amount: 100, method: 'cash' }, 'admin-1')).rejects.toThrow(
      NotFoundException,
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/fees/fee-payments.service.spec.ts`
Expected: FAIL — `service.reconcile is not a function`

- [ ] **Step 3: Add `ReconcilePaymentDto`**

```ts
// backend/src/fees/dto/reconcile-payment.dto.ts
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReconcilePaymentDto {
  @IsInt()
  @Min(1)
  amount!: number; // paisa

  @IsIn(['cash', 'bank_transfer'])
  method!: 'cash' | 'bank_transfer';

  @IsOptional()
  @IsString()
  note?: string;
}
```

- [ ] **Step 4: Implement `reconcile()`**

Add to `backend/src/fees/fee-payments.service.ts` (needs `randomUUID` already imported at the top of this file from Task 4's `pay()`):

```ts
  /**
   * Staff-recorded cash/bank-transfer payment — no gateway involved, so it's created directly as
   * `completed` (staff are asserting money was already received in person/via bank), unlike
   * pay()'s gateway flow which starts `pending` and waits for the webhook.
   */
  async reconcile(
    voucherId: string,
    dto: { amount: number; method: 'cash' | 'bank_transfer'; note?: string },
    actingUserId: string,
  ): Promise<PaymentSummary> {
    const voucher = await this.prisma.feeVoucher.findUnique({
      where: { id: voucherId },
      include: { items: true, allocations: true },
    });
    if (!voucher) {
      throw new NotFoundException('Fee voucher not found');
    }
    const totalAmount = voucher.items.reduce((sum, i) => sum + i.amount, 0);
    const alreadyAllocated = voucher.allocations.reduce((sum, a) => sum + a.amount, 0);
    const amountDue = totalAmount - alreadyAllocated;
    if (dto.amount > amountDue) {
      throw new BadRequestException(`Amount exceeds this voucher's remaining balance of ${amountDue}`);
    }

    const receiptNumber = `RCPT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID().slice(0, 6)}`;
    const payment = await this.prisma.feePayment.create({
      data: {
        amount: dto.amount,
        method: dto.method,
        status: 'completed',
        reference: `manual_${randomUUID()}`,
        allocations: { create: [{ feeVoucherId: voucherId, amount: dto.amount }] },
        receipt: { create: { receiptNumber } },
      },
      include: { allocations: true, receipt: true },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'fee-payment.reconcile',
        entity: 'FeePayment',
        entityId: payment.id,
        metadata: JSON.stringify({ voucherId, amount: dto.amount, method: dto.method, note: dto.note }),
      },
    });

    return this.toSummary(payment);
  }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/fees/fee-payments.service.spec.ts`
Expected: PASS (all tests)

- [ ] **Step 6: Add the controller route**

Modify `backend/src/fees/fees.controller.ts` — add the import and route:

```ts
import { ReconcilePaymentDto } from './dto/reconcile-payment.dto';
```

```ts
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN', 'ACCOUNTS')
  @Post('fee-vouchers/:id/reconcile')
  reconcile(@Param('id') id: string, @Body() dto: ReconcilePaymentDto, @Req() req: AuthenticatedRequest) {
    return this.feePayments.reconcile(id, dto, req.user.id);
  }
```

- [ ] **Step 7: Add e2e coverage**

Add to `backend/test/fees.e2e-spec.ts`, near the other payment tests:

```ts
  it('staff records a cash payment against a voucher, and it appears completed with a receipt', async () => {
    const adminToken = await loginAs('fee-admin@seeds.edu.pk');

    const reconciled = await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${ids.voucher4}/reconcile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 500000, method: 'cash', note: 'Paid at front office' })
      .expect(201);
    expect(reconciled.body).toEqual(expect.objectContaining({ status: 'completed', method: 'cash' }));

    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');
    const fees = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/fees`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(fees.body.find((v: { id: string }) => v.id === ids.voucher4)).toEqual(
      expect.objectContaining({ status: 'paid', amountDue: 0 }),
    );
  });

  it('reconciling more than a voucher\'s remaining balance is rejected', async () => {
    const adminToken = await loginAs('fee-admin@seeds.edu.pk');
    await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${ids.voucher5}/reconcile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 99999999, method: 'cash' })
      .expect(400);
  });

  it('a TEACHER cannot reconcile a payment', async () => {
    const teacherToken = await loginAs('fee-teacher@seeds.edu.pk');
    await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${ids.voucher5}/reconcile`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ amount: 100, method: 'cash' })
      .expect(403);
  });
```

These need `ids.voucher4`/`ids.voucher5` — two more vouchers for `ids.childA`, added to `beforeAll` the same way as `voucher2`/`voucher3` from Task 5.

- [ ] **Step 8: Run the full backend suite**

Run: `cd backend && npm run build && npm test && npm run test:e2e`
Expected: PASS, run twice back-to-back.

- [ ] **Step 9: Commit**

```bash
git add backend/src/fees/dto/reconcile-payment.dto.ts backend/src/fees/fee-payments.service.ts backend/src/fees/fee-payments.service.spec.ts backend/src/fees/fees.controller.ts backend/test/fees.e2e-spec.ts
git commit -m "feat(fees): add staff cash/bank-transfer payment reconciliation"
```

---

### Task 7: staff-console — reconciliation UI

**Files:**
- Modify: `staff-console/src/lib/api.ts`
- Modify: `staff-console/src/views/FeeManagementView.vue`
- Modify: `staff-console/src/views/FeeManagementView.spec.ts`

**Interfaces:**
- Consumes: `POST /api/v1/fee-vouchers/:id/reconcile` (Task 6).
- Produces: `api.reconcileVoucher(accessToken, voucherId, payload)`.

- [ ] **Step 1: Write the failing component test**

Add to `staff-console/src/views/FeeManagementView.spec.ts`, adding `reconcileVoucher: vi.fn()` to the `vi.mock('../lib/api', ...)` block's mocked object, and adding this test after the existing ledger tests:

```ts
  it('staff records a cash payment against a voucher from the ledger, then the ledger reloads', async () => {
    vi.mocked(api.studentFees).mockResolvedValue([
      {
        id: 'v1',
        studentId: 's1',
        month: '2026-09',
        dueDate: '2026-09-10',
        items: [{ label: 'Tuition Fee', amount: 500000 }],
        totalAmount: 500000,
        amountPaid: 0,
        amountDue: 500000,
        status: 'unpaid',
      },
    ]);
    vi.mocked(api.studentFeePayments).mockResolvedValue([]);
    vi.mocked(api.reconcileVoucher).mockResolvedValue(undefined);

    const wrapper = await mountView();
    await flushPromises();
    await wrapper.find('[data-testid="ledger-section"]').setValue('sec-1');
    await flushPromises();
    await wrapper.find('[data-testid="ledger-student"]').setValue('s1');
    await flushPromises();

    await wrapper.find('[data-testid="record-payment-v1"]').trigger('click');
    await wrapper.find('[data-testid="reconcile-amount"]').setValue('5000');
    await wrapper.find('[data-testid="reconcile-method"]').setValue('cash');
    await wrapper.find('[data-testid="reconcile-submit"]').trigger('click');
    await flushPromises();

    expect(api.reconcileVoucher).toHaveBeenCalledWith('token-1', 'v1', {
      amount: 500000,
      method: 'cash',
      note: undefined,
    });
    // Ledger reloads after a successful reconcile — studentFees/studentFeePayments called twice
    // each (once on select, once on reload).
    expect(vi.mocked(api.studentFees).mock.calls.length).toBe(2);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/views/FeeManagementView.spec.ts`
Expected: FAIL — `record-payment-v1` element not found

- [ ] **Step 3: Add `reconcileVoucher` to the API client**

Modify `staff-console/src/lib/api.ts` — add after `studentFeePayments`:

```ts
  async reconcileVoucher(
    accessToken: string,
    voucherId: string,
    payload: { amount: number; method: 'cash' | 'bank_transfer'; note?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/fee-vouchers/${voucherId}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },
```

- [ ] **Step 4: Add the reconcile form to the Student Ledger section**

Modify `staff-console/src/views/FeeManagementView.vue` — add new refs after `ledgerError`:

```ts
const reconcilingVoucherId = ref<string | null>(null);
const reconcileAmount = ref('');
const reconcileMethod = ref<'cash' | 'bank_transfer'>('cash');
const reconcileNote = ref('');
const reconcileError = ref<string | null>(null);

function startReconcile(voucherId: string, amountDuePaisa: number) {
  reconcilingVoucherId.value = voucherId;
  reconcileAmount.value = (amountDuePaisa / 100).toString();
  reconcileMethod.value = 'cash';
  reconcileNote.value = '';
  reconcileError.value = null;
}

async function onReconcile() {
  if (!auth.accessToken || !reconcilingVoucherId.value || !reconcileAmount.value) return;
  reconcileError.value = null;
  try {
    await api.reconcileVoucher(auth.accessToken, reconcilingVoucherId.value, {
      amount: Math.round(Number(reconcileAmount.value) * 100),
      method: reconcileMethod.value,
      note: reconcileNote.value || undefined,
    });
    reconcilingVoucherId.value = null;
    await onLoadLedger();
  } catch (err) {
    reconcileError.value = err instanceof Error ? err.message : 'Could not record payment.';
  }
}
```

Modify the ledger `<table>` template — add an `Actions` column and a per-row button, then a conditional form below the table:

```html
      <table v-if="ledgerVouchers.length" class="ledger-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Due</th>
            <th class="num">Total</th>
            <th class="num">Paid</th>
            <th class="num">Due</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in ledgerVouchers" :key="v.id">
            <td>{{ v.month }}</td>
            <td>{{ v.dueDate }}</td>
            <td class="num">{{ formatPkrFull(v.totalAmount / 100) }}</td>
            <td class="num">{{ formatPkrFull(v.amountPaid / 100) }}</td>
            <td class="num">{{ formatPkrFull(v.amountDue / 100) }}</td>
            <td>{{ v.status }}</td>
            <td>
              <button
                v-if="v.amountDue > 0"
                :data-testid="`record-payment-${v.id}`"
                @click="startReconcile(v.id, v.amountDue)"
              >
                Record payment
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="reconcilingVoucherId" class="card">
        <h3>Record cash / bank-transfer payment</h3>
        <p v-if="reconcileError" class="error" role="alert">{{ reconcileError }}</p>
        <label class="field">
          <span>Amount (PKR)</span>
          <input data-testid="reconcile-amount" v-model="reconcileAmount" type="number" />
        </label>
        <label class="field">
          <span>Method</span>
          <select data-testid="reconcile-method" v-model="reconcileMethod">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
          </select>
        </label>
        <label class="field">
          <span>Note (optional)</span>
          <input data-testid="reconcile-note" v-model="reconcileNote" type="text" />
        </label>
        <button data-testid="reconcile-submit" @click="onReconcile">Record payment</button>
        <button data-testid="reconcile-cancel" @click="reconcilingVoucherId = null">Cancel</button>
      </div>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/views/FeeManagementView.spec.ts`
Expected: PASS (all tests, including the new one)

- [ ] **Step 6: Run the full staff-console verification**

Run: `cd staff-console && npm run lint && npm run build`
Expected: both clean.

- [ ] **Step 7: Commit**

```bash
git add staff-console/src/lib/api.ts staff-console/src/views/FeeManagementView.vue staff-console/src/views/FeeManagementView.spec.ts
git commit -m "feat(staff-console): add cash/bank-transfer payment reconciliation to the fee ledger"
```

---

### Task 8: parent-app — API client changes (method param, webhook-driven completion)

**Files:**
- Modify: `parent-app/lib/src/api/api_client.dart`
- Modify: `parent-app/test/screens/stub_checkout_screen_test.dart`

**Interfaces:**
- Consumes: `POST /api/v1/fee-vouchers/:id/pay` (now requires `method`), `POST /api/v1/payments/webhook/stub`, `GET /api/v1/fee-payments/:id` (all Tasks 4-5), `FeePaymentSummary`/`PaymentInitiation` (existing, `models.dart`, unchanged shape).
- Produces: `ApiClient.payVoucher(accessToken, voucherId, method)` (signature change), `ApiClient.completeStubPayment(reference)`, `ApiClient.getPayment(accessToken, paymentId)`, top-level `stubWebhookSecret` constant — consumed by Task 9.

- [ ] **Step 1: Update the failing widget test first**

Modify `parent-app/test/screens/stub_checkout_screen_test.dart` in full (this task's own test lives in Task 9, since `StubCheckoutScreen` itself changes there — this task only needs the `ApiClient` methods to exist and be correctly shaped, verified via a focused unit-style test on the client itself):

```dart
// parent-app/test/api/api_client_payment_test.dart
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';

void main() {
  test('payVoucher sends the chosen method in the request body', () async {
    Map<String, dynamic>? sentBody;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        sentBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'redirectUrl': '/pay/stub-checkout?ref=x', 'paymentId': 'p1'}), 201);
      }),
    );

    await api.payVoucher('tok', 'v1', 'jazzcash');

    expect(sentBody, {'method': 'jazzcash'});
  });

  test('completeStubPayment posts the reference with the dev stub signature header', () async {
    String? sentSignature;
    Map<String, dynamic>? sentBody;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        sentSignature = request.headers['x-stub-signature'];
        sentBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(jsonEncode({'received': true}), 200);
      }),
    );

    await api.completeStubPayment('stub_abc');

    expect(sentSignature, stubWebhookSecret);
    expect(sentBody, {'reference': 'stub_abc', 'status': 'completed'});
  });

  test('getPayment returns the payment summary', () async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        return http.Response(
          jsonEncode({
            'id': 'p1',
            'amount': 500000,
            'method': 'jazzcash',
            'status': 'completed',
            'voucherIds': ['v1'],
            'receiptId': 'r1',
          }),
          200,
        );
      }),
    );

    final payment = await api.getPayment('tok', 'p1');

    expect(payment.status, 'completed');
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/api/api_client_payment_test.dart`
Expected: FAIL — `payVoucher` takes 2 positional args, `completeStubPayment`/`getPayment`/`stubWebhookSecret` don't exist

- [ ] **Step 3: Update `api_client.dart`**

Modify `parent-app/lib/src/api/api_client.dart`. Add near the top, after the `ApiException` class:

```dart
/// Matches the backend's dev/test-only default (see resolveStubWebhookSecret in
/// backend/src/fees/gateways/gateway-config.ts). Only ever reaches a real deployment's webhook
/// route if that route is somehow left wired up outside dev/test — which the backend's own
/// fail-fast on PAYMENT_STUB_WEBHOOK_SECRET is designed to prevent.
const stubWebhookSecret = 'dev-only-stub-webhook-secret';
```

Replace `payVoucher` and delete `confirmPayment`, replacing both with:

```dart
  Future<PaymentInitiation> payVoucher(String accessToken, String voucherId, String method) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/fee-vouchers/$voucherId/pay'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({'method': method}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
    return PaymentInitiation.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }

  /// Simulates a real gateway's webhook call for the stub gateway only — local dev/tests have no
  /// real JazzCash/EasyPaisa server to receive a checkout and call the webhook itself, so this
  /// plays that role instead, going through the exact same signature-checked backend route a
  /// real gateway would hit.
  Future<void> completeStubPayment(String reference) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/payments/webhook/stub'),
      headers: {'Content-Type': 'application/json', 'x-stub-signature': stubWebhookSecret},
      body: jsonEncode({'reference': reference, 'status': 'completed'}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<FeePaymentSummary> getPayment(String accessToken, String paymentId) async {
    final json = await _get('/api/v1/fee-payments/$paymentId', accessToken) as Map<String, dynamic>;
    return FeePaymentSummary.fromJson(json);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/api/api_client_payment_test.dart`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add parent-app/lib/src/api/api_client.dart parent-app/test/api/api_client_payment_test.dart
git commit -m "feat(parent-app): update ApiClient for method-aware pay() and webhook-driven confirmation"
```

---

### Task 9: parent-app — StubCheckoutScreen and VoucherDetailScreen

**Files:**
- Modify: `parent-app/lib/src/screens/stub_checkout_screen.dart`
- Modify: `parent-app/test/screens/stub_checkout_screen_test.dart`
- Modify: `parent-app/lib/src/screens/voucher_detail_screen.dart`

**Interfaces:**
- Consumes: `ApiClient.completeStubPayment`, `ApiClient.getPayment`, `ApiClient.payVoucher(accessToken, voucherId, method)` (Task 8).
- Produces: nothing further consumed by later tasks (last client-facing task in this plan).

- [ ] **Step 1: Rewrite the failing widget test**

Replace the full content of `parent-app/test/screens/stub_checkout_screen_test.dart`:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/stub_checkout_screen.dart';

void main() {
  testWidgets('completes a payment by driving the stub webhook then polling payment status', (tester) async {
    var webhookCalled = false;
    var polled = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'POST' && request.url.path == '/api/v1/payments/webhook/stub') {
          webhookCalled = true;
          return http.Response(jsonEncode({'received': true}), 200);
        }
        if (request.method == 'GET' && request.url.path == '/api/v1/fee-payments/p1') {
          polled = true;
          return http.Response(
            jsonEncode({
              'id': 'p1',
              'amount': 500000,
              'method': 'jazzcash',
              'status': 'completed',
              'voucherIds': ['v1'],
              'receiptId': 'r1',
            }),
            200,
          );
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: StubCheckoutScreen(
          paymentId: 'p1',
          reference: 'stub_x',
          amountDue: 500000,
          accessToken: 'tok',
          api: api,
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('completePaymentButton')));
    await tester.pumpAndSettle();

    expect(webhookCalled, true);
    expect(polled, true);
    expect(find.text('Payment completed.'), findsOneWidget);
  });

  testWidgets('shows an error if the payment does not end up completed', (tester) async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/payments/webhook/stub') {
          return http.Response(jsonEncode({'received': true}), 200);
        }
        return http.Response(
          jsonEncode({
            'id': 'p1',
            'amount': 500000,
            'method': 'jazzcash',
            'status': 'failed',
            'voucherIds': ['v1'],
            'receiptId': null,
          }),
          200,
        );
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: StubCheckoutScreen(
          paymentId: 'p1',
          reference: 'stub_x',
          amountDue: 500000,
          accessToken: 'tok',
          api: api,
        ),
      ),
    );

    await tester.tap(find.byKey(const Key('completePaymentButton')));
    await tester.pumpAndSettle();

    expect(find.textContaining('did not complete'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/stub_checkout_screen_test.dart`
Expected: FAIL — `StubCheckoutScreen` has no `paymentId`/`reference` named parameters

- [ ] **Step 3: Rewrite `StubCheckoutScreen`**

Replace the full content of `parent-app/lib/src/screens/stub_checkout_screen.dart`:

```dart
import 'package:flutter/material.dart';
import '../api/api_client.dart';

/// Stands in for JazzCash/EasyPaisa's hosted checkout page — no real merchant account exists yet
/// (see StubPaymentGatewayAdapter/PaymentsWebhookController on the backend). "Complete Payment"
/// plays the role of the gateway itself: it calls the backend's stub webhook route (the same
/// signature-checked path a real gateway would hit), then polls the payment to reflect whatever
/// status the webhook actually set — this screen never assumes success.
class StubCheckoutScreen extends StatefulWidget {
  const StubCheckoutScreen({
    super.key,
    required this.paymentId,
    required this.reference,
    required this.amountDue,
    required this.accessToken,
    required this.api,
  });

  final String paymentId;
  final String reference;
  final int amountDue;
  final String accessToken;
  final ApiClient api;

  @override
  State<StubCheckoutScreen> createState() => _StubCheckoutScreenState();
}

class _StubCheckoutScreenState extends State<StubCheckoutScreen> {
  bool _isProcessing = false;
  String? _error;
  bool _isComplete = false;

  Future<void> _completePayment() async {
    setState(() {
      _isProcessing = true;
      _error = null;
    });
    try {
      await widget.api.completeStubPayment(widget.reference);
      final payment = await widget.api.getPayment(widget.accessToken, widget.paymentId);
      if (mounted) {
        setState(() {
          _isComplete = payment.status == 'completed';
          if (!_isComplete) _error = 'Payment did not complete (status: ${payment.status}).';
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text('Amount to pay: PKR ${(widget.amountDue / 100).toStringAsFixed(2)}'),
            const SizedBox(height: 24),
            if (_isComplete) ...[
              const Icon(Icons.check_circle, color: Colors.green, size: 48),
              const SizedBox(height: 12),
              const Text('Payment completed.'),
              const SizedBox(height: 12),
              ElevatedButton(
                key: const Key('checkoutDoneButton'),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text('Done'),
              ),
            ] else ...[
              if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
              ElevatedButton(
                key: const Key('completePaymentButton'),
                onPressed: _isProcessing ? null : _completePayment,
                child: Text(_isProcessing ? 'Processing…' : 'Complete Payment'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/screens/stub_checkout_screen_test.dart`
Expected: PASS (2 tests)

- [ ] **Step 5: Update `VoucherDetailScreen`'s Pay Now flow**

Modify `parent-app/lib/src/screens/voucher_detail_screen.dart` in full:

```dart
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import 'stub_checkout_screen.dart';

class VoucherDetailScreen extends StatelessWidget {
  const VoucherDetailScreen({
    super.key,
    required this.voucher,
    required this.accessToken,
    required this.api,
  });

  final FeeVoucherSummary voucher;
  final String accessToken;
  final ApiClient api;

  Future<void> _payNow(BuildContext context) async {
    // Neither gateway has a real merchant account yet, so both methods resolve to the stub
    // adapter today (see PaymentGatewayAdapterFactoryImpl) — 'jazzcash' is just a starting
    // default; a real method choice becomes meaningful once a real account exists.
    final initiation = await api.payVoucher(accessToken, voucher.id, 'jazzcash');
    if (!context.mounted) return;

    final redirectUri = Uri.parse(initiation.redirectUrl);

    if (redirectUri.path == '/pay/stub-checkout') {
      final reference = redirectUri.queryParameters['ref']!;
      final paid = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          builder: (_) => StubCheckoutScreen(
            paymentId: initiation.paymentId,
            reference: reference,
            amountDue: voucher.amountDue,
            accessToken: accessToken,
            api: api,
          ),
        ),
      );
      if (paid == true && context.mounted) Navigator.of(context).pop();
      return;
    }

    // Real-gateway path: not reachable in this environment (no real merchant account is
    // configured, so the factory always falls back to the stub above) — kept so the seam exists
    // once real credentials do, matching this codebase's StorageAdapter/PushAdapter precedent of
    // building the swap point before the real backing exists.
    await launchUrl(Uri.parse(initiation.redirectUrl), mode: LaunchMode.externalApplication);
    if (!context.mounted) return;
    final payment = await api.getPayment(accessToken, initiation.paymentId);
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Payment status: ${payment.status}')));
      if (payment.status == 'completed') Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Voucher — ${voucher.month}')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final item in voucher.items)
            ListTile(title: Text(item.label), trailing: Text('PKR ${(item.amount / 100).toStringAsFixed(2)}')),
          const Divider(),
          ListTile(
            title: const Text('Total due', style: TextStyle(fontWeight: FontWeight.bold)),
            trailing: Text(
              'PKR ${(voucher.amountDue / 100).toStringAsFixed(2)}',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 16),
          OutlinedButton(
            key: const Key('downloadVoucherPdf'),
            onPressed: () =>
                launchUrl(api.voucherPdfUrl(voucher.id, accessToken), mode: LaunchMode.externalApplication),
            child: const Text('Download PDF'),
          ),
          const SizedBox(height: 8),
          if (voucher.amountDue > 0)
            ElevatedButton(
              key: const Key('payNowButton'),
              onPressed: () => _payNow(context),
              child: const Text('Pay Now'),
            ),
        ],
      ),
    );
  }
}
```

Confirmed locally (`dart run` against a throwaway script) that `Uri.parse` on a bare relative path like `/pay/stub-checkout?ref=x` already populates `.path` (`/pay/stub-checkout`) and `.queryParameters` (`{ref: x}`) correctly — no scheme/host prefix needed, even though a real gateway's `redirectUrl` would be absolute. Plain `Uri.parse(initiation.redirectUrl)` handles both cases.

- [ ] **Step 6: Run the full parent-app verification**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: `flutter analyze` clean (no new warnings/errors beyond the pre-existing 3 info-level lints this repo already tracks as non-blocking), all tests passing.

- [ ] **Step 7: Commit**

```bash
git add parent-app/lib/src/screens/stub_checkout_screen.dart parent-app/test/screens/stub_checkout_screen_test.dart parent-app/lib/src/screens/voucher_detail_screen.dart
git commit -m "feat(parent-app): rewire checkout to the webhook-driven confirmation flow"
```

---

### Task 10: Full verification pass and status docs

**Files:**
- Modify: `build/PROJECT-STATUS.md`
- Modify: `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`

**Interfaces:** Consumes nothing new — this is the closing task confirming everything from Tasks 1-9 together.

- [ ] **Step 1: Run every test suite back-to-back**

Run, in order:
```bash
cd backend && npm run lint && npm run build && npm test && npm run test:e2e && npm run test:e2e
cd ../staff-console && npm run lint && npm run build && npm test
cd ../parent-app && flutter analyze && flutter test
```
Expected: all clean/green. The backend e2e run happens twice, matching this repo's established "run e2e twice consecutively" convention (catches fixture-leakage regressions a single run wouldn't).

- [ ] **Step 2: Manual smoke test against the real seed data**

Start all three (`backend: npm run start:dev`, `staff-console: npm run dev`, `parent-app: flutter run -d chrome`). As `admin@seeds.edu.pk`, open `/admin/fees`, load a student's ledger, and use "Record payment" to reconcile a cash payment against a real unpaid voucher — confirm the ledger updates and a receipt PDF downloads. As `parent-a@seeds.edu.pk`, open a voucher with a balance due, tap "Pay Now", complete the stub checkout, and confirm the voucher shows paid and a receipt is downloadable. Note any discrepancy found here before writing the status update below (if none, say so explicitly rather than skipping this step).

- [ ] **Step 3: Update `build/PROJECT-STATUS.md`**

Add a new `## Sprint E — Payment Gateway & Local Rails ✅ DONE` section, following the exact structure and tone of the `## Sprint D` section immediately above it in the file (goal recap, bullet list of what shipped, notable fixes found during the sprint's own review if any, verified test counts, follow-ups). Read that Sprint D section first to match its structure exactly before writing this one — do not invent a different structure. Explicitly call out, in this new section: PDF voucher generation was already done before this sprint (Sprint 9-10) and only re-verified here; the JazzCash/EasyPaisa adapters are built to public spec but unverified against a live sandbox; EasyPaisa's exact field order is explicitly flagged unconfirmed in the code; the client-callable confirm route was removed as a security fix.

- [ ] **Step 4: Update the roadmap's Implementation Checklist**

Modify `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` lines 53-57 (the Sprint E checklist entry) — check every sub-item box, add the merge commit range/date once merged (leave a placeholder note "merge commit range: TBD at merge time" only if this task runs before merging — replace with the real range immediately after merging, never leave literally as a placeholder in the final committed state), and add the same follow-up notes as the PROJECT-STATUS.md entry (spec-built-not-sandbox-verified gateways, EasyPaisa field-order caveat), matching the terse style every other completed sprint entry in that checklist already uses (see Sprint C/D's entries immediately above for the exact style — inline sub-bullets, not a new prose paragraph).

- [ ] **Step 5: Commit**

```bash
git add build/PROJECT-STATUS.md docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md
git commit -m "docs: close out Sprint E — payment gateway, PDF verification, cash reconciliation, signed webhooks"
```
