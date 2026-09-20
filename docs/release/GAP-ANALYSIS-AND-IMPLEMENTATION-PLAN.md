# Product Readiness Gap Analysis and Phased Implementation Plan

> **Status:** CURRENT (plan; **nothing here is implemented**) · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** [OWNER-DECISIONS](../product/OWNER-DECISIONS.md), [BACKLOG](../product/requirements/BACKLOG.md), [KNOWN-GAPS](../security/KNOWN-GAPS.md), [KNOWN-ISSUES](KNOWN-ISSUES.md), [PRODUCTION-READINESS](PRODUCTION-READINESS.md) · **Owner:** Engineering Lead with Product Owner
> Verdict is unchanged: **NO-GO** until the pilot blockers below are closed. The owner has decided the product rules; the gap is now almost entirely **engineering and infrastructure work**, plus a small set of open owner inputs (§5). No estimates are given because none were supplied; phases are ordered by dependency and by the owner's pilot scope (Q33).
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
| Yearly syllabus (Q2) | ❌ | model, CRUD, copy | BL-26 |
| Fee structures/terms scoped, lockable (Q3) | 🔁 unscoped; no edit/delete | scoping, lifecycle | BL-03 |
| Global guardian, ≤ 2 primary, relationship type (Q4) | 🔁 school-scoped user; unconstrained links | identity refactor + rules + migration | BL-23, BL-04 |
| Promotion outcomes + indicators + confirmation (Q5) | ⚠ 5 decisions, no indicators, default PROMOTED | indicators, outcomes, confirmation, config | BL-05 |
| Generated report cards + grading scales (Q6) | 🔁 upload only; no letter grade | scales, generation, PDF | BL-27, BL-06 |
| Retention/archive, no hard delete (Q7) | 🔁 hard delete exists | archive model, erasure control, export | BL-07, BL-41 |
| Configurable attendance risk + alerts (Q8) | 🔁 constants; no alert routing | settings, alerts | BL-28 |
| Fee features (Q9) | ⚠ vouchers, payments, reconcile | partial payments/outstanding/defaulters/carry-forward now; extras later | BL-08, BL-24 |
| Parent complaints (Q10) | 🔁 parents read-only | raise flow, visibility split | BL-30, BL-31 |
| Daily attendance now / per-period later (Q11) | ✅ daily | keep migration-friendly | BL-45 |
| Leave without class teacher; separate attribution (Q12) | 🔁 approval requires class teacher; attendance stamped with it | workflow + attribution | BL-29 |
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
| Licence, security contact (Q20, Q21) | ⚠ placeholders in docs | owner inputs RD-1/RD-2 | §5 |

## 3. Phased implementation plan (dependency order)
Phases may overlap where noted. Each phase ends with its acceptance criteria met, tests green in CI, docs regenerated, and the referenced KG/KI rows updated.

| Phase | Theme | Items | Why this order | Exit gate |
|---|---|---|---|---|
| **A** | Security and platform baseline | BL-12, BL-51, BL-22, BL-21, BL-10, BL-11, BL-13, BL-36 (decision), BL-52, BL-39 | Unsafe defaults, secrets and infra underpin every later verification; storage and deployment are prerequisites for staging | Staging deployed from a tag; secure bootstrap works; no High audit findings; backup restore rehearsed; Sentry live with scrubbing test |
| **B** | Organisation and tenancy | BL-20, BL-01, BL-02, BL-03, BL-33, BL-32, BL-53 | Session/subject/fee scoping is a dependency of promotion, syllabus, grading, fees and guardians | Cross-school e2e green for sessions, subjects, terms, fee structures, circulars, holidays; UI/API permission parity for copy-structure |
| **C** | People, guardians, lifecycle | BL-23, BL-04, BL-25, BL-05, BL-07, BL-41 | Guardian identity refactor touches auth and scoping — do it once, early, before parent-app and fees work | Parent with children in two schools passes isolation e2e; assignment history recorded; no hard delete path remains |
| **D** | Academics | BL-26, BL-27, BL-06 | Needs B (subjects, sessions) and C (assignment history) | Report card PDF generated from marks for a full session; grading scale configurable |
| **E** | Attendance and leave | BL-28, BL-29 | Independent after B; can run parallel with D | Leave approved with no class teacher and correct attribution; risk alerts to teacher and admin |
| **F** | Fees | BL-08, BL-14 (SMTP/FCM part) | Needs B (scoped structures) and the session model | Partial payment, outstanding, defaulter report and carry-forward verified; paid history immutable |
| **G** | Parent app | BL-35, BL-30, BL-43, BL-54 | Needs C (guardian identity), F (fee visibility) | Signed build on an internal Play track; parent reset, attendance, fees, complaints work on Android 9+ devices |
| **H** | Quality and pilot exit | BL-37, BL-40, BL-18, BL-15, BL-55, BL-56, BL-34, BL-57, BL-58 | Confirms everything together | Pilot exit criteria (§1) signed |
| **Post-pilot** | — | BL-24, BL-31, BL-45–BL-49, BL-38, BL-59, BL-09, BL-16, BL-19 | Owner deferred | — |

Parallelism: A (infra) runs alongside B. BL-34 (rename) should land **before** BL-43 so Firebase/app identifiers are created once. BL-37's lint cleanup should start early (it is mechanical) but the blocking switch lands only when the backlog is clean.

## 4. Conflicts between decided rules and current code (all preserved as rules)
| # | Decided rule | Code conflict | Item |
|---|---|---|---|
| C1 | Sessions per school (Q1) | Global session table; first-active lookups | BL-01 |
| C2 | Guardian global identity spanning schools (Q4) | `User`/`ParentProfile` carry school scope; ADR-0006 tenancy assumes one school per user | BL-23 |
| C3 | Leave needs no class teacher; no fake attribution (Q12) | `leave.service.ts:108-143` requires one and attributes attendance to it | BL-29 |
| C4 | ACCOUNTS finance only (Q18) | ACCOUNTS reaches admissions/complaints/messages | BL-32 |
| C5 | No hard delete (Q7) | `student.delete` | BL-07 |
| C6 | Parent complaint creation (Q10) | Parent screen read-only, create is staff-only | BL-30 |
| C7 | Copy-structure by SCHOOL_ADMIN in UI (Q19) | Router SUPER_ADMIN-only | BL-33 |
| C8 | Immutable fee history + lockable structures (Q3, Q9) | No structure edit/delete at all (inverse gap); no immutability tests | BL-03, BL-08 |
| C9 | SchoolOS / Demo School (Q17, Q23) | Seed, `.env.example`, CI, Postman, Firebase file, specs | BL-34 |
| C10 | Parent reset flow (Q41) | One `FRONTEND_URL` | BL-35 |
| C11 | Safe job locking (Q28) | Unlocked in-process cron | BL-39 |
| C12 | Object storage (Q40) | Local disk only | BL-10 |

## 5. What still needs the owner
Open items are enumerated with IDs in [OWNER-DECISIONS → Still REQUIRES-DECISION](../product/OWNER-DECISIONS.md#still-requires-decision-not-answered-by-the-owner) (RD-1 … RD-15). Highest impact for scheduling: **RD-3 hosting/storage vendor** (blocks BL-10/BL-13), **RD-11 migration approach** for sessions and guardians (blocks BL-01/BL-23), **RD-6 retention periods** and **RD-7 consent/breach content** (block BL-07/BL-56), **RD-8** (attendance marking without a class teacher), **RD-9** (complaint scope split), **RD-10** (promotion enum mapping).

## 6. Risks
| Risk | Mitigation |
|---|---|
| BL-23 and BL-01 are schema-breaking migrations on live-shaped data | Additive-first migrations (ADR-0005), backfill verification reports, rehearsal on a production-like copy, rollback = restore ([ROLLBACK](ROLLBACK.md)) |
| Guardian refactor weakens isolation | Write cross-tenant e2e first (fail), then refactor |
| Sentry/log scrubbing misses PII | Scrub-test suite; no request bodies captured by default |
| Scope: pilot core is broad (fees + report cards + syllabus + history) | Phase gates; `POST-PILOT` list is authoritative; re-plan at each gate |
| No SLA/owners named | RD-5/RD-13 must be closed before production launch |
