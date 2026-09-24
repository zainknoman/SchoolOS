// Rehearsal of migration M1 (BL-60) + its backfill on the legacy dataset (BL-62 gate, BL-65).
import { buildLegacyDataset, LEGACY_SCHEMA } from '../fixtures/legacy-dataset.mjs';
import { runM1Backfill } from '../backfills/m1-attendance-actor.mjs';

const expectEq = (name, actual, expected) => ({ name, ok: actual === expected, details: `actual=${actual} expected=${expected}` });

export default {
  name: 'm1-attendance-actor',
  legacyUpTo: LEGACY_SCHEMA,
  buildFixture: buildLegacyDataset,
  target: { after: LEGACY_SCHEMA },
  async backfill(client) {
    await runM1Backfill(client);
  },
  async checks(client, { manifest, before, after }) {
    const q = async (sql, p = []) => (await client.query(sql, p)).rows;
    const e = manifest.expect;
    const [c] = await q(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE "markedByUserId" IS NOT NULL)::int AS resolved,
        count(*) FILTER (WHERE "markedById" IS NULL)::int AS teacher_null FROM "Attendance"`);
    const adminRow = await q(`SELECT "markedByUserId", "markedById" FROM "Attendance" WHERE id = $1`, [manifest.ids.attAdmin]);
    const leaveRows = await q(`SELECT DISTINCT "markedByUserId" FROM "Attendance" WHERE "studentId" = $1 AND status = 'LEAVE'`, [manifest.ids.stActiveA]);
    return [
      expectEq('attendance row count unchanged', after.Attendance.rows, before.Attendance.rows),
      expectEq('rows resolved (A1/A2)', c.resolved, e.attendanceActorBackfillable),
      expectEq('rows left null (A3)', c.total - c.resolved, e.attendance - e.attendanceActorBackfillable),
      expectEq('markedById never cleared or rewritten', c.teacher_null, 0),
      expectEq('admin-marked row names the admin, not the class teacher', adminRow[0]?.markedByUserId, manifest.ids.adminA),
      expectEq('admin-marked row keeps its legacy Teacher id', adminRow[0]?.markedById, manifest.ids.teacherA),
      expectEq('leave-approval rows name the approver', leaveRows.map((r) => r.markedByUserId).join(','), manifest.ids.adminA),
    ];
  },
};
