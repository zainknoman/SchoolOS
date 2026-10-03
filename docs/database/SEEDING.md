# Seeding

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/prisma/seed.ts` (296 lines), `backend/package.json` (`prisma:seed`), `.env.example` · **Owner:** Engineering Lead

**Purpose:** development/demo data only. **Never run against a production database** — the script has no environment guard and creates well-known demo accounts.

| Item | Fact | Evidence |
|---|---|---|
| Command | `npm run prisma:seed` (ts-node) | `package.json` |
| Required env | `SEED_PASSWORD` (throws if missing); `DATABASE_URL`; **`NODE_ENV` must be `development` or `test`** — the seed refuses otherwise (BL-22) | `seed.ts` |
| Real systems | Use `npm run bootstrap:super-admin` for the first administrator ([DEPLOYMENT](../operations/DEPLOYMENT.md)); the demo seed is never run outside development/test | `src/cli/bootstrap-super-admin.ts` |
| Idempotent? | **No.** Uses `createMany`; there are no deletes/upserts, so it is meant for an empty database (a second run hits unique constraints) | `seed.ts` |
| Organisation | 2 fictional schools, **Demo School North** (code `DSN`, 3 campuses) and **Demo School South** (`DSS`, 2 campuses) — BL-34; contact fields use `*.demo-school.example.edu.pk` / `*.schoolos.local`; 2 sessions per school (`2025-2026` inactive, `2026-2027` **active in both schools**), classes `Class 1`–`Class 8` × sections per campus, subjects | `seed.ts` |
| People | superadmin, per-school admin/principal/accounts, teachers per section, students with parents, staff, support staff, addresses, files (campus logos) | `seed.ts:161-238` |
| Academic data | enrollments, timetable, attendance, diary, admissions, hiring examples | `seed.ts` (see README history for the older description) |
| Load-test data (BL-15) | Separate generator, not the demo seed: `npm run load:data` (built `dist`) creates school `LTS` with 2,000 students, 4,000 guardians, 60 teachers and a month of activity (about 173,000 rows). Idempotent (fixed ids, `skipDuplicates`); refuses unless `NODE_ENV` is development/test, the database name contains `load`/`scratch`/`e2e`, and `LOAD_PASSWORD` is set — see [LOAD-TEST-REPORT](../release/LOAD-TEST-REPORT.md) | `src/cli/load-data.ts` |
| Identifiers | `superadmin@schoolos.local`; `admin@dsn.schoolos.local`, `principal@…`, `accounts@…` per school; teachers `<dsn|dss>.c<campus>.g<class><section>@schoolos.local`; parents `<prefix>.<gr>@parent.schoolos.local`; password = `SEED_PASSWORD` for all | `seed.ts` |

## The Seeds School demo seed (2026-10-04)

A second, separate seed for demonstrating one **fully set-up school**: everything a school needs before admissions, and **one student**. It does not touch `seed.ts` and works with or without the original seed data.

| Item | Fact |
|---|---|
| Command | `npm run prisma:seed:seeds-school` (`backend/prisma/seed-seeds-school.ts`) |
| Required env | Same as `seed.ts`: `DATABASE_URL`, `SEED_PASSWORD`, `NODE_ENV=development` or `test` (refuses otherwise). Optional `SEED_TODAY=YYYY-MM-DD` pretends another date (testing) |
| Idempotent? | **Yes.** Every id is derived from a fixed key and every insert skips existing rows; a second run inserts nothing. Rows that depend on today (attendance, marks, vouchers/payments, diary, report cards) only grow when it is run on a later date. Random values come from a seeded generator, so every run builds the same data |
| School | **The Seeds School** (code `TSS`), campus **Gulistan-e-Jauhar Block-7** (`TSS-1`), every profile field filled; session **2026-2027** (1 Aug 2026 – 31 May 2027) owned by this school and active — other schools' sessions are not changed (sessions are per school since BL-01). It refuses to run if TSS already has a different active session |
| Terms | First Term 1 Aug – 30 Oct 2026, Second Term 1 Nov 2026 – 30 Jan 2027, Final Term 1 Feb – 10 May 2027 |
| Classes | Montessori, KG-1, KG-2, Class 1 – Class 10, sections A–C each (39 sections, named `Mont-A`, `KG1-B`, `3-C`, …) |
| Subjects | Classes 1–10: English, Urdu, Maths (5/week), Computer, Science, Social Studies, Islamiat, Sindhi (4/week), Computer Lab, Arts, Nazra, Physical Training (P.T), Library (1/week). Montessori/KG: English, Urdu, Maths (6), General Knowledge (5), Islamiat (4), Nazra (1), Arts, Rhymes & Activity, P.T (4) |
| Timetable | 40 periods a week per section. Mon–Thu 40-minute periods (08:00–13:40, break 10:40–11:00), Friday 30-minute periods (08:00–12:25, break 10:00–10:25) — each timetable row carries its own times, so no schema change. Built with a max-flow per section; the seed checks that no teacher is double-booked, no teacher has more than 30 periods and every subject has its weekly count. Assembly and break are not stored (a timetable row needs a subject) |
| Staff | Admin, principal and accounts logins (each with a staff profile), 58 teachers (1–2 subjects each; dedicated Montessori/KG teachers; every section has a class teacher), 10 non-teaching staff — CNIC, mobile, addresses, joining date, emergency contact, previous experience with qualification. Salary is not modelled. No photos or documents (they need stored files) |
| Gradebook | Default grading scale (A+ … F), categories per class and term (Quizzes 10 %, Assignments 15 %, Class Test 25 %, Term Final Exam 50 %), and per daily subject 2 quizzes, 2 assignments, 1 class test and 1 final per term; each assessment's planned date is in its label (the table has no date column). Only daily subjects are examined |
| Syllabus | One per class and examined subject, six units over the three terms with planned dates |
| Policies | Promotion (75 % attendance / 40 % results, results block), attendance risk (30 days, 20 %, guardians notified), late fee PKR 500 after 5 grace days |
| Fees | Structures: Monthly Tuition Montessori & KG PKR 6,500, Classes 1–5 PKR 8,000, Classes 6–8 PKR 9,500, Classes 9–10 PKR 11,000; Admission Fee PKR 25,000; Annual Charges PKR 12,000; Examination Fee PKR 2,500 (exam months) |
| Student | **Barzah Zain Noman**, GR-02578, Class 3 section C (roll 15): full profile, previous school, medical info, emergency contact; guardians **Zain Noman Kamali** (father) and **Mehak Irshad Ali Abro** (mother) with parent logins. Attendance every school day since 1 Aug, one approved and one pending leave, marks for every assessment already held, monthly vouchers (August paid by bank transfer, September paid late with the late fee, the current month open) with receipts. When a term has ended, the seed publishes Class 3's results and generates her report card **through the application's own services** |
| Other | Holidays for the session, diary entries for every section for the last ten school days, circulars (school-wide and 3-C) with read receipts, two parent conversations, notifications, a resolved complaint, 8 admission applications and 6 hiring applications in various states |
| Logins | `admin@tss.schoolos.local`, `principal@tss.schoolos.local`, `accounts@tss.schoolos.local`, teachers `firstname.lastname@tss.schoolos.local` (the seed prints the 3-C class teacher), `father.gr-02578@parent.schoolos.local`, `mother.gr-02578@parent.schoolos.local`; password = `SEED_PASSWORD` |
| Verified | 2026-10-04: fresh database (migrate deploy + seed) and a database with the original seed; second run inserts 0 rows; `SEED_TODAY=2026-11-05` publishes First Term results and issues the report card, a repeat leaves it unchanged; backend unit tests pass |

The names of the school, the student and her guardians are the owner's choice (2026-10-04); every other personal detail (CNIC, phone, address) is fictional.

## Code issues discovered (recorded, not fixed)
| ID | Issue | Impact |
|---|---|---|
| SEED-1 | Seeds one `isActive: true` session per school; the API allows only one active session platform-wide (BR-ORG-01) | Seeded state cannot be reproduced through the product; multi-school "first active session" lookups pick arbitrarily |
| SEED-2 | `schoolId` is placed on the in-memory session object but `createMany` is given the copy without it (`seed.ts:155-156`) — harmless because the schema has no such column, but misleading | Confusion when reading the seed |
| SEED-3 | ~~Demo school name looks like a real institution~~ — **fixed 2026-09-26 (BL-34):** Demo School North/South, neutral campus names | — |
| SEED-4 | No production guard | Accidental run creates known-password admin accounts |

Documentation-folder copies (`docs/archive/database/seed-data.ts`, `seed-expanded.ts`) are stale archives, not the seed.
