// Rehearsal of migration M5 (BL-03) + its backfill on the legacy dataset (BL-62 gate, BL-65).
import { buildLegacyDataset, LEGACY_SCHEMA } from '../fixtures/legacy-dataset.mjs';
import { runM5Backfill } from '../backfills/m5-school-fee-structures.mjs';

const expectEq = (name, actual, expected) => ({ name, ok: actual === expected, details: `actual=${actual} expected=${expected}` });

export default {
  name: 'm5-school-fee-structures',
  legacyUpTo: LEGACY_SCHEMA,
  buildFixture: buildLegacyDataset,
  target: { after: LEGACY_SCHEMA },
  async backfill(client) {
    await runM5Backfill(client);
  },
  async checks(client, { manifest, before, after }) {
    const q = async (sql, p = []) => (await client.query(sql, p)).rows;
    const one = async (sql, p) => (await q(sql, p))[0];
    const { schoolA, schoolB, feeGlobal, feeTransport } = manifest.ids;
    const tuition = await q(`SELECT "schoolId", status FROM "FeeStructure" WHERE name = 'Tuition' ORDER BY "schoolId"`);
    const transport = await one(`SELECT "schoolId", status FROM "FeeStructure" WHERE id = $1`, [feeTransport]);
    const lab = await one(`SELECT "schoolId" FROM "FeeStructure" WHERE name = 'Lab Fee'`);
    const admission = await q(`SELECT "schoolId" FROM "FeeStructure" WHERE name = 'Admission Fee'`);
    const items = await one(`
      SELECT count(*)::int AS total,
             count(i."feeStructureId")::int AS linked,
             count(*) FILTER (WHERE f."schoolId" IS NOT NULL AND f."schoolId" <> cp."schoolId")::int AS cross_school
      FROM "FeeItem" i
      JOIN "FeeVoucher" v ON v.id = i."feeVoucherId"
      LEFT JOIN "Enrollment" e ON e."studentId" = v."studentId" AND e."academicSessionId" = v."academicSessionId"
      LEFT JOIN "Campus" cp ON cp.id = e."campusId"
      LEFT JOIN "FeeStructure" f ON f.id = i."feeStructureId"`);
    const rev = await q(`SELECT category, blocking FROM "MigrationReviewItem" WHERE migration = 'M5'`);
    const cat = (c, blocking) => rev.filter((r) => r.category === c && r.blocking === blocking).length;
    return [
      expectEq('voucher lines unchanged in number', after.FeeItem.rows, before.FeeItem.rows),
      expectEq('structures +1 (Tuition cloned for the second school)', after.FeeStructure.rows, before.FeeStructure.rows + 1),
      expectEq('Tuition LOCKED in both schools', tuition.map((t) => `${t.schoolId === schoolA ? 'A' : t.schoolId === schoolB ? 'B' : '?'}:${t.status}`).sort().join(','), 'A:LOCKED,B:LOCKED'),
      expectEq('Transport (A only) -> A, LOCKED', `${transport.schoolId === schoolA}|${transport.status}`, 'true|LOCKED'),
      expectEq('Lab Fee (never issued) unassigned', lab.schoolId, null),
      expectEq('Admission Fee collision left unassigned', admission.every((a) => a.schoolId === null), true),
      expectEq('issued lines with an enrolment linked to a structure of their school', `${items.linked}|${items.cross_school}`, '3|0'),
      expectEq('review rows: collision x2, unreferenced x1 (blocking); attribution + clone (info)', `${cat('FEE_STRUCTURE_NAME_COLLISION', true)}/${cat('FEE_STRUCTURE_UNREFERENCED', true)}/${cat('FEE_STRUCTURE_ATTRIBUTED_BY_LABEL', false) + cat('FEE_STRUCTURE_CLONE_REQUIRED', false)}`, '2/1/2'),
      expectEq('original Tuition row kept (anchor)', (await one(`SELECT count(*)::int AS n FROM "FeeStructure" WHERE id = $1 AND "schoolId" IS NOT NULL`, [feeGlobal])).n, 1),
    ];
  },
};
