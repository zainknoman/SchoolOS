# School Admin and Principal Guide

> **Status:** PARTIAL (see [verification level](README.md)) · **Verified:** 2026-09-20 · Role: `SCHOOL_ADMIN` — your school (or only your campus, if your login is campus-scoped). A **Principal** is a School Admin whose account has the principal flag: you additionally see **Principal → School Overview** and **Academics & Staff**.
> **Implemented 2026-09-25:** copy-structure for school admins (BL-33), subject management (BL-02), leave approval without a class teacher (BL-60/BL-29 part). **Still to come:** the leave recommendation step (BL-29). This guide describes current behaviour and is not click-tested.

Menu groups: Overview · People · Operations · Communication · Org Structure.

## 1. Daily/weekly work
| Task | Where | How |
|---|---|---|
| See what needs attention | **Dashboard** | summary cards for your school |
| Mark or review attendance | *Teachers do this;* admins can review reports via the API/dashboards | — |
| Approve or reject leave | **Operations → Leave Applications** | open a request → approve or reject (once). Approval fails if the child's section has no class teacher — assign one first |
| Publish a notice | **Communication → Circulars** | choose whole school or one section, write, publish; see read counts. (since BL-20 a school-wide circular reaches only your school's parents — a campus principal's, only their campus) ⚠ old note: school-wide circulars previously reach parents of *all* schools (KG-1) |
| Reply to parents | **Communication → Messages** | open a conversation and answer |
| Complaints | **Communication → Complaints** | log and update status (open → resolved) per student |

## 2. People
- **Students → add student:** requires an active academic session and a section. Link either an existing parent or create a new parent login (exactly one). GR number must be unique. Open **Student Profile** to add address, previous school, medical info, emergency contacts and documents (mark documents verified).
- **New academic year** (Org Structure → Academic Sessions → *Copy structure here* on the new session, or from Promotions): copies classes, sections, terms, assessment categories and the timetable from the chosen session — nothing in the old session changes, and running it twice is harmless (BL-33).
- **Subjects** (Operations → Subjects): add your school's subjects, rename them, **deactivate** one you no longer teach (it disappears from pickers, history stays), delete only an unused one (BL-02).
- **Parents:** create/edit parents. On a parent's profile you see only **your school's** children of that parent. Each link has a **relationship** (Father/Mother/Guardian/Other) and up to **two primary guardians** per student (a third is refused — make one non-primary first); *Add child* links another of your students, *Remove* unlinks one (a student keeps at least one guardian). A parent who already has children at another school: use **Find existing parent** (exact login or CNIC) and link them — never create a second account; you cannot edit or delete such a shared parent's profile (a super admin can) (BL-23). **Reset password** (parent profile) gives a one-time password, shown once — read it to the parent; they must choose their own at next sign-in and are signed out everywhere. Not available when e-mail reset is configured, or for a parent who also has children in another school (ask the super admin).
- **Staff / Hiring:** add staff and keep profiles, experience and documents. For hiring: **Hiring → New Candidate** (upload résumé first) → create application → **approve** (creates the staff record; for a teacher you must give a login) or **reject**. Decisions are final.
- **Accounts Access** (Operations → Accounts Access): accounts staff work on fees only; tick **Admissions**, **Complaints** or **Parent messages** for each accounts user who should also handle those. Every change is recorded (BL-32).
- **Bulk Import:** download the sample file for students, parents, teachers or staff → upload → **preview** (fix reported errors, including duplicates within the file) → **commit**.

## 3. Admissions
**Operations → Admissions → New Applicant**, then the application (desired class and session). Review/edit while open; **approve** creates the student, links/creates the parent and enrols them in the application's session; **reject** with notes. Decisions cannot be undone.

## 4. Academic setup
1. **Classes:** create classes (grade levels) for your campus and the session (**Org Structure → Classes**); you can also add a campus (**Campuses → Add Campus**) for your school — editing or deleting a campus needs a super admin.
2. **Sections:** create sections and assign a **class teacher** (must belong to the same campus) — attendance and leave approval need it.
3. **Timetable:** build each section's week; the system rejects a teacher or room double-booked in the same period.
4. **Terms** and **Assessment Categories** (weights per class/term — aim for 100 %; a warning shows otherwise).
4a. **Syllabus** (**Operations → Syllabus**): choose a class, **Add syllabus** for a subject, then write an overview and the units in teaching order (title, topics, term, planned dates; ↑/↓ to reorder) and **Save**. Teachers of that class can read it. **Copy structure** to a new session copies syllabi too. A finished session's syllabus is kept as history and cannot be edited.
5. **Holidays:** school-wide or per campus; attendance cannot be marked on holidays. Leaving the campus empty makes it apply to every campus of **your** school (BL-20); a campus principal can only add holidays for their campus.
6. **Report Cards:** attach one report-card document per student per session (not generated from marks).

## 5. End of year: promotion
1. Ask the super admin to create and activate the new session; create/copy classes and sections for it.
2. **Operations → Promotions:** pick the source section → **Load students**. Each row shows the student's attendance %, results % and any fees due for the year, with warnings in yellow (red when your school's rules block a plain *Promoted*). No outcome is chosen for you: pick one per row, or use **Apply outcome to all** and adjust. *Promoted with conditions* needs the conditions written in (they are kept in the student's promotion history). For *Promoted*, *Promoted with conditions* and *Retained* choose the target section in the new session; *Graduated*, *Transferred* and *Withdrawn* take none → **Confirm decisions** and accept the confirmation. The old placement is closed and history is kept and cannot be edited.
3. **Promotion rules** (panel above the table, school-wide admins): the minimum attendance and result percentages, and whether each rule — or fees still due — should *block* a plain *Promoted*. Without blocks they are warnings only.

## 5a. Teaching history
A teacher's staff profile (**People → Staff → the teacher → Teaching History**) lists every class and subject they were assigned, with dates. It is kept automatically when you change a section's class teacher or save a timetable; nothing is overwritten. Assignments that existed before this feature show "before <session start>".

## 5b. Data export
**Operations → Data Export** downloads your school's students, guardians, enrolments, attendance, results (marks) or fee vouchers as a CSV file that opens in Excel. Pick a session to narrow most exports, or a date range for attendance. The file covers your school only (your campus, if your account is campus-level), and every export is recorded in the audit log with your name and the number of rows. **Include sensitive fields** (B-Form, religion, medical information, CNIC) is available to the principal only — tick it only when the purpose needs them. Fee amounts are in paisa.

## 6. Principal views
**School Overview** and **Academics & Staff** summarise the school. They are read-only dashboards.

## Cautions
**Archive** (the old *Delete*) takes a student or staff member out of the lists without losing anything: a student's current enrolment is ended (withdrawn); a teacher is taken off their classes and timetable and can no longer sign in. **Show archived** lists them and **Restore** brings them back (a restored student is not re-enrolled; a restored teacher's login stays disabled until re-enabled). Only a super admin can erase a record permanently. Subjects cannot be added in the product. You cannot disable or unlock a user account from the UI.
