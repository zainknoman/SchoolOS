# Parent Journey (Parent App)

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `parent-app/lib/src/screens/`, `me/`, `leave/`, `fees/`, e2e `me`, `leave`, `fees`, `messages-notifications` · **Owner:** Product Owner
> **Decided, not yet implemented (owner, 2026-09-20):** one parent account across schools (BL-23); parent-app-compatible password reset (BL-35); parents raise complaints (BL-30); Google Play first (BL-43). Steps below describe current behaviour.

Parents have no self-registration: an administrator (or admission approval / bulk import) creates the parent login. The first login may force a password change (`mustChangePassword`).

| Stage | Screen | What the parent can do | Backend |
|---|---|---|---|
| Sign in | `login_screen`, `forgot_password_screen`, `reset_password_screen` | Email or GR-number identifier + password; reset by email (needs SMTP) | F-AUTH-01/02 |
| Home | `home_tab`, `parent_header` | Switch between linked children (`/me/children`); summary cards | F-ME-01 |
| Calendar | `calendar_tab` | Attendance, diary and timetable for the chosen child/month; holidays | F-ATT-01, F-DIA-01, F-TT-01, F-ORG-07 |
| Circulars | `circulars_tab` | Read notices; marks read | F-COM-01 |
| Fees | `fees_tab`, `voucher_detail_screen`, `stub_checkout_screen` | View vouchers, download PDF, pay online, see receipts | F-FEE-02/03 |
| Messages | `messages_tab` | Start conversation with class teacher / school admin / accounts; reply | F-COM-02 |
| Notifications | `notifications_sheet` | In-app list; push if FCM configured; channel/digest preferences | F-COM-03/04 |
| More | `more_tab` → `leave_screen`, `complaints_screen`, `report_cards_screen`, `student_info_screen` | Apply for leave; **view** complaints; view report cards; view/limited-edit child info | F-LV-01, F-CMP-01, F-RC-01, F-ME-01 |
| Offline | `cache/` | Last successful timetable/attendance/diary/circulars shown with a "Last updated" banner when a refresh fails | F-OFF-01 |
| Language/theme | `locale_controller`, `theme_controller`, `accent_controller` | English/Urdu (RTL), light/dark, accent | F-UX-01 |

Access limits: a parent sees only children linked through `StudentParent`, including after withdrawal/graduation (BR-SCOPE-02). Push notifications require a Firebase project (none is wired — CONFIGURATION REQUIRED). Structured grades are shown inside the report-cards screen as a secondary data source (a failure loading them never blocks the PDF; the screen's own comment notes it can return an empty list until a term picker exists — verify in Phase 11). Not available: self-registration, raising complaints.
