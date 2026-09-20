# Known Issues (Engineering)

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** project owner
> Consolidates every `CODE ISSUE DISCOVERED` raised by the documentation program. Security/isolation items live in [KNOWN-GAPS](../security/KNOWN-GAPS.md) (KG-1..KG-23) and are **not repeated**. **None of these was fixed.** Business decisions behind some are in [BUSINESS-RULES](../product/BUSINESS-RULES.md) §8.

| ID | Area | Issue | Evidence | Impact | Decision needed |
|---|---|---|---|---|---|
| KI-1 | Org/Data | `AcademicSession` global; activation deactivates all; first-active lookups; seed contradicts | `academic-session.service.ts:49`, `student.service.ts:69`, `fee-vouchers.service.ts:30`, `students-bulk-import.service.ts:100`, `seed.ts:154` | wrong-session data in multi-school setups | Q1 |
| KI-2 | Org | No subject management (read-only list) | `subjects.controller.ts`; grep for `subject.create` in `src/`: none | cannot onboard subjects | Q2 |
| KI-3 | Fees | Fee structures: no edit/delete; unscoped list | `fees.controller.ts` | mistakes permanent; cross-school visibility | Q3 |
| KI-4 | Notifications | SMS sender calls placeholder `api.sms-gateway.example.pk` | `sms-sender.ts:18` | SMS cannot work | provider choice |
| KI-5 | Notifications | No retry/timeout/delivery status on any outbound call; failures swallowed | `notifications.service.ts:72`; adapters | silent message loss | — |
| KI-6 | Config | `.env.example` lists unused `JWT_REFRESH_*`, omits `NODE_ENV`, `PORT`, `UPLOADS_DIR`, `WHATSAPP_*`, `SMS_GATEWAY_*` | [ENVIRONMENT](../operations/ENVIRONMENT.md) | misconfiguration | — |
| KI-7 | Config | `FRONTEND_URL` defaults to localhost; single URL for reset links although parents use the mobile app | `auth.service.ts:168` | reset link may be unusable for parents (UNKNOWN) | — |
| KI-8 | API | No pagination anywhere; unbounded lists | API-1 | scale/performance | — |
| KI-9 | API | No global exception filter/request logging; default error bodies | API-2 | diagnosability | — |
| KI-10 | API | Unknown request fields silently dropped | API-3 | hidden client bugs | — |
| KI-11 | API | No OpenAPI; hand-mirrored client types | API-4 | drift | — |
| KI-12 | Data | Missing DB uniqueness: one ACTIVE enrollment per student; one voucher per student/session/month | `schema.prisma` | race-condition duplicates | — |
| KI-13 | Data | Stringly-typed status columns | DB-3 | invalid states possible | — |
| KI-14 | Data | Hard deletes of PII; no soft delete/archive; cascades on structural children | `student.service.ts:155`, DB-5 | irrecoverable loss | Q7 |
| KI-15 | Data | Attendance is daily-only (`@@unique(studentId,date)`) while timetable is per period | DB-6 | product limitation | — |
| KI-16 | Grades | Category weights not required to total 100 (warning only) | `assessment-categories.service.ts:40` | wrong grades | Q6 |
| KI-17 | Promotions | Preview suggests PROMOTED for everyone; no eligibility checks | `promotions.service.ts` | mistaken promotions | Q5 |
| KI-18 | UI | `/admin/academic-sessions` restricted to SUPER_ADMIN in the router while `copy-structure` API allows SCHOOL_ADMIN | router vs `academic-session.controller.ts` | school admins cannot use copy-structure from the UI | — |
| KI-19 | Attendance | Holiday double-count edge case documented in code | `attendance.service.ts:20-23` | report totals | — |
| KI-20 | Seed | One active session per school; real-sounding school name; no production guard | [SEEDING](../database/SEEDING.md) | data hygiene | — |
| KI-21 | CI | Backend lint failing (2,014 errors, mostly formatting) but non-blocking; comment says ~672 | `ci.yml:42`, run 2026-09-20 | quality gate weak | — |
| KI-22 | Tests | No tests for defects TENANT-1..5, KG-2/3/4/23; no e2e for staff, hiring, files, risk job | [TEST-MATRIX](../testing/TEST-MATRIX.md) | regressions unnoticed | — |
| KI-23 | Bootstrap | No documented/coded way to create the first SUPER_ADMIN outside the dev seed | repo | cannot go live cleanly | — |
| KI-24 | Ops | No health endpoint; `GET /` is a static greeting | `app.controller.ts` | no readiness probe | — |
| KI-25 | Repo | `sample4` design comps could not be moved (Windows lock); two CSVs in it have uncommitted edits | [CLEANUP-MANIFEST](../archive/CLEANUP-MANIFEST.md) §6 | housekeeping | owner |
