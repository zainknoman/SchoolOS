# Super Admin Guide

> **Status:** PARTIAL (see [verification level](README.md)) · **Verified:** 2026-09-20 · Role: `SUPER_ADMIN` — unrestricted across all schools. Screens: **Dashboard** (network overview), **Org Structure** menu.

## Set up a school and its campuses
1. **Schools → Add School.** Enter the school profile (name, registration, contact, type, board). You can provision the first administrator/principal login here; a password is generated if you leave it blank and is shown **once** — copy it.
2. **Campuses → Add Campus** for each branch; choose the school; provision a campus principal login if wanted (a campus-scoped login sees only that campus).
3. Open **School Profile / Campus Profile** to edit details later.
Deleting a school or campus is blocked while anything still refers to it.

## Academic sessions (platform-wide)
1. **Academic Sessions → create** a session (label like `2026-2027`, start and end dates).
2. Tick *active* only for the session currently running. **Important:** activating a session **deactivates every other session for all schools** — sessions are shared by the whole platform. Students, fee vouchers and imports are attached to the active session, so coordinate school calendars before switching.
3. Only super admins can create/edit/delete sessions in the UI.

## Classes
**Classes:** create classes (grade levels) per campus and session — school administrators can do this too, as well as add campuses and sections for their own school. Only you can edit or delete campuses and manage schools and sessions.
*Copying a previous year's structure* (classes and sections, without class teachers) is available through the API for school admins; the current UI screen for sessions is super-admin only.

## Monitoring
The **Dashboard** shows the network overview across schools. There is no built-in audit-log viewer, user-management screen, account unlock or account disable: to unlock a locked user wait 15 minutes; other account fixes need database access ([RUNBOOKS](../operations/RUNBOOKS.md)).

## Cautions
- Subjects cannot be created in the product (seeded only).
- School-wide circulars and platform-wide holidays can cross school boundaries (known defects KG-1, KG-6) — avoid relying on them in a multi-school deployment until fixed.
