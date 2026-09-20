# Accounts Guide

> **Status:** PARTIAL (see [verification level](README.md)) · **Verified:** 2026-09-20 · Role: `ACCOUNTS` — your school. Screens you can open: **Dashboard**, **Fees**, **Messages**, **Complaints**, **Admissions**.
> **Decided, not yet implemented (owner, 2026-09-20):** ACCOUNTS access narrows to fees/finance; admissions/complaints/messages only by explicit grant (BL-32). This guide describes current behaviour.

## Fee structures and vouchers (Operations → Fees)
1. **Create fee structures** (name and amount; amounts are whole numbers in the smallest currency unit). They cannot be edited or deleted afterwards — check before saving.
2. **Issue vouchers:** choose the month and due date, pick fee structures, and select either specific students **or** a whole section. A student can have only one voucher per month; if any selected student already has one, the whole request is rejected. Vouchers attach to the platform's currently **active** academic session.
3. **Print/download** a voucher as PDF; download **receipts** for payments.

## Payments
Parents pay from the parent app. Payment status updates when the gateway confirms it. ⚠ online payment (JazzCash/EasyPaisa) needs an administrator to have configured and verified the gateway; until then treat online payment as unavailable. A failed online payment returns the voucher to unpaid so the parent can retry.
**Manual settlement:** for cash/bank receipts open the voucher and use **Reconcile**. A voucher that is already fully paid cannot be paid again, and a payment cannot exceed the balance.

## Admissions intake
You can add **applicants** and applications and approve/reject them, like a school admin (see [SCHOOL-ADMIN-GUIDE](SCHOOL-ADMIN-GUIDE.md) §3).

## Messages and complaints
Reply to parent conversations addressed to Accounts; view and update complaints.

## Not available
Discounts, scholarships, late fees, refunds and instalment plans are not supported; fee structures cannot be edited. There is no fee-defaulter report or accounting export.
