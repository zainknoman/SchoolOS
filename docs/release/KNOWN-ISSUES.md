# Known Issues (Engineering)

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** Engineering Lead and Product Owner
> Consolidates every `CODE ISSUE DISCOVERED` raised by the documentation program. Security/isolation items live in [KNOWN-GAPS](../security/KNOWN-GAPS.md) (KG-1..KG-23) and are **not repeated**. **None of these was fixed.** Owner decisions of 2026-09-20 ([OWNER-DECISIONS](../product/OWNER-DECISIONS.md), [BUSINESS-RULES §8](../product/BUSINESS-RULES.md)) settle the business questions; the **Decision needed** column now shows the decided rule and the work item (`DECIDED → BL-xx`). All remain open engineering work.

| ID | Area | Issue | Evidence | Impact | Decision needed |
|---|---|---|---|---|---|
| KI-1 | Org/Data | `AcademicSession` global; activation deactivates all; first-active lookups; seed contradicts | `academic-session.service.ts:49`, `student.service.ts:69`, `fee-vouchers.service.ts:30`, `students-bulk-import.service.ts:100`, `seed.ts:154` | wrong-session data in multi-school setups | DECIDED (school-scoped) → BL-01 |
| KI-2 | Org | No subject management (read-only list) | `subjects.controller.ts`; grep for `subject.create` in `src/`: none | cannot onboard subjects | DECIDED (school-scoped, CRUD, syllabus) → BL-02, BL-26 |
| KI-3 | Fees | Fee structures: no edit/delete; unscoped list | `fees.controller.ts` | mistakes permanent; cross-school visibility | DECIDED (school-scoped; draft/lock/archive) → BL-03 |
| KI-4 | Notifications | SMS sender calls placeholder `api.sms-gateway.example.pk` | `sms-sender.ts:18` | SMS cannot work | DECIDED (adapter; provider TBD, RD-4) → BL-38 (post-pilot) |
| KI-5 | Notifications | No retry/timeout/delivery status on any outbound call; failures swallowed | `notifications.service.ts:72`; adapters | silent message loss | — |
| KI-6 | Config | `.env.example` lists unused `JWT_REFRESH_*`, omits `NODE_ENV`, `PORT`, `UPLOADS_DIR`, `WHATSAPP_*`, `SMS_GATEWAY_*` | [ENVIRONMENT](../operations/ENVIRONMENT.md) | misconfiguration | — |
| KI-7 | Config | `FRONTEND_URL` defaults to localhost; single URL for reset links although parents use the mobile app | `auth.service.ts:168` | reset link may be unusable for parents (UNKNOWN) | DECIDED (separate parent reset flow) → BL-35 |
| KI-8 | API | No pagination anywhere; unbounded lists | API-1 | scale/performance | DECIDED (pilot targets Q44) → BL-40, BL-15 |
| KI-9 | API | No global exception filter/request logging; default error bodies | API-2 | diagnosability | DECIDED (structured logs, Sentry) → BL-11 |
| KI-10 | API | Unknown request fields silently dropped | API-3 | hidden client bugs | — |
| KI-11 | API | No OpenAPI; hand-mirrored client types | API-4 | drift | — |
| KI-12 | Data | Missing DB uniqueness: one ACTIVE enrollment per student; one voucher per student/session/month | `schema.prisma` | race-condition duplicates | → BL-53 |
| KI-13 | Data | Stringly-typed status columns | DB-3 | invalid states possible | → BL-53 |
| KI-14 | Data | Hard deletes of PII; no soft delete/archive; cascades on structural children | `student.service.ts:155`, DB-5 | irrecoverable loss | DECIDED (retain/archive) → BL-07 |
| KI-15 | Data | Attendance is daily-only (`@@unique(studentId,date)`) while timetable is per period | DB-6 | product limitation | DECIDED (daily now, per-period later) → BL-45 |
| KI-16 | Grades | Category weights not required to total 100 (warning only) | `assessment-categories.service.ts:40` | wrong grades | DECIDED → BL-27 (weights must total 100 to publish) |
| KI-17 | Promotions | Preview suggests PROMOTED for everyone; no eligibility checks | `promotions.service.ts` | mistaken promotions | DECIDED (manual + indicators + confirmation) → BL-05 |
| KI-18 | UI | `/admin/academic-sessions` restricted to SUPER_ADMIN in the router while `copy-structure` API allows SCHOOL_ADMIN | router vs `academic-session.controller.ts` | school admins cannot use copy-structure from the UI | DECIDED (UI must match API) → BL-33 |
| KI-19 | Attendance | Holiday double-count edge case documented in code | `attendance.service.ts:20-23` | report totals | — |
| KI-20 | Seed | One active session per school; real-sounding school name; no production guard | [SEEDING](../database/SEEDING.md) | data hygiene | DECIDED (neutral Demo School, per-school sessions) → BL-34, BL-01 |
| KI-21 | CI | Backend lint failing (2,014 errors, mostly formatting) but non-blocking; comment says ~672 | `ci.yml:42`, run 2026-09-20 | quality gate weak | DECIDED (blocking after cleanup) → BL-37 |
| KI-22 | Tests | No tests for defects TENANT-1..5, KG-2/3/4/23; no e2e for staff, hiring, files, risk job | [TEST-MATRIX](../testing/TEST-MATRIX.md) | regressions unnoticed | → BL-18 |
| KI-23 | Bootstrap | No documented/coded way to create the first SUPER_ADMIN outside the dev seed | repo | cannot go live cleanly | DECIDED (one-time bootstrap) → BL-22 |
| KI-24 | Ops | No health endpoint; `GET /` is a static greeting | `app.controller.ts` | no readiness probe | → BL-11 |
| KI-25 | Repo | `sample4` design comps could not be moved (Windows lock); two CSVs in it have uncommitted edits | [CLEANUP-MANIFEST](../archive/CLEANUP-MANIFEST.md) §6 | housekeeping | inspected — awaiting owner authorisation (RD-15) → BL-58; CSV content see KI-29 |
| KI-26 | Leave | Leave approval **requires** a class teacher on the section and stamps generated LEAVE attendance with that teacher's id; owner rule: no class teacher required, separate recommendation/decision attribution, never a fabricated teacher | `leave.service.ts:108-143` | leave blocked for sections without a class teacher; misattributed audit | DECIDED → BL-29 (attendance-marking case: RD-8) |
| KI-27 | Complaints | Parents cannot raise complaints (create is staff-only; parent screen read-only) | `complaints` controller roles; `complaints_screen.dart` | product gap vs decided rule | DECIDED → BL-30 |
| KI-28 | Roles | ACCOUNTS reaches admissions, complaints and messages; owner rule: finance only, others by explicit permission | router `requiresRole`, `@Roles` | over-broad access | DECIDED → BL-32 |
| KI-29 | UI (UNVERIFIED, owner-reported 2026-09-19) | (a) hiring approve dialog does not prefill DOB/CNIC/mobile/email/login e-mail from the candidate; (b) Add-Applicant session dropdown lists other schools' sessions; (c) Admissions dropdown labels missing and other schools' sessions listed | reported in scratch notes (housekeeping inspection §4); not reproduced by the documentation program | usability / cross-school data exposure | (b),(c) covered by BL-01; (a) triage |
| KI-30 | Identity | Parent identity is school-scoped in the user model; owner rule requires one global parent identity across schools | `User.schoolId`, `ParentProfile`, ADR-0006 | cannot meet Q4 without refactor | DECIDED → BL-23 |
| KI-31 | Rebrand | "SchoolPortal"/`@schoolportal.local`, DB name `schoolportal`, "Beacon House" remain in seed/config/tests/Postman/Firebase file/CI | grep 2026-09-20 (see BL-34) | naming + real-sounding demo data | DECIDED → BL-34 |
| KI-32 | Storage | Local-disk uploads; not multi-instance safe | `local-disk-storage.adapter.ts` | conflicts with Q28/Q40 | DECIDED → BL-10 |
