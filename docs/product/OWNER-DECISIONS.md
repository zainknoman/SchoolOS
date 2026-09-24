# SchoolOS — Owner Decisions Register

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** the owner's written answers to the 50 readiness questions and the follow-up ruling on conflicts (both 2026-09-20); code state cited per row · **Owner:** Product Owner (SchoolOS Owner)
> **How to read this register.** A decision here sets **intent and policy**. It does **not** make anything implemented: "Current code" is the behaviour that exists today and remains the documented behaviour until code changes. Every row that conflicts with the code has an engineering work item in [BACKLOG](requirements/BACKLOG.md). Where the code conflicts with a decided rule, **the rule is preserved and the code is the defect** (owner ruling, 2026-09-20).
> Decided by: Product Owner, 2026-09-20. Named individuals are not recorded; roles only (see [Roles used in docs](#ownership-roles)).

## Guiding principles (owner, 2026-09-20)
1. School-scoped data is the default. 2. Academic history is never destroyed by promotion or session rollover. 3. Students have no login in the initial release. 4. Parents/guardians can span multiple schools. 5. Principal is a SCHOOL_ADMIN attribute, not a role. 6. **Campus** and **Class** are the canonical terms. 7. **SchoolOS** is the canonical product name. 8. Financial and academic records are immutable/auditable. 9. Integrations are configurable and never block the core platform. 10. No real school branding or personal data in demo/sample data. 11. Security, privacy and children's-data protection are first-class requirements. 12. Stable core platform before AI, public admissions or student login.

## A. Product and business rules
| # | Decision (DECIDED 2026-09-20) | Current code (unchanged) | Work item |
|---|---|---|---|
| 1 | Academic sessions are **school-scoped** (own calendar per school); existing data backfilled to the right school's session | Global; activation deactivates all (BR-ORG-01/02) | BL-01 |
| 2 | Subjects are **school-scoped**, reusable across campuses/classes; SUPER_ADMIN and own-school SCHOOL_ADMIN manage them; teachers cannot; active/inactive instead of delete where history exists; **yearly syllabus per class + subject per session** | Global unique names; read-only list; no syllabus | BL-02, BL-26 |
| 3 | Fee structures and terms are **school-scoped**; editable while draft/unused, **locked** once invoices depend on them; archive, never hard-delete | Unscoped; no edit/delete | BL-03 |
| 4 | Guardian identity is **global to the person**; **max 2 primary guardians per student**, unlimited non-primary guardians/emergency contacts; each relationship has relationship type (Father, Mother, Guardian, Other), primary flag, student and school context; one parent account across schools, no duplicates. Global identity, authentication account, school-scoped relationship and school-scoped authorization are separate concerns. **Pilot requirement, not deferred** (owner ruling) | Parent `User` has no `schoolId` and identity is already global (`User.identifier`, `ParentProfile.cnic` unique); `StudentParent` has no relationship type/primary flag; fan-out is not school-scoped (BR-STU-05, KG-1) | BL-04, BL-23 |
| 5 | Promotion is a **manual admin decision** with system-computed supporting indicators (results, attendance, fee clearance) shown as warnings/recommendations; blocking only if a school configures it; admin must explicitly confirm; outcomes: Promoted, Promoted with conditions, Retained, Transferred, Withdrawn/Left (+ Graduated retained, RD-10) | Decisions PROMOTED/RETAINED/GRADUATED/TRANSFERRED_OUT/WITHDRAWN; preview suggests PROMOTED for all; no indicators (BR-ENR-02) | BL-05 |
| 6 | Report cards **generated from gradebook** (marks, %, letter grade, configurable grading scales, remarks, subject-wise + overall result), exportable as PDF; GPA supported in the model if possible, optional; **uploads retained** for pre-SchoolOS history. **Pilot core** | Manual record + file; weighted % only, no letter grades (BR-GRD-01, BR-RC-01) | BL-06, BL-27 |
| 7 | Records are **retained**, not hard-deleted: active vs archived/former, soft delete only where legally required; history (enrolments, attendance, results, fees, teaching assignments) preserved; export for authorised school admins; permanent erasure only SUPER_ADMIN/privacy administrators under the legal policy; **no automatic permanent deletion** until a retention policy is formally defined | `DELETE /admin/students/:id` hard-deletes (KG-17) | BL-07, BL-41 |
| 8 | Attendance-risk defaults 30 days / 25 % / ≥ 5 tracked days, **configurable per school** (applies to all campuses; campus overrides possible later). Flag visible to class teacher and school admin; parent notification supported but **off until the school enables it** | Hard-coded constants (BR-ATT-04) | BL-28 |
| 9 | Fees: discounts, scholarships, late fees, refunds, installments, carry-forward, outstanding balances, partial payments, waivers, defaulter reports, accounting exports; history immutable/auditable. **Pilot subset:** structures, terms, charges, payments, outstanding balances, defaulter reporting, basic carry-forward. Others post-pilot | Vouchers/payments/reconcile only (BR-FEE-01..04) | BL-08 (pilot), BL-24 (post-pilot) |
| 10 | Parents can **raise complaints** and see status/history; staff can assign, update status, respond, add internal notes, track resolution; parents never see internal notes. Pilot scope fixed by RD-9; escalation/SLA/routing automation post-pilot | Parents read-only; staff create/update (PERSONAS note) | BL-30 (pilot), BL-31 (post-pilot) |
| 11 | **Daily** attendance for release 1; design must allow per-period later | Daily only (BR-ATT-01) | BL-45 (post-pilot, design constraint) |
| 12 | Leave and attendance: teacher/class teacher may **recommend** leave; authorised SCHOOL_ADMIN approves/rejects; **no class teacher required**; recommendation and final decision attributed **separately** in the audit trail; never fabricate a teacher attribution; **attendance marking also needs no class teacher** (RD-8) | Approval **requires** a class teacher and stamps attendance with `classTeacherId` (BR-LV-02, `leave.service.ts:108-143`); attendance marking needs a Teacher identity because `Attendance.markedById` is a required Teacher FK — admins are attributed to the class teacher or refused (BR-ATT-03) | BL-29, BL-60 (schema M1/M1b) |
| 13 | **No student login** in the initial release; architecture must not preclude it later | Confirmed: no such role | BL-47 (post-pilot) |
| 14 | Staff-entered admissions now; public online admissions = future module/API | Staff-entered only | BL-46 (post-pilot) |
| 15 | Maintain **teacher/staff assignment history**: teacher, session, school/campus, class, section, subject, role, start/end dates | NOT IMPLEMENTED | BL-25 |

## B. Roles and terminology
| # | Decision | Current code | Work item |
|---|---|---|---|
| 16 | PRINCIPAL is **not** a role; it is a flag on an authorised SCHOOL_ADMIN | Matches (ADR-0002) | — |
| 17 | Terms: **Campus** (not Branch), **Class** (not Grade), **SchoolOS**. Rename current product-facing "SchoolPortal" references (UI, active docs, seed data/emails, `.env.example`, default DB name, Postman, Firebase/config refs, tests, package/app names where safe). Historical archived docs may keep it. Risky technical identifiers are listed separately. "Beacon House" → neutral demo data | Active docs done in this pass; code/config still contain both (see BL-34 inventory) | BL-34 |
| 18 | ACCOUNTS: **fees/finance only**; admissions, complaints and general messaging only when explicitly granted; prefer permission-based access | ACCOUNTS currently has admissions, complaints and messages (PERSONAS §2) | BL-32 |
| 19 | SCHOOL_ADMIN can copy academic structure between sessions **for their own school** (classes, sections, subjects, subject assignments, syllabus structure, timetable templates); SUPER_ADMIN across schools; creates new-session records only, never touches history; **UI permissions must match the API** | API already allows SCHOOL_ADMIN; UI route is SUPER_ADMIN-only (KI-18); copies classes/sections only (BR-ORG-05) | BL-33 |

## C. Ownership and legal
| # | Decision | Doc effect |
|---|---|---|
| 20 | **Proprietary / closed source.** No open-source licence. Legal entity is `[LEGAL_ENTITY_NAME]` until formally confirmed | Root `LICENSE` (proprietary notice, placeholder entity); `package.json` `UNLICENSED` unchanged |
| 21 | Dedicated security contact `[SECURITY_EMAIL]` once the domain is final; placeholder only; private reporting, not public issues | `SECURITY.md` |
| 22 | Privacy-by-design for children's data (CNIC, B-Form, contacts, addresses, academic, attendance, medical, guardians). Required controls: RBAC, audit log, TLS, secure password storage, restricted sensitive fields, backups, retention/archive, consent/notice, controlled exports, breach procedures. **No legal-compliance claim** until counsel reviews. Product Owner owns privacy policy and consent; Security/Engineering owns technical controls and incident escalation; legal counsel reviews Pakistani requirements; breach-notification process must be documented **before production** | [DATA-PROTECTION](../security/DATA-PROTECTION.md) |
| 23 | Neutral fictional demo school (`Demo School`); no real branding or data in the repo | BL-34 (seed still uses a real-sounding name) |
| 24 | Role-based ownership (seven roles with placeholders — see Ownership roles below, RD-5). No personal names | Doc headers |

## D. Hosting and operations
| # | Decision | Where recorded |
|---|---|---|
| 25 | Hosting provider/region **not chosen**; design for managed PostgreSQL, separate staging/production, HTTPS, per-environment secrets, external object storage, automated backups. Environments: Development (local), Staging `staging.[PRODUCTION_DOMAIN]`, Production `app.[PRODUCTION_DOMAIN]`; domains are placeholders | [DEPLOYMENT](../operations/DEPLOYMENT.md) |
| 26 | Backups daily minimum (PITR preferred); **RPO ≤ 24 h, RTO ≤ 4 h, retention ≥ 30 days**; initial targets, may tighten after pilot | [BACKUP-RESTORE](../operations/BACKUP-RESTORE.md) |
| 27 | Pilot: Operations owner handles technical incidents; school admin is first contact for school-side issues; four **internal** severity levels P1–P4 with internal acknowledgement targets (RD-13: 30 min / 2 business h / 1 business day / 3 business days), **no contractual SLA**; support channel `[SUPPORT_EMAIL]`; an incident/support process must exist **before production launch** | [RUNBOOKS](../operations/RUNBOOKS.md) |
| 28 | Single backend instance acceptable for the pilot; architecture stays horizontally scalable: no permanent local-disk uploads, storage abstraction, jobs with safe locking/idempotency, no in-memory distributed state | [DEPLOYMENT](../operations/DEPLOYMENT.md), BL-10, BL-39 |
| 29 | Sentry (errors/performance), provider/DB monitoring, structured logs, external uptime monitoring (provider not fixed); **PII scrubbing on**; never capture passwords, tokens, CNIC/B-Form, medical or sensitive student/guardian data | [MONITORING-LOGGING](../operations/MONITORING-LOGGING.md) |
| 30 | First SUPER_ADMIN via a **one-time controlled bootstrap** (command/script; credentials from secret management; forced password change; mechanism disabled afterwards); no public registration | BL-22 (KI-23) |
| 31 | Semantic Versioning; **first production release = 1.0.0**; Git tags; **PR-based development, no direct commits to main/production branch**; staging validation + Product/Engineering approval before production | [RELEASE-CHECKLIST](../release/RELEASE-CHECKLIST.md) |
| 32 | Parent app: **Google Play first**, App Store later; organisation owns Play/Apple accounts, signing keys, certificates, Firebase project, app ids; keys never in Git | BL-43 |
| 33 | Pilot: 1 school, campuses as needed, ~500–2,000 students; core scope and exit criteria in [GAP-ANALYSIS](../release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md) | same |

## E. Integrations
| # | Decision | Current code |
|---|---|---|
| 34 | Payment gateways **not a launch blocker and OFF for the pilot (RD-14)**; JazzCash and EasyPaisa supported behind feature configuration, activated only with merchant credentials; manual payment recording is the fallback | Adapters exist, never verified |
| 35 | Dedicated SchoolOS Firebase project; FCM for parent push; separate staging/production projects where practical | No project; `firebase_options.dart` placeholder |
| 36 | Production SMTP/transactional email behind a provider abstraction, env-configured; **provider not chosen** | SMTP adapter exists |
| 37 | SMS behind an adapter/interface; **provider not chosen**; do not couple to the placeholder URL | Placeholder URL (KI-4) |
| 38 | WhatsApp = future; official Cloud API; approved templates required, no free-text design | Free-text Graph API sender |
| 39 | AI drafting **optional, feature-flagged**, not a production dependency; if enabled: org credentials, server-side keys, configurable usage/cost limits, minimise/redact child data | Optional stub/Anthropic provider |
| 40 | **S3-compatible object storage** in production behind a storage service; no persistent local-disk uploads | Local disk only |
| 41 | Parent password reset uses a **parent-app/web-compatible flow** (short-lived, single-use token, deep link), logically separate from staff reset | Single `FRONTEND_URL` (KI-7) |

## F. Quality and process
| # | Decision | Current code / work item |
|---|---|---|
| 42 | Do not treat `localStorage` tokens as the final production design without review; evaluate HttpOnly secure cookies, SameSite, refresh rotation, CSRF; **do not break current auth**; a separate hardening phase if migration is needed | Tokens in `localStorage` (KG-9) → BL-36 |
| 43 | Target **WCAG 2.1 AA** for web apps (keyboard, semantics, focus, contrast, accessible errors, labels, responsive); Parent app follows Android accessibility guidelines | Conformance unknown (NFR-A11Y-01) |
| 44 | Pilot targets: API p95 < 500 ms (normal CRUD), auth p95 < 1 s, ≥ 100 concurrent active users, **99.5 % monthly availability**, horizontally scalable design; to be load-tested | No targets/tests existed → BL-15, BL-40 |
| 45 | Android 9+, low-memory devices, slow/intermittent networks, small screens, common Android makers; not high-end only | No device matrix |
| 46 | Backend lint becomes a **blocking CI check after** the formatting/lint backlog is cleaned (no fixed date); CI progressively enforces format, lint, type-check, unit, integration/e2e, build. The clean-up is a **prerequisite** in the plan | 2,014 errors, non-blocking → BL-37 |

## G. Repository housekeeping (owner ruling: inspect only)
| # | Decision | State |
|---|---|---|
| 47 | Do not prune worktrees/branches until verified; inspect first | Inspection reported in [housekeeping inspection](../audit/2026-09-20-housekeeping-inspection.md); **no mutation made** |
| 48 | Large generated screenshots/HTML/zips should not stay in normal Git history unless genuine product assets; preferred: source docs in Git, binaries to LFS/external storage, unneeded generated files removed; demo screenshots kept only if free of private data and approved | Inspected; **no mutation made** |
| 49 | Do not discard the sample4 CSV changes; inspect purpose and diff; keep and commit if intentional, otherwise archive/remove after verification | Inspected — see report (contains pasted scratch text, incl. another project's credentials); **no mutation made** |
| 50 | Documentation may be committed **after** the analysis is complete and reviewed, as separate logical commits (product readiness; architecture/operations; security/deployment; repository cleanup last and separate); run tests/lint/format/doc checks first. **Do not commit yet** — the owner will authorise after reviewing | The Phase 14 session made **no commit**. Note: `e4e9f27` (docs phases 0–13, pushed) was created externally mid-session and includes earlier versions of this file; later edits are uncommitted |

## Ownership roles
Ownership is defined by **role**, not by person. A role is a responsibility in the documentation; the person assigned to it is a separate fact recorded outside the repository (or in the placeholder below once assigned). Never write an individual's name into a doc header.
| Role | Placeholder for the assigned person | Owns |
|---|---|---|
| Product Owner / SchoolOS Owner | `[PRODUCT_OWNER]` | product docs, business rules, release approval, licence, privacy policy content (with the Privacy Administrator) |
| Technical Owner (= "Engineering Lead" in doc headers) | `[TECHNICAL_OWNER]` | architecture, API, database, testing, release engineering, release approval |
| Security Owner (Technical Owner until assigned) | `[SECURITY_OWNER]` | security docs, technical controls, vulnerability handling, incident escalation |
| Privacy Administrator | `[PRIVACY_ADMINISTRATOR]` | privacy notice, consent policy, retention policy, breach-notification process, permanent-erasure approvals, legal-counsel liaison |
| Operations / Infrastructure Owner (= "Operations/Deployment Owner" in doc headers) | `[OPS_OWNER]` | deployment, backup/restore, monitoring, runbooks, incident handling |
| Support Owner | `[SUPPORT_OWNER]` | support channel `[SUPPORT_EMAIL]`, first-line triage with school admins |
| Finance Owner | `[FINANCE_OWNER]` | fee policy, payment reconciliation rules, financial-record retention input |

## Placeholder registry (values NOT invented — supplied later; code/config must read them from environment/config, never hard-code)
| Placeholder | Meaning | Used by |
|---|---|---|
| `[LEGAL_ENTITY_NAME]`, `[YEAR]` | copyright holder / legal entity (product name stays **SchoolOS**) | `LICENSE`, privacy documentation |
| `[PRODUCTION_DOMAIN]` | production domain (staging = `staging.[PRODUCTION_DOMAIN]`, production = `app.[PRODUCTION_DOMAIN]`) | CORS, deep links, e-mail links |
| `[SECURITY_EMAIL]` | security disclosure address | `SECURITY.md` |
| `[SUPPORT_EMAIL]` | support channel | RUNBOOKS, user guides |
| `[EMAIL_FROM]` | transactional e-mail sender | mail adapter config |
| `[FIREBASE_PROJECT_ID]`, `[FIREBASE_OWNER]`, `[PLAY_DEVELOPER_ACCOUNT]` | Firebase project/owner, Play developer account | parent-app release, FCM config |
| `[PRODUCT_OWNER]` … `[FINANCE_OWNER]` | the seven role assignees above | escalation, approvals |
| Hosting/region/PostgreSQL provider, SMTP, SMS, uptime monitor | **TBD** (provider-agnostic; environment-configured) | DEPLOYMENT, INTEGRATIONS |

## Resolution of the open items RD-1 … RD-15 (owner, 2026-09-20 second ruling)
All 15 were answered. "Residual" = what is still TBD. None of the residuals is an architecture decision; where a value is a placeholder the architecture stays provider-agnostic and configuration-driven.
| # | Decision (DECIDED) | Residual (TBD) | Work item |
|---|---|---|---|
| RD-1 | Keep `[LEGAL_ENTITY_NAME]` as copyright holder; do not assume an entity; LICENSE/SECURITY/privacy docs may use the placeholder. Production/legal-finalisation item, not an architecture blocker | entity name | — |
| RD-2 | No invented domains/e-mails: `[PRODUCTION_DOMAIN]`, `[SECURITY_EMAIL]`, `[SUPPORT_EMAIL]`, `[EMAIL_FROM]`; architecture reads them from environment variables | actual values | BL-13, BL-51 |
| RD-3 | Provider-agnostic. Pilot: hosting/region/PostgreSQL provider TBD; **S3-compatible** object storage. Minimum expectations: managed PostgreSQL, automated backups, PITR where available, S3-compatible storage, TLS, secrets management, monitoring/logging, provider-supported restore. Document requirements; do not select a vendor | vendors | BL-13, BL-10 |
| RD-4 | SMTP, SMS, uptime monitoring: TBD; provider-agnostic; all configurable through environment/configuration; **e-mail/SMS may stay disabled for the pilot** until providers are chosen | providers | BL-14, BL-38, BL-11 |
| RD-5 | Seven ownership roles with placeholders (table above); role ownership is distinct from the person assigned | assignees | — |
| RD-6 | **Configurable retention policy**; periods TBD pending legal/privacy review; categories: student, guardian, staff, attendance, academic results/report cards, fee/financial, complaints, audit logs, authentication/security logs, uploaded documents, backups. Privacy Administrator = `[PRIVACY_ADMINISTRATOR]`. CNIC and other government identifiers, and medical/health data are **sensitive**; field-level encryption is **not** declared mandatory until legal/security review, but the design must support encryption-at-rest and restricted access, and must allow field-level encryption later without redesigning the data model. **No automatic deletion until periods are approved** | retention periods; whether field-level encryption is required | BL-07, BL-63 |
| RD-7 | Privacy-by-design; a **privacy notice is required before production use**; consent/notice requirements depend on jurisdiction and legal review (no invented legal text); minimal data collection; role-based, school-scoped access; audit logging; a documented incident-response process for breaches. Legal/privacy owner = `[PRIVACY_ADMINISTRATOR]` | breach-notification obligations and timelines; notice/consent wording | BL-56 |
| RD-8 | **Attendance marking may proceed without a class teacher** (not only leave). Class-teacher assignment optional; attendance never blocked for lack of one; an authorised teacher/staff member may mark per permissions; the system records who actually marked/modified it; no fake class-teacher attribution | — | BL-60 (BL-29 for leave) |
| RD-9 | **Pilot complaints:** parent submits complaint with category, title, description, attachments (where supported), status, assigned owner, internal notes (never shown to parents), resolution/comments, timestamps, audit trail. **Post-pilot:** multi-level escalation, SLA automation/timers, complex routing, automated notifications/workflows, advanced analytics, cross-campus complaint administration, approval chains | — | BL-30 (pilot), BL-31 (post-pilot) |
| RD-10 | Student lifecycle statuses: **ACTIVE, TRANSFERRED, WITHDRAWN, GRADUATED**; `TRANSFERRED_OUT` is not a separate concept (= TRANSFERRED); `WITHDRAWN` = withdrawal/left; `GRADUATED` stays; history preserves previous status/session/class; **controlled migration** to the final terminology, no silent data change. See mapping in [BUSINESS-RULES §8](BUSINESS-RULES.md) | — | BL-61 |
| RD-11 | Existing-school migration must be explicit, auditable, backward-aware, repeatable/idempotent where practical and tested before production. Sessions: map to the right school, no needless duplication, preserve history, never assign to an arbitrary "current" session when ambiguous — flag for manual review. Guardians: preserve the global identity model, deterministic matching on reliable identifiers only, never merge on similar names, flag potential duplicates, never merge so that one school's students become visible to an unauthorised account. A **migration strategy and validation/reconciliation report must be documented before executing** | — | BL-62 |
| RD-12 | Push via FCM; `[FIREBASE_PROJECT_ID]`, `[FIREBASE_OWNER]`, `[PLAY_DEVELOPER_ACCOUNT]` placeholders; the release process must document ownership and access before publishing | account values | BL-43 |
| RD-13 | Internal targets (not a contractual SLA): **P1** acknowledge ≤ 30 min, continuous investigation until mitigated; **P2** ≤ 2 business hours; **P3** ≤ 1 business day; **P4** ≤ 3 business days. Support channel `[SUPPORT_EMAIL]`. A customer-facing SLA is a future business decision | SLA | BL-56 |
| RD-14 | **Pilot payment gateways are OFF.** Manual fee recording, vouchers/receipts, manual payment status and manual reconciliation must work; JazzCash/EasyPaisa stay behind configuration flags; nothing blocks pilot deployment; future gateways enable without redesigning fee architecture | — | BL-08, BL-14 |
| RD-15 | **No cleanup yet.** Do not delete the sample4 CSVs, worktrees or branches; no LFS migration; no removals/renames. Recommended actions are documented; a separate controlled housekeeping phase follows product-readiness review with explicit authorisation | authorisation to clean | BL-58 |

## BL-62 migration-strategy decisions (owner, 2026-09-24)
The owner approved the **recommended option for each of D1–D8** in [MIGRATION-STRATEGY §9](../database/MIGRATION-STRATEGY.md): D1 anchor school keeps a shared session/subject/fee structure, other schools get clones; D2 unreferenced rows in a multi-school database are assigned or deleted explicitly, never copied; D3 a holiday without a campus is copied to every school and listed; D4 a circular without a school stays null (SUPER_ADMIN and past recipients only) until assigned; D5 fee structures attributed by voucher label with a confirmation list; D6 guardian relationship/primary-slot rules G4/G5; D7 more than one active session blocks M3; D8 review queue = `MigrationReviewItem` table + SQL runbook. This satisfies the RD-11 “strategy documented before executing” requirement; each migration still needs its harness scenario, production-copy dry-run and backup (§8).

## Remaining unresolved decisions / TBDs only
| # | Item | Nature | Blocks |
|---|---|---|---|
| T-1 | Values behind the placeholders: legal entity/year, production domain, security/support/e-mail-from addresses, Firebase project/owner, Play developer account, role assignees | supply before production; config-driven | production launch (not architecture) |
| T-2 | Hosting provider, region, managed PostgreSQL provider, S3-compatible vendor | vendor choice | staging/production deployment (BL-13, BL-10) — architecture unaffected |
| T-3 | SMTP, SMS, uptime-monitoring providers | vendor choice; e-mail/SMS may stay off in the pilot | see B-1 below |
| T-4 | Retention periods per category; whether CNIC/medical need field-level encryption | legal/privacy review | any automatic deletion (none will be built); privacy sign-off |
| T-5 | Breach-notification obligations/timelines; privacy notice and consent wording | legal review | production launch |
| T-6 | Formal customer-facing SLA | future business decision | nothing in the pilot |
| T-7 | Authorisation for housekeeping (CSV cleanup, worktrees/branches, LFS) | owner authorisation | nothing in the pilot |

## What still genuinely blocks the pilot (derived; see also [GAP-ANALYSIS](../release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md) §7)
- **B-1 (new, derived from RD-4 + Q33 + Q41): parent password reset needs a delivery channel.** Pilot exit requires working parent authentication and password reset, but RD-4 lets e-mail/SMS stay disabled and the current code, with SMTP unset, only writes the reset link to the log (KG-4). The pilot therefore needs **either** a chosen SMTP provider (T-3) **or** an admin-assisted reset (school admin issues a one-time temporary password with `mustChangePassword`, no link logged). Not an RD repeat — a consequence of the answers. Recommended: implement the admin-assisted path (no vendor dependency) and add SMTP when chosen.
- **B-2:** FCM needs a real Firebase project (`[FIREBASE_PROJECT_ID]`) for "notifications operational" in the exit criteria; without one, push stays a logging no-op.
- **B-3:** the engineering pilot blockers themselves (Phases A–C in the plan) — all code work, none decision-blocked.
- **B-4 (production, not pilot start):** a **staging** environment needs some host, database and S3-compatible store (T-2), and a privacy notice plus incident process must exist before real school data is entered (T-5, BL-56).
