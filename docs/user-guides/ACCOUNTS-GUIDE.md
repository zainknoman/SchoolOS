# Accounts Guide

> **Status:** PARTIAL (see [verification level](README.md)) · **Verified:** 2026-09-20 · Role: `ACCOUNTS` — your school. Screens you can open: **Dashboard** and **Fees**; **Admissions**, **Complaints** and **Messages** only if your school admin has granted them to you (BL-32).
> **Implemented 2026-09-26 (BL-32):** accounts staff work on fees/finance; admissions, complaints and parent messages need an explicit grant from a school admin (Operations → Accounts Access). A grant or its removal applies immediately; sign in again to see the menu change.

## Fee structures and vouchers (Operations → Fees)
1. **Create fee structures** (name and amount; amounts are whole numbers in the smallest currency unit). A new structure is a **Draft** — **Activate** it to use it on vouchers. It can be edited until it is first invoiced, then it is **Locked**; **Archive** hides it from new vouchers (history stays). Structures are never deleted (BL-03).
2. **Issue vouchers:** choose the month and due date, pick fee structures, and select either specific students **or** a whole section. A student can have only one voucher per month; if any selected student already has one, the whole request is rejected. Vouchers attach to the platform's currently **active** academic session.
3. **Print/download** a voucher as PDF; download **receipts** for payments.

## Payments
Parents pay from the parent app. Payment status updates when the gateway confirms it. ⚠ online payment (JazzCash/EasyPaisa) needs an administrator to have configured and verified the gateway; until then treat online payment as unavailable. A failed online payment returns the voucher to unpaid so the parent can retry.
**Manual settlement:** for cash/bank receipts open the voucher and use **Reconcile**. A voucher that is already fully paid cannot be paid again, and a payment cannot exceed the balance.

## Admissions intake (only with the Admissions grant)
You can add **applicants** and applications and approve/reject them, like a school admin (see [SCHOOL-ADMIN-GUIDE](SCHOOL-ADMIN-GUIDE.md) §3).

## Messages and complaints (only with the matching grant)
With the **Messages** grant, parents writing to "Accounts" reach you and you reply to them; without any granted accounts user, the parent app says no Accounts account exists. With the **Complaints** grant you view and update complaints.

## Not available
Discounts, scholarships, late fees, refunds and instalment plans are not supported; fee structures are locked once invoiced (archive and create a new one to change a price). There is no fee-defaulter report or accounting export.
