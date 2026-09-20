# Migrations

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/prisma/migrations/*/migration.sql`, `prisma.config.ts`, `.github/workflows/ci.yml` · **Owner:** project owner
> Replaces `docs/database/migration-plan.md` (archived, covered only two sub-projects).

## Strategy (observed)
- **Additive only.** A scan of all 13 `migration.sql` files finds **zero** `DROP TABLE`/`DROP COLUMN` statements (ADR-0005). New tables, new nullable/defaulted columns, new constraints.
- **Forward-only.** Prisma Migrate has no down migrations. Rollback = restore a database backup taken before deploy (no backup procedure exists yet — see [operations](../operations/BACKUP-RESTORE.md)).
- **Applied with** `npx prisma migrate deploy` (documented in the README; CI runs it against `postgres:16` before tests). Development creation of new migrations uses `prisma migrate dev` (not documented in repo scripts).
- **Baseline squash.** `20260908000000_postgres_baseline` (33 tables, 678 lines) replaced the earlier SQLite-era migrations; a database created before 2026-09-08 from those cannot be upgraded in place (`docs/archive/database/full-data-model-audit.md` records the earlier six).
- Prisma 7 reads the connection string from `prisma.config.ts` (`DATABASE_URL`).

## History
| # | Migration | Size | Purpose (from the SQL and schema) |
|---|---|---|---|
| 1 | `20260908000000_postgres_baseline` | 33 tables, 44 alters | Full baseline: identity, org, people, timetable, attendance, diary, circulars, messages, notifications, fees, leave, files, audit |
| 2 | `20260911000000_notification_channel_preferences` | 2 alters | `User.notificationChannel`, `digestEnabled` |
| 3 | `20260911001942_sprint_ijk_new_models` | 6 tables | Holidays, complaints, report cards, draft suggestions, attendance risk flags, device tokens (+ password reset support) |
| 4 | `20260912130140_teacher_campus_user_school_id` | 4 alters | `Teacher.campusId`, `User.schoolId` for tenant scoping |
| 5 | `20260913075451_add_gradebook` | 4 tables | Terms, assessment categories, assessments, marks |
| 6 | `20260913080800_add_admissions` | 2 tables | Applicant, Application |
| 7 | `20260913190151_add_student_profile_and_documents` | 5 tables | Student profile satellites, addresses, documents |
| 8 | `20260914111659_add_staff_and_hiring` | 6 tables | Staff, experience, emergency contacts, documents, hiring |
| 9 | `20260916210234_add_school_campus_contact_fields` | 2 alters | School/Campus contact fields |
| 10 | `20260917064046_add_student_promotion` | 1 table | `StudentPromotion` |
| 11 | `20260917101522_extend_school_campus_profile` | 6 alters | Extended school/campus profile |
| 12 | `20260919090000_add_parent_profile_fields` | 4 alters | Parent profile fields |
| 13 | `20260919141332_add_user_campus_scope` | 2 alters | `User.campusId` (campus-scoped principals) |

(The exact table list per migration should be re-derived from the SQL when needed; the purposes above are inferred from table/column names and were not read line by line.)

## Data migrations / backfills
No `UPDATE`/`INSERT`/`DELETE` statements were found in migrations (only DDL). Columns added later (e.g. `User.schoolId`, `User.campusId`) are nullable, so existing rows were **not** backfilled by migrations — existing users would have null scope and be **denied** org-scoped access by `OrgScopeService` until updated (`CODE ISSUE DISCOVERED` DB-1 for any pre-existing production data; none is known to exist).

## Not present
Migration tests (up-from-N, data-preservation), a documented squash policy, a tested rollback rehearsal, a migration lint in CI.
