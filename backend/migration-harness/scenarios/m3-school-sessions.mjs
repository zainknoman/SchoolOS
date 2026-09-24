// Rehearsal of migration M3 (BL-01) + its backfill on the legacy dataset (BL-62 gate, BL-65).
import { buildLegacyDataset, LEGACY_SCHEMA } from '../fixtures/legacy-dataset.mjs';
import { runM3Backfill } from '../backfills/m3-school-sessions.mjs';

const expectEq = (name, actual, expected) => ({ name, ok: actual === expected, details: `actual=${actual} expected=${expected}` });

export default {
  name: 'm3-school-sessions',
  legacyUpTo: LEGACY_SCHEMA,
  buildFixture: buildLegacyDataset,
  target: { after: LEGACY_SCHEMA },
  async backfill(client) {
    await runM3Backfill(client);
  },
  async checks(client, { manifest, before, after }) {
    const q = async (sql, p = []) => (await client.query(sql, p)).rows;
    const { schoolA, schoolB, sessGlobal, sessAOnly, sessUnused, classB, orphanVoucher } = manifest.ids;
    const one = async (sql, p) => (await q(sql, p))[0];
    const bClone = await one(`SELECT id, "schoolId", "isActive", label FROM "AcademicSession" WHERE "legacySessionId" = $1`, [sessGlobal]);
    const crossSchool = await one(`
      SELECT
        (SELECT count(*)::int FROM "Class" c JOIN "Campus" cp ON cp.id = c."campusId" JOIN "AcademicSession" s ON s.id = c."academicSessionId" WHERE s."schoolId" <> cp."schoolId") AS classes,
        (SELECT count(*)::int FROM "Enrollment" e JOIN "Campus" cp ON cp.id = e."campusId" JOIN "AcademicSession" s ON s.id = e."academicSessionId" WHERE s."schoolId" <> cp."schoolId") AS enrollments,
        (SELECT count(*)::int FROM "AssessmentCategory" ac JOIN "Class" c ON c.id = ac."classId" JOIN "Term" t ON t.id = ac."termId" WHERE t."academicSessionId" <> c."academicSessionId") AS categories`);
    const rev = await q(`SELECT category, blocking FROM "MigrationReviewItem" WHERE migration = 'M3'`);
    const cat = (c) => rev.filter((r) => r.category === c);
    return [
      expectEq('classes, enrolments, vouchers unchanged in number', [after.Class.rows, after.Enrollment.rows, after.FeeVoucher.rows].join('/'), [before.Class.rows, before.Enrollment.rows, before.FeeVoucher.rows].join('/')),
      expectEq('sessions +1 (one clone for school B)', after.AcademicSession.rows, before.AcademicSession.rows + 1),
      expectEq('terms +1 (term cloned with the session)', after.Term.rows, before.Term.rows + 1),
      expectEq('anchor: school A keeps the shared session', (await one(`SELECT "schoolId" FROM "AcademicSession" WHERE id = $1`, [sessGlobal])).schoolId, schoolA),
      expectEq("clone belongs to school B, keeps label and active flag", `${bClone?.schoolId}|${bClone?.label}|${bClone?.isActive}`, `${schoolB}|2025-2026|true`),
      expectEq("school B's class re-pointed to its clone", (await one(`SELECT "academicSessionId" FROM "Class" WHERE id = $1`, [classB])).academicSessionId, bClone?.id),
      expectEq('no class/enrolment/category points across schools or sessions', `${crossSchool.classes}/${crossSchool.enrollments}/${crossSchool.categories}`, '0/0/0'),
      expectEq('single-school session -> school A', (await one(`SELECT "schoolId" FROM "AcademicSession" WHERE id = $1`, [sessAOnly])).schoolId, schoolA),
      expectEq('unused session stays unassigned', (await one(`SELECT "schoolId" FROM "AcademicSession" WHERE id = $1`, [sessUnused])).schoolId, null),
      expectEq('orphan voucher left on its session', (await one(`SELECT "academicSessionId" FROM "FeeVoucher" WHERE id = $1`, [orphanVoucher])).academicSessionId, sessAOnly),
      expectEq('review: split (info), unreferenced (blocking), orphan dependent', `${cat('SESSION_SPLIT_REQUIRED').length}/${cat('SESSION_UNREFERENCED').filter((r) => r.blocking).length}/${cat('SESSION_DEPENDENT_UNRESOLVABLE').length}`, '1/1/1'),
      expectEq('one active session per school', (await one(`SELECT max(n)::int AS m FROM (SELECT count(*) AS n FROM "AcademicSession" WHERE "isActive" GROUP BY "schoolId") x`)).m, 1),
    ];
  },
};
