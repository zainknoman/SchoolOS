# Fees and Payments

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `fees/` (controller, vouchers, payments, gateways), e2e `fees`, `.env.example` · **Owner:** project owner
> **Integration status:** JazzCash/EasyPaisa are CONFIGURATION REQUIRED and have never been verified against a live gateway; the stub gateway is development/test only. See PROJECT-STATUS.

## Flow

| Step | Actor · UI · API | Effect | Rules |
|---|---|---|---|
| 1. Define fee structures | ACCOUNTS/SCHOOL_ADMIN · `/admin/fees` · `POST /fee-structures` | Named amounts (integer, smallest unit). No edit/delete endpoint. | Q3 |
| 2. Issue vouchers | same · `POST /fee-vouchers` (student list **or** section) | One voucher per student per month for the **first active session**; duplicates reject the whole request | BR-FEE-01/02, BR-ORG-02 |
| 3. Parent views vouchers | Parent app Fees · `GET /students/:id/fees`, `/fee-vouchers/:id/pdf` | `amountDue` = items − allocations | — |
| 4. Parent pays | `POST /fee-vouchers/:id/pay` (gateway chosen) | Creates a pending `FeePayment` and an allocation immediately (so `amountDue` reflects it); returns gateway redirect (or stub checkout in dev) | BR-FEE-03 |
| 5. Gateway callback | `POST /payments/webhook/:gateway` (public, signature verified) | `completed` → payment settled + receipt; `failed` → allocation zeroed so the voucher is payable again; idempotent on gateway retries | BR-FEE-04 |
| 6. Receipt | `GET /fee-payments/:id/receipt.pdf` | PDF receipt (access-checked to the student's parent/staff) | BR-SCOPE-02 |
| 7. Manual settlement | Accounts · `POST /fee-vouchers/:id/reconcile` | Marks payment received outside the gateway (cash/bank) | BR-FEE-03 |

Failure paths: fully paid → 400; over-balance → 400; invalid signature → 401; no active session → 400.

Not supported (Q9): late fees, discounts/scholarships, refunds, installment plans, fee carry-forward at promotion, accounting export.
