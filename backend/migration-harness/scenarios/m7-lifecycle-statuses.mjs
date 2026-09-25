// Rehearsal of migration M7 (BL-61, RD-10) + its backfill (rules L1-L3) on the legacy dataset (BL-62 gate, BL-65).
import { buildLegacyDataset, LEGACY_SCHEMA } from '../fixtures/legacy-dataset.mjs';
import { runM7Backfill } from '../backfills/m7-lifecycle-statuses.mjs';

const expectEq = (name, actual, expected) => ({ name, ok: actual === expected, details: `actual=${actual} expected=${expected}` });

export default {
  name: 'm7-lifecycle-statuses',
  legacyUpTo: LEGACY_SCHEMA,
  async buildFixture(client, insert) {
    const m = await buildLegacyDataset(client, insert);
    // A LEFT student whose transfer was later superseded by another decision: the LATEST promotion decides (L1),
    // so this one goes to review, not to TRANSFERRED.
    const { stLeftUnmatched1, adminA } = m.ids;
    const enr = (await client.query(`SELECT id FROM "Enrollment" WHERE "studentId" = $1 LIMIT 1`, [stLeftUnmatched1])).rows[0].id;
    // an earlier, completed enrolment carries the superseded transfer (fromEnrollmentId is unique)
    const older = (await client.query(`INSERT INTO "Enrollment" (id, "studentId", "campusId", "sectionId", "academicSessionId", "startDate", status, "updatedAt")
      SELECT gen_random_uuid()::text, "studentId", "campusId", "sectionId", "academicSessionId", '2025-04-01', 'COMPLETED', now() FROM "Enrollment" WHERE id = $1 RETURNING id`, [enr])).rows[0].id;
    await insert('StudentPromotion', { studentId: stLeftUnmatched1, fromEnrollmentId: older, decision: 'TRANSFERRED_OUT', decidedById: adminA, decidedAt: '2026-01-01T00:00:00Z' });
    await insert('StudentPromotion', { studentId: stLeftUnmatched1, fromEnrollmentId: enr, decision: 'WITHDRAWN', decidedById: adminA, decidedAt: '2026-02-01T00:00:00Z' });
    m.ids.enrollmentStatusBefore = (await client.query(`SELECT string_agg(id || ':' || status::text, ',' ORDER BY id) s FROM "Enrollment"`)).rows[0].s;
    return m;
  },
  target: { after: LEGACY_SCHEMA },
  async backfill(client) {
    await runM7Backfill(client);
  },
  async checks(client, { manifest, before, after }) {
    const q = async (sql, p = []) => (await client.query(sql, p)).rows;
    const one = async (sql, p) => (await q(sql, p))[0];
    const { stLeftMatched, stLeftUnmatched1, stLeftUnmatched2 } = manifest.ids;
    const status = async (id) => (await one(`SELECT status::text s FROM "Student" WHERE id = $1`, [id])).s;
    const labels = async (t) => (await q(`SELECT e.enumlabel l FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = $1 ORDER BY e.enumsortorder`, [t])).map((r) => r.l).join(',');
    const rev = await q(`SELECT "entityId", blocking FROM "MigrationReviewItem" WHERE migration = 'M7' AND category = 'LIFECYCLE_LEFT_MANUAL_REVIEW' ORDER BY "entityId"`);
    const audit = await one(`SELECT count(*)::int n, min(metadata) m FROM "AuditLog" WHERE action = 'migration.m7.lifecycle'`);
    const enrNow = (await one(`SELECT string_agg(id || ':' || status::text, ',' ORDER BY id) s FROM "Enrollment"`)).s;
    return [
      expectEq('students unchanged in number', after.Student.rows, before.Student.rows),
      expectEq('promotions unchanged in number', after.StudentPromotion.rows, before.StudentPromotion.rows),
      expectEq('PromotionDecision renamed + PROMOTED_WITH_CONDITIONS', await labels('PromotionDecision'), 'PROMOTED,PROMOTED_WITH_CONDITIONS,RETAINED,TRANSFERRED,GRADUATED,WITHDRAWN'),
      expectEq('StudentStatus gains TRANSFERRED, keeps LEFT (expand only)', await labels('StudentStatus'), 'ACTIVE,LEFT,GRADUATED,WITHDRAWN,TRANSFERRED'),
      expectEq('existing transfer promotion now reads TRANSFERRED', (await one(`SELECT decision::text d FROM "StudentPromotion" WHERE "studentId" = $1`, [stLeftMatched])).d, 'TRANSFERRED'),
      expectEq('L1 LEFT + latest transfer -> TRANSFERRED', await status(stLeftMatched), 'TRANSFERRED'),
      expectEq('L1 audited with the previous status', `${audit.n}|${audit.m}`, '1|{"rule":"L1","from":"LEFT","to":"TRANSFERRED"}'),
      expectEq('L2 superseded transfer stays LEFT', await status(stLeftUnmatched1), 'LEFT'),
      expectEq('L2 no promotion stays LEFT', await status(stLeftUnmatched2), 'LEFT'),
      expectEq('L2 review rows, blocking', rev.map((r) => `${r.entityId}:${r.blocking}`).join(','), [stLeftUnmatched1, stLeftUnmatched2].sort().map((id) => `${id}:true`).join(',')),
      expectEq('L3 EnrollmentStatus untouched', enrNow, manifest.ids.enrollmentStatusBefore),
      expectEq('no student changed except the L1 row', (await one(`SELECT count(*)::int n FROM "Student" WHERE status = 'TRANSFERRED'`)).n, 1),
    ];
  },
};
