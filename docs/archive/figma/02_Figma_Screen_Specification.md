> **ARCHIVED 2026-09-20** — Aug-2026 Figma handoff, predates the SchoolOS redesign. Current design source: DESIGN.md. Do not treat as current documentation.

# School OS — Figma Screen Specification
**Source:** Tier A MVP Build Specification / Internal Rev 1.0 · Aug 2026

## Screen inventory

### Web
1. Owner Dashboard
2. Fee Reconciliation Queue
3. Exam Marks Entry
4. Communication / Message Audit
5. Attendance Report
6. Academic Grading Scheme Editor
7. Academic Session Settings
8. Student Management / Profile desktop adaptation

### Mobile
9. Teacher Mark Attendance
10. Teacher Offline Queue
11. Parent Home
12. Student Profile
13. Login
14. Mobile Navigation / Information Architecture

---

# 01 Owner Dashboard — Web

**Frame:** 1440 × 1024  
**User:** Owner / Admin  
**Goal:** Give the owner immediate operational health and drill-down entry points.

### Layout
- 64 px header
- 240 px sidebar
- Main content max width based on 12-column grid
- Page title + date/session controls
- Four KPI cards across
- Two-column exception/action region
- Attendance/collection trend panel
- Notification delivery panel

### Header
- School OS logo
- Campus selector
- Academic session selector
- Notification icon
- User profile

### Sidebar
Dashboard / Students / Attendance / Fees / Exams / Communication / Reports / Settings

### KPI cards
1. Students — `1,284`
2. Present — `93.5%`
3. Fees Collected — `PKR 2.4M`
4. Outstanding — `PKR 680K`

Secondary cards:
- At-risk students — `37`
- Absent today — `84`
- Teachers absent — `6`

### Interactions
- Every KPI is clickable.
- At-risk opens filtered student list.
- Outstanding opens fees/defaulters.
- Collection opens fee analytics.
- Delivery widget opens communication audit.

### States
Default / Loading / Empty / Error.

---

# 02 Teacher Mark Attendance — Mobile

**Frame:** 390 × 844  
**User:** Teacher  
**Success metric:** 40 students marked in under 30 seconds.

### Header
- Back
- `Mark Attendance`
- Overflow
- Network status

### Context
- Class: Grade 7 — Section B
- Subject: General Science
- Date
- Period

### Primary action
`DEFAULT ALL PRESENT`

This is intentionally high priority and must be reachable without scrolling.

### Student list
Each row:
- Roll number
- Avatar
- Name
- Status toggle

Tap behavior:
`Present → Absent → Late → Present`

When Absent:
- Reason selector appears.

When Late:
- Arrival time selector appears.

### Sticky footer
- Total / Present / Absent
- `SUBMIT ATTENDANCE (37/40)`

### Prototype
Start → default all present → change selected students → submit → success state.

---

# 03 Teacher Offline Queue — Mobile

**Frame:** 390 × 844

### Header
`Offline Queue`

### Network state
Large `OFFLINE` badge.
Cache:
`3.2 MB / Healthy`

### Queue tabs
Pending / Synced

### Queue item
- Workflow type
- Class/subject
- Date
- Number of records
- Idempotency key
- Pending/synced status

Example:
`Attendance · Class 9-A · Physics · 40 records`

### Conflict state
Show:
`Teacher submission overrides earlier Admin bulk edits.`

### CTA
`FORCE SYNC ON CONNECT`

### Sync result
Each item must expose:
- Synced
- Conflict resolved
- Failed / retry
- Server timestamp

No silent failure.

---

# 04 Parent Home — Mobile

**Frame:** 390 × 844  
**User:** Parent

### Header
- School name
- Parent name
- Notifications
- Child selector

### Three-question hierarchy

#### Did my child attend?
Card:
- Present/Absent
- Time
- Monthly attendance %

#### What do I owe?
Card:
- Voucher month
- Amount
- Paid/unpaid
- Receipt
- PDF action

#### What was the result?
Card:
- Exam/term
- Percentage
- Grade
- Optional rank
- Report card action

### Secondary content
- Announcements
- Timetable preview

### Bottom navigation
Home / Attendance / Fees / Results / More

---

# 05 Fee Reconciliation Queue — Web

**Frame:** 1440 × 1024  
**User:** Finance/admin

### Filter bar
- Payment rail
- Date range
- Exception status
- Challan search

### Summary
- Total received: `PKR 2,400,000`
- Auto matched: `98.2%`
- Exceptions: `1.8%`

### Table
Columns:
Timestamp / Rail / Transaction ID / Amount / Challan / Student / Exception / Action

### Resolution drawer
Show:
- Invoice amount
- Received amount
- Difference
- Student
- Challan
- Payment rail
- Transaction ID

Options:
1. Accept partial payment & carry forward
2. Apply discount/concession
3. Reject/refund

Primary:
`CONFIRM AND APPLY RECONCILIATION`

### Success
Row leaves exception queue and summary counts update.

---

# 06 Exam Marks Entry — Web

**Frame:** 1440 × 1024  
**User:** Teacher

### Header
Exam / Class / Subject / Filter

### Marks table
Roll No / Student / Total / Obtained / Grade / Remarks

### Actions
- Save
- Save & Next Subject
- Import
- Export

### Offline capability
Display network state and pending-save indicator.
Every marks row can be queued with a client-generated idempotency key.

---

# 07 Communication / Message Audit — Web

**Frame:** 1440 × 1024  
**User:** Admin / Owner

### Composer
- Audience
- Event
- Channels
- Preview
- Send now / Schedule

### Channels
- WhatsApp primary
- SMS fallback
- Push

### Audit table
Timestamp / Recipient / Event / Primary channel / Fallback / Delivery status

### Delivery states
Queued / Sent / Delivered / Read / SMS fallback / Failed

### Settings panel
- Quiet hours: `21:00–07:00 PKT`
- Rate limit
- Fallback timeout
- Template management
- Consent/opt-out state

---

# 08 Attendance Summary — Web

### Filters
Date range / Class / Section / Student / Status

### KPI
Average attendance / Present / Absent / Leave

### Table
Class / Present % / Present / Absent / Leave

### Drill-down
Click class → section → student → attendance history.

### Export
CSV/PDF.

---

# 09 Login — Mobile

**Frame:** 390 × 844

### Content
- School OS logo
- Login / Sign up tabs
- Mobile/email
- Password
- Forgot password
- Login
- Optional Google/Microsoft SSO

### Footer
- PKR timezone
- Language selector
- Terms/privacy

---

# 10 Mobile Navigation

### Teacher
Home / Attendance / Marks / More

### Parent
Home / Attendance / Fees / Results / More

### Rule
Role-scoped navigation. A teacher must never see admin/finance modules.

---

# 11 Student Profile — Mobile

### Header
- Avatar
- Student name
- Class/section
- Roll number
- Edit action

### Tabs
Profile / Parents / Documents

### Profile data
DOB / Gender / Admission No. / Blood Group / Phone / Campus

### Actions
Call guardian / View attendance / View fees / View results.

---

# 12 Academic Session Settings — Web

### Header
Academic Session + `New Session`

### Table
Session / Start Date / End Date / Status / Actions

### Example
2026–2027 / 01 Apr 2026 / 31 Mar 2027 / Active

### Actions
Edit / Archive / Activate

### Guardrails
- Only one active session per campus.
- Historical records retain the session/version under which they were created.

---

# 13 Grading Scheme Editor — Web

### Scheme selector
Example:
`Cambridge IGCSE / O-Level v2.1`

### Template choices
Cambridge / Matric BISE Punjab / Matric BISE Sindh / IB MYP / Custom

### Grade boundary table
Grade / Min % / Max % / Grade Point / Remark / Actions

### Rule controls
- Passing grade
- Term weighting
- Core-subject requirements
- Result-card template

### Versioning
Display:
`Version 2.1 · Effective from 01 Aug 2026`

Saving a new version must not mutate historical results.

---

# 14 Student Management — Web

### Search
Name / Roll No / Admission No / Parent phone

### Filters
Campus / Class / Section / Status

### Table
Student / Roll / Class / Parent / Status / Actions

### Bulk actions
Import roster / Export / Assign section / Archive

### Onboarding target
A clerk should be able to import a real roster and configure classes in under one day without vendor staff.

---

# Required global states

Every major screen must have:
- Loading
- Empty
- Error
- Permission denied
- Offline where applicable
- Success confirmation
- Unsaved changes
- Destructive confirmation

# Responsive rules

Desktop:
- 1440 primary design target
- 1280 supported
- 1024 minimum admin layout

Mobile:
- 390 primary target
- 375 supported
- 320 minimum functional target

Do not simply scale desktop screens onto mobile. Recompose around the user's primary task.
