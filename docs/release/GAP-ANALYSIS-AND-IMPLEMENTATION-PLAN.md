# Product Readiness Gap Analysis and Phased Implementation Plan

> **Status:** CURRENT (plan) — **implementation in progress; the live progress table is [EXECUTION-PLAN §0](EXECUTION-PLAN.md), and each done item carries a "Done" note in the [BACKLOG](../product/requirements/BACKLOG.md)**. The "Current" column below records the state at 2026-09-20; the **Progress** note after the table lists what has since been delivered · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** [OWNER-DECISIONS](../product/OWNER-DECISIONS.md), [BACKLOG](../product/requirements/BACKLOG.md), [KNOWN-GAPS](../security/KNOWN-GAPS.md), [KNOWN-ISSUES](KNOWN-ISSUES.md), [PRODUCTION-READINESS](PRODUCTION-READINESS.md) · **Owner:** Engineering Lead with Product Owner
> Verdict is unchanged: **NO-GO** until the pilot blockers below are closed. The owner has decided the product rules; the gap is now almost entirely **engineering and infrastructure work**, plus **placeholder/TBD values** (vendors, domains, legal values — §5). All 15 open owner items were answered on 2026-09-20; nothing that remains is an architecture decision. No estimates are given because none were supplied; phases are ordered by dependency and by the owner's pilot scope (Q33).
> Principle applied (owner ruling 2026-09-20): where code conflicts with a confirmed product rule, **the rule stands, the conflict is documented, and a work item is created** — no requirement was weakened to fit the code.

## 1. Pilot definition (owner, Q33)
One school, campuses as needed, ~500–2,000 students plus parents/staff, real workflows, single backend instance (design stays horizontally scalable).
**Core scope:** organisation (school, campus, session, classes, sections) · student lifecycle (admissions, enrolment, promotion, history) · people (teachers, staff, guardians, relationships, assignment history) · academics (school subjects, assignments, yearly syllabus, gradebook, report cards) · attendance (daily, leave, risk) · fees (structures, terms, charges, payments, outstanding, defaulters, basic carry-forward) · parent (auth, reset, attendance and fee visibility, complaints) · platform (RBAC, audit, secure bootstrap, backups, object storage, monitoring, error tracking, security baseline).
**Post-pilot unless the pilot school requires them:** public admissions, student login, per-period attendance, WhatsApp, AI drafting, automated payment gateways, advanced accounting/complaints/analytics, campus attendance overrides.
**Exit criteria:** stable auth · stable admissions/enrolment · attendance, fees, academic/session workflows, parent app and notifications operational · backups **tested** · monitoring live · security review complete · no unresolved Critical/High defects · school sign-off (BL-57).

## 2. Gap analysis by capability
Legend: ✅ exists · ⚠ partial · ❌ missing · 🔁 conflicts with the decided rule (rule preserved; code is the defect).

| Capability (decided rule) | Today | Gap | Work items |
|---|---|---|---|
| School-scoped sessions (Q1) | 🔁 global session; activation deactivates all | schema, backfill, per-school active resolution | BL-01 |
| School-scoped subjects + CRUD (Q2) | 🔁 global, read-only | schema, endpoints, UI | BL-02 |
| Yearly syllabus (Q2) | ❌ → ✅ 2026-09-26 | model, CRUD, copy | BL-26 |
| Fee structures/terms scoped, lockable (Q3) | 🔁 unscoped; no edit/delete | scoping, lifecycle | BL-03 |
| Global guardian, ≤ 2 primary, relationship type (Q4) | ⚠ parent `User` has **no** `schoolId` and identity is already global; links unconstrained; fan-out not school-scoped | relationship data, cross-school linking + PII boundary, school-scoped fan-out, dedupe (no `schoolId` on the identity) | BL-23, BL-04 |
| Promotion outcomes + indicators + confirmation (Q5) | ⚠ 5 decisions, no indicators, default PROMOTED | indicators, outcomes, confirmation, config | BL-05 |
| Lifecycle status terms ACTIVE/TRANSFERRED/WITHDRAWN/GRADUATED (RD-10) | 🔁 `LEFT`, `TRANSFERRED_OUT` | controlled, audited migration | BL-61 |
| Existing-school migration strategy + reconciliation report (RD-11) | ❌ | strategy doc, dry-run, manual-review queue | BL-62 |
| Configurable retention policy, no auto-delete (RD-6) | ❌ | settings + report | BL-63 |
| Parent reset without an e-mail provider (RD-4 × Q41) | ❌ link only logged | admin-assisted reset | BL-64 |
| Generated report cards + grading scales (Q6) | 🔁 upload only; no letter grade | scales, generation, PDF | BL-27, BL-06 |
| Retention/archive, no hard delete (Q7) | 🔁 hard delete exists | archive model, erasure control, export | BL-07, BL-41 |
| Configurable attendance risk + alerts (Q8) | 🔁 constants; no alert routing | settings, alerts | BL-28 |
| Fee features (Q9) | ⚠ vouchers, payments, reconcile | partial payments/outstanding/defaulters/carry-forward now; extras later | BL-08, BL-24 |
| Parent complaints (Q10, RD-9) | 🔁 parents read-only | pilot workflow (submit, assign, internal notes, resolution, audit); escalation/SLA post-pilot | BL-30, BL-31 |
| Daily attendance now / per-period later (Q11) | ✅ daily | keep migration-friendly | BL-45 |
| Leave and attendance without class teacher; separate attribution (Q12, RD-8) | 🔁 `markedById` is a required Teacher FK; admins are attributed to the class teacher or refused | schema (`markedByUserId`, nullable `markedById`; LeaveRequest recommender/decider) + workflow | BL-60, BL-29 |
| Staff-entered admissions (Q14) | ✅ | — | — |
| Staff/teacher assignment history (Q15) | ❌ | model + hooks + report | BL-25 |
| ACCOUNTS = finance only (Q18) | 🔁 also admissions/complaints/messages | permission model | BL-32 |
| Copy structure by SCHOOL_ADMIN (Q19) | ⚠ API yes, UI no; classes/sections only | UI permission, wider scope | BL-33 |
| Rebrand + neutral demo data (Q17, Q23) | ⚠ docs done; seed/config not | code/config rename | BL-34 |
| Bootstrap first SUPER_ADMIN (Q30) | ❌ | command + guard | BL-22 |
| Object storage (Q40, Q28) | ❌ local disk | S3 adapter | BL-10 |
| Health, logs, Sentry, uptime (Q29) | ❌ | endpoints, logger, Sentry with scrubbing | BL-11 |
| Backups RPO 24 h / RTO 4 h (Q26) | ❌ | tooling + rehearsal | BL-13 |
| Deployment, staging/prod (Q25) | ❌ | image, pipeline, TLS | BL-13 |
| Parent reset flow (Q41) | 🔁 single `FRONTEND_URL` | separate flow | BL-35 |
| Firebase + Play publishing (Q32, Q35) | ❌ | project, signing, pipeline | BL-43 |
| Token storage review (Q42) | ⚠ `localStorage` | decision + optional migration | BL-36 |
| WCAG 2.1 AA (Q43) | ⚠ axe tooling, no conformance | audit | BL-55 |
| Performance/availability targets (Q44) | ❌ no tests; unbounded lists | load test, pagination | BL-15, BL-40 |
| Android 9+ device matrix (Q45) | ❌ | test matrix | BL-54 |
| Blocking backend lint (Q46) | ⚠ 2,014 errors, non-blocking | cleanup then enforce | BL-37 |
| Tenant-isolation defects, unsafe defaults, deps | ❌ open | fix + regression | BL-20, BL-51, BL-12, BL-21 |
| Privacy operations, breach process, support process (Q22, Q27) | ❌ documents absent | write, approve, counsel review | BL-56 |
| Integrations (Q34–Q39) | ⚠ adapters, unverified | verify FCM/SMTP for pilot; gateways post-pilot | BL-14, BL-38, BL-48, BL-49 |
| Licence, security contact, domains (Q20, Q21, RD-1, RD-2) | ⚠ placeholders (`[LEGAL_ENTITY_NAME]`, `[SECURITY_EMAIL]`, `[PRODUCTION_DOMAIN]`, `[SUPPORT_EMAIL]`, `[EMAIL_FROM]`) | supply values; config-driven | §5 |


**Progress (updated 2026-09-26 after BL-06, branch `wave-0/foundations`)** — delivered since this table was written (✅ = done, commit in EXECUTION-PLAN §0):
- ✅ Wave 0: BL-65 harness, BL-62 strategy (approved), BL-18 scaffold, BL-66 generators, BL-37 part 1.
- ✅ Wave 1: BL-51 config safety, BL-12 headers/audit, BL-21 account controls, BL-64 parent reset without e-mail, BL-22 bootstrap super admin, BL-52 upload checks, BL-60 attendance without class teacher (M1).
- ✅ Wave 2: BL-10 object storage, BL-11 health/logs/Sentry, BL-39 job lock, BL-40 pagination (BL-13 is Ops, open).
- ✅ Wave 3: BL-20 circular/holiday anchors (M2), BL-01 school sessions (M3), BL-02 school subjects (M4), BL-03 fee structures (M5), BL-33 copy structure, BL-32 accounts grants, BL-53 DB invariants (M12), BL-34 rebrand/neutral demo data.
- ✅ Wave 4: BL-23 + BL-04 guardians (M6), BL-61 lifecycle terms (M7), BL-05 promotion indicators/confirmation, BL-25 teaching-assignment history (M8), BL-07 archive/erasure + BL-63 retention settings (M9; also closed KG-25, record-scoped student/staff/teacher routes), BL-41 audited one-school CSV export (sensitive fields for the principal/SUPER_ADMIN only).
- ✅ Wave 5 so far: BL-26 yearly syllabus per class + subject (admins edit, teachers of the class read, copied by copy-structure, ended sessions read-only); BL-27 per-school grading scales with letters/remarks/grade points and result publication gated on weights of 100 % (closes KI-16; also KG-26); BL-06 report cards generated from the published results (versioned, immutable, PDF, parents see the current card). Next: BL-28, BL-29, then Waves 6–7.
So in the table: Q4, Q5, Q15, Q19, Q17/Q23 (code part), Q30, Q40, Q29 (app part), Q44 pagination part, Q46 part 1, the tenant-isolation/unsafe-default row, RD-4 × Q41, RD-6 (retention settings; enforcement post-pilot), Q7 (archive instead of delete, controlled export), Q22 (export part), RD-10 and RD-11 are now ✅; Q28/Q25/Q26 infrastructure, Q32/Q35, and the rest remain as listed.

## 3. Phased implementation plan (dependency order)
The wave-by-wave execution plan, migration list (M1–M13), regeneration matrix and rollback rules are in [EXECUTION-PLAN](EXECUTION-PLAN.md); Wave 0 (BL-62, BL-65, BL-66, BL-37 part 1, BL-18 scaffold) precedes Phase A here.
Phases may overlap where noted. Each phase ends with its acceptance criteria met, tests green in CI, docs regenerated, and the referenced KG/KI rows updated.

| Phase | Theme | Items | Why this order | Exit gate |
|---|---|---|---|---|
| **A** | Security and platform baseline | BL-12, BL-51, BL-22, BL-21, BL-10, BL-11, BL-13, BL-36 (decision), BL-52, BL-39 | Unsafe defaults, secrets and infra underpin every later verification; storage and deployment are prerequisites for staging | Staging deployed from a tag; secure bootstrap works; no High audit findings; backup restore rehearsed; Sentry live with scrubbing test |
| **B** | Organisation and tenancy | BL-62 (strategy first), BL-20, BL-01, BL-02, BL-03, BL-33, BL-32, BL-53 | Session/subject/fee scoping is a dependency of promotion, syllabus, grading, fees and guardians | Cross-school e2e green for sessions, subjects, terms, fee structures, circulars, holidays; UI/API permission parity for copy-structure |
| **C** | People, guardians, lifecycle | BL-23, BL-04, BL-25, BL-61, BL-05, BL-07, BL-63, BL-41 | Guardian identity refactor touches auth and scoping — do it once, early, before parent-app and fees work | Parent with children in two schools passes isolation e2e; assignment history recorded; no hard delete path remains |
| **D** | Academics | BL-26, BL-27, BL-06 | Needs B (subjects, sessions) and C (assignment history) | Report card PDF generated from marks for a full session; grading scale configurable |
| **E** | Attendance and leave | BL-28, BL-29, BL-60 | Independent after B; can run parallel with D | Leave approved and attendance marked with no class teacher and correct attribution; risk alerts to teacher and admin |
| **F** | Fees | BL-08, BL-14 (SMTP/FCM part) | Needs B (scoped structures) and the session model | Partial payment, outstanding, defaulter report and carry-forward verified; paid history immutable |
| **G** | Parent app | BL-35 (+ BL-64 fallback), BL-30, BL-43, BL-54 | Needs C (guardian identity), F (fee visibility) | Signed build on an internal Play track; parent reset, attendance, fees, complaints work on Android 9+ devices |
| **H** | Quality and pilot exit | BL-37, BL-40, BL-18, BL-15, BL-55, BL-56, BL-34, BL-57, BL-58 | Confirms everything together | Pilot exit criteria (§1) signed |
| **Post-pilot** | — | BL-24, BL-31, BL-45–BL-49, BL-38, BL-59, BL-09, BL-16, BL-19 | Owner deferred | — |

Parallelism: A (infra) runs alongside B. BL-34 (rename) should land **before** BL-43 so Firebase/app identifiers are created once. BL-37's lint cleanup should start early (it is mechanical) but the blocking switch lands only when the backlog is clean.

## 4. Conflicts between decided rules and current code (all preserved as rules)
| # | Decided rule | Code conflict | Item |
|---|---|---|---|
| C1 | Sessions per school (Q1) | Global session table; first-active lookups | BL-01 |
| C2 | Guardian global identity spanning schools (Q4) | **Corrected:** parent `User` rows have no `schoolId` and identity is already global; the conflict is `StudentParent` lacking relationship type/primary flag, no PII boundary for a parent linked from a second school, and non-school-scoped fan-out (ADR-0006 describes *staff* scoping) | BL-23 |
| C3 | Leave and attendance need no class teacher; no fake attribution (Q12, RD-8) | root cause: `Attendance.markedById` is a required Teacher FK; admins are attributed to the class teacher or refused (`attendance.service.ts`, `leave.service.ts:108-143`) | BL-60 (M1) then BL-29 (M1b) |
| C13 | Lifecycle terms ACTIVE/TRANSFERRED/WITHDRAWN/GRADUATED (RD-10) | `StudentStatus.LEFT`, `PromotionDecision.TRANSFERRED_OUT` | BL-61 |
| C14 | Parent reset must work with e-mail disabled (RD-4, Q33) | link only logged (KG-4) | BL-64 |
| C4 | ACCOUNTS finance only (Q18) | ACCOUNTS reaches admissions/complaints/messages | BL-32 |
| C5 | No hard delete (Q7) | `student.delete` | BL-07 |
| C6 | Parent complaint creation (Q10) | Parent screen read-only, create is staff-only | BL-30 |
| C7 | Copy-structure by SCHOOL_ADMIN in UI (Q19) | Router SUPER_ADMIN-only | BL-33 |
| C8 | Immutable fee history + lockable structures (Q3, Q9) | No structure edit/delete at all (inverse gap); no immutability tests | BL-03, BL-08 |
| C9 | SchoolOS / Demo School (Q17, Q23) | Seed, `.env.example`, CI, Postman, Firebase file, specs | BL-34 |
| C10 | Parent reset flow (Q41) | One `FRONTEND_URL` | BL-35 |
| C11 | Safe job locking (Q28) | Unlocked in-process cron | BL-39 |
| C12 | Object storage (Q40) | Local disk only | BL-10 |

## 5. Remaining unresolved decisions / TBDs
Only placeholders and legal/vendor values remain ([OWNER-DECISIONS](../product/OWNER-DECISIONS.md#remaining-unresolved-decisions--tbds-only)): T-1 placeholder values, T-2 hosting/region/PostgreSQL/S3 vendor, T-3 SMTP/SMS/uptime providers, T-4 retention periods and field-level-encryption requirement, T-5 breach-notification timelines and notice/consent wording, T-6 customer-facing SLA, T-7 housekeeping authorisation. **None forces an architecture decision:** the design is provider-agnostic and configuration-driven.

## 6. Risks
| Risk | Mitigation |
|---|---|
| BL-23 and BL-01 are schema-breaking migrations on live-shaped data | Additive-first migrations (ADR-0005), backfill verification reports, rehearsal on a production-like copy, rollback = restore ([ROLLBACK](ROLLBACK.md)) |
| Guardian refactor weakens isolation | Write cross-tenant e2e first (fail), then refactor |
| Sentry/log scrubbing misses PII | Scrub-test suite; no request bodies captured by default |
| Scope: pilot core is broad (fees + report cards + syllabus + history) | Phase gates; `POST-PILOT` list is authoritative; re-plan at each gate |
| Role assignees, domains and vendors are placeholders | T-1/T-2/T-3 must be supplied before production launch; configuration-driven so no rework |
| Migration (sessions, guardians, lifecycle terms) mishandles ambiguous data | BL-62 strategy + dry-run + manual-review queue before any execution; no merge on name similarity |

## 7. Pilot blockers vs post-pilot (updated after RD-1…RD-15)
**Genuine pilot blockers (all engineering or non-code documents; none is an undecided product question):**
| # | Blocker | Item(s) | Note |
|---|---|---|---|
| 1 | Security baseline: unsafe defaults, dependency vulns, headers, bootstrap, server-side account controls | BL-51, BL-12, BL-22, BL-21 | Phase A |
| 2 | Tenant isolation + school scoping (sessions, subjects, terms, fee structures, circulars, holidays) | BL-20, BL-01, BL-02, BL-03 | needs the migration strategy **BL-62 first** |
| 3 | Global guardian identity + guardian rules | BL-23, BL-04 | needs BL-62 |
| 4 | No hard delete of student/staff records | BL-07 | |
| 5 | Object storage, health, logs/Sentry, deployment and **tested** backups on a chosen provider | BL-10, BL-11, BL-13 | provider TBD, architecture unaffected; a staging host is needed to rehearse |
| 6 | Parent reset that works with the chosen e-mail configuration | BL-35 and, if no SMTP provider is chosen, **BL-64** | derived blocker B-1 |
| 7 | FCM push on a real Firebase project | BL-14 (FCM), BL-43 | needs `[FIREBASE_PROJECT_ID]` |
| 8 | Privacy notice, incident process, breach handling documented **before real data** | BL-56 | wording/timelines pending legal review |
| 9 | Load test against Q44 targets; pilot exit sign-off | BL-15, BL-57 | |
**Pilot core (must ship for the pilot scope but not a go-live gate on their own):** BL-05, BL-61, BL-25, BL-26, BL-27, BL-06, BL-28, BL-29, BL-60, BL-08, BL-30, BL-32, BL-33, BL-34, BL-36 (decision), BL-37, BL-39, BL-40, BL-41, BL-52, BL-53, BL-54, BL-55, BL-63, BL-18.
**Post-pilot:** BL-24 (fee extras), BL-31 (advanced complaints), BL-38 (SMS), BL-45 (per-period attendance), BL-46 (public admissions), BL-47 (student login), BL-48 (WhatsApp), BL-49 (AI drafting), BL-59 (campus overrides, advanced accounting/analytics), payment gateways (BL-14 gateway part), retention **enforcement** (after legal approval). **Unprioritised:** BL-09, BL-16, BL-19.
**Deliberately NOT blockers:** payment gateways (OFF in the pilot), SMS, WhatsApp, AI drafting, e-mail provider selection (only via B-1), hosting-vendor choice as an architecture question, retention periods (no deletion is built), field-level encryption, LFS/repository cleanup.
