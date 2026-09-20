# SchoolOS Parent App

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Owner:** project owner

Flutter app for parents: children switcher, calendar (attendance/diary/timetable), circulars, fees and voucher payment, messages, notifications, leave, complaints, report cards. English and Urdu. Project overview: [`../README.md`](../README.md).

## Run

```bash
flutter pub get
flutter run -d chrome
```

API base URL: `--dart-define=API_BASE_URL=http://10.0.2.2:3000` (Android emulator); default `http://localhost:3000` (`lib/main.dart`). Sign in with a seeded parent account (see the root README).

## Checks

```bash
flutter analyze
flutter test
```

CI uses Flutter 3.47.1 (`.github/workflows/ci.yml`).

## Layout

`lib/src/api/` HTTP client with token refresh · `auth/` session state, secure token store · `screens/` UI · `cache/` last-response offline cache · `notifications/` FCM token registration · `theme/` theme, accent, locale · `router/` `go_router` · `lib/l10n/` ARB strings. Firebase is configured through `lib/firebase_options.dart` (no real Firebase project is wired yet — push is CONFIGURATION REQUIRED).
