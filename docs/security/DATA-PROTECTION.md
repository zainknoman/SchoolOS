# Data Protection and PII Inventory

> **Status:** CURRENT (inventory; policy direction DECIDED, controls not yet built) · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/prisma/schema.prisma` ([DATA-DICTIONARY](../database/DATA-DICTIONARY.md)) · **Owner:** Security Owner (Engineering Lead until assigned)
> No privacy policy, retention schedule, consent record or data-subject-request process exists in the repository yet. **This document makes no claim of legal or regulatory compliance**; that claim may be made only after qualified legal counsel has reviewed the applicable Pakistani requirements (owner decision, 2026-09-20). Nothing below is legal guidance.

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

## Decided policy direction (owner, 2026-09-20) — controls NOT YET IMPLEMENTED unless marked
SchoolOS stores sensitive information about children and families in Pakistan (CNIC, B-Form, contacts, addresses, academic records, attendance, medical information, guardian data). It follows **privacy-by-design**: collect and expose the minimum, restrict sensitive fields.

| Required control | Status today | Work item |
|---|---|---|
| Role-based access | IMPLEMENTED (with known scoping gaps KG-1/6/7/8) | BL-20, BL-01..03, BL-32 |
| Audit logging | PARTIALLY IMPLEMENTED (no old/new values; completeness unproven) | BL-18 |
| Encryption in transit | CONFIGURATION REQUIRED (TLS at the deployment edge; none defined) | BL-13 |
| Secure password storage | IMPLEMENTED (argon2) | — |
| Restricted access to sensitive fields (CNIC, B-Form, medical) | PARTIALLY IMPLEMENTED (role/scope only; no field-level restriction) | BL-41, BL-07 |
| Backups | NOT IMPLEMENTED | BL-13 (RPO ≤ 24 h, RTO ≤ 4 h, ≥ 30 days) |
| Retention/archive controls | NOT IMPLEMENTED — records are **retained**, archived not hard-deleted; **no automatic permanent deletion** until a retention policy is formally defined | BL-07 |
| Consent/notice mechanisms | NOT IMPLEMENTED | BL-56 |
| Controlled exports | NOT IMPLEMENTED — authorised school admins only, audited | BL-41 |
| Breach/incident procedures | NOT IMPLEMENTED — must be documented **before production** | BL-56 |
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
- Privacy notice required before production use; consent/notice requirements and breach-notification timelines are **TBD pending legal review** (`[PRIVACY_ADMINISTRATOR]`); breach handling needs a documented incident-response process (BL-56).

## Still open (placeholders / legal values only)
Retention periods; whether field-level encryption is required; breach-notification obligations and timelines; notice/consent wording; the person assigned to `[PRIVACY_ADMINISTRATOR]`. None blocks architecture; the first three block privacy sign-off and any automatic deletion.
