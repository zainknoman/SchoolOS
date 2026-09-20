> **ARCHIVED 2026-09-20** — Aug-2026 Figma handoff, predates the SchoolOS redesign. Current design source: DESIGN.md. Do not treat as current documentation.

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
