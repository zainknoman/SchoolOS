# School Admin and Principal Guide

> **Status:** PARTIAL (see [verification level](README.md)) · **Verified:** 2026-09-20 · Role: `SCHOOL_ADMIN` — your school (or only your campus, if your login is campus-scoped). A **Principal** is a School Admin whose account has the principal flag: you additionally see **Principal → School Overview** and **Academics & Staff**.

Menu groups: Overview · People · Operations · Communication · Org Structure.

## 1. Daily/weekly work
| Task | Where | How |
|---|---|---|
| See what needs attention | **Dashboard** | summary cards for your school |
| Mark or review attendance | *Teachers do this;* admins can review reports via the API/dashboards | — |
| Approve or reject leave | **Operations → Leave Applications** | open a request → approve or reject (once). Approval fails if the child's section has no class teacher — assign one first |
| Publish a notice | **Communication → Circulars** | choose whole school or one section, write, publish; see read counts. ⚠ school-wide circulars currently reach parents of *all* schools (KG-1) |
| Reply to parents | **Communication → Messages** | open a conversation and answer |
| Complaints | **Communication → Complaints** | log and update status (open → resolved) per student |

## 2. People
- **Students → add student:** requires an active academic session and a section. Link either an existing parent or create a new parent login (exactly one). GR number must be unique. Open **Student Profile** to add address, previous school, medical info, emergency contacts and documents (mark documents verified).
- **Parents:** create/edit parents and link or unlink children.
- **Staff / Hiring:** add staff and keep profiles, experience and documents. For hiring: **Hiring → New Candidate** (upload résumé first) → create application → **approve** (creates the staff record; for a teacher you must give a login) or **reject**. Decisions are final.
- **Bulk Import:** download the sample file for students, parents, teachers or staff → upload → **preview** (fix reported errors, including duplicates within the file) → **commit**.

## 3. Admissions
**Operations → Admissions → New Applicant**, then the application (desired class and session). Review/edit while open; **approve** creates the student, links/creates the parent and enrols them in the application's session; **reject** with notes. Decisions cannot be undone.

## 4. Academic setup
1. **Classes:** create classes (grade levels) for your campus and the session (**Org Structure → Classes**); you can also add a campus (**Campuses → Add Campus**) for your school — editing or deleting a campus needs a super admin.
2. **Sections:** create sections and assign a **class teacher** (must belong to the same campus) — attendance and leave approval need it.
3. **Timetable:** build each section's week; the system rejects a teacher or room double-booked in the same period.
4. **Terms** and **Assessment Categories** (weights per class/term — aim for 100 %; a warning shows otherwise).
5. **Holidays:** school-wide or per campus; attendance cannot be marked on holidays. ⚠ leaving the campus empty makes it apply to every campus of every school (KG-6).
6. **Report Cards:** attach one report-card document per student per session (not generated from marks).

## 5. End of year: promotion
1. Ask the super admin to create and activate the new session; create/copy classes and sections for it.
2. **Operations → Promotions:** pick the source section → review each student's decision (the default suggestion is *Promoted* for everyone — check manually) → for *Promoted*/*Retained* choose the target section in the new session; for *Graduated*, *Transferred out* or *Withdrawn* choose no target → execute. The old placement is closed and history is kept.

## 6. Principal views
**School Overview** and **Academics & Staff** summarise the school. They are read-only dashboards.

## Cautions
Deleting a student or staff record is permanent (there is no undo or archive); the system blocks it only if other records still refer to them. Subjects cannot be added in the product. You cannot disable or unlock a user account from the UI.
