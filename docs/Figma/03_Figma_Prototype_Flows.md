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
