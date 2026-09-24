# Testing Strategy and Current Results

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` — **suites were executed on this date** (commands and results below; figures come from the run, not from older documents) · **Owner:** Engineering Lead
> Passing tests are evidence of behaviour under the test setup, **not proof of production readiness** (no live integration, load, security or migration-from-data tests exist).

## Test layers (as implemented)
| Layer | Tooling | Location | What it proves | Database |
|---|---|---|---|---|
| Backend unit/service | Jest + `@nestjs/testing`, **mocked `PrismaService`** | `backend/src/**/*.spec.ts` (78 files) | logic branches, adapters with fake senders, guards, config resolvers | none |
| Backend e2e | Jest + Supertest, real Nest app | `backend/test/*.e2e-spec.ts` (22 files) | HTTP contracts, authz, tenant boundaries, rate limit, CORS, business flows against real PostgreSQL | PostgreSQL (`DATABASE_URL`) |
| Staff console | Vitest + `@vue/test-utils` (jsdom), axe-core | `staff-console/src/**/*.spec.ts` (73 files) | component/view/store/router behaviour, accessibility checks | none (API mocked) |
| Parent app | `flutter test` | `parent-app/test/**` (29 files) | screens, auth, cache, API client, notifications | none |
| Static | `eslint`, `vue-tsc`, `flutter analyze`, `nest build` | — | style/type correctness | — |

Not present: contract tests against a schema, browser end-to-end tests of the staff console, mobile integration tests, load/performance, security (DAST/fuzz), migration tests, production smoke tests, live-integration tests. (A `.playwright-mcp/` tool folder exists outside the repo tree; no Playwright suite is committed.)

## Results of the 2026-09-20 run (`main@15362b7`, Windows 11, Node 24.18)
| Suite | Command | Result |
|---|---|---|
| Backend unit | `cd backend && npx jest --silent` | **78 suites, 579 tests passed** (57 s) |
| Backend e2e | `npx jest --config test/jest-e2e.json --runInBand` against a **fresh empty PostgreSQL database** (all 13 migrations applied with `prisma migrate deploy`; database dropped afterwards; the development database was not used) | **22 suites, 196 tests passed** (52 s) |
| Staff console | `cd staff-console && npx vitest run` | 72 files, **468 tests passed**; 1 worker-start timeout on `AppShell.spec.ts` when run in parallel with the other suites (exit 1). Re-run alone: `src/components/AppShell.spec.ts` **44 tests passed**. Combined: 73 files, 512 tests |
| Parent app | `cd parent-app && flutter test` | **100 tests passed** |
| Flutter static | `flutter analyze` | **No issues found** |
| Staff console types | `npm run type-check` | passed |
| Staff console lint | `npm run lint` | passed |
| Backend lint | `npx eslint "{src,test}/**/*.ts"` | **2,034 problems (2,014 errors, 20 warnings)**, 1,965 of them `prettier/prettier` formatting (CRLF/format backlog), rest mostly `no-unsafe-*`; **non-blocking in CI** (`continue-on-error`). The CI comment cites "~672" — the backlog has grown |
| Backend build / staff-console build | not run in this pass | — |

**Caveats:** e2e ran serially against a scratch database (CI runs them against a `postgres:16` service, not serially-verified here); the Windows timeout in the console run is environmental (three suites ran concurrently). Timings are single runs.

## Gaps (recorded for readiness)
| Gap | Detail |
|---|---|
| No coverage measurement | `jest --coverage` exists (`test:cov`) but no threshold or report is enforced or published |
| Prisma mocked in unit tests | unit specs cannot catch constraint/relation errors; only e2e can |
| No e2e for: staff, hiring, files/uploads, attendance-risk cron, digest job, AI drafting, live gateways/FCM/SMTP/SMS/WhatsApp | see [TEST-MATRIX](TEST-MATRIX.md) |
| No tests for known defects | TENANT-1..5, KG-2/3/4/23 have no failing/regression test |
| No migration tests | only "applies to an empty DB" (implicitly via e2e setup) |
| No production smoke suite | see [RELEASE-VALIDATION](RELEASE-VALIDATION.md) |
| Client/backend contract drift | hand-maintained types (API-4) |
| CI does not run staff-console type-check separately | `npm run build` runs `vue-tsc` (via `run-p type-check`) |

## Conventions
E2E specs boot the real `AppModule`, create their own data and clean it up; there is no shared fixture database. Unit specs colocate with the file under test. Design-system a11y checks use `axe-core` in component specs.

**Failing-first tests (BL-18).** `backend/test/pending/` holds e2e tests that state the *target* behaviour of an unimplemented backlog item. They are registered with `pending(...)` (= Jest `it.failing`), so CI passes while the defect exists and **fails as soon as the behaviour is fixed**; the implementer then moves the test into the regular suite as a plain `it`. `E2E_PENDING_STRICT=1 npm run test:e2e -- test/pending` runs them as ordinary tests to show each documented failure reason. Verified 2026-09-24: all 7 fail for their documented reason in strict mode; full e2e 23 suites / 203 tests pass in normal mode (scratch database).
