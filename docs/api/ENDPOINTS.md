# Endpoint Reference

> **Status:** CURRENT · **Generated** by `scripts/docs/generate.mjs` (BL-66) from every `backend/src/**/*.controller.ts` — **do not edit by hand**; regenerate with `node scripts/docs/generate.mjs` (CI runs `--check`) · **Sources:** `@Controller` + `@Get/@Post/@Put/@Patch/@Delete` + `@Roles/@Public/@Throttle`; method-level `@Roles`/`@Public` override class-level ones · **Owner:** Engineering Lead
> All paths are prefixed with `/api/v1`. **Roles** = the `@Roles(...)` decorator (`RolesGuard` does an exact `includes(user.role)` check — SUPER_ADMIN has **no implicit override**). "any authenticated (service-scoped)" = no decorator: every logged-in role passes the guard and the **service** decides by scope (see [AUTHORIZATION](AUTHORIZATION.md)). `T` = route-level throttle decorator (auth routes, 5/min); all routes also fall under the global 100/min limit.
> Total: **224** route handlers in 49 controllers.

## (root)

`GET /` returns the static string "Hello World!" (`app.service.ts`). It is public but **is not a health check** (it does not touch the database).

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/` | **public** |  | `app.controller.ts` |

## academic-sessions

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/academic-sessions` | SUPER_ADMIN |  | `academic-session/academic-session.controller.ts` |
| GET | `/academic-sessions` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `academic-session/academic-session.controller.ts` |
| POST | `/academic-sessions/:id/copy-structure` | SCHOOL_ADMIN, SUPER_ADMIN |  | `academic-session/academic-session.controller.ts` |
| PATCH | `/academic-sessions/:id` | SUPER_ADMIN |  | `academic-session/academic-session.controller.ts` |
| DELETE | `/academic-sessions/:id` | SUPER_ADMIN |  | `academic-session/academic-session.controller.ts` |

## admin/dashboard-summary

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/admin/dashboard-summary` | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN |  | `dashboard/dashboard.controller.ts` |

## admin/network-overview

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/admin/network-overview` | SUPER_ADMIN |  | `dashboard/dashboard.controller.ts` |

## admin/operations-summary

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/admin/operations-summary` | SCHOOL_ADMIN, ACCOUNTS |  | `dashboard/dashboard.controller.ts` |

## admin/parents

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/admin/parents` | SCHOOL_ADMIN, SUPER_ADMIN |  | `parent/parent.controller.ts` |
| GET | `/admin/parents` | SCHOOL_ADMIN, SUPER_ADMIN |  | `parent/parent.controller.ts` |
| GET | `/admin/parents/duplicates` | SUPER_ADMIN |  | `parent/parent.controller.ts` |
| POST | `/admin/parents/lookup` | SCHOOL_ADMIN, SUPER_ADMIN |  | `parent/parent.controller.ts` |
| POST | `/admin/parents/:id/reset-password` | SCHOOL_ADMIN, SUPER_ADMIN | T | `parent/parent.controller.ts` |
| GET | `/admin/parents/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `parent/parent.controller.ts` |
| POST | `/admin/parents/:id/children` | SCHOOL_ADMIN, SUPER_ADMIN |  | `parent/parent.controller.ts` |
| DELETE | `/admin/parents/:id/children/:studentId` | SCHOOL_ADMIN, SUPER_ADMIN |  | `parent/parent.controller.ts` |
| PATCH | `/admin/parents/:id/children/:studentId` | SCHOOL_ADMIN, SUPER_ADMIN |  | `parent/parent.controller.ts` |
| PATCH | `/admin/parents/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `parent/parent.controller.ts` |
| DELETE | `/admin/parents/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `parent/parent.controller.ts` |

## admin/principal-academics-summary

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/admin/principal-academics-summary` | SCHOOL_ADMIN |  | `dashboard/dashboard.controller.ts` |

## admin/staff

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/admin/staff/:staffId/profile` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| PATCH | `/admin/staff/:staffId/profile` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| GET | `/admin/staff/:staffId/emergency-contacts` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| POST | `/admin/staff/:staffId/emergency-contacts` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| PATCH | `/admin/staff/:staffId/emergency-contacts/:contactId` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| DELETE | `/admin/staff/:staffId/emergency-contacts/:contactId` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| GET | `/admin/staff/:staffId/experience` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| POST | `/admin/staff/:staffId/experience` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| PATCH | `/admin/staff/:staffId/experience/:experienceId` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| DELETE | `/admin/staff/:staffId/experience/:experienceId` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| GET | `/admin/staff/:staffId/documents` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| POST | `/admin/staff/:staffId/documents` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| PATCH | `/admin/staff/:staffId/documents/:documentId/verify` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff-profile.controller.ts` |
| GET | `/admin/staff` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff.controller.ts` |
| POST | `/admin/staff` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff.controller.ts` |
| PATCH | `/admin/staff/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff.controller.ts` |
| DELETE | `/admin/staff/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff.controller.ts` |
| POST | `/admin/staff/:id/archive` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff.controller.ts` |
| POST | `/admin/staff/:id/unarchive` | SCHOOL_ADMIN, SUPER_ADMIN |  | `staff/staff.controller.ts` |
| POST | `/admin/staff/:id/erase` | SUPER_ADMIN |  | `staff/staff.controller.ts` |

## admin/students

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/admin/students/:studentId/profile` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| PATCH | `/admin/students/:studentId/profile` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| PATCH | `/admin/students/:studentId/current-enrollment` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| PUT | `/admin/students/:studentId/previous-school` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| PUT | `/admin/students/:studentId/medical-info` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| GET | `/admin/students/:studentId/emergency-contacts` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| POST | `/admin/students/:studentId/emergency-contacts` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| PATCH | `/admin/students/:studentId/emergency-contacts/:contactId` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| DELETE | `/admin/students/:studentId/emergency-contacts/:contactId` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| GET | `/admin/students/:studentId/documents` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| POST | `/admin/students/:studentId/documents` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| PATCH | `/admin/students/:studentId/documents/:documentId/verify` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| GET | `/admin/students/:studentId/promotion-history` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student-profile.controller.ts` |
| POST | `/admin/students` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student.controller.ts` |
| GET | `/admin/students` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student.controller.ts` |
| PATCH | `/admin/students/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student.controller.ts` |
| DELETE | `/admin/students/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student.controller.ts` |
| POST | `/admin/students/:id/archive` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student.controller.ts` |
| POST | `/admin/students/:id/unarchive` | SCHOOL_ADMIN, SUPER_ADMIN |  | `student/student.controller.ts` |
| POST | `/admin/students/:id/erase` | SUPER_ADMIN |  | `student/student.controller.ts` |

## admin/teachers

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/admin/teachers` | SCHOOL_ADMIN, SUPER_ADMIN |  | `teacher/teacher.controller.ts` |
| GET | `/admin/teachers` | SCHOOL_ADMIN, SUPER_ADMIN |  | `teacher/teacher.controller.ts` |
| PATCH | `/admin/teachers/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `teacher/teacher.controller.ts` |
| DELETE | `/admin/teachers/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `teacher/teacher.controller.ts` |
| POST | `/admin/teachers/:id/erase` | SUPER_ADMIN |  | `teacher/teacher.controller.ts` |

## admin/users

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/admin/users/accounts-staff` | SCHOOL_ADMIN, SUPER_ADMIN |  | `auth/account-access.controller.ts` |
| GET | `/admin/users/:id/access` | SCHOOL_ADMIN, SUPER_ADMIN |  | `auth/account-access.controller.ts` |
| POST | `/admin/users/:id/disable` | SCHOOL_ADMIN, SUPER_ADMIN |  | `auth/account-access.controller.ts` |
| POST | `/admin/users/:id/enable` | SCHOOL_ADMIN, SUPER_ADMIN |  | `auth/account-access.controller.ts` |
| PUT | `/admin/users/:id/grants` | SCHOOL_ADMIN, SUPER_ADMIN |  | `auth/account-access.controller.ts` |
| POST | `/admin/users/:id/revoke-sessions` | SCHOOL_ADMIN, SUPER_ADMIN |  | `auth/account-access.controller.ts` |

## applicants

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/applicants` | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `ADMISSIONS` |  | `admissions/applicants.controller.ts` |
| GET | `/applicants` | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `ADMISSIONS` |  | `admissions/applicants.controller.ts` |

## applications

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/applications` | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `ADMISSIONS` |  | `admissions/applications.controller.ts` |
| GET | `/applications` | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `ADMISSIONS` |  | `admissions/applications.controller.ts` |
| GET | `/applications/:id` | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `ADMISSIONS` |  | `admissions/applications.controller.ts` |
| PATCH | `/applications/:id` | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `ADMISSIONS` |  | `admissions/applications.controller.ts` |
| POST | `/applications/:id/reject` | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `ADMISSIONS` |  | `admissions/applications.controller.ts` |
| POST | `/applications/:id/approve` | SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `ADMISSIONS` |  | `admissions/applications.controller.ts` |

## assessment-categories

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/assessment-categories` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/assessment-categories.controller.ts` |
| GET | `/assessment-categories` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/assessment-categories.controller.ts` |
| PATCH | `/assessment-categories/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/assessment-categories.controller.ts` |
| DELETE | `/assessment-categories/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/assessment-categories.controller.ts` |

## assessments

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/assessments` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/assessments.controller.ts` |
| GET | `/assessments` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/assessments.controller.ts` |
| PATCH | `/assessments/:id` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/assessments.controller.ts` |
| DELETE | `/assessments/:id` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/assessments.controller.ts` |
| POST | `/assessments/:id/marks` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/assessments.controller.ts` |

## attendance

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/attendance` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `attendance/attendance.controller.ts` |
| POST | `/attendance/bulk` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `attendance/attendance.controller.ts` |

## attendance-risk

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/attendance-risk/settings` | SCHOOL_ADMIN, SUPER_ADMIN |  | `attendance-risk/attendance-risk.controller.ts` |
| PUT | `/attendance-risk/settings` | SCHOOL_ADMIN, SUPER_ADMIN |  | `attendance-risk/attendance-risk.controller.ts` |
| GET | `/attendance-risk` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `attendance-risk/attendance-risk.controller.ts` |

## auth

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/auth/login` | **public** | T | `auth/auth.controller.ts` |
| POST | `/auth/refresh` | **public** |  | `auth/auth.controller.ts` |
| POST | `/auth/logout` | **public** |  | `auth/auth.controller.ts` |
| POST | `/auth/logout-all` | any authenticated (service-scoped) |  | `auth/auth.controller.ts` |
| POST | `/auth/forgot-password` | **public** | T | `auth/auth.controller.ts` |
| POST | `/auth/reset-password` | **public** | T | `auth/auth.controller.ts` |
| POST | `/auth/change-password` | any authenticated (service-scoped) | T | `auth/auth.controller.ts` |

## bulk-import

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/bulk-import/:entity/sample` | SCHOOL_ADMIN, SUPER_ADMIN |  | `bulk-import/bulk-import.controller.ts` |
| POST | `/bulk-import/students/preview` | SCHOOL_ADMIN, SUPER_ADMIN |  | `bulk-import/bulk-import.controller.ts` |
| POST | `/bulk-import/students/commit` | SCHOOL_ADMIN, SUPER_ADMIN |  | `bulk-import/bulk-import.controller.ts` |
| POST | `/bulk-import/parents/preview` | SCHOOL_ADMIN, SUPER_ADMIN |  | `bulk-import/bulk-import.controller.ts` |
| POST | `/bulk-import/parents/commit` | SCHOOL_ADMIN, SUPER_ADMIN |  | `bulk-import/bulk-import.controller.ts` |
| POST | `/bulk-import/teachers/preview` | SCHOOL_ADMIN, SUPER_ADMIN |  | `bulk-import/bulk-import.controller.ts` |
| POST | `/bulk-import/teachers/commit` | SCHOOL_ADMIN, SUPER_ADMIN |  | `bulk-import/bulk-import.controller.ts` |
| POST | `/bulk-import/staff/preview` | SCHOOL_ADMIN, SUPER_ADMIN |  | `bulk-import/bulk-import.controller.ts` |
| POST | `/bulk-import/staff/commit` | SCHOOL_ADMIN, SUPER_ADMIN |  | `bulk-import/bulk-import.controller.ts` |

## campuses

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/campuses` | SCHOOL_ADMIN, SUPER_ADMIN |  | `campus/campus.controller.ts` |
| GET | `/campuses` | SCHOOL_ADMIN, SUPER_ADMIN |  | `campus/campus.controller.ts` |
| PATCH | `/campuses/:id` | SUPER_ADMIN |  | `campus/campus.controller.ts` |
| DELETE | `/campuses/:id` | SUPER_ADMIN |  | `campus/campus.controller.ts` |

## circulars

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/circulars` | SCHOOL_ADMIN, SUPER_ADMIN |  | `circulars/circulars.controller.ts` |
| POST | `/circulars/draft-suggestion` | SCHOOL_ADMIN, SUPER_ADMIN |  | `circulars/circulars.controller.ts` |
| GET | `/circulars` | any authenticated (service-scoped) |  | `circulars/circulars.controller.ts` |
| POST | `/circulars/:id/read` | PARENT |  | `circulars/circulars.controller.ts` |
| GET | `/circulars/:id/stats` | SCHOOL_ADMIN, SUPER_ADMIN |  | `circulars/circulars.controller.ts` |

## classes

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/classes` | SCHOOL_ADMIN, SUPER_ADMIN |  | `class/class.controller.ts` |
| GET | `/classes` | TEACHER, SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN |  | `class/class.controller.ts` |
| PATCH | `/classes/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `class/class.controller.ts` |
| DELETE | `/classes/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `class/class.controller.ts` |

## complaints

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/complaints` | TEACHER, SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `COMPLAINTS` |  | `complaints/complaints.controller.ts` |
| GET | `/complaints` | any authenticated (service-scoped) · ACCOUNTS only with grant `COMPLAINTS` |  | `complaints/complaints.controller.ts` |
| PATCH | `/complaints/:id` | TEACHER, SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN · ACCOUNTS only with grant `COMPLAINTS` |  | `complaints/complaints.controller.ts` |

## conversations

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/conversations` | PARENT · ACCOUNTS only with grant `MESSAGES` |  | `messages/conversations.controller.ts` |
| GET | `/conversations` | any authenticated (service-scoped) · ACCOUNTS only with grant `MESSAGES` |  | `messages/conversations.controller.ts` |
| GET | `/conversations/:id` | any authenticated (service-scoped) · ACCOUNTS only with grant `MESSAGES` |  | `messages/conversations.controller.ts` |
| POST | `/conversations/:id/messages` | any authenticated (service-scoped) · ACCOUNTS only with grant `MESSAGES` |  | `messages/conversations.controller.ts` |
| POST | `/conversations/:id/read` | any authenticated (service-scoped) · ACCOUNTS only with grant `MESSAGES` |  | `messages/conversations.controller.ts` |

## diary

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/diary` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `diary/diary.controller.ts` |
| POST | `/diary/draft-suggestion` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `diary/diary.controller.ts` |

## fee-payments

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/fee-payments/:id` | any authenticated (service-scoped) |  | `fees/fees.controller.ts` |
| GET | `/fee-payments/:id/receipt.pdf` | any authenticated (service-scoped) |  | `fees/fees.controller.ts` |

## fee-structures

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/fee-structures` | SCHOOL_ADMIN, SUPER_ADMIN, ACCOUNTS |  | `fees/fees.controller.ts` |
| GET | `/fee-structures` | SCHOOL_ADMIN, SUPER_ADMIN, ACCOUNTS |  | `fees/fees.controller.ts` |
| PATCH | `/fee-structures/:id` | SCHOOL_ADMIN, SUPER_ADMIN, ACCOUNTS |  | `fees/fees.controller.ts` |

## fee-vouchers

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/fee-vouchers` | SCHOOL_ADMIN, SUPER_ADMIN, ACCOUNTS |  | `fees/fees.controller.ts` |
| GET | `/fee-vouchers/:id/pdf` | any authenticated (service-scoped) |  | `fees/fees.controller.ts` |
| POST | `/fee-vouchers/:id/reconcile` | SCHOOL_ADMIN, SUPER_ADMIN, ACCOUNTS |  | `fees/fees.controller.ts` |
| POST | `/fee-vouchers/:id/pay` | PARENT |  | `fees/fees.controller.ts` |

## files

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/files` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `files/files.controller.ts` |
| GET | `/files/:id` | any authenticated (service-scoped) |  | `files/files.controller.ts` |

## grading-scales

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/grading-scales` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/grading.controller.ts` |
| POST | `/grading-scales` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/grading.controller.ts` |
| PUT | `/grading-scales/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/grading.controller.ts` |
| DELETE | `/grading-scales/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/grading.controller.ts` |

## health

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/health/live` | **public** |  | `observability/health.controller.ts` |
| GET | `/health/ready` | **public** |  | `observability/health.controller.ts` |

## hiring

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/hiring/applications` | SCHOOL_ADMIN, SUPER_ADMIN |  | `hiring/hiring-applications.controller.ts` |
| GET | `/hiring/applications` | SCHOOL_ADMIN, SUPER_ADMIN |  | `hiring/hiring-applications.controller.ts` |
| GET | `/hiring/applications/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `hiring/hiring-applications.controller.ts` |
| PATCH | `/hiring/applications/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `hiring/hiring-applications.controller.ts` |
| POST | `/hiring/applications/:id/reject` | SCHOOL_ADMIN, SUPER_ADMIN |  | `hiring/hiring-applications.controller.ts` |
| POST | `/hiring/applications/:id/approve` | SCHOOL_ADMIN, SUPER_ADMIN |  | `hiring/hiring-applications.controller.ts` |
| POST | `/hiring/candidates` | SCHOOL_ADMIN, SUPER_ADMIN |  | `hiring/hiring-candidates.controller.ts` |
| GET | `/hiring/candidates` | SCHOOL_ADMIN, SUPER_ADMIN |  | `hiring/hiring-candidates.controller.ts` |

## holidays

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/holidays` | SCHOOL_ADMIN, SUPER_ADMIN |  | `holidays/holidays.controller.ts` |
| GET | `/holidays` | any authenticated (service-scoped) |  | `holidays/holidays.controller.ts` |
| PATCH | `/holidays/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `holidays/holidays.controller.ts` |
| DELETE | `/holidays/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `holidays/holidays.controller.ts` |

## leave-requests

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/leave-requests` | PARENT |  | `leave/leave.controller.ts` |
| GET | `/leave-requests` | SCHOOL_ADMIN, SUPER_ADMIN |  | `leave/leave.controller.ts` |
| POST | `/leave-requests/:id/approve` | SCHOOL_ADMIN, SUPER_ADMIN |  | `leave/leave.controller.ts` |
| POST | `/leave-requests/:id/reject` | SCHOOL_ADMIN, SUPER_ADMIN |  | `leave/leave.controller.ts` |

## me

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/me` | any authenticated (service-scoped) |  | `me/me.controller.ts` |
| GET | `/me/children` | any authenticated (service-scoped) |  | `me/me.controller.ts` |
| GET | `/me/children/:studentId` | any authenticated (service-scoped) |  | `me/me.controller.ts` |
| PATCH | `/me/children/:studentId` | any authenticated (service-scoped) |  | `me/me.controller.ts` |
| POST | `/me/device-tokens` | any authenticated (service-scoped) |  | `me/me.controller.ts` |
| PATCH | `/me/notification-preferences` | any authenticated (service-scoped) |  | `me/me.controller.ts` |

## notifications

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/notifications` | any authenticated (service-scoped) |  | `notifications/notifications.controller.ts` |
| POST | `/notifications/:id/read` | any authenticated (service-scoped) |  | `notifications/notifications.controller.ts` |
| POST | `/notifications/read-all` | any authenticated (service-scoped) |  | `notifications/notifications.controller.ts` |

## payments

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/payments/webhook/:gateway` | **public** |  | `fees/payments-webhook.controller.ts` |

## promotions

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/promotions/preview` | SCHOOL_ADMIN, SUPER_ADMIN |  | `promotions/promotions.controller.ts` |
| GET | `/promotions/policy` | SCHOOL_ADMIN, SUPER_ADMIN |  | `promotions/promotions.controller.ts` |
| PUT | `/promotions/policy` | SCHOOL_ADMIN, SUPER_ADMIN |  | `promotions/promotions.controller.ts` |
| POST | `/promotions/execute` | SCHOOL_ADMIN, SUPER_ADMIN |  | `promotions/promotions.controller.ts` |

## report-cards

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/report-cards/generated` | SCHOOL_ADMIN, SUPER_ADMIN |  | `report-cards/generated-report-cards.controller.ts` |
| GET | `/report-cards/generated` | PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `report-cards/generated-report-cards.controller.ts` |
| GET | `/report-cards/generated/:id` | PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `report-cards/generated-report-cards.controller.ts` |
| GET | `/report-cards/generated/:id/pdf` | PARENT, TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `report-cards/generated-report-cards.controller.ts` |
| POST | `/report-cards` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `report-cards/report-cards.controller.ts` |
| GET | `/report-cards` | any authenticated (service-scoped) |  | `report-cards/report-cards.controller.ts` |
| GET | `/report-cards/:id/pdf` | any authenticated (service-scoped) |  | `report-cards/report-cards.controller.ts` |

## schools

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/schools` | SUPER_ADMIN |  | `school/school.controller.ts` |
| GET | `/schools` | SUPER_ADMIN |  | `school/school.controller.ts` |
| PATCH | `/schools/:id` | SUPER_ADMIN |  | `school/school.controller.ts` |
| DELETE | `/schools/:id` | SUPER_ADMIN |  | `school/school.controller.ts` |

## sections

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/sections/:id/attendance` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `attendance/attendance.controller.ts` |
| GET | `/sections/:id/diary` | TEACHER, SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN |  | `diary/diary.controller.ts` |
| GET | `/sections` | TEACHER, SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN |  | `sections/sections.controller.ts` |
| GET | `/sections/:id/students` | TEACHER, SCHOOL_ADMIN, ACCOUNTS, SUPER_ADMIN |  | `sections/sections.controller.ts` |
| POST | `/sections` | SCHOOL_ADMIN, SUPER_ADMIN |  | `sections/sections.controller.ts` |
| PATCH | `/sections/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `sections/sections.controller.ts` |
| DELETE | `/sections/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `sections/sections.controller.ts` |
| GET | `/sections/:id/timetable` | SCHOOL_ADMIN, SUPER_ADMIN |  | `timetable/timetable.controller.ts` |
| PUT | `/sections/:id/timetable` | SCHOOL_ADMIN, SUPER_ADMIN |  | `timetable/timetable.controller.ts` |

## students

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/students/:id/attendance` | any authenticated (service-scoped) |  | `attendance/attendance.controller.ts` |
| GET | `/students/:id/attendance-risk` | any authenticated (service-scoped) |  | `attendance-risk/attendance-risk.controller.ts` |
| GET | `/students/:id/diary` | any authenticated (service-scoped) |  | `diary/diary.controller.ts` |
| GET | `/students/:id/fees` | any authenticated (service-scoped) |  | `fees/fees.controller.ts` |
| GET | `/students/:id/fees/payments` | any authenticated (service-scoped) |  | `fees/fees.controller.ts` |
| GET | `/students/:id/grades` | any authenticated (service-scoped) |  | `gradebook/grades.controller.ts` |
| GET | `/students/:id/leave-requests` | any authenticated (service-scoped) |  | `leave/leave.controller.ts` |
| GET | `/students/:id/timetable` | any authenticated (service-scoped) |  | `timetable/timetable.controller.ts` |

## syllabi

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/syllabi` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `syllabus/syllabus.controller.ts` |
| GET | `/syllabi/:id` | TEACHER, SCHOOL_ADMIN, SUPER_ADMIN |  | `syllabus/syllabus.controller.ts` |
| POST | `/syllabi` | SCHOOL_ADMIN, SUPER_ADMIN |  | `syllabus/syllabus.controller.ts` |
| PUT | `/syllabi/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `syllabus/syllabus.controller.ts` |
| DELETE | `/syllabi/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `syllabus/syllabus.controller.ts` |

## teachers

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| GET | `/teachers` | SCHOOL_ADMIN, SUPER_ADMIN |  | `teachers/teachers.controller.ts` |
| GET | `/teachers/me/day` | TEACHER |  | `teachers/teachers.controller.ts` |
| GET | `/teachers/me/gradebook-overview` | TEACHER |  | `teachers/teachers.controller.ts` |
| GET | `/teachers/me/timetable` | TEACHER |  | `timetable/timetable.controller.ts` |

## terms

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/terms` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/terms.controller.ts` |
| GET | `/terms` | any authenticated (service-scoped) |  | `gradebook/terms.controller.ts` |
| PATCH | `/terms/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/terms.controller.ts` |
| DELETE | `/terms/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `gradebook/terms.controller.ts` |

## timetable

| Method | Path | Roles | T | Controller |
|---|---|---|---|---|
| POST | `/timetable` | SCHOOL_ADMIN, SUPER_ADMIN |  | `timetable/timetable.controller.ts` |
| PATCH | `/timetable/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `timetable/timetable.controller.ts` |
| DELETE | `/timetable/:id` | SCHOOL_ADMIN, SUPER_ADMIN |  | `timetable/timetable.controller.ts` |
