# Staff Console Architecture

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `staff-console/src/**`, `staff-console/package.json`, `DESIGN.md` · **Owner:** Engineering Lead

**Stack:** Vue 3.5 (Composition API, TypeScript), Vite, Pinia, Vue Router 5, vue-i18n, Vitest + `@vue/test-utils`, axe-core (runs on every spec — see [ACCESSIBILITY-AUDIT](../release/ACCESSIBILITY-AUDIT.md)).

| Layer | Location | Notes |
|---|---|---|
| Entry | `src/main.ts`, `App.vue` | installs Pinia, router, i18n and the fetch interceptor |
| Routing / guards | `src/router/index.ts` | `meta.requiresRole`, `requiresPrincipal`, title/group for nav; routes under `/teacher`, `/admin`, `/principal`; login/forgot/reset are public |
| Session | `src/stores/auth.ts` | Pinia store; access token **in memory only**; the refresh token is an HttpOnly cookie the console never sees (BL-36 option B). `restoreSession()` runs before the router starts; refreshes are single-flight per tab and serialised across tabs with a Web Lock. `localStorage` holds only the non-secret `schoolos.hasSession` hint |
| API client | `src/lib/api.ts` | one file of typed `fetch` wrappers; base URL `VITE_API_BASE_URL` (default `http://localhost:3000`) |
| 401 handling | `src/lib/fetchInterceptor.ts` | wraps global `fetch`; on a 401 from the own API it refreshes once and retries |
| Shell | `components/AppShell.vue`, `CommandPalette.vue` | role-based nav (items absent from the DOM per role), command palette |
| UI kit | `components/*` | `EntityTable`, `FormField`, `AppModal`, `ConfirmDialog`, `StatusPill`, `EmptyState`, `ErrorRetry`, toasts |
| Views | `src/views/*View.vue` (+ `*PageView.vue` wrappers) | one feature view per screen |
| i18n | `src/locales/{en,ur}.json`, `lib/i18n.ts`, `lib/textDirection.ts` | English and Urdu with RTL |
| Theming | `assets/base.css`, `lib/theme.ts` | tokens per `DESIGN.md` / `design-system/.../MASTER.md` |

Client-side role guards only shape the UI; the backend is the authority. There is no client data-cache layer beyond component state.
