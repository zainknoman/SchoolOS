# Data Protection and PII Inventory

> **Status:** CURRENT (inventory) / REQUIRES-DECISION (policy) · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/prisma/schema.prisma` ([DATA-DICTIONARY](../database/DATA-DICTIONARY.md)) · **Owner:** project owner
> No privacy policy, retention schedule, consent record or data-subject-request process exists in the repository. Legal requirements for Pakistani schools handling minors' data are **UNKNOWN** here and need the owner's/legal advice; nothing below is legal guidance.

## What personal data is stored
| Category | Fields (model) | Sensitivity |
|---|---|---|
| Student identity | name parts, preferred name, gender, DOB, place of birth, nationality, religion, `grNumber` (unique), `bFormNumber` (unique) (`Student`) | High (minors) |
| Student health | blood group, allergies, medical conditions, special educational needs, medication and emergency notes (`StudentMedicalInfo`) | **Very high** |
| Student documents | files + type/expiry/verification (`StudentDocument`, `File`) | High |
| Contacts/addresses | guardian and emergency contacts, phones, addresses (`Address`, `StudentEmergencyContact`, `ParentProfile`) | High |
| Parents | name, phone, WhatsApp, email, `cnic` (unique), occupation/employer (`ParentProfile`) | High |
| Staff | `cnic`, DOB, mobile, email, addresses, experience, emergency contacts, documents, employment status (`Staff*`, `Teacher`) | High |
| Hiring | résumés (files), candidate data (`HiringCandidate`) | Medium–High |
| Behaviour/welfare | complaints, leave requests with reasons, attendance-risk flags (`Complaint`, `LeaveRequest`, `AttendanceRiskFlag`) | Medium–High |
| Finance | vouchers, payments, receipts (`Fee*`, `Receipt`) — no card data stored by the app (gateway-hosted) | Medium |
| Credentials | argon2 password hashes, hashed refresh/reset tokens (`User`, `RefreshToken`, `PasswordResetToken`) | High |
| Device/telemetry | FCM device tokens (`DeviceToken`), audit trail (`AuditLog`) | Medium |

## Current protections
Authenticated, role- and scope-checked access; parents limited to own children; hashes for credentials; uploads not publicly served (access-checked, forced download); audit log of writes.

## Gaps
| Gap | Note |
|---|---|
| No encryption at application level for CNIC/B-Form/medical fields | Relies on database/disk encryption (deployment-defined) |
| Plain-text PII in application logs | Password-reset links logged when SMTP unset (KG-4); other logs not reviewed; no redaction policy |
| No retention/deletion policy; hard deletes | Q7, KG-17; graduates' data stays indefinitely; backups not defined |
| No consent/notice records | — |
| No data export/erasure workflow | Not implemented |
| Files on local disk | Backup/encryption/location unmanaged; not portable |
| Cross-school leakage paths | KG-1, KG-6, KG-8 |
| Screenshots/design comps may contain demo PII | `docs/design-reference/` (demo data; review before external sharing) |

## Decisions needed (REQUIRES-DECISION)
Retention period per category; who may export/erase; whether CNIC/medical fields need field-level encryption; breach-notification owner.
