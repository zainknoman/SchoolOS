> **ARCHIVED 2026-09-20** — Original MVP plan (SQLite-era). Superseded by the canonical docs listed in docs/README.md. Do not treat as current documentation.

# Current System Analysis — The SchoolOS School

Findings from a direct teardown of the distributed `schoolos-android.apk`, a live browse of
`https://www.schoolos.edu.pk/`, and `SchoolOS/apk/SchoolDetails.txt` (the school's own screen-by-screen
description of its current parent portal). This stands in for discovery — do not re-run it.

## Existing screens / features (source of truth: `SchoolOS/apk/SchoolDetails.txt`)

1. **Login** — Email or GR Number + password.
2. **Dashboard** — month calendar; tapping a date reveals that day's Time Table, Attendance, or Class
   Diary below the calendar (three buttons, one selected at a time).
3. **Circulars** — School Circular and Section Circular, each a list of Title | Created At | Action.
4. **Messages** — search by Section/Subject (textbox) + Filter button. No compose/reply described in the
   school's own spec — read-only as far as documented.
5. **Diaries** — the exact same calendar as the Dashboard, as a separate nav item (duplicate path to the
   same data — an information-architecture bug, not a distinct feature).
6. **Fees** — fee vouchers (view only).

Diary content is already bilingual day-to-day: English entries alongside Urdu (RTL) entries in the same
list (e.g. اسلامیات, اردو, اردو حفظ subjects) — RTL correctness is a real, current requirement, not a
hypothetical one.

## Website (`schoolos.edu.pk`)

- Public marketing site (Montessori → Secondary, Hifz-e-Qur'an, British curriculum) + a login portal on
  the same domain.
- Footer credits a build agency ("salshasoft") — a **different vendor** from the one behind the Android
  app.
- Nav includes "Gulshan Campus" — the school operates (at least) two campuses today, not hypothetically
  in the future.
- A "Go to dashboard" control renders on the public homepage even logged out — the dashboard view
  appears to be client-mounted regardless of auth state, just visually hidden. Worth a quick
  access-control check when the real backend is stood up.

## Android app teardown (`com.sigmolabs.schoolos`)

- **Not listed on the Play Store** (404 on the Play Store listing URL) — distributed as a raw sideloaded
  APK. No auto-updates, no crash visibility for the school, and it trains parents to install unsigned
  APKs from links.
- Kotlin + Jetpack Compose (Material 3) shell wrapping a `WebView` with a `JavaScriptBridge` class — i.e.
  a thin native wrapper around web content, not a fully native app. No hardcoded backend base URL was
  found in the decompiled strings — likely resolved dynamically.
- Firebase Cloud Messaging, Analytics, Remote Config, and Installations are all wired in — push
  infrastructure exists, but whether circulars actually arrive as push (vs. requiring a manual refresh)
  was not verifiable from the teardown alone; verify this explicitly during the notifications build.
- Package name (`com.sigmolabs.schoolos`) traces to a vendor distinct from the website's agency — i.e. two
  separate vendors run the web portal and the mobile app today, with no confirmed shared backend.

## Retain / redesign / remove

| Existing feature | Verdict | Why |
|---|---|---|
| Calendar → Timetable/Attendance/Diary tabs | **Retain the pattern** | Matches how competitor apps structure this; keep the UX, rebuild the data layer. |
| Bilingual EN/Urdu diary content | **Retain, make first-class** | Already real usage today — needs correct RTL layout, not a bolted-on translation layer. |
| Duplicate "Diaries" nav item | **Remove** | Same calendar as Dashboard; fold into one screen. |
| Fee vouchers (view-only) | **Redesign** | Keep the voucher view/PDF, add in-app payment (JazzCash/EasyPaisa) and payment history — the single highest-leverage gap vs. every competitor reviewed. |
| Messages (search + filter, no compose) | **Redesign** | Turn into a real scoped inbox: Parent → Class Teacher / Admin / Accounts / Principal only, server-enforced. |
| Two-vendor web + app split | **Remove** | Consolidate onto one backend/API; this is the root cause of the duplicate-nav bug and any current data-consistency risk. |
| Sideloaded, unpublished app | **Fix** | Publish properly to Play Store (and App Store) under the school's own developer account. |

## Missing from the existing system (confirmed gaps, not assumptions)

- No in-app fee payment (voucher view only).
- No multi-child switcher documented.
- No push-notification confirmation loop (wired but unverified).
- No leave-application workflow.
- No structured timetable fields beyond subject name (no period/time/teacher/room in the documented spec).

## Assumptions to verify during build (do not invent answers to these)

- Whether the current backend behind the website portal exposes any reusable API — not found in the APK
  teardown; assume no and build fresh unless the school's IT contact says otherwise.
- Exact current fee-voucher line items and JazzCash/EasyPaisa merchant account availability.
- Whether "Section Circular" scoping is by class, section, or grade — SchoolDetails.txt doesn't specify;
  confirm with the school before building the authorization rule.
