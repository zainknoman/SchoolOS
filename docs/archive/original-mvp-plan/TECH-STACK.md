> **ARCHIVED 2026-09-20** — Original MVP plan (SQLite-era). Superseded by the canonical docs listed in docs/README.md. Do not treat as current documentation.

# TECH STACK

This is a monorepo of three sub-projects sharing one repo (`build/`), one PRD, and one Prisma schema
(SQLite locally for now, Postgres before deploy).

## backend/  (target: web/API)
Language/runtime: TypeScript / Node 20
Framework:        NestJS
Database:         SQLite for local dev/tests (via Prisma ORM) — no Postgres/Docker on this machine yet.
                  Prisma's `datasource` provider switches to `postgresql` before any staging/production
                  deploy; schema is written provider-agnostic where Prisma allows (avoid SQLite-only
                  types). Tracked as a pre-deploy task, not forgotten.
Test framework:   Jest
Package manager:  npm
Target:           API
Constraints:      versioned REST at /api/v1; DTO validation on every endpoint; no financial math on
                  the client — always server-computed.

### Commands (the loop runs these verbatim, cwd = build/backend/)
install:     npm install
test (unit): npm test
test (file): npm test -- {path}
integration: npm run test:e2e
run:         npm run start:dev
lint:        npm run lint
lint:fix:    npm run lint:fix

## staff-console/  (target: web)
Language/runtime: TypeScript
Framework:        Vue 3 + Vite + Vue Router + Pinia
Test framework:   Vitest
Package manager:  npm
Target:           web
Constraints:      one app, RBAC-gated routes/nav for Teacher vs Admin/Accounts — not two deployable apps.

### Commands (cwd = build/staff-console/)
install:     npm install
test (unit): npm test
test (file): npm test -- {path}
run:         npm run dev
lint:        npm run lint
lint:fix:    npm run lint:fix
note:        vitest.config.ts sets pool:"threads", fileParallelism:false — this environment's worker
              pool otherwise times out (observed on this Windows/git-bash sandbox); do not "fix" this
              back to defaults without re-testing.

## parent-app/  (target: mobile-flutter) — DEFERRED this run, no Flutter SDK on this machine
This sub-project is not scaffolded in this run (FEAT-005 deferred). Spec kept here so it's ready the
moment the SDK is available — run `flutter --version` to confirm, then resume at FEAT-005.
Language/runtime: Dart / Flutter (stable channel)
Framework:        Flutter, go_router
Test framework:   flutter test (+ golden tests)
Package manager:  pub (flutter pub get)
Target:           mobile-flutter, Android first, iOS fast-follow
Constraints:      secure token storage (Keystore-backed), correct Urdu RTL rendering, offline-tolerant
                  caching for timetable/attendance/diary/circulars, designed for mid/low-end Android.

### Commands (cwd = build/parent-app/)
install:     flutter pub get
test (unit): flutter test
lint:        flutter analyze
run:         flutter run -d web-server --web-port {port}   (T0 smoke; native run via `flutter run`)

## Shared
Notifications:  Firebase Cloud Messaging (wired in FEAT-011, not this run)
File storage:   S3-compatible object storage (wired when FEAT-008/009/012 land)
Deployment:     Docker, staging + production environments (dev added later if the team grows)
Auth:           JWT access + refresh, shared by both clients against the one NestJS backend

## Run scoping note
This run builds FEAT-001 through FEAT-004 only (data model, auth/RBAC, multi-campus/multi-child, and
the staff-console shell). FEAT-005 (Flutter parent app) is deferred — no Flutter SDK on this machine.
FEAT-006 onward are fully specified in FEATURES.txt for planning but their impl tasks are left `queued`
— see ARCHITECTURE.md §Run scoping for why.
