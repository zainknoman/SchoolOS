# Data Protection and PII Inventory

> **Status:** CURRENT (inventory; policy direction DECIDED, controls not yet built) · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/prisma/schema.prisma` ([DATA-DICTIONARY](../database/DATA-DICTIONARY.md)) · **Owner:** Security Owner (Engineering Lead until assigned)
> A **draft** privacy notice and privacy operations process (questions for counsel, breach handling, privacy requests) exist since BL-56 (2026-10-01): [PRIVACY-NOTICE](PRIVACY-NOTICE.md), [PRIVACY-OPERATIONS](PRIVACY-OPERATIONS.md) — **not approved and not reviewed by counsel**. No retention schedule or consent record exists. **This document makes no claim of legal or regulatory compliance**; that claim may be made only after qualified legal counsel has reviewed the applicable Pakistani requirements (owner decision, 2026-09-20). Nothing below is legal guidance.

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
| No encryption at application level for CNIC/B-Form/medical fields | Relies on database/disk encryption (deployment-defined); the columns are listed in one place so field-level encryption can be added later — [SENSITIVE-DATA](SENSITIVE-DATA.md) (BL-07) |
| Plain-text PII in application logs | Password-reset links logged when SMTP unset (KG-4); other logs not reviewed; no redaction policy |
| Retention periods not yet approved | Delete = archive and erasure is SUPER_ADMIN-only (BL-07, 2026-09-27); every category exists in **Retention policy** with its period unset (BL-63) — graduates' data stays until periods are approved; backups not defined |
| No consent/notice records | whether one is needed is a question for counsel ([PRIVACY-OPERATIONS C7](PRIVACY-OPERATIONS.md#1-consent-and-notice-requirements-for-legal-review)) |
| Privacy requests handled by hand | export (BL-41) and erasure (BL-07) exist; requests follow [PRIVACY-OPERATIONS §3](PRIVACY-OPERATIONS.md#3-handling-privacy-requests); no per-person export |
| Files on local disk | Backup/encryption/location unmanaged; not portable |
| Cross-school leakage paths | KG-1, KG-6, KG-8 |
| Screenshots/design comps may contain demo PII | `docs/design-reference/` (demo data; review before external sharing) |

## Decided policy direction (owner, 2026-09-20) — controls NOT YET IMPLEMENTED unless marked
SchoolOS stores sensitive information about children and families in Pakistan (CNIC, B-Form, contacts, addresses, academic records, attendance, medical information, guardian data). It follows **privacy-by-design**: collect and expose the minimum, restrict sensitive fields.

| Required control | Status today | Work item |
|---|---|---|
| Role-based access | IMPLEMENTED (with known scoping gaps KG-1/6/7/8) | BL-20, BL-01..03, BL-32 |
| Audit logging | PARTIALLY IMPLEMENTED (no old/new values; completeness unproven) | BL-18 |
| Encryption in transit | CONFIGURATION REQUIRED (TLS at the deployment edge; none defined) | BL-13 |
| Secure password storage | IMPLEMENTED (argon2) | — |
| Restricted access to sensitive fields (CNIC, B-Form, medical) | PARTIALLY IMPLEMENTED — role/scope on screens and APIs; **exports** leave them out unless the principal or SUPER_ADMIN asks for them (BL-41, 2026-09-26); no field-level encryption (design note [SENSITIVE-DATA](SENSITIVE-DATA.md)) | BL-41, BL-07 |
| Backups | NOT IMPLEMENTED | BL-13 (RPO ≤ 24 h, RTO ≤ 4 h, ≥ 30 days) |
| Retention/archive controls | IMPLEMENTED 2026-09-27 — archive instead of delete, SUPER_ADMIN erasure of archived records (audited), `RetentionPolicy` settings + review report (`/admin/retention-policy`); **no automatic permanent deletion** (a test asserts it) | BL-07, BL-63 |
| Consent/notice mechanisms | NOT IMPLEMENTED — notice drafted ([PRIVACY-NOTICE](PRIVACY-NOTICE.md), not approved); no notice screen or consent record; requirements pending counsel | BL-56 |
| Controlled exports | IMPLEMENTED 2026-09-26 — `GET /api/v1/admin/exports/:dataset` (CSV): school admins and SUPER_ADMIN, one school per export (campus-level admins: their campus), every export audited (`data-export.<dataset>` with scope, filters, sensitive flag, row count); sensitive columns only on explicit request by the principal or SUPER_ADMIN; formula cells neutralised | BL-41 |
| Breach/incident procedures | PARTIALLY IMPLEMENTED — documented 2026-10-01 ([PRIVACY-OPERATIONS §2](PRIVACY-OPERATIONS.md#2-breach-handling-process), [RUNBOOKS](../operations/RUNBOOKS.md#incident-and-support-process-decided-pilot)); approval, counsel review, named people and one rehearsal pending; notification timelines TBD | BL-56 |
| PII scrubbing in error tracking/logs (never capture passwords, tokens, CNIC/B-Form, medical or sensitive student/guardian data) | NOT IMPLEMENTED | BL-11 |
| Object storage with access checks for documents | NOT IMPLEMENTED (local disk) | BL-10 |

**Erasure:** permanent erasure is restricted to SUPER_ADMIN or an authorised privacy administrator and follows the organisation's legal/privacy policy (current code hard-deletes students — KG-17, BL-07).
**Ownership:** the Product Owner/organisation owns the privacy policy, consent policy and breach-notification process; Security/Engineering owns technical controls and incident escalation; legal counsel reviews the Pakistani legal requirements.
**Third parties:** Sentry, Firebase, e-mail/SMS providers and (optionally) the AI provider must be configured to minimise personal data sent to them; AI drafting is off by default and, if enabled, must redact child data where possible.

## Retention categories (RD-6) — configurable, periods TBD
No period below is invented. Each category needs a **configurable** period, approved by the `[PRIVACY_ADMINISTRATOR]` after legal/privacy review. **No automatic deletion is implemented or permitted until periods are approved** (BL-63; enforcement is post-pilot).
| Category | Examples in the data model | Sensitivity | Period |
|---|---|---|---|
| Student records | `Student`, medical info, documents | high / very high | TBD |
| Guardian records | `ParentProfile`, `StudentParent`, contacts | high | TBD |
| Staff records | `Staff*`, `Teacher`, hiring data | high | TBD |
| Attendance | `Attendance`, leave, risk flags | medium | TBD |
| Academic results / report cards | marks, `ReportCard`, promotions | high | TBD |
| Fee / financial records | vouchers, payments, receipts | medium; immutable | TBD |
| Complaints | `Complaint` incl. internal notes | medium–high | TBD |
| Audit logs | `AuditLog` | medium | TBD |
| Authentication / security logs | refresh/reset tokens, login events, app logs | medium | TBD |
| Uploaded documents | `File` objects in object storage | high | TBD |
| Backups | database + object-storage backups | inherits the source data; interacts with the 30-day minimum retention | TBD |

## Sensitive fields and encryption (RD-6)
- **Sensitive:** CNIC and similar government identifiers (`ParentProfile.cnic`, staff `cnic`, student `bFormNumber`), and medical/health information (`StudentMedicalInfo`).
- **Encryption at rest and restricted access** must be supported by the architecture (managed PostgreSQL and S3-compatible storage with provider encryption; role/scope-checked access).
- **Field-level encryption is NOT declared mandatory** until the legal/security review determines the requirement. If it is later required it must be implementable without redesigning the data model — keep sensitive fields in dedicated columns/tables behind a single access layer (BL-07).
- Privacy notice required before production use; consent/notice requirements and breach-notification timelines are **TBD pending legal review** (`[PRIVACY_ADMINISTRATOR]`); breach handling follows [PRIVACY-OPERATIONS §2](PRIVACY-OPERATIONS.md#2-breach-handling-process) (BL-56, draft).

## Still open (placeholders / legal values only)
Retention periods; whether field-level encryption is required; breach-notification obligations and timelines; notice/consent wording; the person assigned to `[PRIVACY_ADMINISTRATOR]`. None blocks architecture; the first three block privacy sign-off and any automatic deletion.
