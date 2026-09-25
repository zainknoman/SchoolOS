# Super Admin Guide

> **Status:** PARTIAL (see [verification level](README.md)) · **Verified:** 2026-09-20 · Role: `SUPER_ADMIN` — unrestricted across all schools. Screens: **Dashboard** (network overview), **Org Structure** menu.

## Set up a school and its campuses
1. **Schools → Add School.** Enter the school profile (name, registration, contact, type, board). You can provision the first administrator/principal login here; a password is generated if you leave it blank and is shown **once** — copy it.
2. **Campuses → Add Campus** for each branch; choose the school; provision a campus principal login if wanted (a campus-scoped login sees only that campus).
3. Open **School Profile / Campus Profile** to edit details later.
Deleting a school or campus is blocked while anything still refers to it.

## Academic sessions (per school)
1. **Academic Sessions → create** a session (label like `2026-2027`, start and end dates).
2. Choose the **School**, then tick *active* only for the session currently running. Activating a session deactivates only that school's other sessions (BL-01); other schools keep their own calendars.
3. Only super admins can create/edit/delete sessions in the UI.

## Classes
**Classes:** create classes (grade levels) per campus and session — school administrators can do this too, as well as add campuses and sections for their own school. Only you can edit or delete campuses and manage schools and sessions.
*Copying a previous year's structure* (classes and sections, without class teachers) is available through the API for school admins; the current UI screen for sessions is super-admin only.

## Monitoring
The **Dashboard** shows the network overview across schools. There is no built-in audit-log viewer, user-management screen, account unlock or account disable: to unlock a locked user wait 15 minutes; other account fixes need database access ([RUNBOOKS](../operations/RUNBOOKS.md)).

## Privacy: erasure and retention (BL-07, BL-63)
- **Erase** a student, staff member or teacher permanently: archive it first, then `POST /api/v1/admin/students|staff|teachers/:id/erase` (audited). It is refused while records kept for retention (attendance, vouchers, marks …) still refer to the person — that is intended.
- **Retention policy** (`/api/v1/admin/retention-policy`): every data category is listed with its period *unset*. Enter a period only after legal review; the **report** (`…/report`) counts records past their period. Nothing is ever deleted automatically.

## Cautions
- Subjects are managed per school in **Subjects** (choose the school when adding one); school admins manage their own school's (BL-02).
- A whole-school circular, or a holiday without a campus, belongs to one school: choose the **School** in the form (BL-20).
- The very first super admin of a new system is created by the operator with `npm run bootstrap:super-admin`, not in the console; you must choose a new password at first sign-in. Further super admins are created by an existing one.
- School-wide circulars and platform-wide holidays can cross school boundaries (known defects KG-1, KG-6) — avoid relying on them in a multi-school deployment until fixed.
