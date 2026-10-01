# Privacy Operations — consent/notice questions, breach handling, privacy requests (BL-56)

> **Status:** REQUIRES-DECISION — process drafted, **not approved, not reviewed by counsel, not rehearsed** · **Verified:** 2026-10-01 against `wave-0/foundations@c2af6cc` · **Sources:** [OWNER-DECISIONS](../product/OWNER-DECISIONS.md) Q22, Q27, RD-7, RD-13; [DATA-PROTECTION](DATA-PROTECTION.md); [RUNBOOKS — Incident and support process](../operations/RUNBOOKS.md#incident-and-support-process-decided-pilot); `backend/src/data-export`, `backend/src/retention`, `admin/users` account controls · **Owner:** `[PRIVACY_ADMINISTRATOR]` (approval: Product Owner; technical steps: `[SECURITY_OWNER]`, `[OPS_OWNER]`)
> Companion to the [privacy notice draft](PRIVACY-NOTICE.md). The general incident and support process (severity levels, internal targets, roles, incident record) lives in [RUNBOOKS](../operations/RUNBOOKS.md#incident-and-support-process-decided-pilot) and is **not repeated here**; this file adds what is specific to personal data. **No legal text, no compliance claim.** Every notification timeline is **TBD pending legal review**.

## 0. Gates before real data is entered
| # | Gate | Evidence | Status |
|---|---|---|---|
| G1 | Counsel has reviewed this file, the [privacy notice](PRIVACY-NOTICE.md) and [DATA-PROTECTION](DATA-PROTECTION.md), and answered §1 | review record `[LINK]` (may be held outside the repository) | ⏳ |
| G2 | Privacy notice approved by the Product Owner and published where users see it before use | [PRIVACY-NOTICE — Sign-off](PRIVACY-NOTICE.md#sign-off-required-before-the-notice-is-published-or-real-data-is-entered) | ⏳ |
| G3 | Breach-notification timelines and recipients filled in (§2 step 6) | this file, §2 | ⏳ TBD — counsel |
| G4 | Named people assigned to `[PRIVACY_ADMINISTRATOR]`, `[SECURITY_OWNER]`, `[OPS_OWNER]`, `[SUPPORT_OWNER]` and `[SUPPORT_EMAIL]` live (names kept outside the repository) | access list `[LINK]` | ⏳ |
| G5 | Incident process rehearsed once (§4) | §4 record | ⏳ |
These gates are item B3 of the [pilot exit checklist](../release/PILOT-EXIT-CHECKLIST.md) (BL-57).

## 1. Consent and notice requirements for legal review
Questions for counsel. Each answer becomes a decision recorded here with date and reviewer; none is answered by engineering.
| # | Question | Why it matters (fact) | Answer |
|---|---|---|---|
| C1 | Which Pakistani laws, regulations or authority guidance apply to a school-management system holding children's data, as of the review date? | the system stores data about minors, families and staff | `[TBD — counsel]` |
| C2 | What legal basis applies to each purpose in [PRIVACY-NOTICE §4](PRIVACY-NOTICE.md#4-why-it-is-used)? Which purposes, if any, need consent? | determines whether a consent record is needed | `[TBD — counsel]` |
| C3 | For students who are minors: who gives or withdraws consent (parent, guardian, both), and does that change with age? | guardians can be linked to more than one school (BL-23); two primary guardians per student | `[TBD — counsel]` |
| C4 | Is a separate, explicit basis or consent needed for health data (`StudentMedicalInfo`) and government identifiers (CNIC, B-Form)? | these are the "sensitive" fields ([SENSITIVE-DATA](SENSITIVE-DATA.md)) | `[TBD — counsel]` |
| C5 | Which roles are the school and `[LEGAL_ENTITY_NAME]` in for the data, and does that need a written agreement with each school? | pilot = one school operated by the organisation | `[TBD — counsel]` |
| C6 | What must the notice contain, in which languages (English/Urdu — the console supports both), and how must it be shown "before use" (paper at admission, sign-in link, in-app screen)? | no notice screen exists today ([PRIVACY-NOTICE §9](PRIVACY-NOTICE.md#9-where-and-when-the-notice-is-shown--open)) | `[TBD — counsel]` |
| C7 | Must acceptance or consent be recorded, and what must the record contain? | the data model has no consent record; adding one is a code change | `[TBD — counsel]` |
| C8 | Is field-level encryption of CNIC/B-Form/medical data required, or is provider encryption at rest enough? | not built; the design keeps it possible ([SENSITIVE-DATA](SENSITIVE-DATA.md)) | `[TBD — counsel]` |
| C9 | Retention period for each category in [DATA-PROTECTION — Retention categories](DATA-PROTECTION.md#retention-categories-rd-6--configurable-periods-tbd), including backups | periods are unset; nothing is deleted automatically (BL-63) | `[TBD — counsel]` |
| C10 | Which requests must be honoured (access, correction, erasure, objection, other), by whom, in what time, and what may be refused (e.g. fee records)? | §3 maps requests to the existing tools | `[TBD — counsel]` |
| C11 | Breach notification: what counts as a notifiable breach, whom to notify (authority, school, parents, staff), within what time, and with what content? | §2 step 6 | `[TBD — counsel]` |
| C12 | What must be disclosed about service providers and storage location, and are transfers outside Pakistan restricted? | hosting, storage, Sentry, Firebase and SMTP providers are not chosen yet ([PRIVACY-NOTICE §5](PRIVACY-NOTICE.md#5-who-can-see-it-fact)) | `[TBD — counsel]` |
| C13 | Staff and applicant data: does a separate staff/applicant notice apply? | hiring module stores CVs | `[TBD — counsel]` |
| C14 | Push notification texts and e-mails to parents: any rules on content about children? | notifications include student names and attendance/fee facts | `[TBD — counsel]` |

Review record: reviewer `[LEGAL_COUNSEL]` · date `[DATE]` · scope `[DOCS + VERSION]` · outcome `[LINK]`.

## 2. Breach-handling process
A suspected personal-data breach is always **P1** in the [incident process](../operations/RUNBOOKS.md#incident-and-support-process-decided-pilot) (acknowledge ≤ 30 minutes, internal target; continuous work until contained). Examples: data of one school visible to another school's users, a parent seeing another family's child, an export or backup in the wrong hands, a compromised staff or SUPER_ADMIN account, a leaked secret or database credential.

| Step | What | Who | Tools that exist today |
|---|---|---|---|
| 1. Report | Anyone (school admin, staff, parent via the school, engineer, security report per [`SECURITY.md`](../../SECURITY.md)) reports to `[SUPPORT_EMAIL]`; first line opens a P1 incident record | `[SUPPORT_OWNER]` | incident record ([RUNBOOKS](../operations/RUNBOOKS.md#incident-and-support-process-decided-pilot)) |
| 2. Engage | Security owner takes over; privacy administrator is informed at once | `[SECURITY_OWNER]`, `[PRIVACY_ADMINISTRATOR]` | — |
| 3. Contain | Stop further exposure: disable the account (`POST /api/v1/admin/users/:id/disable`) or sign it out everywhere (`…/revoke-sessions`); rotate a leaked secret ([BACKUP-RESTORE — Disaster scenarios](../operations/BACKUP-RESTORE.md#disaster-scenarios-not-yet-covered-by-any-plan)); switch off a faulty feature or roll back the release ([ROLLBACK](../release/ROLLBACK.md)); revoke leaked storage/database credentials at the provider | `[SECURITY_OWNER]`, `[OPS_OWNER]` | account controls (BL-21, audited `account.*`) |
| 4. Preserve evidence | Before changing data: take an on-demand database backup; export the relevant `AuditLog` rows (direct SQL — there is no audit-log API), access-log lines (request id, user, path) and error-tracker events; note times in the incident record | `[OPS_OWNER]` | `AuditLog` (incl. `data-export.*`, `account.*`, `*.erase`), JSON access logs (BL-11), Sentry |
| 5. Assess | Which people and which data categories ([DATA-PROTECTION](DATA-PROTECTION.md#what-personal-data-is-stored)), how many, which schools, since when, whether sensitive fields (CNIC, B-Form, medical) or children's data are involved, whether the data left the system (export, download, screen only) | `[SECURITY_OWNER]` with `[PRIVACY_ADMINISTRATOR]` | export audit rows show scope, filters, sensitive flag and row count |
| 6. Decide on notification | `[PRIVACY_ADMINISTRATOR]` with the Product Owner and counsel decides whether and whom to notify. **Recipients, deadlines and content: TBD pending legal review (C11).** Until counsel answers, involve counsel for every confirmed breach and do not promise any timeline externally | `[PRIVACY_ADMINISTRATOR]`, Product Owner, `[LEGAL_COUNSEL]` | — |
| 7. Fix | Correct the cause (code fix through the normal PR flow, configuration change); add a regression test where the cause is code | Engineering | e2e suites (tenant isolation, authz) |
| 8. Close and learn | Complete the incident record (timeline, cause, data affected, decisions, notifications sent, follow-ups); review within `[TBD]` business days; update KNOWN-GAPS if a gap was found | `[SECURITY_OWNER]` | [KNOWN-GAPS](KNOWN-GAPS.md) |

Breach register: every suspected breach — notified or not — is kept in a register held by `[PRIVACY_ADMINISTRATOR]` **outside the repository** (it contains personal data). Location: `[BREACH_REGISTER_LOCATION]`. What the register must contain: `[TBD — counsel]`.

## 3. Handling privacy requests
Requests reach the school admin or `[SUPPORT_EMAIL]`; `[PRIVACY_ADMINISTRATOR]` verifies the requester's identity and authority (for a minor: the linked guardian) and decides. Which requests apply and the response time are **TBD (C10)**. The software already provides:
| Request | How it is done today | Limits |
|---|---|---|
| See own data | Parents already see their children's records in the parent app. A full copy: a school admin or SUPER_ADMIN exports the relevant datasets (**Operations → Data Export**, `GET /api/v1/admin/exports/:dataset` — `students`, `guardians`, `enrolments`, `attendance`, `results`, `fees`; BL-41) and extracts the person's rows | export is per school and dataset, not per person; sensitive columns only on request by the principal or SUPER_ADMIN; every export is audited |
| Correct data | normal edit screens in the staff console (audited writes) | issued report cards and published results are frozen by design (BL-06, BL-27); corrections there mean a new version |
| Erase data | archive the record, then a SUPER_ADMIN erases it — [RUNBOOKS: "Privacy request: permanently erase a person's record"](../operations/RUNBOOKS.md) (BL-07) | refused while retained records (e.g. fee ledger) still reference it; backups keep the data until they expire (≥ 30 days) |
| Retention | **Retention policy** (`/api/v1/admin/retention-policy`, SUPER_ADMIN; BL-63) lists every category with its period unset; its report counts records past their period | periods are set only after legal review (C9); nothing is deleted automatically |

Record each request (date, requester, request, decision, date completed) in the register held by `[PRIVACY_ADMINISTRATOR]` outside the repository.

## 4. Rehearsal (required once before real data is entered)
Run one table-top exercise of a P1 personal-data incident end to end on **staging or a scratch database, never on real data**. Suggested scenario: "a school admin reports seeing another school's student in a list". Walk through §2 steps 1–8: open the incident record, check the internal acknowledgement time against the 30-minute target, disable a test account, take a backup, pull the `AuditLog` and access-log lines for the request, write the assessment, go through the notification decision with the TBD placeholders, close the record.

| Field | Value |
|---|---|
| Date | `[DATE]` |
| Participants (roles) | `[ROLES]` |
| Scenario | `[SCENARIO]` |
| Time to acknowledge / contain | `[MIN]` / `[MIN]` |
| Gaps found and follow-ups | `[LIST]` |
| Record | `[LINK]` |
| Accepted by | `[PRIVACY_ADMINISTRATOR]` · `[DATE]` |
