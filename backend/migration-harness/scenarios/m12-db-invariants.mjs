// Rehearsal of migration M12 (BL-53): DB invariants. Proves (1) the migration REFUSES, changing nothing,
// when data violates an invariant, (2) it applies cleanly to the legacy dataset, (3) the new constraints
// reject exactly the bad writes and still allow the good ones.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildLegacyDataset } from '../fixtures/legacy-dataset.mjs';
import { MIGRATIONS_DIR } from '../harness.mjs';

const BEFORE_M12 = '20260926090000_bl32_staff_grants';
const M12 = '20260926120000_m12_db_invariants';
const expectEq = (name, actual, expected) => ({
  name,
  ok: actual === expected,
  details: `actual=${actual} expected=${expected}`,
});

const DUP_ENROLMENT = `INSERT INTO "Enrollment" (id, "studentId", "campusId", "sectionId", "academicSessionId", "startDate", status, "updatedAt")
  SELECT gen_random_uuid()::text, "studentId", "campusId", "sectionId", "academicSessionId", now(), $2, now()
  FROM "Enrollment" WHERE "studentId" = $1 LIMIT 1`;
const DUP_VOUCHER = `INSERT INTO "FeeVoucher" (id, "studentId", "academicSessionId", month, "issueDate", "dueDate", "updatedAt")
  SELECT gen_random_uuid()::text, "studentId", "academicSessionId", month, now(), now(), now() FROM "FeeVoucher" WHERE "studentId" = $1 LIMIT 1`;

/** Runs `sql` inside a savepoint; returns the Postgres error code (or 'ok') and never keeps the change. */
async function attempt(client, sql, params = []) {
  await client.query('BEGIN');
  try {
    await client.query(sql, params);
    return 'ok';
  } catch (e) {
    return e.code ?? e.message;
  } finally {
    await client.query('ROLLBACK');
  }
}

export default {
  name: 'm12-db-invariants',
  legacyUpTo: BEFORE_M12,
  async buildFixture(client, insert) {
    const manifest = await buildLegacyDataset(client, insert);
    // Guard rehearsal on DIRTY data, before the real apply: a second ACTIVE enrolment and a duplicate
    // voucher, then the migration itself. It must raise and leave nothing behind.
    const m12Sql = readFileSync(
      join(MIGRATIONS_DIR, M12, 'migration.sql'),
      'utf8',
    );
    await client.query('BEGIN');
    try {
      await client.query(DUP_ENROLMENT, [manifest.ids.stActiveA, 'ACTIVE']);
      await client.query(DUP_VOUCHER, [manifest.ids.stActiveA]);
      await client.query(m12Sql);
      manifest.guardRefusal = 'NOT REFUSED';
    } catch (e) {
      manifest.guardRefusal = e.message;
    } finally {
      await client.query('ROLLBACK');
    }
    return manifest;
  },
  target: { after: BEFORE_M12 },
  async checks(client, { manifest, before, after }) {
    const one = async (sql, p = []) => (await client.query(sql, p)).rows[0];
    const st = manifest.ids.stActiveA;
    const idx = await one(
      `SELECT count(*)::int AS n FROM pg_indexes WHERE indexname IN ('Enrollment_one_active_per_student', 'FeeVoucher_studentId_academicSessionId_month_key')`,
    );
    const checks = await one(
      `SELECT count(*)::int AS n FROM pg_constraint WHERE conname IN ('Complaint_status_check', 'LeaveRequest_status_check', 'FeePayment_status_check', 'Application_status_check', 'HiringApplication_status_check', 'MigrationReviewItem_status_check')`,
    );
    return [
      expectEq(
        'dirty data: the migration refuses with the counts',
        /^M12 refused: 1 student\(s\) .* 1 duplicate voucher group\(s\), invalid status values in: none/.test(
          manifest.guardRefusal,
        ),
        true,
      ),
      expectEq(
        'clean legacy data: rows unchanged by M12',
        [after.Enrollment.rows, after.FeeVoucher.rows].join('/'),
        [before.Enrollment.rows, before.FeeVoucher.rows].join('/'),
      ),
      expectEq('both unique indexes exist', idx.n, 2),
      expectEq('six status checks exist', checks.n, 6),
      expectEq(
        'second ACTIVE enrolment rejected (23505)',
        await attempt(client, DUP_ENROLMENT, [st, 'ACTIVE']),
        '23505',
      ),
      expectEq(
        'a closed (WITHDRAWN) extra enrolment is still allowed',
        await attempt(client, DUP_ENROLMENT, [st, 'WITHDRAWN']),
        'ok',
      ),
      expectEq(
        'duplicate voucher rejected (23505)',
        await attempt(client, DUP_VOUCHER, [st]),
        '23505',
      ),
      expectEq(
        'invalid leave status rejected (23514)',
        await attempt(client, `UPDATE "LeaveRequest" SET status = 'maybe'`),
        '23514',
      ),
      expectEq(
        'valid leave status accepted',
        await attempt(client, `UPDATE "LeaveRequest" SET status = 'rejected'`),
        'ok',
      ),
    ];
  },
};
