# Staff Lifecycle (Hiring → Staff/Teacher → Assignment)

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `hiring/`, `staff/`, `teacher/`, `sections/`, `timetable/`; **no dedicated e2e spec** (unit specs only) · **Owner:** project owner

| Step | Actor · UI · API | Effect | Rules |
|---|---|---|---|
| 1. Add candidate | SCHOOL_ADMIN/SUPER_ADMIN · `/admin/hiring/new` · `POST /hiring/candidates` | `HiringCandidate`; résumé must be uploaded first via `POST /files` and linked | BR-STF-02 |
| 2. Create application | `POST /hiring/applications` | `HiringApplication` (open) | — |
| 3. Review/edit | `/admin/hiring/:id` · `PATCH /hiring/applications/:id` | editable until decided | BR-STF-02 |
| 4a. Approve | `POST /hiring/applications/:id/approve` | Creates `Staff`; for a **teacher** hire also creates the `Teacher` + login (identifier/password required); records `createdStaffId` | BR-STF-01/02 |
| 4b. Reject | `POST /hiring/applications/:id/reject` | REJECTED | — |
| 5. Maintain staff profile | `/admin/staff/:id` · `/admin/staff/:staffId/{profile,experience,emergency-contacts,documents}` | Personal data, experience, emergency contacts, documents + verification | — |
| 6. Assign to sections | `/admin/sections` (class teacher); `/admin/timetable` (subject/period) | Determines teacher access scope (BR-SCOPE-03) and gates attendance/leave (BR-ATT-03, BR-LV-02) | BR-ORG-06 |
| 7. Bulk onboarding | `/admin/bulk-import` (teachers, staff) | Preview → commit | BR-IMP-01 |

Not supported: contracts/payroll, leave for staff, performance records, **history of teacher↔section assignment** (assignments are current-state only — verify in Phase 7), staff deactivation workflow other than `DELETE /admin/staff/:id` (Q7 applies).
