> **ARCHIVED 2026-09-20** — Original MVP plan (SQLite-era). Superseded by the canonical docs listed in docs/README.md. Do not treat as current documentation.

# SchoolOS Digital Platform — MVP Build Plan (v3, validated)

This supersedes `MVP-Prompt.txt` and `MVP-Plan-V1.txt` for scope, and merges the good parts of
`MVP-Plan-V2.txt` in. It is written to be handed directly to a coding agent (Claude Code /
agentic-app-builder / Cursor) as the build brief.

## Verdict on the prior drafts

- **`MVP-Prompt.txt` / `MVP-Plan-V1.txt`** — technically solid (schema, API design, RBAC, security
  checklist are all worth keeping) but specs **five separate applications** (public site, parent web
  portal, Flutter app, teacher portal, admin portal) plus a full production stack, before a single parent
  has logged in. That's a 4–6 month build wearing a "12–16 week MVP" label. Do not build this as written.
- **`MVP-Plan-V2.txt`** — right instinct: **one role-based app, not five**, fee payment pulled into the
  MVP itself (not deferred), a leave-application flow, and numeric success metrics. Its 4–6 week estimate
  is too tight once you account for a real backend + RBAC + bilingual RTL, but the *shape* is correct.
- **This document** takes V2's shape, V1's technical rigor, and adds what neither had: the actual APK
  teardown findings (current login is Email/GR-Number, app is an unpublished WebView-shell, two vendors
  today) and a data-migration step, since SchoolOS already has live student/parent/attendance/fee records —
  this is not a greenfield build.

Discovery is already done — don't re-run it. The prior report (current-system audit + market validation)
stands in for `docs/current-system-analysis.md` and `docs/current-vs-new-feature-matrix.md`. Start a
coding agent directly at "Architecture decision" below.

---

## Product objective

Every screen exists to answer one question for the parent:

> "What do I need to know about my child today?"

Tier 2/3 features (below) don't ship until that question is answered fast, in both English and Urdu,
on a mid/low-end Android phone with a weak connection.

---

## Architecture decision

**One backend. Two clients, not five.**

| Surface | What it is | Why |
|---|---|---|
| **Backend** | Node.js + TypeScript + NestJS, PostgreSQL + Prisma, versioned REST at `/api/v1` | Single source of truth — the thing that eliminates the current two-vendor drift. |
| **Parent app** | Flutter, Android first, iOS fast-follow | Parents already expect an app (that's what they have today); one codebase for both platforms. |
| **Staff console** | One Vue 3 + TS + Vite + Pinia web app, RBAC-gated views | Teacher, Admin, and Accounts are **roles inside one app**, not three separate applications. This is V2's best idea, applied to V1's stack. |
| **Public website** | Refresh in place on its own track | Keep current IA/content; not on the critical path for the parent's daily problem. Lower priority, can run in parallel with less senior effort. |
| **Parent web portal** | **Deferred to Phase 2** | Same backend/API will serve it later with no rework — just not built in week one. |

Do not start a Teacher Portal and an Admin Portal as two separate deployable frontends. Do not start the
parent web portal in parallel with the Flutter app. Both of those choices are what turned the prior drafts
into a 4–6 month build.

---

## MVP feature scope (Tier 1 — build all of this, nothing more)

### Parent app
- **Login**: Email or GR Number + password (matches the field the school's parents already use today),
  JWT access + refresh tokens, secure token storage, rate-limited/lockout on repeated failures, session
  persistence (don't force re-login on every open), logout, forgot-password via email/SMS OTP.
- **Multi-child switcher** — one parent account, `[ Child Name ▼ ]` at the top, switching updates every
  screen below. Required from day one, not deferred.
- **Home ("Today")** — child's name/grade/section/campus, today's attendance, today's timetable, today's
  diary, unread circulars/messages count, outstanding fee amount.
- **Calendar** — month view, `Today` button, prev/next month, three tabs under the selected date:
  **Timetable / Attendance / Diary**.
  - *Timetable*: period, start/end time, subject, teacher (optional), room (optional).
  - *Attendance*: today's status (Present/Absent/Late/Leave/Holiday), monthly calendar with the same
    color states, running summary (present/absent/late days, attendance %). **Immutable from the parent
    side** — only staff can write it, every write audit-logged.
  - *Diary*: per-subject entries (subject, teacher, homework text, due date, attachment/image/PDF/link),
    correct **RTL rendering for Urdu content** — do not auto-translate it.
- **Circulars** — school-wide and section-wide, title/date/category/description/attachment/priority/expiry,
  read/unread tracked server-side, push the moment one is published.
- **Messages** — real inbox (not a static list): search + filter, thread per conversation, read receipts,
  reply where permitted. Parents can message **only** Class Teacher / School Admin / Accounts /
  Principal — enforced server-side, never just hidden in the UI.
- **Fees** — current voucher (tuition/other charges/late fee/discounts/total/paid/outstanding, all
  computed server-side, never trust the client), due date, **online payment via JazzCash + EasyPaisa**
  (this was Tier-2 in the previous draft of this plan — three independent passes, including the two
  ChatGPT drafts, all converged on it as the single highest-leverage feature, so it's pulled into MVP),
  downloadable PDF voucher, payment history with receipts.
- **Leave application** — parent submits a leave request (date range + reason); admin approves/rejects;
  an approved leave reflects on the attendance calendar. Cheap to build, high trust payoff.
- **Notifications** — push (FCM) for: new circular, new message, attendance marked absent/late, new diary
  entry, fee voucher issued, payment confirmed, leave approved/rejected. Each notification deep-links to
  the right screen (e.g., attendance push → attendance detail, not just the app's home screen).
- **Offline tolerance** — cache last-loaded timetable/attendance/diary/circulars; show `Last updated: …`
  rather than a blank screen; **never show stale fee/payment data without that same timestamp** — money
  screens must never look "live" when they aren't.
- **Profile** — name/email/phone/children/campus, notification settings, change password, logout,
  privacy/terms/support.

### Staff console (one app, role-gated)
- **Teacher role**: today's classes, mark attendance (class/section/period/date → present/absent/late/
  leave), publish diary entries, view assigned timetable, view/respond to authorized parent threads.
- **Admin/Accounts role**: dashboard (total students, present/absent today, pending fees, new messages,
  unread circulars), CRUD for students/parents/guardian links/classes/sections/teachers, timetable
  management, circular authoring + delivery/read stats, fee-voucher and payment management, leave-request
  approval, basic complaint/concern tracking (submitted by parent, status open/resolved — cheap, high
  trust, worth including at this scope).

### Backend
- Every entity from the prior drafts' schema (users, roles, schools, campuses, academic_sessions,
  classes, sections, subjects, teachers, students, parent_profiles, student_parents, timetables,
  attendance, diary_entries + attachments, circulars + attachments, messages + recipients + attachments,
  notifications, fee_structures, fee_vouchers, fee_items, fee_payments, receipts, files, device_tokens) —
  that part of the original spec was already correct, keep it as-is.
- `audit_logs` table and the writes into it (login, attendance change, diary/circular publish, fee
  change, payment recorded, role change) — **ship the writes now, defer the viewer UI** to Phase 2. The
  data being captured from day one matters far more than an admin screen to browse it in week 1.
- RBAC roles, trimmed for actual current org size: `SUPER_ADMIN`, `SCHOOL_ADMIN`, `TEACHER`, `ACCOUNTS`,
  `PARENT`. (Drop `CAMPUS_ADMIN` / `CLASS_COORDINATOR` from MVP — one school admin role can cover both of
  SchoolOS' two campuses at current scale; add the finer-grained roles later if the org actually needs them.)
- Multi-campus is a **schema property from day one** (`campus_id` on student/class/section), not a UI
  toggle — SchoolOS already runs Gulistan-e-Jauhar and Gulshan-e-Iqbal today, so this can't be an afterthought
  even though there's no "switch active campus" admin feature in MVP.
- Versioned REST API (`/api/v1/...`), the endpoint list from the original draft is fine as a starting
  point (auth, `/me`, `/students/:id/{timetable,attendance,diary}`, `/circulars`, `/messages`, `/fees`,
  `/fees/:id/pdf`, `/notifications`) plus `POST /api/v1/fees/:id/pay` and `POST /api/v1/leave-requests`.
- Security: Argon2/bcrypt password hashing, JWT + refresh-token rotation, rate limiting, DTO validation,
  file MIME/size validation with randomized storage names, signed URLs for attachments, everything in
  env vars (nothing hard-coded), structured logging without secrets or PII.

### Data migration (missing from every prior draft — add explicitly)
Before Sprint 1 ends: export current students, parents, guardian links, classes/sections, and any
attendance/fee history reachable from the two existing vendor systems (web portal + the Sigmo-labeled
Android app's backend), and script the import into the new schema. This is real production data, not a
greenfield seed set — treat the export as a blocking Phase-0 task, not a stretch goal.

---

## Explicitly excluded from MVP

Merged from both prior drafts, nothing added back in:

Payroll · full accounting ERP · library · transport GPS/tracking · RFID/biometric attendance · canteen
wallet/cashless payments · AI tutor or AI-generated progress summaries · complex LMS/e-content ·
online examinations · inventory/procurement/HR · custom drag-and-drop report builder · live gradebook
(ship **static report-card PDF upload/view per term** instead) · a separate parent web portal ·
separate Teacher/Admin portal apps · campus-switching UI · WhatsApp integration (SMS/push is enough
for MVP; WhatsApp is a strong Phase-2 candidate given how Pakistani parents actually respond faster to it,
but it adds a business-API integration that isn't worth blocking launch on).

---

## Build sequence (six two-week sprints)

1. **Data migration + auth/RBAC foundation** — export/import real records; auth, roles, multi-campus
   schema.
2. **Timetable + attendance** — full vertical slice: API → staff-console marking screen → parent calendar
   view, end to end.
3. **Diary + circulars** — attachment upload, real Urdu-content RTL QA, read/unread tracking.
4. **Messages + notifications** — scoped inbox (server-enforced recipient rules), FCM wiring with
   deep links.
5. **Fees (incl. online payment) + leave applications + multi-child** — JazzCash/EasyPaisa integration,
   server-computed totals, PDF generation, leave request/approval flow, multi-child verified across every
   screen built so far.
6. **Hardening + pilot** — offline caching pass, security review (rate limits, authZ boundaries, RTL
   edge cases), app-store submission, launch to one campus/class of 20–50 parents.

---

## Acceptance criteria

- Parent logs in with Email/GR Number + password; only sees their own authorized children; switches
  between them with every screen updating.
- Calendar shows correct timetable/attendance/diary for the selected date; Urdu content renders RTL
  correctly, untranslated.
- Circulars open, attachments download, read state is tracked.
- Messages are scoped to authorized recipients only, searchable/filterable, replies work where permitted.
- Fee voucher is correct (server-computed), downloadable as PDF, payable in-app via JazzCash/EasyPaisa,
  payment history and receipts are visible.
- Leave requests can be submitted, approved/rejected, and reflect on the attendance calendar.
- Push notifications arrive and deep-link to the correct screen.
- Teacher can mark attendance and publish diary from the staff console; Admin can publish circulars and
  manage students/parents/teachers/classes/timetable/fees; every sensitive action is server-authorized
  and audit-logged.
- No secrets committed; production build succeeds; app is submitted to Play Store (and App Store once
  iOS is ready) under the school's own developer account — not sideloaded.

## Success metrics (measure after pilot, not before)

- ≥70% parent login rate within 2 weeks of rollout to a pilot class.
- ≥50% of that month's fees paid in-app (vs. manual/bank) within the first term.
- ≥40% push-notification open rate.
- Support tickets trend down week-over-week after week 2 of each grade's rollout.
