# SchoolOS — Requirements / Decision Matrix

> **Status:** CURRENT (decisions; **none implemented**) · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** [OWNER-DECISIONS](../OWNER-DECISIONS.md), [BUSINESS-RULES §8](../BUSINESS-RULES.md), [BACKLOG](BACKLOG.md), [NFR](NON-FUNCTIONAL-REQUIREMENTS.md), [GAP-ANALYSIS](../../release/GAP-ANALYSIS-AND-IMPLEMENTATION-PLAN.md) · **Owner:** Product Owner
> One row per decided requirement: decision → rule/NFR id → what the code does today → gap → work item → phase → pilot class. **Pilot class:** `BLOCKER` (go-live gate), `CORE` (pilot scope), `POST` (post-pilot), `DOC` (non-code). Feature/status words follow the [docs index](../../README.md).

| Decision (source) | Rule / NFR | Code today | Gap | Work item | Phase | Pilot |
|---|---|---|---|---|---|---|
| School-scoped academic sessions (Q1) | BR-ORG-01/02, Q1 | global; first-active lookups | schema, backfill, per-school active | BL-01 (after BL-62) | B | BLOCKER |
| School-scoped subjects, CRUD, active/inactive (Q2) | Q2 | global, read-only | schema, CRUD, UI | BL-02 | B | BLOCKER |
| Yearly syllabus per class + subject + session (Q2) | Q2 | none | new model | BL-26 | D | CORE |
| School-scoped, lockable fee structures and terms (Q3) | Q3 | unscoped, no edit | scoping + lifecycle | BL-03 | B | BLOCKER |
| Global guardian identity; ≤ 2 primary; relationship type; unlimited non-primary (Q4) | Q4, BR-STU-05 | parent `User` has no `schoolId` (identity already global); links unconstrained | relationship data, cross-school linking/PII boundary, school-scoped fan-out, dedupe (no `schoolId` on identity) | BL-23, BL-04 | C | BLOCKER |
| Migration strategy + reconciliation report, no destructive/ambiguous merges (RD-11) | BR-D-RD11 | n/a | strategy, dry-run, review queue | BL-62 | B | BLOCKER |
| Promotion: manual, indicators as warnings, explicit confirmation, outcomes (Q5) | BR-ENR-02/03, Q5 | 5 decisions, no indicators | indicators, confirmation | BL-05 | C | CORE |
| Lifecycle terms ACTIVE/TRANSFERRED/WITHDRAWN/GRADUATED (RD-10) | BR-D-RD10 | `LEFT`, `TRANSFERRED_OUT` | controlled migration | BL-61 | C | CORE |
| Generated report cards + grading scales + PDF (Q6) | BR-GRD-01, BR-RC-01 | upload only, no letter grade | scales, generation | BL-27, BL-06 | D | CORE |
| Retain/archive, no hard delete, no auto-deletion (Q7, RD-6) | NFR-PRV-01, BR-D-RD6 | hard delete | archive model | BL-07 | C | BLOCKER |
| Configurable retention policy per category, periods TBD (RD-6) | BR-D-RD6 | none | settings + report | BL-63 | C | CORE |
| Controlled data export for authorised admins (Q7, Q22) | NFR-PRV-01 | none | export + audit | BL-41 | C | CORE |
| Attendance-risk config per school; alerts to teacher/admin; parent notice off by default (Q8) | BR-ATT-04 | constants | settings, alerts | BL-28 | E | CORE |
| Daily attendance now; per-period later (Q11) | BR-ATT-01 | daily | none now | BL-45 | — | POST |
| Attendance marking without class teacher; real marker recorded (RD-8) | BR-ATT-03 | `markedById` required Teacher FK; admin → class teacher or refused | schema M1 (`markedByUserId`, nullable `markedById`) + code | BL-60 | W1 | CORE |
| Leave: recommend + admin approve, no class teacher, separate attribution (Q12) | BR-LV-02 | requires class teacher; stamps it; no recommender/decider columns | schema M1b + workflow | BL-29 | E | CORE |
| Pilot fees: manual payments, vouchers/receipts, partial, outstanding, defaulters, basic carry-forward, immutable history (Q9, RD-14) | BR-FEE-01..03 | vouchers/payments/reconcile | partial/outstanding/defaulter/carry-forward | BL-08 | F | CORE |
| Fee extras: discounts, scholarships, waivers, late fees, refunds, installments (Q9) | Q9 | none | ledger extensions | BL-24 | — | POST |
| Payment gateways OFF in the pilot; behind flags (RD-14, Q34) | BR-FEE-04 | adapters unverified | verification post-pilot | BL-14 | F/— | POST |
| Parent complaints — pilot workflow (Q10, RD-9) | Q10 | staff-only create | parent submit, assign, internal notes, resolution | BL-30 | G | CORE |
| Complaints — escalation/SLA/routing/analytics (RD-9) | Q10 | none | advanced | BL-31 | — | POST |
| Teacher/staff assignment history (Q15) | BR-D-15 | none | model + hooks | BL-25 | C | CORE |
| ACCOUNTS finance-only + grants (Q18) | BR-D-18 | also admissions/complaints/messages | permission model | BL-32 | B | CORE |
| Copy structure by SCHOOL_ADMIN, incl. subjects/syllabus/templates, history untouched (Q19) | BR-ORG-05, BR-D-19 | API yes, UI no | UI + scope | BL-33 | B | CORE |
| No student login (Q13); public admissions later (Q14) | BR-D-13/14 | none | none now | BL-47, BL-46 | — | POST |
| SchoolOS naming, Demo School data (Q17, Q23) | — | SchoolPortal/Beacon House in seed/config | rename | BL-34 | H | CORE |
| Provider-agnostic deployment, staging/prod, backups RPO 24 h/RTO 4 h/30 d (Q25, Q26, RD-3) | NFR-DAT-02, NFR-SCL-01 | none | image, pipeline, backups | BL-13 | A | BLOCKER |
| S3-compatible object storage; no local-disk uploads (Q28, Q40) | NFR-SCL-01 | local disk | adapter | BL-10 | A | BLOCKER |
| Safe job locking; single instance OK for pilot (Q28) | NFR-SCL-01 | in-process cron | leader lock | BL-39 | A | CORE |
| Health, structured logs, Sentry + PII scrubbing, provider-agnostic uptime (Q29, RD-4) | NFR-OPS-01, NFR-AVL-01 | none | endpoints, logger, Sentry | BL-11 | A | BLOCKER |
| Controlled first SUPER_ADMIN bootstrap (Q30) | KI-23 | dev seed only | command | BL-22 | A | BLOCKER |
| SemVer, tags, 1.0.0, PR flow, staging + approval (Q31) | NFR-REL-01 | none | process/CI | RELEASE-CHECKLIST | H | DOC |
| Google Play first; org-owned accounts; keys outside Git (Q32, RD-12) | — | none | pipeline | BL-43 | G | CORE |
| Pilot scope + exit criteria (Q33) | — | — | BL-57 | H | — | BLOCKER |
| Firebase project for FCM (Q35, RD-12) | — | placeholder options | project + verification | BL-14, BL-43 | G | BLOCKER |
| E-mail/SMS providers TBD, may be disabled in the pilot (RD-4) | — | SMTP adapter; SMS placeholder URL | provider abstraction; SMS adapter | BL-14, BL-38 | — | POST |
| Parent reset separate flow; fallback if no e-mail (Q41, RD-4) | KI-7, KI-35 | single URL; link logged | new flow + admin-assisted reset | BL-35, BL-64 | G | BLOCKER |
| WhatsApp templates; AI drafting off by default (Q38, Q39) | — | free-text; optional stub | later | BL-48, BL-49 | — | POST |
| Token-storage hardening review (Q42) | KG-9 | `localStorage` | decision + optional migration | BL-36 | A | CORE |
| WCAG 2.1 AA (Q43) | NFR-A11Y-02 | unknown | audit | BL-55 | H | CORE |
| p95 < 500 ms CRUD / < 1 s auth, 100 users, 99.5 % (Q44) | NFR-PERF-01, NFR-AVL-01 | unmeasured; no pagination | load test, pagination | BL-15, BL-40 | H | BLOCKER (exit) |
| Android 9+ / low-end devices (Q45) | NFR-DEV-01 | no matrix | test matrix | BL-54 | G | CORE |
| Blocking backend lint after cleanup (Q46) | NFR-QLT-01 | 2,014 errors, non-blocking | cleanup, enforce | BL-37 | H | CORE |
| Privacy notice, incident/breach process, internal P1–P4 targets, no compliance claim (Q22, Q27, RD-7, RD-13) | NFR-PRV-01 | absent | documents + counsel review | BL-56 | H | BLOCKER (DOC) |
| Proprietary licence; placeholders for entity/domain/e-mail (Q20, Q21, RD-1, RD-2) | — | placeholders in `LICENSE`, `SECURITY.md` | supply values | — | — | DOC |
| Housekeeping documented, no cleanup authorised (Q47–Q49, RD-15) | — | inspected only | authorisation | BL-58 | H | CORE |
| Migration test harness (F9) | BL-62 | none | fixtures, reconciliation, idempotency | BL-65 | W0 | BLOCKER |
| Committed documentation generators (F8) | docs/README rules | throwaway scripts | reproducible generators + drift check | BL-66 | W0 | CORE |
