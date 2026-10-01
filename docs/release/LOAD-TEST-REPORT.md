# Load and Performance Test Report (BL-15)

> **Status:** CURRENT — **interim: local runs pass; the staging run that closes BL-15 is still to do** · **Measured:** 2026-09-28 (baseline) and 2026-10-01 (final) against `wave-0/foundations` · **Sources:** `backend/load-test/run.mjs`, `backend/src/cli/load-data.ts`, `backend/load-test/results/*.json` · **Owner:** Engineering Lead (Technical Owner)

Targets (Q44, [NFR-PERF-01](../product/requirements/NON-FUNCTIONAL-REQUIREMENTS.md)): **CRUD p95 < 500 ms**, **auth p95 < 1 s**, **100 concurrent active users**, error rate < 1 %, and a plan for **99.5 % monthly availability** (NFR-AVL-01). BL-15 asks for a report **against staging with 2,000 students' data**. Staging does not exist yet (BL-13), so this report gives local results, the fixes they led to, and the exact steps for the staging run (§6).

## 1. Result

| Check | Target | Baseline (2026-09-28) | Final (2026-10-01) |
|---|---|---|---|
| CRUD p95 | < 500 ms | ❌ 824 ms | ✅ **135 ms** |
| Auth p95 (login + refresh) | < 1,000 ms | ✅ 521 ms | ✅ **152 ms** |
| Error rate | < 1 % | ✅ 0.01 % (1 of 14,890) | ✅ 0.006 % (1 of 15,968) |
| Concurrent users started and kept active | 100 | ✅ 100 | ✅ 100 |
| Staging run | required by BL-15 | — | ⏳ **not done** (no staging, BL-13) |

All four thresholds pass on a developer laptop. That laptop runs the API, PostgreSQL **and** the load generator on the same 4-core CPU, so it is a harsher setup than staging should be. Even so, it is not a substitute for the staging run in §6.

Two endpoints still have a p95 above 500 ms **on their own**: the admin parent list and the admin dashboard. Both are office-only screens, and the CRUD p95 across all requests passes easily. See §5.

## 2. Method

**Data set** — `npm run load:data` (`backend/src/cli/load-data.ts`). It builds one school (`LTS`) with 2 campuses, 20 classes and 60 sections. It adds 2,000 students with 4,000 guardians, 60 teachers with a timetable (1,800 periods), and one month (September 2026) of activity: 44,000 attendance rows, 2,640 diary entries, 4,000 fee vouchers and 1,401 payments, 72 circulars with 52,000 recipients, 40,000 notifications, 286 conversations, 2,000 report cards and 154 leave requests. The total is about 173,000 rows. Every id and date is fixed, so the data is the same on every machine. A re-run inserts nothing. The generator refuses unless `NODE_ENV` is `development` or `test`, the database name contains `load`, `scratch` or `e2e`, and `LOAD_PASSWORD` (≥ 12 characters) is set. It cannot write into a real database by accident.

**Load** — `npm run load:test` (`backend/load-test/run.mjs`, plain Node with no dependencies). k6 is not installed, and autocannon can only replay fixed requests, so neither could log in or follow each user's own children and sections. Each virtual user (VU) is one person who logs in once, then repeats requests for their role. Between requests the VU waits 1–3 s, and it refreshes its session every 15 requests:

| Share | Role | Session | Requests |
|---|---|---|---|
| 60 % | Parent (app) | bearer tokens | profile, children, attendance, diary, timetable, fees and payments, report cards, circulars (read + mark read), notifications, conversations |
| 25 % | Teacher (console) | HttpOnly refresh cookie (BL-36) | my day, timetable, section roster, attendance read, **bulk attendance marking**, diary, conversations |
| 15 % | Office: school admin and accounts (console) | HttpOnly refresh cookie | paged/searched student and parent lists, student profile, fees, **dashboard summary**, fee structures, leave requests |

The run ramps to 100 VUs over 60 s, holds them for 300 s and reports per-endpoint p50/p95/p99. **Auth** means `POST /auth/login` and `POST /auth/refresh`; everything else is **CRUD**. The runner exits with code 1 if any threshold fails, and writes the full result to `backend/load-test/results/<time>-<label>.json`.

**Rate limiting is left on.** The API limits each client IP (100 requests/min, and 5/min on login). The production defaults are never changed for a load test. Locally, each VU sends from its own loopback address (`127.0.0.x`, `--source-ips loopback`), just as 100 users on 100 devices would.

**Machine** — Intel i5-8350U (4 cores / 8 threads, 1.7 GHz), 16 GB RAM, Windows 11, Node 24, PostgreSQL local. The API ran as the production build (`node dist/src/main`, `NODE_ENV=production`).

## 3. Results

| Run | File | CRUD p95 | Auth p95 | Requests | Errors |
|---|---|---|---|---|---|
| Baseline, before fixes | `2026-09-28T03-40-29-199Z-baseline-before.json` | 824 ms | 521 ms | 14,890 | 1 |
| Intermediate, first fixes | `2026-09-28T04-03-12-868Z-after-fixes.json` | 432 ms | 308 ms | 15,500 | 0 |
| **Final**, all fixes + a fresh data set | `2026-10-01T13-43-14-768Z-final.json` | **135 ms** | **152 ms** | 15,968 | 1 |

Throughput was about 41–44 requests/s in every run. That is what 100 users with 1–3 s think time produce; it was not the server's limit. The final run used a database rebuilt from scratch with the current generator.

p95 per endpoint (ms), slowest at baseline first:

| Endpoint | Baseline | Final |
|---|---|---|
| `POST /api/v1/attendance/bulk` | 4,524 | **155** |
| `GET /api/v1/admin/dashboard-summary` | 2,197 | 536 |
| `GET /api/v1/admin/parents` | 1,059 | 627 |
| `GET /api/v1/teachers/me/day` | 988 | 46 |
| `GET /api/v1/admin/students` | 970 | 256 |
| `GET /api/v1/admin/students/:id/profile` | 792 | 92 |
| `GET /api/v1/sections/:id/attendance` | 768 | 46 |
| `GET /api/v1/me/children/:id` | 764 | 47 |
| `POST /auth/login` | 370 | 217 |
| all other endpoints | 191–682 | 14–58 |

Fixing the slowest calls also brought the fast ones down. Slow calls used to hold pooled database connections (node-postgres pool, default 10), and the other requests queued behind them.

**Errors.** The final run had one `POST /auth/refresh` that got no HTTP response (status 0, a socket error) out of 1,034 refreshes. The baseline had one CRUD error. In 15,968 requests these are within the 1 % budget. The runner did not keep the socket error's reason then; it does now (`errorsByEndpoint` in the JSON, with codes such as `ECONNRESET`), so a repeat on staging will show the cause.

## 4. What was fixed

| Where | Problem under load | Change |
|---|---|---|
| `AttendanceService.markBulk` | One upsert per student inside one transaction (a 33-student section = 33 round trips while holding a pooled connection) | A fixed number of statements: `createMany(skipDuplicates)`, one `updateMany` per status, one read-back, one audit row. Re-marking still overwrites; the response keeps the request order (new e2e test) |
| `AttendanceController.bulk` → `StudentAccessService.assertCanAccessStudents` | Access was checked one student at a time, in sequence | One batch check with the same rules per role (unit tests for each role and for a single student out of reach) |
| `DashboardService` | Attendance % loaded every row for the day; outstanding fees loaded every voucher with items and allocations; the 7-day trend ran 2 queries per day; alerts passed every user id of the school as a parameter list | `groupBy` counts; per-voucher sums in two grouped queries; the week from two queries; alerts from one SQL join |
| `TeachersService.myDay` | One attendance count per timetable entry | One query for all of today's sections |
| `ParentService.list` | The children `_count` was aggregated over **all** 4,000 parents before the 25-row page was cut | Page first, then count children for those 25 parents only (same scope rule) |
| Migration `20260930090000_bl15_perf_indexes` | No index for day-wide attendance reads or the newest notifications | `Attendance(date)`, `Notification(createdAt)`; additive only, checked by `test/performance-indexes.e2e-spec.ts` |

## 5. Remaining hot spots and recommendations

These are not threshold failures, but they are the first things to watch on staging:

1. **`GET /api/v1/admin/parents` (p95 627 ms).** The school/campus scope is a chain of `EXISTS` subqueries (guardian link → student → enrolment → section → class → campus). It runs for both the page and the total count, and Prisma's planning time alone was about 40 ms for it. Option: scope through `Enrollment.campusId` directly. Do that only after confirming that it always matches the section's campus (the BL-53 invariants), because the scope rule must not change.
2. **`GET /api/v1/admin/dashboard-summary` (p95 536 ms).** It still runs about ten aggregate queries per call. Option: a short per-school cache (30–60 s). The dashboard is a summary, and a minute of staleness is normally acceptable. This needs a product decision.
3. **Connection pool size.** `PrismaService` uses the node-postgres default of 10 connections, and no setting changes it. Recommendation: a `DATABASE_POOL_MAX` setting (default 10), sized on staging against the database's `max_connections`.
4. **Repeat on staging** with the API, database and load generator on separate machines (§6). Those numbers, not these, go into the BL-57 exit checklist.

## 6. Running it against staging

1. Create a **separate** staging database whose name contains `load` (for example `schoolos_load`) and run `npx prisma migrate deploy` on it. **Never** use the pilot database: the generator refuses any other name, and it must stay that way.
2. Generate the data from a machine that can reach that database: `NODE_ENV=development DATABASE_URL=<…/schoolos_load> LOAD_PASSWORD=<≥12 chars> npm run build && npm run load:data`.
3. Point a staging API instance at that database. Keep the production settings (rate limits, `TRUST_PROXY`, `NODE_ENV=production`).
4. Run the load from the generator host: `LOAD_PASSWORD=<same> npm run load:test -- --base https://<staging-api> --origin https://<staging-console> --source-ips none --label staging`.
   **Rate limit:** the API limits each client IP. Through the proxy, 100 VUs from one host share one IP and will get `429` responses. Either spread the VUs over several generator hosts (each with `--vus` set to its share of 100) or keep each host under the limit, or run a second pass from the API host itself with `--base http://127.0.0.1:<port> --source-ips loopback` (Linux binds any `127.x.x.x`). That pass measures the API and the database without the proxy.
5. Attach the resulting `load-test/results/*-staging.json` to this report, update §1, and record the result in BL-57.
6. Drop the load database afterwards. Its accounts all share one known password.

## 7. Availability plan (99.5 % monthly, NFR-AVL-01)

A load test cannot measure availability. It is measured in operation:

- **Budget:** 0.5 % of a 30-day month is about **3.6 hours** of downtime per month.
- **Measurement:** an external uptime probe on `GET /health/live` every minute, plus `GET /health/ready` for the database (BL-11). The alert rules are in [MONITORING-LOGGING](../operations/MONITORING-LOGGING.md). Monthly availability = successful probes ÷ all probes.
- **Shortening downtime:** zero-downtime deploys (`migrate deploy` with expand-only migrations, see [MIGRATION-STRATEGY](../database/MIGRATION-STRATEGY.md)), a tested restore ([BACKUP-RESTORE](../operations/BACKUP-RESTORE.md)) and a rollback path ([ROLLBACK](ROLLBACK.md)).
- **Horizontal scaling:** sessions (refresh tokens) are kept in the database, files go to S3 (BL-10), and scheduled jobs take an advisory lock (BL-39), so a second API instance can run. One caveat: the rate-limit counters are in memory (`ThrottlerModule` default storage), so each instance counts separately and the effective limit is multiplied by the instance count. A shared store is needed before scaling out if the limits must stay exact.
- **Open (owner):** whether planned maintenance windows count against the 99.5 %, and which uptime provider is used (T-3, BL-13). Neither is decided here.

## 8. Limits of this result

- Local runs share one CPU between the API, PostgreSQL and the generator. Laptop timings vary from run to run, so the intermediate run is not an exact step between baseline and final.
- The scenario is read-heavy. The only write path under load is bulk attendance, plus marking circulars read; fee posting, admissions and imports were not loaded.
- One school only. Multi-school behaviour is covered by the e2e scope tests, not by load.
- A laptop going to sleep mid-run produces requests that take minutes and invalidates the run. Discard such runs; one smoke run on 2026-10-01 was discarded for that reason.
