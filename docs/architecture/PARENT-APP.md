# Parent App Architecture

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `parent-app/lib/**`, `pubspec.yaml` · **Owner:** project owner

**Stack:** Flutter (Dart `^3.13`), `provider` (`ChangeNotifierProvider<AuthState>`, plain `Provider` for services), `go_router`, `http`, `flutter_secure_storage`, `shared_preferences`, `firebase_core` + `firebase_messaging`, `google_fonts`, `flutter_localizations`/`intl`.

| Concern | Location | Notes |
|---|---|---|
| Composition | `lib/main.dart` | builds `ApiClient`, `AuthState`, `DeviceTokenRegistrar`; `API_BASE_URL` via `--dart-define` (default `http://localhost:3000`) |
| API | `src/api/api_client.dart`, `refreshing_http_client.dart`, `models.dart` | token refresh wrapper |
| Auth | `src/auth/auth_state.dart`, `token_store.dart` | tokens kept in **secure storage** (`flutter_secure_storage`) |
| Navigation | `src/router/app_router.dart` | auth-gated routes; bottom-nav shell (`home_shell.dart`) |
| Screens | `src/screens/*` | home, calendar, circulars, fees/voucher/checkout, messages, more, notifications, leave, complaints, report cards, student info, auth flows |
| Offline | `src/cache/` | `DataCache` + `loadWithCache`; per-student/month keys; "Last updated" banner |
| Push | `src/notifications/` | token provider + registrar (`POST /me/device-tokens`); no real Firebase project is wired (`firebase_options.dart`) |
| Theme / l10n | `src/theme/`, `lib/l10n/` | English and Urdu, RTL, theme mode, accent |
