# SchoolOS — Requirements Backlog (DECIDED engineering work — NOT IMPLEMENTED)

> **Status:** PLANNED (decided, not built) · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** [OWNER-DECISIONS](../OWNER-DECISIONS.md), [KNOWN-GAPS](../../security/KNOWN-GAPS.md), [KNOWN-ISSUES](../../release/KNOWN-ISSUES.md), [BUSINESS-RULES](../BUSINESS-RULES.md) · **Owner:** Product Owner (priorities) / Engineering Lead (delivery)
> Everything here is **not** a current feature. Each item carries a decision already made by the owner (2026-09-20); the current behaviour stays documented as current until the item ships. Order and phasing: [GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN](../../release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md).
> **Priority:** `PILOT-BLOCKER` (must be done before a pilot goes live) · `PILOT-CORE` (in pilot scope, Q33) · `POST-PILOT` · `UNPRIORITISED` (no owner decision). **Phases:** A Security & platform · B Org & tenancy · C People & lifecycle · D Academics · E Attendance & leave · F Fees · G Parent app · H Quality & pilot exit.
> Done for any item means: code merged via PR, tests added (unit + e2e where the rule is isolation/authorisation/data-integrity), docs regenerated, the referenced KG/KI/BR rows moved or updated.

## Phase A — Security and platform baseline
| ID | Item | Priority | Acceptance criteria | Refs |
|---|---|---|---|---|
| BL-12 | Security headers (`helmet`), `trust proxy` config, dependency scanning in CI, fix High `npm audit` findings | PILOT-BLOCKER | Response carries standard security headers; rate limiter keys on real client IP behind the proxy (e2e); CI fails on High advisories; `npm audit --omit=dev` shows 0 High | KG-5, KG-12, KG-13 |
| BL-51 | Config safety: reject `change-me` secrets; require explicit `NODE_ENV`; remove/disable dev fallbacks in production; never log reset links (KG-4) | PILOT-BLOCKER | App refuses to boot in production with placeholder/short secrets or unset `NODE_ENV`; reset link never appears in logs in any mode; regression tests | KG-2, KG-3, KG-4 |
| BL-22 | Controlled first-SUPER_ADMIN bootstrap | PILOT-BLOCKER | One-time command reads credentials from env/secret store; sets `mustChangePassword`; refuses to run once a SUPER_ADMIN exists (or is disabled by flag); audited; documented in DEPLOYMENT/RUNBOOKS; no public registration path | Q30, KI-23 |
| BL-21 | Server-side account disable/unlock, session revocation (revoke-all, logout), enforce `mustChangePassword` on the server | PILOT-BLOCKER | Disabled/locked users are rejected within one request; `isLocked` is honoured; API rejects non-change-password calls while `mustChangePassword`; e2e | KG-10, KG-11, KG-23 |
| BL-10 | S3-compatible object-storage adapter behind the existing storage interface; migration tool for existing files | PILOT-BLOCKER | Uploads/downloads work against an S3-compatible endpoint in staging; access checks unchanged (`FilesAccessService`); no persistent writes to local disk in production config; e2e with a local S3 emulator | Q40, Q28, KG-14 |
| BL-39 | Safe scheduled jobs (leader lock/idempotency) and shared throttler storage | PILOT-CORE (needed before >1 instance) | Two instances never produce duplicate risk flags/digests (test with two app instances); throttling shared or documented single-instance | Q28, ADR-0008 |
| BL-11 | Health/readiness endpoints (DB check); structured JSON logs with request id; global exception filter; Sentry with PII scrubbing; uptime probe | PILOT-BLOCKER | `/health/live` and `/health/ready` (DB) exist and are not authenticated; logs are JSON with request id; Sentry events contain no passwords, tokens, CNIC, B-Form, medical data (scrub test); alert rules documented | Q29, KI-9, KI-24 |
| BL-13 | Deployment tooling: container image, environment definitions (staging/production), migration step, TLS, secrets injection; automated DB backups (PITR preferred) with a **rehearsed restore** | PILOT-BLOCKER | Staging and production deploy from a tag via documented pipeline; backup meets RPO ≤ 24 h, retention ≥ 30 d; a restore rehearsal within RTO ≤ 4 h is recorded in `docs/release/` | Q25, Q26, KG-21 |
| BL-36 | Staff-console token-storage hardening review (HttpOnly Secure SameSite cookie, refresh rotation, CSRF) | PILOT-CORE (decision at security review; may be a later phase) | Written decision (adopt / accept-with-mitigation); if adopted: no regression in the current login flow, CSRF protection tested, tokens absent from `localStorage`; also remove query-string token acceptance (KG-15) | Q42, KG-9, KG-15 |
| BL-52 | Upload hardening: MIME sniffing, content-type allow-list, size limits, optional malware scan | PILOT-CORE | Server-detected type must match allow-list; oversize rejected; tests | KG-14 |

## Phase B — Organization and tenancy foundation
| ID | Item | Priority | Acceptance criteria | Refs |
|---|---|---|---|---|
| BL-20 | Fix cross-school leakage: circulars to own school's parents only; holiday campus validation and no platform-wide null-campus holidays; regression tests for TENANT-1..5 | PILOT-BLOCKER | A parent/school never sees another school's circular/holiday (e2e cross-tenant); create with a foreign `campusId` is rejected | KG-1, KG-6, KI-22 |
| BL-01 | School-scoped academic sessions; per-school "active" resolution; backfill existing data; remove global "first active" lookups; seed creates per-school sessions | PILOT-BLOCKER | `AcademicSession.schoolId` required; activating a session deactivates only that school's others; student create, voucher issue and bulk import resolve the caller's school session; migration backfills every existing row deterministically with a verification report; e2e for two schools | Q1, BR-ORG-01/02, KG-7, KI-1, BL-17 |
| BL-02 | Subject management: school-scoped `Subject`, unique per school, create/edit/deactivate by SUPER_ADMIN and own-school SCHOOL_ADMIN (teachers denied), reusable across campuses/classes, deactivate instead of delete when referenced | PILOT-BLOCKER | CRUD endpoints + console UI; `GET /subjects` scoped to school; e2e for authz and cross-school isolation; historical marks/timetable unaffected by deactivation | Q2, KG-8, KI-2 |
| BL-03 | Terms and fee structures school-scoped; fee structure lifecycle draft → active → locked (once referenced) → archived; edit only in draft/unused; never hard-deleted | PILOT-BLOCKER | `schoolId` on both; lists scoped; edit of a used structure is rejected with a clear error; archive hides from new issue but keeps history; e2e | Q3, KG-8, KI-3 |
| BL-33 | Copy-structure: console permission matches API (SCHOOL_ADMIN for own school; SUPER_ADMIN across schools); extend to subjects, subject assignments, syllabus structure, timetable templates; new-session records only | PILOT-CORE | SCHOOL_ADMIN can run it from the UI; copying never updates/deletes rows of the source or any historical session (test asserts source rows unchanged); idempotent; audited | Q19, KI-18, BR-ORG-05 |
| BL-32 | Permission model for ACCOUNTS (fees/finance only by default; other modules by explicit grant) | PILOT-CORE | ACCOUNTS default cannot reach admissions/complaints/messages APIs or routes; a grant mechanism exists and is audited; role matrix regenerated | Q18 |
| BL-53 | Missing DB invariants: one ACTIVE enrolment per student; one voucher per student/session/month; status enums | PILOT-CORE | Unique/partial-unique constraints migrated after data check; concurrent-create test | KI-12, KI-13 |

## Phase C — People, guardians and lifecycle
| ID | Item | Priority | Acceptance criteria | Refs |
|---|---|---|---|---|
| BL-23 | **Global guardian identity refactor:** separate (1) person/guardian identity, (2) parent authentication account, (3) school-scoped student–guardian relationship, (4) school-scoped authorisation. One parent account can have children in several schools; no duplicate accounts per school; merge/dedupe path for existing duplicates | PILOT-BLOCKER (owner ruling: not deferred) | Parent logs in once and sees children across schools; each school only sees its own relationships and its own students; `StudentAccessService`, circulars, messages, notifications and fees scoping re-verified; migration plan with rollback, duplicate-detection report; cross-tenant e2e | Q4, ADR-0006, BR-SCOPE-02, RD-11 |
| BL-04 | Guardian rules: relationship type required (Father/Mother/Guardian/Other), primary flag, **max 2 primary per student**, unlimited non-primary/emergency contacts | PILOT-BLOCKER (with BL-23) | Third primary rejected (API + UI); relationship type mandatory; non-primary guardians allowed; bulk import respects rules; e2e | Q4, BR-STU-05 |
| BL-25 | Teacher/staff assignment history: teacher, session, school/campus, class, section, subject, role, start/end dates; queries for historical reporting; assignment changes end-date rather than overwrite | PILOT-CORE | New model + service; every change to class-teacher / subject / timetable assignment writes a history row; report "who taught X in session Y"; history rows immutable; e2e | Q15 |
| BL-05 | Promotion: outcomes Promoted, Promoted with conditions, Retained, Transferred, Withdrawn/Left (mapping to existing values per RD-10); computed indicators (results, attendance, fee clearance) shown as warnings; optional per-school blocking rules; explicit admin confirmation; history never modified | PILOT-CORE | Preview returns indicators per student and no auto-"Promoted" without confirmation; confirmation required in API; blocking only if the school configured it; conditions text stored; e2e including a session rollover that leaves prior-session data unchanged | Q5, BR-ENR-02/03, KI-17 |
| BL-07 | Retention model: archived/former status for students and staff; soft delete only where legally required; hard delete of student/staff PII removed from the normal path; erasure restricted to SUPER_ADMIN/privacy admin; **no automatic deletion** | PILOT-BLOCKER for removing hard delete; policy periods = RD-6 | `DELETE /admin/students/:id` no longer hard-deletes (archives instead); archived records excluded from active lists yet visible historically; erasure endpoint behind role + audit; e2e | Q7, KG-17, KI-14 |
| BL-41 | Controlled data export for authorised school admins (students, guardians, enrolments, attendance, results, fees) with audit | PILOT-CORE | Export limited to caller's school; each export audited; sensitive fields (CNIC, medical) excluded unless explicitly requested and permitted | Q7, Q22 |

## Phase D — Academics
| ID | Item | Priority | Acceptance criteria | Refs |
|---|---|---|---|---|
| BL-26 | Yearly syllabus per class + subject scoped to the academic session | PILOT-CORE | Syllabus CRUD by admin/authorised staff; unique per (class, subject, session); copied by BL-33; read by teachers of that class | Q2, Q19 |
| BL-27 | Configurable grading scales (per school): percentage bands → letter grade/remark; GPA fields in the model (optional); category weights must total 100 % to publish results | PILOT-CORE | Scale CRUD; final grade computation returns marks, %, letter; weights ≠ 100 blocks publication (fixes KI-16) | Q6, BR-GRD-01/03, KI-16 |
| BL-06 | Report cards generated from gradebook (subject-wise, overall, remarks) and exported as PDF; uploaded historical report cards still supported | PILOT-CORE | Generate per student/term/session from marks; regeneration after mark change is versioned (issued cards immutable); PDF export; parent read-only; e2e | Q6, BR-RC-01 |

## Phase E — Attendance and leave
| ID | Item | Priority | Acceptance criteria | Refs |
|---|---|---|---|---|
| BL-28 | Attendance risk configurable per school (window, threshold, min days; defaults 30 / 25 % / 5), alerts to class teacher and school admin, optional parent notification (off by default) | PILOT-CORE | Settings persisted per school; job reads settings; alert visible to teacher and admin; parent notification only when enabled; unit + e2e; also clarifies "absence vs not-present" rate | Q8, BR-ATT-04 |
| BL-29 | Leave workflow: teacher/class-teacher **recommendation** step; SCHOOL_ADMIN approve/reject; works with no class teacher; separate attribution (recommender vs decider) in audit; LEAVE attendance rows attributed to the actual decider — never a fabricated teacher | PILOT-CORE | Approval succeeds for a section without a class teacher; `markedById` is the admin (or nullable) — never a synthetic id; recommendation and decision are two audit entries; e2e | Q12, BR-LV-02, KI-26 |

## Phase F — Fees
| ID | Item | Priority | Acceptance criteria | Refs |
|---|---|---|---|---|
| BL-08 | Pilot fee scope: structures/terms/charges, payments (incl. partial), outstanding balances, defaulter report, basic carry-forward to the next session/class; paid records immutable (corrections via reversing entries) | PILOT-CORE | Partial payment allocates and leaves an outstanding balance; defaulter report per school/campus/class; carry-forward creates an opening balance in the new session without editing the old one; edit/delete of paid history rejected; e2e | Q9, BR-FEE-01..03 |
| BL-24 | Post-pilot fee extras: discounts, scholarships, waivers, late fees, refunds, installment plans, accounting/export reports | POST-PILOT | Each is a separate, audited, reversible ledger entry; no mutation of paid history | Q9 |
| BL-14 | Integration verification: **FCM and SMTP** in staging (pilot); JazzCash/EasyPaisa (post-pilot, behind feature config; manual payment recording is the pilot path) | PILOT-CORE (FCM, SMTP) / POST-PILOT (gateways) | Sandbox run recorded per integration in `docs/release/` with date and evidence; feature flags default off | Q34–Q36, KG-18 |

## Phase G — Parent app
| ID | Item | Priority | Acceptance criteria | Refs |
|---|---|---|---|---|
| BL-35 | Parent password reset: separate flow, deep-link/web-compatible URL, short-lived single-use token, distinct from staff reset | PILOT-BLOCKER | Reset email opens the parent app (or a parent web page) and completes; token single-use; staff and parent flows separate in code; e2e | Q41, KI-7 |
| BL-30 | Parent complaints (basic): parent creates complaint, sees own history/status; staff respond and change status; internal notes never returned to parents | PILOT-CORE | Parent-facing DTO excludes internal notes (test); parents can only see their own children's complaints | Q10, KI-27 |
| BL-31 | Complaints (advanced): assignment, SLA/resolution tracking, escalation | POST-PILOT (split proposed, RD-9) | — | Q10, Q33 |
| BL-43 | Parent app release pipeline: Play Console (org-owned), signing keys outside Git, Firebase staging/production projects, production app identifiers | PILOT-CORE | Signed AAB from CI/secure store, key never in repo; production build points to production API; internal-testing track release recorded | Q32, Q35 |
| BL-54 | Parent app device/accessibility validation: Android 9+, low-memory, slow network, small screens; Android accessibility checks | PILOT-CORE | Test matrix executed and recorded; no blocking defects | Q43, Q45 |

## Phase H — Quality, verification and pilot exit
| ID | Item | Priority | Acceptance criteria | Refs |
|---|---|---|---|---|
| BL-37 | CI hardening: **prerequisite** — clean the backend format/lint backlog (2,014 errors); then make backend lint, format, type-check, unit, e2e and build blocking | PILOT-CORE (no fixed date) | Backend lint job has no `continue-on-error` and is green; documented | Q46, KI-21 |
| BL-15 | Load/performance validation against Q44 targets (p95 < 500 ms CRUD, auth p95 < 1 s, 100 concurrent, 99.5 % availability plan) | PILOT-BLOCKER for exit | Load test report against staging with 2,000 students' data | Q44 |
| BL-40 | Pagination/filters on unbounded list endpoints | PILOT-CORE | List endpoints accept `page/limit` with server caps; consoles updated; e2e | KI-8 |
| BL-18 | E2E for staff, hiring, files, risk job; regression tests for every closed KG/KI | PILOT-CORE | Suites in CI | KI-22 |
| BL-55 | Accessibility conformance pass (WCAG 2.1 AA) for staff console | PILOT-CORE | axe checks in CI plus manual keyboard/screen-reader audit report | Q43 |
| BL-56 | Privacy operations: privacy policy, consent/notice text, breach-notification and incident/support process (P1–P4), documented and owner-approved **before production**; counsel review | PILOT-BLOCKER (non-code) | Documents approved by Product Owner; counsel review recorded; no legal-compliance claims until then | Q22, Q27, RD-7, RD-13 |
| BL-57 | Pilot exit review: security review, backup restore test, monitoring live, school sign-off, no open Critical/High defects | PILOT-BLOCKER for exit | Signed checklist in `docs/release/` | Q33 |
| BL-34 | **SchoolOS rebrand of config/code + neutral demo data.** Inventory: `backend/prisma/seed.ts` (emails `@schoolportal.local`, DB name, "Beacon House"), `backend/.env.example`, `.github/workflows/ci.yml`, `docs/api/*.postman_*.json`, `parent-app/lib/firebase_options.dart`, `backend/src/notifications/fcm-config.spec.ts`, `staff-console/src/lib/i18n.ts`, `staff-console/src/views/StaffManagementView.spec.ts`. **Risk-review separately:** default DB name (existing databases), Firebase/app identifiers (need a new Firebase project anyway, BL-43), package names, `docs/database/SEEDING.md` after seed change | PILOT-CORE | No product-facing "SchoolPortal"/"Beacon House" outside archives; seed uses `Demo School` and `@schoolos.*` demo domains; technical identifiers with migration risk are listed with an explicit keep/rename decision | Q17, Q23, KG-20, KI-20, BL-17 |
| BL-58 | Repository hygiene (needs explicit owner authorisation): stale worktrees/branches, large design binaries (LFS/external), `sample4` CSV scratch content (contains another project's credentials — must not be committed) | PILOT-CORE (housekeeping) | Per [housekeeping inspection](../../audit/2026-09-20-housekeeping-inspection.md) after authorisation; no unique unpushed work lost | Q47–Q49, KI-25 |

## Post-pilot / unprioritised
| ID | Item | Priority | Notes | Refs |
|---|---|---|---|---|
| BL-45 | Per-period attendance (design constraint now: do not block it; keep day-level uniqueness migration-friendly) | POST-PILOT | | Q11, KI-15 |
| BL-46 | Public online admissions API/module | POST-PILOT | | Q14 |
| BL-47 | Student login (architecture must allow it; do not implement) | POST-PILOT | | Q13 |
| BL-48 | WhatsApp Business Cloud API with approved templates | POST-PILOT | Replace the free-text sender | Q38 |
| BL-49 | AI drafting hardening: feature flag default off, cost limits, redaction | POST-PILOT | | Q39 |
| BL-38 | SMS provider adapter (decouple from the placeholder URL; provider TBD) | POST-PILOT (unless the pilot school requires SMS) | | Q37, KI-4, RD-4 |
| BL-59 | Campus-level attendance-risk overrides; advanced accounting; advanced analytics | POST-PILOT | | Q8, Q33 |
| BL-09 | Parent web portal | UNPRIORITISED | Q41 requires the reset flow to be app-or-web compatible only | — |
| BL-16 | Multi-tenant SaaS direction | UNPRIORITISED | Needs its own audit before any refactor; BL-23 and BL-01 must not foreclose it | — |
| BL-19 | OpenAPI/Swagger contract | UNPRIORITISED | | KI-11 |

## Legacy ID map (former backlog rows)
BL-01…BL-22 keep their meaning; BL-04 = guardian **rules** (identity refactor is BL-23), BL-08 = pilot fee scope (extras moved to BL-24), BL-14 split by phase, BL-17 folded into BL-01/BL-34, BL-13/BL-11/BL-10 re-scoped to the decided hosting-agnostic targets.
