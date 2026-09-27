# Accounts Guide

> **Status:** PARTIAL (see [verification level](README.md)) · **Verified:** 2026-09-20 · Role: `ACCOUNTS` — your school. Screens you can open: **Dashboard**, **Fees** and **Fee Balances**; **Admissions**, **Complaints** and **Messages** only if your school admin has granted them to you (BL-32).
> **Implemented 2026-09-27 (BL-08):** discounts, scholarships, waivers, late fees, reversals, the **Fee Balances** screen (outstanding balances, defaulters, late-fee rule, carry-forward).
> **Implemented 2026-09-26 (BL-32):** accounts staff work on fees/finance; admissions, complaints and parent messages need an explicit grant from a school admin (Operations → Accounts Access). A grant or its removal applies immediately; sign in again to see the menu change.

## Fee structures and vouchers (Operations → Fees)
1. **Create fee structures** (name and amount; amounts are whole numbers in the smallest currency unit). A new structure is a **Draft** — **Activate** it to use it on vouchers. It can be edited until it is first invoiced, then it is **Locked**; **Archive** hides it from new vouchers (history stays). Structures are never deleted (BL-03).
2. **Issue vouchers:** choose the month and due date, pick fee structures, and select either specific students **or** a whole section. A student can have only one voucher per month; if any selected student already has one, the whole request is rejected. Vouchers attach to the platform's currently **active** academic session.
3. **Print/download** a voucher as PDF; download **receipts** for payments.
4. **Student ledger** (Fees → Student Ledger → section → student): **Lines** shows every line of a voucher — charges, discounts, scholarships, waivers, late fees, balances brought or carried forward — with the reason and whether it was reversed.
   - **Add line:** a discount, scholarship or waiver (reduces what is due, never below zero) or a late fee, always with a reason.
   - **Reverse:** cancels a discount, scholarship, waiver or late fee with a reason; the original stays visible. A charge is corrected with a waiver instead.
5. **Discounts & scholarships** (same screen, under the payments): a standing concession — a % of the charges or a fixed PKR amount per voucher — is added automatically to every voucher you issue while it is active. **End** it to stop; vouchers already issued do not change.

## Fee Balances (Operations → Fee Balances)
- **Balances:** every student of your school (your campus, if your account is campus-level) who owes money, with outstanding and overdue amounts and the oldest overdue due date. Tick **Defaulters only** for students with an overdue balance; filter by section.
- **Late fee:** your school's late fee and grace days (school-wide users change it). **Apply late fees now** adds it once to each voucher of the current session that is still unpaid after the due date plus the grace days. Run it again any time — a voucher never gets a second late fee.
- **Carry forward:** at the start of a new session, moves every unpaid balance of earlier sessions into one **Opening balance** voucher per student. The old voucher is marked *carried forward* (nothing on it is changed) and payments are then taken on the opening-balance voucher. Safe to run more than once.

## Payments
In the pilot **online payment is off** (RD-14): parents see "please pay at the school office" and you record the payment. Once an administrator configures a gateway, parents can pay from the app and the status updates when the gateway confirms it; a failed online payment returns the voucher to unpaid.
**Manual settlement:** for cash/bank receipts use **Record payment** on the voucher; a part payment leaves the rest outstanding and every payment gets a receipt. A voucher that is already fully paid cannot be paid again, and a payment cannot exceed the balance. A payment recorded by mistake is corrected with **Reverse** (with a reason) — this records a correcting entry; the original payment and its receipt stay on record. Nothing paid can be edited or deleted.

## Admissions intake (only with the Admissions grant)
You can add **applicants** and applications and approve/reject them, like a school admin (see [SCHOOL-ADMIN-GUIDE](SCHOOL-ADMIN-GUIDE.md) §3).

## Messages and complaints (only with the matching grant)
With the **Messages** grant, parents writing to "Accounts" reach you and you reply to them; without any granted accounts user, the parent app says no Accounts account exists. With the **Complaints** grant you work your school's complaint queue like a school admin (owner, internal notes, replies, resolution — see [SCHOOL-ADMIN-GUIDE](SCHOOL-ADMIN-GUIDE.md)) and can be made a complaint's owner.

## Not available
Refunds and instalment plans are not supported (a reduction can never leave a voucher in credit); fee structures are locked once invoiced (archive and create a new one to change a price). There is no accounting export beyond the fee-voucher CSV in Data Export.
