# Sprint 9-10 — Fees + Leave (FEAT-012, FEAT-013)

Status: approved, ready for implementation planning.
Spec source: `plan/docs/FEATURES.txt` (FEAT-012, FEAT-013 — one-line entries; this doc is the full
detail, same role as the FEAT-010/011 design doc for Sprint 7-8).

## Goal

- **FEAT-012 (Fees):** Admin/Accounts issue server-computed fee vouchers to students; parents view
  vouchers, pay in-app via a stubbed JazzCash/EasyPaisa gateway, and see payment history/receipts —
  all as PDFs. Client-computed totals are never trusted.
- **FEAT-013 (Leave):** a parent submits a date-range leave request; SCHOOL_ADMIN/SUPER_ADMIN
  approve or reject it; an approved request writes `LEAVE` attendance rows so it shows up on the
  existing attendance calendar/summary without any new client-side rendering path.

Two decisions made during brainstorming (both confirmed by the user):
1. **No real JazzCash/EasyPaisa merchant account exists.** The payment gateway is built as a
   swappable `PaymentGatewayAdapter`, same pattern as `PushAdapter` (FEAT-011) and `StorageAdapter`
   (FEAT-008/009) — a stub implementation simulates the redirect-and-callback shape now; wiring a
   real merchant account later is a one-file change.
2. **The mock `FeesView.vue`** (built during the Sprint "UI Refresh" pass against local mock data)
   is a bank-transaction *reconciliation* queue — a different flow than FEAT-012's spec, which is
   in-app gateway payment. It is **out of scope this sprint**, left as-is/unrouted from the new
   work, not wired to a real endpoint.

## Data model

`FeeStructure`/`FeeVoucher`/`FeeItem`/`FeePayment`/`FeePaymentAllocation`/`Receipt` and
`LeaveRequest` already exist (Sprint 6.5, migration `20260828111313_fee_payment_allocation` +
`20260827093519_init`), built ahead of this sprint specifically so it wouldn't need reshaping now.
No new tables. One addition:

- `FeePayment.reference` is already `@unique` — the stub adapter must still generate a distinct
  reference per attempt (e.g. `stub_<uuid>`) so retries/duplicate submits behave like a real
  gateway's idempotency key would.
- `LeaveRequest.status` is a plain `String` (`"pending" | "approved" | "rejected"`, no enum) —
  consistent with `FeePayment.status`/`.method` already being untyped strings in this schema;
  matched, not changed, this sprint.

No Prisma migration is needed for the schema itself. `prisma/seed.ts` gains: one `FeeStructure`
("Tuition Fee"), one issued `FeeVoucher` (with items) for the seeded student, one completed
`FeePayment` + `Receipt` against it (so payment history isn't empty on a fresh seed — same
"never regress to looks-blank-but-isn't-broken" discipline as every prior sprint), and one
`LeaveRequest` in `pending` status.

## Payment gateway abstraction

```ts
interface PaymentGatewayAdapter {
  initiate(input: { amount: number; reference: string }): Promise<{ redirectUrl: string; gatewayReference: string }>;
  // Called by the client after the stub "checkout" completes, standing in for a real
  // gateway webhook/callback.
  confirm(gatewayReference: string): Promise<{ status: 'completed' | 'failed' }>;
}
```

`StubPaymentGatewayAdapter` returns a deterministic `redirectUrl` pointing at a stub checkout
screen served by the client itself (not a real hosted page) and always confirms `'completed'`.
Swapping in a real JazzCash/EasyPaisa-backed implementation later is a one-file change behind the
same interface — matching the `StorageAdapter`/`PushAdapter` precedent exactly.

## Backend API

New NestJS modules (`fees`, `leave`), following the existing `attendance`/`timetable` module shape
(controller + service + DTOs, `@Roles()` guards, audit-logged writes, `StudentAccessService` for
ownership checks).

**Fees module:**
- `POST /api/v1/fee-structures` — `@Roles('SCHOOL_ADMIN','SUPER_ADMIN','ACCOUNTS')` — `{ name, amount }`.
- `GET /api/v1/fee-structures` — staff-only, for the issuance picker.
- `POST /api/v1/fee-vouchers` — `@Roles('SCHOOL_ADMIN','SUPER_ADMIN','ACCOUNTS')` —
  `{ studentIds[] | sectionId, academicSessionId, month, feeStructureIds[], dueDate }`. Resolves
  the target student list (direct ids, or every student with an active `Enrollment` in the given
  section via `EnrollmentService`), and for each creates one `FeeVoucher` with one `FeeItem` per
  selected `FeeStructure` — amount copied from `FeeStructure.amount` at issuance time (a later
  change to a `FeeStructure`'s amount must not retroactively change an already-issued voucher).
  Rejects (400) issuing a second voucher for the same student+month.
- `GET /api/v1/students/:id/fees` — ownership-checked (parent → own child; staff → any). Returns
  each voucher with `amountDue = sum(FeeItem.amount) - sum(FeePaymentAllocation.amount for that voucher)`
  and a derived status (`unpaid` / `partial` / `paid` / `overdue` — `overdue` when `amountDue > 0`
  and `dueDate < now`).
- `GET /api/v1/fee-vouchers/:id/pdf` — ownership-checked, challan-style PDF (school header,
  student/class, itemized `FeeItem`s, total, due date) via **pdfkit**.
- `POST /api/v1/fee-vouchers/:id/pay` — `@Roles('PARENT')`, ownership-checked. Body carries no
  amount — the amount paid is always the voucher's server-computed `amountDue` at call time (never
  client-supplied). Calls `PaymentGatewayAdapter.initiate()`, creates a `FeePayment` row with
  `status: 'pending'`, returns the stub `redirectUrl`.
- `POST /api/v1/fee-payments/:id/confirm` — `@Roles('PARENT')`, ownership-checked (the calling
  parent must own the student the payment's allocations target). Calls
  `PaymentGatewayAdapter.confirm()`; on `'completed'`, sets `FeePayment.status`, creates the
  `FeePaymentAllocation` (full amount against the one voucher paid) and a `Receipt`
  (`receiptNumber` = a short sequential/date-based human-readable code, e.g. `RCPT-20260903-0007`);
  on `'failed'`, just sets `status: 'failed'`, no allocation/receipt. Re-confirming an
  already-`completed` payment is a no-op (idempotent, matches the `reference` uniqueness intent).
- `GET /api/v1/fee-payments/:id/receipt.pdf` — ownership-checked, 404 if the payment has no
  `Receipt` yet (not completed).
- `GET /api/v1/students/:id/fees/payments` — ownership-checked, payment history for a child
  (payment + which voucher(s) it was allocated to + receipt link).

**Leave module:**
- `POST /api/v1/leave-requests` — `@Roles('PARENT')`, ownership-checked — `{ studentId, startDate, endDate, reason }`.
  `startDate <= endDate` validated; status starts `'pending'`.
- `GET /api/v1/leave-requests?status=` — staff-only (`SCHOOL_ADMIN`/`SUPER_ADMIN`), all requests,
  optionally filtered.
- `GET /api/v1/students/:id/leave-requests` — ownership-checked, a child's own leave history.
- `POST /api/v1/leave-requests/:id/approve` — `@Roles('SCHOOL_ADMIN','SUPER_ADMIN')`. Sets
  `status: 'approved'`, then for every calendar day in `[startDate, endDate]` upserts an
  `Attendance` row (`studentId`, `date`, `status: 'LEAVE'`, `markedById: <approver>`) **unless**
  that date already has `status: 'HOLIDAY'`, which is left untouched. This overwrites any prior
  `PRESENT`/`ABSENT`/`LATE` mark for the date — an admin approval is treated as authoritative,
  matching how `markAttendance` already upserts. Rejecting a `pending` request that later gets
  approved after some dates have passed still backfills those past dates (a real school scenario:
  leave approved after the fact).
- `POST /api/v1/leave-requests/:id/reject` — `@Roles('SCHOOL_ADMIN','SUPER_ADMIN')`. Sets
  `status: 'rejected'`. No attendance write.
- Approving/rejecting an already-decided (`approved`/`rejected`) request is rejected with 400 — a
  decision is final, no re-approval/undo this sprint.

Every write (`fee-voucher.create`, `fee-payment.confirm`, `leave-request.approve/reject`, etc.)
gets an `AuditLog` row, matching the existing convention.

## Client UI

**staff-console (Vue):**
- `/admin/fees` (Admin/Accounts) — a new `FeesView.vue`-equivalent (new file; the existing
  `FeesView.vue` reconciliation mock is left in place, unrouted from this work) with two panels:
  a fee-structure list + "Issue Vouchers" form (section or individual students, month, due date,
  structure checkboxes), and a per-student voucher/payment ledger view (search a student, see
  vouchers + status + payment history), following `TimetableView.vue`'s admin-CRUD-screen
  conventions.
- `/admin/leave` (Admin/Super Admin) — pending/approved/rejected queue with approve/reject actions,
  following `CircularsView.vue`'s list-screen conventions.
- `AppShell.vue` nav gains "Fees" and "Leave" links for the admin/accounts roles (mirroring how
  "Dashboard"/"Timetable" were added in prior sprints).

**parent-app (Flutter):**
- The bottom nav's existing "Fees" tab (index 4 in `home_shell.dart`, currently the generic
  placeholder text) becomes a real `FeesTab`: voucher list (status badges, due dates), tap-through
  to a voucher detail (itemized, "Download PDF", "Pay Now"), a stub checkout screen (simulates the
  gateway redirect, a single "Complete Payment" button calling the confirm endpoint), and a
  payment-history/receipts list. `HomeTab`'s existing static "Fees" card (`homeFeesCard`, currently
  inert) becomes a real link into this tab, mirroring how `onOpenTimetable`/`onSeeAllAnnouncements`
  already jump between tabs.
- A new "Leave Applications" entry is added to the "More" tab (index 5, currently the same generic
  placeholder) — a submit form (child picker if >1 child, date range, reason) plus a status list
  (pending/approved/rejected) for past submissions.

## Testing & rollout

Same rigor as prior sprints, TDD throughout:
- Backend: one `*.service.spec.ts` per new service (mocked `PrismaService`) + e2e tests for the
  authorization/ownership boundaries — a parent can't pay/view another parent's child's voucher; a
  non-admin can't issue vouchers or approve leave; a voucher's `amountDue` is server-computed
  regardless of what a client sends to `/pay`; issuing a duplicate voucher for the same
  student+month is rejected; approving leave writes `LEAVE` rows but skips existing `HOLIDAY` days;
  a decided leave request can't be re-approved/rejected.
- Staff console: component specs for the new Fees issuance/ledger view and the Leave queue view.
- Parent app: widget tests for `FeesTab` (list, detail, stub-pay flow, receipt) and the new Leave
  submit/status screen.
- `prisma/seed.ts` updated per the Data model section above, so neither client's new screens are
  empty on a fresh seed.
