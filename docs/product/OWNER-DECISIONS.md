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
| 4 | Guardian identity is **global to the person**; **max 2 primary guardians per student**, unlimited non-primary guardians/emergency contacts; each relationship has relationship type (Father, Mother, Guardian, Other), primary flag, student and school context; one parent account across schools, no duplicates. Global identity, authentication account, school-scoped relationship and school-scoped authorization are separate concerns. **Pilot requirement, not deferred** (owner ruling) | `ParentProfile`/`User` carry school scoping; `StudentParent` unconstrained (BR-STU-05) | BL-04, BL-23 |
| 5 | Promotion is a **manual admin decision** with system-computed supporting indicators (results, attendance, fee clearance) shown as warnings/recommendations; blocking only if a school configures it; admin must explicitly confirm; outcomes: Promoted, Promoted with conditions, Retained, Transferred, Withdrawn/Left | Decisions PROMOTED/RETAINED/GRADUATED/TRANSFERRED_OUT/WITHDRAWN; preview suggests PROMOTED for all; no indicators (BR-ENR-02) | BL-05 |
| 6 | Report cards **generated from gradebook** (marks, %, letter grade, configurable grading scales, remarks, subject-wise + overall result), exportable as PDF; GPA supported in the model if possible, optional; **uploads retained** for pre-SchoolOS history. **Pilot core** | Manual record + file; weighted % only, no letter grades (BR-GRD-01, BR-RC-01) | BL-06, BL-27 |
| 7 | Records are **retained**, not hard-deleted: active vs archived/former, soft delete only where legally required; history (enrolments, attendance, results, fees, teaching assignments) preserved; export for authorised school admins; permanent erasure only SUPER_ADMIN/privacy administrators under the legal policy; **no automatic permanent deletion** until a retention policy is formally defined | `DELETE /admin/students/:id` hard-deletes (KG-17) | BL-07, BL-41 |
| 8 | Attendance-risk defaults 30 days / 25 % / ≥ 5 tracked days, **configurable per school** (applies to all campuses; campus overrides possible later). Flag visible to class teacher and school admin; parent notification supported but **off until the school enables it** | Hard-coded constants (BR-ATT-04) | BL-28 |
| 9 | Fees: discounts, scholarships, late fees, refunds, installments, carry-forward, outstanding balances, partial payments, waivers, defaulter reports, accounting exports; history immutable/auditable. **Pilot subset:** structures, terms, charges, payments, outstanding balances, defaulter reporting, basic carry-forward. Others post-pilot | Vouchers/payments/reconcile only (BR-FEE-01..04) | BL-08 (pilot), BL-24 (post-pilot) |
| 10 | Parents can **raise complaints** and see status/history; staff can assign, update status, respond, add internal notes, track resolution; parents never see internal notes | Parents read-only; staff create/update (PERSONAS note) | BL-30 (basic), BL-31 (advanced) |
| 11 | **Daily** attendance for release 1; design must allow per-period later | Daily only (BR-ATT-01) | BL-45 (post-pilot, design constraint) |
| 12 | Leave: teacher/class teacher may **recommend**; authorised SCHOOL_ADMIN approves/rejects; **no class teacher required**; recommendation and final decision attributed **separately** in the audit trail; never fabricate a teacher attribution | Approval **requires** a class teacher and stamps attendance with `classTeacherId` (BR-LV-02, `leave.service.ts:108-143`) | BL-29 |
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
| 21 | Dedicated security contact `security@[production-domain]` once the domain is final; placeholder only; private reporting, not public issues | `SECURITY.md` |
| 22 | Privacy-by-design for children's data (CNIC, B-Form, contacts, addresses, academic, attendance, medical, guardians). Required controls: RBAC, audit log, TLS, secure password storage, restricted sensitive fields, backups, retention/archive, consent/notice, controlled exports, breach procedures. **No legal-compliance claim** until counsel reviews. Product Owner owns privacy policy and consent; Security/Engineering owns technical controls and incident escalation; legal counsel reviews Pakistani requirements; breach-notification process must be documented **before production** | [DATA-PROTECTION](../security/DATA-PROTECTION.md) |
| 23 | Neutral fictional demo school (`Demo School`); no real branding or data in the repo | BL-34 (seed still uses a real-sounding name) |
| 24 | Role-based ownership: Product Owner/SchoolOS Owner; Engineering Lead; Operations/Deployment Owner; Security Owner (= Engineering Lead until assigned). No personal names | Doc headers |

## D. Hosting and operations
| # | Decision | Where recorded |
|---|---|---|
| 25 | Hosting provider/region **not chosen**; design for managed PostgreSQL, separate staging/production, HTTPS, per-environment secrets, external object storage, automated backups. Environments: Development (local), Staging `staging.<production-domain>`, Production `app.<production-domain>`; domains are placeholders | [DEPLOYMENT](../operations/DEPLOYMENT.md) |
| 26 | Backups daily minimum (PITR preferred); **RPO ≤ 24 h, RTO ≤ 4 h, retention ≥ 30 days**; initial targets, may tighten after pilot | [BACKUP-RESTORE](../operations/BACKUP-RESTORE.md) |
| 27 | Pilot: Engineering/Operations owner handles technical incidents; school admin is first contact for school-side issues; four **internal** severity levels P1–P4; **no contractual SLA**; response times defined after the pilot; a designated support email/helpdesk channel; an incident/support process must exist **before production launch** | [RUNBOOKS](../operations/RUNBOOKS.md) |
| 28 | Single backend instance acceptable for the pilot; architecture stays horizontally scalable: no permanent local-disk uploads, storage abstraction, jobs with safe locking/idempotency, no in-memory distributed state | [DEPLOYMENT](../operations/DEPLOYMENT.md), BL-10, BL-39 |
| 29 | Sentry (errors/performance), provider/DB monitoring, structured logs, external uptime monitoring (provider not fixed); **PII scrubbing on**; never capture passwords, tokens, CNIC/B-Form, medical or sensitive student/guardian data | [MONITORING-LOGGING](../operations/MONITORING-LOGGING.md) |
| 30 | First SUPER_ADMIN via a **one-time controlled bootstrap** (command/script; credentials from secret management; forced password change; mechanism disabled afterwards); no public registration | BL-22 (KI-23) |
| 31 | Semantic Versioning; **first production release = 1.0.0**; Git tags; **PR-based development, no direct commits to main/production branch**; staging validation + Product/Engineering approval before production | [RELEASE-CHECKLIST](../release/RELEASE-CHECKLIST.md) |
| 32 | Parent app: **Google Play first**, App Store later; organisation owns Play/Apple accounts, signing keys, certificates, Firebase project, app ids; keys never in Git | BL-43 |
| 33 | Pilot: 1 school, campuses as needed, ~500–2,000 students; core scope and exit criteria in [GAP-ANALYSIS](../release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md) | same |

## E. Integrations
| # | Decision | Current code |
|---|---|---|
| 34 | Payment gateways **not a launch blocker**; JazzCash and EasyPaisa supported behind feature configuration, activated only with merchant credentials; manual payment recording is the fallback | Adapters exist, never verified |
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
| Role | Owns |
|---|---|
| Product Owner / SchoolOS Owner | product docs, business rules, privacy policy and consent process, release approval, licence |
| Engineering Lead | architecture, API, database, testing, release engineering, release approval |
| Operations / Deployment Owner | deployment, backup/restore, monitoring, runbooks, incident/support process |
| Security Owner (= Engineering Lead until assigned) | security docs, technical controls, incident escalation, vulnerability handling |

## Still `REQUIRES-DECISION` (not answered by the owner)
| # | Item | Why it matters | Blocks |
|---|---|---|---|
| RD-1 | Legal entity name (`[LEGAL_ENTITY_NAME]`) and copyright holder | LICENSE, SECURITY, privacy policy | licence finalisation |
| RD-2 | Production domain and security/support email addresses | SECURITY.md, support process, CORS, email `FROM`, deep links | production |
| RD-3 | Hosting provider/region, object-storage vendor, managed-Postgres vendor | DEPLOYMENT, BL-10, BL-13 | staging/production |
| RD-4 | SMTP provider; SMS provider; uptime-monitoring provider | BL-14, BL-38, BL-11 | notifications/monitoring |
| RD-5 | Named owners for each ownership role | escalation | production |
| RD-6 | Retention periods per data category; who is a "privacy administrator"; whether CNIC/medical fields need field-level encryption | Q7 policy, BL-07 | any automatic deletion; privacy sign-off |
| RD-7 | Consent/notice content and breach-notification process | Q22 | production |
| RD-8 | Whether attendance **marking** (not just leave) may proceed without a class teacher (BR-ATT-03) | Q12 covered leave only | BL-29 scope |
| RD-9 | Which complaint functions are "advanced" (Q10 lists assign/internal notes/resolution tracking; Q33 defers "advanced complaint workflows"). Proposed split in BL-30/BL-31 | pilot scope | BL-30/31 |
| RD-10 | Whether "Transferred" and "Withdrawn/Left" replace the current TRANSFERRED_OUT/WITHDRAWN/GRADUATED values or extend them (Q5 omits GRADUATED) | enum design | BL-05 |
| RD-11 | Data-migration approach for existing schools' sessions and guardians (Q1 "appropriate" session; Q4 duplicate-parent merge rules) | migration safety | BL-01, BL-23 |
| RD-12 | Notification channel and Firebase project ownership account; Play developer account holder | BL-43 | app release |
| RD-13 | Incident response-time targets per severity; designated support channel address | Q27 (post-pilot SLA) | production support |
| RD-14 | Whether pilot payments are all manual (gateways off) — assumed yes per Q34 | fees scope | BL-14 |
| RD-15 | Removal/archival of the two `sample4` CSVs, stale worktrees/branches, LFS migration — awaiting explicit authorisation | Q47–Q49 | housekeeping |
