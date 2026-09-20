> **ARCHIVED 2026-09-20** — Aug-2026 Figma handoff, predates the SchoolOS redesign. Current design source: DESIGN.md. Do not treat as current documentation.

# School OS — Figma Documentation Package

**Revision:** Internal Rev 1.0 · Aug 2026  
**Scope:** Tier A MVP  
**Platform:** Pakistan-first, mobile-first School Operating System

This package converts the provided School OS build specification and generated low-fidelity wireframes into a Figma-ready documentation structure.

## Files

- `01_Figma_Design_System.md` — foundations, tokens, components, naming and accessibility.
- `02_Figma_Screen_Specification.md` — screen-by-screen layout, content, states and responsive rules.
- `03_Figma_Prototype_Flows.md` — prototype nodes, interactions, offline behavior and acceptance criteria.
- `04_Figma_Tokens.json` — machine-readable design tokens.

## Recommended Figma build order

1. Create the pages listed in the design-system document.
2. Create Color/Typography/Spacing/Radius/Elevation variables.
3. Build primitive components first.
4. Build composite components such as KPI cards, attendance rows, payment exceptions and audit badges.
5. Build desktop shells.
6. Build mobile shells and bottom navigation.
7. Recreate the 14 screen specifications.
8. Add loading/error/empty/offline/success states.
9. Connect the six prototype flows.
10. Run a usability review against the Tier A metrics.

## Important product rule

The UI should optimize for task completion rather than module breadth.

The most important demonstration is:
**Teacher opens attendance → marks a 40-student class → submits in under 30 seconds.**

The second critical demonstration is:
**Payment arrives → automatically matched → exception only when necessary → owner resolves it from a single queue.**

The third is:
**Student absent → WhatsApp primary → SMS fallback → auditable delivery status.**

## Wireframe fidelity

The supplied generated image is treated as the low-fidelity structural reference. Final Figma components should preserve its information hierarchy while applying the production design tokens in the design-system document.


---

# School OS — Figma Design System
**Build Spec:** Internal Rev 1.0 · Aug 2026  
**Product:** Pakistan-first, mobile-first School Operating System  
**Figma purpose:** Production UI foundation for Tier A MVP

## 1. Figma file structure

Create these Figma pages:

1. `00 Cover`
2. `01 Foundations`
3. `02 Components`
4. `03 Patterns`
5. `04 Owner Web`
6. `05 Teacher Mobile`
7. `06 Parent Mobile`
8. `07 Fees & Payments`
9. `08 Exams & Academics`
10. `09 Communication`
11. `10 Reports`
12. `11 Settings`
13. `12 Prototype Flows`
14. `99 Archive`

Use sections inside each page for related screens and states.

## 2. Foundations

### Desktop
- Base frame: 1440 × 1024
- Grid: 12 columns
- Margins: 80 px
- Gutter: 24 px
- Desktop shell header: 64 px
- Sidebar: 240 px where used
- Content spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48 px

### Mobile
- Base frame: 390 × 844
- Horizontal padding: 16 px
- Content width: 358 px
- Bottom navigation: 72–80 px
- Minimum interactive target: 48 × 48 px
- Use Auto Layout vertically for primary screen stacks.

### Typography
Primary: Inter
RTL/localisation: Noto Sans Arabic

- H1: 24 / 32, Bold
- H2: 18 / 24, SemiBold
- H3: 16 / 24, SemiBold
- Subhead: 14 / 20, Medium
- Body: 14 / 20, Regular
- Caption: 12 / 16, Regular
- Numeric KPI: 28 / 34, Bold

Create text styles:
`Type/H1`, `Type/H2`, `Type/H3`, `Type/Subhead`, `Type/Body`, `Type/Caption`, `Type/KPI`.

### Color variables

Brand:
- `color/brand/900` = #064E3B
- `color/brand/500` = #10B981

Neutral:
- `color/bg` = #F8FAFC
- `color/surface` = #FFFFFF
- `color/border` = #E2E8F0
- `color/text/900` = #0F172A
- `color/text/600` = #475569
- `color/text/400` = #94A3B8

Semantic:
- `color/success` = #16A34A
- `color/error` = #DC2626
- `color/warning` = #D97706
- `color/info` = #2563EB

Payment rails:
- `color/rail/jazzcash` = #CB040A
- `color/rail/easypaisa` = #00A859
- `color/rail/1link` = #00529B

Do not encode business logic in color alone. Every status must also have a text/icon label.

### Radius
- `radius/sm` = 6
- `radius/md` = 10
- `radius/lg` = 14
- `radius/xl` = 18
- `radius/pill` = 999

### Shadows
Use subtle elevation only:
- `shadow/card`: low elevation
- `shadow/popover`: medium elevation
- `shadow/modal`: high elevation

## 3. Component library

Create components with variants and properties.

### App Shell
`Shell/Web`
- Header
- Sidebar
- Campus selector
- Academic session selector
- User menu

`Shell/Mobile`
- Top bar
- Optional network status
- Bottom navigation

### Stat Tile Card
Variants:
- Standard
- Alert
- Interactive
- Loading
Properties:
- `label`
- `value`
- `unit`
- `supportingText`
- `icon`
- `clickable`

### Attendance Toggle Row
Variants:
- Present
- Absent
- Late
- Excused
- Disabled
Properties:
- Student avatar
- Roll number
- Student name
- status
- optional reason

Interaction:
- Minimum 48 px touch target
- One tap changes status
- Secondary detail only appears after Absent/Late.

### Status Badge
Variants:
- Present
- Absent
- Late
- Paid
- Unpaid
- Queued
- Delivered
- Read
- Failed
- Unreconciled

### Network Status Banner
Variants:
- Online
- Syncing
- Offline
- Queue active
Properties:
- connection state
- pending count
- sync action

### Payment Exception Card
Variants:
- Unmatched
- Underpaid
- Overpaid
- Duplicate
Properties:
- rail
- transaction ID
- amount
- challan
- student
- exception reason
- resolution action

### Message Audit Badge
Variants:
- WhatsApp queued
- WhatsApp delivered
- WhatsApp read
- SMS fallback
- Push delivered
- Failed

### Data Table
Properties:
- column configuration
- row density
- selection
- pagination
- empty state
- loading state

### Form Controls
Create:
- Text input
- Number input
- Search input
- Select
- Multi-select
- Date picker
- Time picker
- Radio
- Checkbox
- Toggle
- Segmented control
- File/import control

### Buttons
Variants:
- Primary
- Secondary
- Tertiary
- Destructive
- Icon
- Loading
- Disabled

Sizes:
- Small
- Medium
- Large
- Mobile full-width

## 4. Accessibility and interaction rules

- All primary actions must have visible labels.
- Never rely on color alone for status.
- Touch targets are at least 48 × 48 px.
- Keyboard focus states are required for web.
- Error states include concise corrective text.
- Destructive actions require confirmation.
- Loading states use skeletons/spinners without shifting layout.
- Empty states explain the next action.
- Mobile screens must remain usable at 320 px width.
- Urdu/RTL must be possible without changing the component architecture.

## 5. Naming convention

Use:
`Category / Component / Variant`

Examples:
- `Button / Primary / Default`
- `Button / Primary / Loading`
- `Attendance / Student Row / Present`
- `Attendance / Student Row / Absent`
- `Payment / Exception Card / Underpaid`
- `Communication / Audit Badge / SMS Fallback`

## 6. Figma variables

Create collections:
- `Color`
- `Typography`
- `Spacing`
- `Radius`
- `Elevation`
- `Breakpoint`

Use semantic aliases rather than hard-coded values inside components.


---

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


---

# School OS — Figma Prototype & Interaction Specification

## Prototype principles

The prototype should demonstrate the product moat, not every CRUD operation.

Priority flows:
1. Teacher attendance in <30 seconds
2. Offline attendance/marks queue and reconciliation
3. Parent three-question home
4. Payment exception resolution
5. Absence → WhatsApp → SMS fallback → audited delivery
6. Configurable grading scheme with immutable historical versions

## Flow A — Teacher Attendance

### Nodes
`Teacher Home`
→ `Attendance`
→ `Select Class/Subject`
→ `Mark Attendance`
→ `Submit`
→ `Success`

### Interactions
- Tap Attendance: Smart Animate / 200 ms
- Default all present: immediate state change
- Tap student: status changes
- Tap Absent: reason drawer
- Submit: success overlay

### Offline branch
`Mark Attendance`
→ connection lost
→ `Offline Banner`
→ `Submit`
→ `Offline Queue`
→ reconnect
→ `Syncing`
→ `Synced`

### Failure branch
If server rejects item:
`Sync Error`
→ item detail
→ Retry

No silent data loss.

## Flow B — Owner → Payment Exception

`Owner Dashboard`
→ click `Outstanding` or `Unreconciled Payments`
→ `Fee Reconciliation Queue`
→ click transaction
→ `Resolution Drawer`
→ select resolution
→ `Confirm`
→ success
→ queue row removed
→ KPI updated

## Flow C — Absence Notification

`Teacher Mark Attendance`
→ Submit absent event
→ `Notification Service`
→ WhatsApp
→ Delivered/Read

Fallback:
WhatsApp timeout
→ SMS
→ Carrier acknowledgement
→ final audit status

The Figma prototype should visually show:
- event timestamp
- channel attempted
- fallback reason
- final delivery result

## Flow D — Parent

`Login`
→ `Parent Home`
→ child selector
→ Attendance / Fees / Results

From Home:
- Attendance card → attendance history
- Fee card → invoice/receipt
- Result card → report card

## Flow E — Grading Scheme

`Settings`
→ `Grading Schemes`
→ select scheme
→ edit boundary
→ preview result
→ save new version
→ confirmation

Historical record banner:
`Existing results remain unchanged.`

## Flow F — Offline Marks

`Marks Entry`
→ enter marks
→ offline
→ save
→ queue item
→ reconnect
→ sync
→ conflict result

## Figma prototype setup

Use named prototype variables:
- `networkState`: online / offline / syncing
- `attendanceStatus`: present / absent / late
- `syncState`: pending / synced / conflict / failed
- `messageStatus`: queued / delivered / read / fallback / failed
- `paymentException`: unmatched / underpaid / overpaid / duplicate
- `role`: owner / admin / teacher / parent
- `language`: English / Urdu

## Prototype transition guidance

- Standard navigation: Instant or Smart Animate, 150–250 ms.
- Bottom-sheet/drawer: 200–300 ms.
- Toast: 2–4 seconds.
- Avoid decorative animation.
- Attendance interactions must feel instantaneous.
- Do not simulate a 30-second wait; the prototype should demonstrate the intended rapid interaction.

## Acceptance checklist

### Attendance
- [ ] Teacher reaches class attendance in three taps or fewer.
- [ ] Default-all-present is obvious.
- [ ] Student status can be changed with one tap.
- [ ] Absent/Late details do not slow the common path.
- [ ] Offline state is obvious.
- [ ] Queue status is inspectable.

### Fees
- [ ] Exception rate is visible.
- [ ] Every exception exposes a reason.
- [ ] Resolution action is explicit.
- [ ] Successful reconciliation updates summary state.

### Communication
- [ ] WhatsApp is visually primary.
- [ ] SMS fallback is visible.
- [ ] Delivery state is auditable per recipient.

### Parent
- [ ] Attendance, fee status and result are visible without deep navigation.
- [ ] Child switching is obvious.
- [ ] Receipts/report cards are accessible.

### Academics
- [ ] Grading scheme is configurable.
- [ ] Versioning is visible.
- [ ] Historical records are protected.

### Architecture-visible UI
- [ ] Tenant/campus context is always visible in web admin.
- [ ] Role-scoped navigation is enforced visually.
- [ ] Offline workflows expose sync state.
