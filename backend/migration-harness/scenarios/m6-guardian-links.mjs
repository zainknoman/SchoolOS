// Rehearsal of migration M6 (BL-04/BL-23) + its backfill (rules G4/G5) on the legacy dataset (BL-62 gate, BL-65).
import { buildLegacyDataset, LEGACY_SCHEMA } from '../fixtures/legacy-dataset.mjs';
import { runM6Backfill } from '../backfills/m6-guardian-links.mjs';

const expectEq = (name, actual, expected) => ({ name, ok: actual === expected, details: `actual=${actual} expected=${expected}` });

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
  name: 'm6-guardian-links',
  legacyUpTo: LEGACY_SCHEMA,
  async buildFixture(client, insert) {
    const m = await buildLegacyDataset(client, insert);
    const set = (student, parent, relationship, isPrimary, createdAt) =>
      client.query(`UPDATE "StudentParent" SET relationship = $3, "isPrimary" = $4, "createdAt" = $5 WHERE "studentId" = $1 AND "parentProfileId" = $2`, [student, parent, relationship, isPrimary, createdAt]);
    const { stActiveA, stSimilar1, p1, p2, p2dup, pSim1, pSim2 } = m.ids;
    await set(stActiveA, p1, 'Father', true, '2026-01-01T00:00:00Z');
    await set(stActiveA, p2, ' MOTHER ', true, '2026-01-02T00:00:00Z');
    await set(stSimilar1, p2dup, 'Uncle', false, '2026-01-01T00:00:00Z');
    await set(stSimilar1, pSim1, 'guardian', false, '2026-01-02T00:00:00Z');
    await set((await client.query(`SELECT "studentId" FROM "StudentParent" WHERE "parentProfileId" = $1`, [pSim2])).rows[0].studentId, pSim2, 'other', false, '2026-01-01T00:00:00Z');
    // The student with three guardians: all three flagged primary (more than Q4 allows).
    await client.query(`UPDATE "StudentParent" SET "isPrimary" = true WHERE "studentId" IN (SELECT "studentId" FROM "StudentParent" GROUP BY 1 HAVING count(*) = 3)`);
    return m;
  },
  target: { after: LEGACY_SCHEMA },
  async backfill(client) {
    await runM6Backfill(client);
  },
  async checks(client, { manifest, before, after }) {
    const q = async (sql, p = []) => (await client.query(sql, p)).rows;
    const one = async (sql, p) => (await q(sql, p))[0];
    const { stActiveA, stActiveB, stSimilar1, p1, p2, p2dup, pSim2 } = manifest.ids;
    const link = (s, p) => one(`SELECT "relationshipType" t, "relationshipNote" n, "primarySlot" slot, "isPrimary" pr FROM "StudentParent" WHERE "studentId" = $1 AND "parentProfileId" = $2`, [s, p]);
    const a1 = await link(stActiveA, p1);
    const a2 = await link(stActiveA, p2);
    const b1 = await link(stActiveB, p1);
    const uncle = await link(stSimilar1, p2dup);
    const other = await one(`SELECT "relationshipType" t, "relationshipNote" n, "primarySlot" slot FROM "StudentParent" WHERE "parentProfileId" = $1`, [pSim2]);
    const three = await one(`SELECT count(*) FILTER (WHERE "primarySlot" IS NOT NULL)::int AS slotted FROM "StudentParent" WHERE "studentId" IN (SELECT "studentId" FROM "StudentParent" GROUP BY 1 HAVING count(*) = 3)`);
    const rev = await q(`SELECT category, blocking FROM "MigrationReviewItem" WHERE migration = 'M6' ORDER BY category`);
    return [
      expectEq('links unchanged in number', after.StudentParent.rows, before.StudentParent.rows),
      expectEq('"Father" / " MOTHER " typed, slots 1/2 by createdAt', `${a1.t}:${a1.slot}|${a2.t}:${a2.slot}`, 'FATHER:1|MOTHER:2'),
      expectEq('single default link -> GUARDIAN, slot 1, now primary', `${b1.t}:${b1.slot}:${b1.pr}`, 'GUARDIAN:1:true'),
      expectEq('free text "Uncle" -> OTHER with the text kept', `${uncle.t}:${uncle.n}:${uncle.slot}`, 'OTHER:Uncle:null'),
      expectEq('"other" -> OTHER without a note, only link -> slot 1', `${other.t}:${other.n}:${other.slot}`, 'OTHER:null:1'),
      expectEq('three primaries -> no slot assigned', three.slotted, 0),
      expectEq('review rows (blocking multiple-primary, informational no-primary)', rev.map((r) => `${r.category}:${r.blocking}`).join(','), 'GUARDIAN_MULTIPLE_PRIMARY:true,GUARDIAN_PRIMARY_SLOT_REVIEW:false'),
      expectEq('a second guardian in slot 1 is rejected (23505)', await attempt(client, `UPDATE "StudentParent" SET "primarySlot" = 1 WHERE "studentId" = $1 AND "parentProfileId" = $2`, [stActiveA, p2]), '23505'),
      expectEq('slot 3 is rejected (23514)', await attempt(client, `UPDATE "StudentParent" SET "primarySlot" = 3 WHERE "studentId" = $1 AND "parentProfileId" = $2`, [stActiveA, p2]), '23514'),
    ];
  },
};
