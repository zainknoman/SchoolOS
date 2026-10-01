# Privacy Notice — draft structure (BL-56)

> **Status:** REQUIRES-DECISION — **DRAFT, NOT FOR USE.** Not approved by the Product Owner, not reviewed by counsel · **Verified:** 2026-10-01 against `wave-0/foundations@c2af6cc` · **Sources:** [DATA-PROTECTION](DATA-PROTECTION.md), [SENSITIVE-DATA](SENSITIVE-DATA.md), [OWNER-DECISIONS](../product/OWNER-DECISIONS.md) Q22/RD-7, `backend/src/data-export`, `backend/src/retention`, `backend/.env.example` · **Owner:** `[PRIVACY_ADMINISTRATOR]` (approval: Product Owner; review: legal counsel)
> RD-7 requires a privacy notice **before production use**. This file is the skeleton of that notice. It holds two kinds of content only: **facts about what the software does** (taken from the code and the data inventory, so counsel knows what the notice has to cover) and **placeholders** (`[TBD — counsel]`) wherever wording, a legal basis, a right, a period or an obligation is needed. **It contains no legal text and makes no compliance claim.** Nothing in it may be shown to parents, staff or schools until the sign-off block at the end is complete.

## How to use this draft
1. Counsel answers the questions in [PRIVACY-OPERATIONS §1](PRIVACY-OPERATIONS.md#1-consent-and-notice-requirements-for-legal-review) and writes the wording for every `[TBD — counsel]` below.
2. The Product Owner checks the facts sections against the deployed configuration (which providers are switched on) and approves.
3. The approved text is published where users will see it **before** their data is entered (where it is shown is open — see §9).
4. Any later change to what the software collects or which providers are enabled requires updating this notice first.

## 1. Who is responsible
- Organisation: `[LEGAL_ENTITY_NAME]` (OWNER-DECISIONS Q20).
- Role of the school versus the organisation for the data (who decides, who processes): `[TBD — counsel]`.
- Privacy contact: `[PRIVACY_ADMINISTRATOR]`, reachable at `[SUPPORT_EMAIL]` (or a dedicated privacy address `[PRIVACY_EMAIL]` if counsel requires one).

## 2. Whose data the system holds (fact)
Students (most are minors), their parents/guardians and emergency contacts, school staff and teachers, and job applicants (hiring module). Full inventory: [DATA-PROTECTION — What personal data is stored](DATA-PROTECTION.md#what-personal-data-is-stored).

## 3. What data is collected (fact; summarise in plain language for the final notice)
| Group | Examples held by the software |
|---|---|
| Student identity | name, gender, date and place of birth, nationality, religion, GR number, B-Form number |
| Student health (very sensitive) | blood group, allergies, medical conditions, special educational needs, medication and emergency notes |
| School records | enrolment, attendance, leave requests, marks, grades, report cards, promotions, complaints |
| Parents/guardians | name, phone, WhatsApp, e-mail, CNIC, occupation/employer, address, relationship to the student |
| Staff and teachers | CNIC, date of birth, contact details, addresses, experience, documents, employment status |
| Applicants | CV files and candidate details |
| Fees | vouchers, payments, receipts (no card data — payment gateways are off in the pilot, RD-14) |
| Accounts and security | sign-in identifier, password hash, session records, audit log of actions, device token for push notifications |
| Uploaded files | student/staff documents, photos, attachments to diary entries, circulars and complaints |

Which fields are mandatory and why each is needed (data minimisation, RD-7): `[TBD — Product Owner with counsel]`.

## 4. Why it is used
- Purposes, as the software uses the data (fact): running admissions and enrolment, attendance, timetables, academic records and report cards, fee vouchers and receipts, communication between school and parents (circulars, messages, diary, push notifications), complaints and leave, staff administration and hiring, security (sign-in, audit trail).
- Legal basis for each purpose: `[TBD — counsel]`.
- Whether any purpose needs consent, and whose consent for minors: `[TBD — counsel]`.

## 5. Who can see it (fact)
- Access is role-based and limited to the user's school (and campus where set); parents see only their own children; teachers see their assigned classes. Roles: [PERSONAS-AND-ROLES](../product/PERSONAS-AND-ROLES.md).
- Sensitive identifiers and medical fields are left out of exports unless the principal or a SUPER_ADMIN explicitly asks for them; every export is audited (BL-41).
- Service providers that may receive data **when the organisation switches them on** (each is off unless configured — `backend/.env.example`):

| Provider type | What it receives | Pilot state |
|---|---|---|
| Hosting / managed database | all data (encrypted at rest per provider) | provider not chosen (BL-13) |
| Object storage (S3-compatible) | uploaded files | required outside development; provider not chosen |
| Error tracking (Sentry) | error reports with personal data scrubbed (BL-11) | on when `SENTRY_DSN` is set |
| Push notifications (Firebase Cloud Messaging) | device token and notification text | planned for the pilot (BL-14) |
| E-mail (SMTP) | recipient address and message (e.g. password reset) | provider not chosen; may stay off (RD-4) |
| Malware scanning (ClamAV) | uploaded files, sent to the ClamAV service the organisation runs | on when `CLAMAV_HOST` is set |
| SMS / WhatsApp / payment gateways / AI drafting | — | off in the pilot |

Provider names, locations and any transfer outside Pakistan: `[TBD — fill in from the chosen providers; counsel to say what must be disclosed]`.

## 6. How long it is kept
- The software never deletes records automatically (a test asserts it); records are archived, and permanent erasure is restricted to SUPER_ADMIN (BL-07, BL-63).
- Retention periods per category: **TBD** — set in **Retention policy** only after legal review ([DATA-PROTECTION — Retention categories](DATA-PROTECTION.md#retention-categories-rd-6--configurable-periods-tbd)).
- Backup retention: at least 30 days (OWNER-DECISIONS Q26); how this interacts with erasure requests: `[TBD — counsel]`.

## 7. Choices and requests
- Which requests people can make (access, correction, erasure, objection, others) and the response time: `[TBD — counsel]`.
- How a request is made: to the school admin or `[SUPPORT_EMAIL]`; handled per [PRIVACY-OPERATIONS §3](PRIVACY-OPERATIONS.md#3-handling-privacy-requests).

## 8. Security and incidents
- Wording on security measures: `[TBD — counsel; do not claim more than SECURITY-OVERVIEW shows as implemented]`.
- Whether and how affected people are told about a breach: `[TBD — counsel]` (process: [PRIVACY-OPERATIONS §2](PRIVACY-OPERATIONS.md#2-breach-handling-process)).

## 9. Where and when the notice is shown — open
No screen in the staff console or the parent app shows a privacy notice today. Options to decide (Product Owner, with counsel's view on what counts as "shown before use"): on the admission form/school paperwork · a link on the console sign-in page · a first-launch screen in the parent app (needs a code change and a Play listing privacy URL, BL-43) · all of these. Decision: `[TBD]`. Whether acceptance must be recorded (a consent record does not exist in the data model): `[TBD — counsel]`.

## 10. Changes to this notice
How users are told about changes: `[TBD — counsel]`. Version and effective date: `[VERSION]` · `[EFFECTIVE_DATE]`.

## Sign-off (required before the notice is published or real data is entered)
| Step | Name / role | Date | Evidence |
|---|---|---|---|
| Facts checked against the deployed configuration | `[PRIVACY_ADMINISTRATOR]` | `[DATE]` | `[LINK]` |
| Counsel review and wording | `[LEGAL_COUNSEL]` | `[DATE]` | `[LINK — kept outside the repository if privileged]` |
| Product Owner approval | `[PRODUCT_OWNER]` | `[DATE]` | `[LINK]` |
