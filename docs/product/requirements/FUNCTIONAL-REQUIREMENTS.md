# SchoolOS — Functional Requirements (as implemented)

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** [FEATURE-CATALOG](../FEATURE-CATALOG.md), [BUSINESS-RULES](../BUSINESS-RULES.md), backend e2e specs · **Owner:** Product Owner
> These are requirements the **current implementation satisfies or claims to satisfy** — not a wishlist. Planned work is in [BACKLOG.md](BACKLOG.md). Acceptance evidence: an e2e spec name means the area is exercised there; **the specific assertion has not been individually verified in this pass** unless stated. `UNVERIFIED` = no automated evidence found (unit specs with mocked Prisma do not count as acceptance evidence). Numbers/traceability completion: Phase 10.
> **Owner decisions (2026-09-20):** rows below describe **implemented** behaviour only. Decided-but-unbuilt capabilities (school-scoped sessions/subjects/fees, global guardians, generated report cards, promotion indicators, staff assignment history, attendance-risk settings, leave recommendation, parent complaints, fee extras, archive/retention) are tracked in [OWNER-DECISIONS](../OWNER-DECISIONS.md) and [BACKLOG](BACKLOG.md), never as current features.

## Identity and access

| ID | Requirement | Feature | Acceptance (Given/When/Then) | Evidence |
|---|---|---|---|---|
| FR-AUTH-01 | Users sign in with email or GR-number and password and receive an access + refresh token. | F-AUTH-01 | Given a valid account, when POST `/auth/login`, then 200 with tokens; invalid → generic 401 | e2e `auth` |
| FR-AUTH-02 | Repeated failures lock the account temporarily. | F-AUTH-01 | Given 5 wrong passwords, then the 6th attempt (even correct) is rejected for 15 min | e2e `auth` (lockout: verify) |
| FR-AUTH-03 | Refresh tokens rotate; a reused token is rejected. | F-AUTH-01 | Given a refresh token used once, when reused, then 401 | e2e `auth` (verify) |
| FR-AUTH-04 | Password reset by emailed one-hour single-use link without revealing account existence. | F-AUTH-02 | Given unknown identifier, when forgot-password, then identical message | e2e `auth-password-reset` |
| FR-AUTH-05 | Every non-public endpoint requires a valid token; role-restricted endpoints reject other roles with 403. | F-AUTH-03 | Given a PARENT token, when calling an admin endpoint, then 403 | e2e `auth`, `cross-tenant-boundary` |
| FR-AUTH-06 | Staff can only read/write data within their school (and campus if campus-scoped); parents only their children; teachers only their sections. | F-AUTH-03 | Given school-A admin, when requesting a school-B student, then 403/404 | e2e `cross-tenant-boundary`, `sections-access`, `me`, `org-provisioning` |
| FR-AUTH-07 | SUPER_ADMIN can create a school/campus and provision its principal/admin login. | F-AUTH-04 | Given SUPER_ADMIN, when POST `/schools` with login, then school + user exist, scoped correctly | e2e `org-provisioning` |
| FR-AUTH-08 | Authentication endpoints are rate-limited. | F-AUTH-01 | Given >5 requests/min (non-test) to login, then 429 | e2e `rate-limiting` (limits relaxed under test) |

## Organization and people

| ID | Requirement | Feature | Acceptance | Evidence |
|---|---|---|---|---|
| FR-ORG-01 | SUPER_ADMIN manages schools, campuses, academic sessions, classes; admins manage sections. | F-ORG-01..05 | CRUD succeeds for permitted roles, fails otherwise; deleting a referenced row returns 400 | e2e `org-structure`, `cascade-delete-restrictions` |
| FR-ORG-02 | A section's class teacher must belong to the class's campus. | F-ORG-05 | Given teacher from another campus, when assign, then 400 | UNVERIFIED (unit only) |
| FR-ORG-03 | Admin can copy a session's classes/sections to another session idempotently. | F-ORG-03 | Given source≠target, when copy twice, then no duplicates | e2e `org-structure` (verify) |
| FR-ORG-04 | Holidays (school-wide or campus) are managed by admins and visible to all scoped users. | F-ORG-07 | Given a holiday, then attendance marking that day is rejected | e2e `holidays-complaints-report-cards`, `timetable-attendance` |
| FR-PPL-01 | Admins create, edit, delete students, enrolling them in the active session and linking exactly one existing/new parent. | F-PPL-01 | Given both/neither parent option, then 400; duplicate GR → conflict | e2e `people-crud` |
| FR-PPL-02 | Admins maintain full student profile data and verify documents. | F-PPL-02 | Profile PATCH persists; documents can be marked verified | e2e `people-crud` (verify verify-path) |
| FR-PPL-03 | Admins manage parents and child links. | F-PPL-03 | Link/unlink child persists; scoping enforced | e2e `people-crud` |
| FR-PPL-04 | Admins manage teachers and staff, including profile sub-records. | F-PPL-04/05 | CRUD scoped to school | e2e `people-crud` (teachers); staff UNVERIFIED |
| FR-PPL-05 | Hiring applications can be approved once (creating staff, and teacher+login for teachers) or rejected. | F-PPL-06 | Given approved application, when re-approved, then 400 | UNVERIFIED (unit only) |
| FR-PPL-06 | Bulk import previews and commits students, parents, teachers, staff; in-file duplicates reported. | F-PPL-07 | Preview returns per-row errors; commit inserts valid rows | e2e `bulk-import` |

## Admissions and lifecycle

| ID | Requirement | Feature | Acceptance | Evidence |
|---|---|---|---|---|
| FR-ADM-01 | Staff record applicants and applications for a desired class and target session. | F-ADM-01/02 | Application persists with status SUBMITTED | e2e `admissions` |
| FR-ADM-02 | Approving an application creates the student, parent link and enrollment in the target session; a decided application cannot be changed. | F-ADM-02 | Approve → student + enrollment exist; second decision → 400 | e2e `admissions` |
| FR-ENR-01 | Enrollment history is retained with status and dates. | F-ENR-01 | After change/promotion, prior enrollment remains with end date | e2e `people-crud`, `promotions` |
| FR-ENR-02 | Admins preview and execute promotion decisions atomically, recording history. | F-ENR-02 | Execute with valid target → old enrollment closed, new created, StudentPromotion row; invalid target session → 400 | e2e `promotions` |

## Daily operations

| ID | Requirement | Feature | Acceptance | Evidence |
|---|---|---|---|---|
| FR-TT-01 | Admins maintain section timetables without teacher/room double-booking; teachers and parents view relevant timetables. | F-TT-01 | Conflicting entry → 409 | e2e `timetable-attendance` |
| FR-ATT-01 | Teachers/admins mark attendance (single/bulk); not on holidays; section must have a class teacher; parents see their child's attendance. | F-ATT-01 | Holiday → 400; no class teacher → 400 | e2e `timetable-attendance` |
| FR-ATT-02 | The system flags students with high recent absence daily. | F-ATT-02 | Given ≥25 % over 30 days with ≥5 tracked days, then a flag exists | UNVERIFIED (unit only; cron not e2e) |
| FR-DIA-01 | Teachers/admins publish diary entries; parents read their child's. | F-DIA-01 | Entry visible to linked parent only | e2e `diary-circulars` |
| FR-GRD-01 | Admins configure terms and weighted categories; teachers create assessments and enter marks (≤ max, enrolled students only); grades computed as weighted %. | F-GRD-01 | Marks > max → 400; weights ≠100 → warning | e2e `gradebook` |
| FR-RC-01 | Staff record one report card per student per session with a document; parents view/download. | F-RC-01 | Duplicate → 409 | e2e `holidays-complaints-report-cards` |
| FR-LV-01 | Parents request leave; admins approve/reject once, requiring a class teacher. | F-LV-01 | Second decision → 400 | e2e `leave` |
| FR-CMP-01 | Staff log and update complaints; parents can read their child's. | F-CMP-01 | Parent POST → 403; GET own child → 200 | e2e `holidays-complaints-report-cards` (verify) |

## Finance

| ID | Requirement | Feature | Acceptance | Evidence |
|---|---|---|---|---|
| FR-FEE-01 | Accounts staff define fee structures and issue monthly vouchers per student list or section; one per student/month/session. | F-FEE-01/02 | Duplicate → 400 | e2e `fees` |
| FR-FEE-02 | Parents pay vouchers via a configured gateway; webhook settles/fails payments idempotently with a signature check; receipts are available. | F-FEE-03 | Bad signature → 401; repeat webhook → no double transition | e2e `fees` (stub gateway only — **live gateways UNVERIFIED**) |
| FR-FEE-03 | Payments cannot exceed the balance or pay a paid voucher; accounts can reconcile manually. | F-FEE-03/04 | Over-balance → 400 | e2e `fees` |

## Communication and platform

| ID | Requirement | Feature | Acceptance | Evidence |
|---|---|---|---|---|
| FR-COM-01 | Admins publish circulars with read tracking; parents read/mark. | F-COM-01 | Stats reflect reads | e2e `diary-circulars` |
| FR-COM-02 | Parents converse with school staff; staff reply within scope. | F-COM-02 | Only participants access a conversation | e2e `messages-notifications` |
| FR-COM-03 | Users receive in-app notifications and can set channel/digest preferences; external channels are delivered when configured. | F-COM-03/04 | In-app notification appears; external send: **UNVERIFIED live** | e2e `messages-notifications` (in-app) |
| FR-FIL-01 | Users upload and download files with access checks. | F-FIL-01 | Non-authorized user → 403 | UNVERIFIED (no dedicated e2e; unit `files-access`) |
| FR-ME-01 | Parents list and view their own children only. | F-ME-01 | Other child → 403/404 | e2e `me` |
| FR-UX-01 | Both clients support English and Urdu (RTL). | F-UX-01 | Locale switch renders RTL | client unit tests (verify) |
| FR-OFF-01 | Parent app shows last cached data with a timestamp when refresh fails. | F-OFF-01 | Offline → cached banner | parent-app tests |
