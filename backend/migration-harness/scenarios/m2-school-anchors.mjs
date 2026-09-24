// Rehearsal of migration M2 (BL-20) + its backfill on the legacy dataset (BL-62 gate, BL-65).
import { buildLegacyDataset, LEGACY_SCHEMA } from '../fixtures/legacy-dataset.mjs';
import { runM2Backfill } from '../backfills/m2-school-anchors.mjs';

const expectEq = (name, actual, expected) => ({ name, ok: actual === expected, details: `actual=${actual} expected=${expected}` });

export default {
  name: 'm2-school-anchors',
  legacyUpTo: LEGACY_SCHEMA,
  buildFixture: buildLegacyDataset,
  target: { after: LEGACY_SCHEMA },
  async backfill(client) {
    await runM2Backfill(client);
  },
  async checks(client, { manifest, before, after }) {
    const q = async (sql, p = []) => (await client.query(sql, p)).rows;
    const { schoolA, schoolB } = manifest.ids;
    const circ = await q(`SELECT title, "schoolId" FROM "Circular" ORDER BY title`);
    const hol = await q(`SELECT title, "schoolId", "campusId" FROM "Holiday" ORDER BY title, "schoolId"`);
    const national = hol.filter((h) => h.title.startsWith('National'));
    const rev = await q(`SELECT category, blocking FROM "MigrationReviewItem" WHERE migration = 'M2' ORDER BY category`);
    const bySchool = (t) => circ.find((c) => c.title === t)?.schoolId ?? null;
    return [
      expectEq('circular count unchanged', after.Circular.rows, before.Circular.rows),
      expectEq('C1 section circular -> school B', bySchool('Section notice'), schoolB),
      expectEq('C2 author circular -> school A', bySchool('A school notice'), schoolA),
      expectEq('C3 SUPER_ADMIN circular stays null', bySchool('School-wide notice'), null),
      expectEq('H1 campus holiday -> school A', hol.find((h) => h.title === 'Campus A holiday')?.schoolId, schoolA),
      expectEq('H2 national holiday kept in every school', national.map((h) => h.schoolId).sort().join(','), [schoolA, schoolB].sort().join(',')),
      expectEq('holidays: +1 copy per extra school', after.Holiday.rows, before.Holiday.rows + 1),
      expectEq('no holiday left without a school', hol.filter((h) => h.schoolId === null).length, 0),
      expectEq('review: 1 blocking circular row', rev.filter((r) => r.category === 'CIRCULAR_SCHOOL_UNRESOLVABLE' && r.blocking).length, 1),
      expectEq('review: 2 non-blocking holiday rows', rev.filter((r) => r.category === 'HOLIDAY_NO_CAMPUS' && !r.blocking).length, 2),
    ];
  },
};
