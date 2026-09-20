# Academic Operations (Session, Timetable, Attendance, Diary, Assessment, Report Cards, Communication)

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `academic-session/`, `timetable/`, `attendance/`, `diary/`, `gradebook/`, `report-cards/`, `circulars/`, `messages/`, `notifications/`, `leave/`, `complaints/`; e2e `org-structure`, `timetable-attendance`, `diary-circulars`, `gradebook`, `holidays-complaints-report-cards`, `messages-notifications`, `leave` · **Owner:** project owner

## 1. Academic session lifecycle
1. **Create** (SUPER_ADMIN, `POST /academic-sessions`, label + dates + `isActive`). Activating one **deactivates all other active sessions platform-wide** (BR-ORG-01, Q1).
2. **Copy structure** (`POST /academic-sessions/:id/copy-structure`, source ≠ target): copies classes and sections per campus, idempotently, without class teachers (BR-ORG-05). Class teachers and timetables must be set again.
3. **Run the year** (below). 4. **Promote** students into the new session ([STUDENT-LIFECYCLE](STUDENT-LIFECYCLE.md) §D). 5. Session deactivation/deletion: `PATCH`/`DELETE /academic-sessions/:id` (delete blocked while referenced — BR-SCOPE-04). No automatic rollover.

## 2. Timetable
Admin builds a section's weekly timetable (single entry CRUD or `PUT /sections/:id/timetable` bulk replace); teacher/room double-booking is rejected (BR-TT-01). Teachers see their own (`/teachers/me/timetable`); parents see the child's (`/students/:id/timetable`).

## 3. Attendance
Teacher (own sections) or admin marks single or bulk records: PRESENT/ABSENT/LATE/LEAVE/HOLIDAY. Blocked on declared holidays and when the section has no class teacher (BR-ATT-01..03). Parents read per child/month. A nightly job flags high absence (BR-ATT-04, Q8) and dashboards surface flags.

## 4. Diary / homework
Teacher or admin posts entries by section/subject (`POST /diary`, optional AI draft via `/diary/draft-suggestion` — stub unless configured). Parents read per child; accounts staff can read section diaries.

## 5. Assessment
Setup (admin): terms for a session → assessment categories per class/term with weight % (warning if ≠ 100, BR-GRD-03). Delivery (teacher): create assessments (max marks) and enter marks for actively enrolled students (BR-GRD-02). Output: weighted final % per subject via `GET /students/:id/grades` (BR-GRD-01). No letter grades.

## 6. Report cards
Teacher/admin creates one report-card record per student per session with a document (`POST /report-cards`, BR-RC-01, Q6); parents view/download PDF. It is **not** produced from the gradebook.

## 7. Communication
- **Circulars:** admin publishes to school/sections; parents mark read; admin sees read stats.
- **Messages:** parent starts a conversation with class teacher/school admin/accounts; staff reply.
- **Notifications:** created by events; delivered in-app and, if configured, by push/SMS/WhatsApp/email or a daily digest (user preference). External channels: CONFIGURATION/EXTERNAL SERVICE REQUIRED.

## 8. Leave and complaints
Parent files a leave request for a child (`POST /leave-requests`); admin approves/rejects once, and approval requires the section to have a class teacher (BR-LV-01/02). Complaints are logged and updated by staff; parents can only read them.

## 9. Holidays
Admin defines school-wide or campus-specific holidays; they block attendance marking and appear on parents' calendar.
