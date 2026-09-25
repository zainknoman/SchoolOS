// Rehearsal of migration M8 (BL-25) + its backfill on the legacy dataset (BL-65), plus the trigger
// behaviour the application relies on: change = close + open, unchanged re-save = no churn,
// deletion keeps readable history, rows are immutable.
import { buildLegacyDataset, LEGACY_SCHEMA } from '../fixtures/legacy-dataset.mjs';
import { runM8Backfill } from '../backfills/m8-teaching-assignments.mjs';

const expectEq = (name, actual, expected) => ({ name, ok: actual === expected, details: `actual=${actual} expected=${expected}` });

/** Runs `sql` in a transaction that is always rolled back; returns 'ok' or the Postgres error code. */
async function attempt(client, fn) {
  await client.query('BEGIN');
  try {
    await fn();
    await client.query('SET CONSTRAINTS ALL IMMEDIATE'); // fire the deferred triggers inside the attempt
    return 'ok';
  } catch (e) {
    return e.code ?? e.message;
  } finally {
    await client.query('ROLLBACK');
  }
}

export default {
  name: 'm8-teaching-assignments',
  legacyUpTo: LEGACY_SCHEMA,
  async buildFixture(client, insert) {
    return buildLegacyDataset(client, insert);
  },
  target: { after: LEGACY_SCHEMA },
  async backfill(client) {
    await runM8Backfill(client);
  },
  async checks(client, { manifest, before, after }) {
    const q = async (sql, p = []) => (await client.query(sql, p)).rows;
    const one = async (sql, p) => (await q(sql, p))[0];
    const { secA, teacherA, teacherB } = manifest.ids;
    const expected = await one(`
      SELECT (SELECT count(*) FROM "Section" WHERE "classTeacherId" IS NOT NULL)::int
           + (SELECT count(*) FROM (SELECT DISTINCT "sectionId", "teacherId", "subjectId" FROM "Timetable" WHERE "teacherId" IS NOT NULL) d)::int AS n`);
    const rows = await one(`SELECT count(*)::int n, count(*) FILTER (WHERE "startDateUnknown" AND "endDate" IS NULL)::int open_unknown,
      count(*) FILTER (WHERE "startDate" <> (SELECT s."startDate" FROM "AcademicSession" s WHERE s.id = "academicSessionId"))::int wrong_start
      FROM "TeachingAssignment"`);
    const ctA = await one(`SELECT "teacherName" t, "className" c, "sectionName" s, "sessionLabel" l FROM "TeachingAssignment" WHERE "sectionId" = $1 AND role = 'CLASS_TEACHER'`, [secA]);

    // --- trigger behaviour, each inside a rolled-back transaction
    const openFor = (section) => q(`SELECT role::text r, "teacherId" t, "subjectId" s, "endDate" IS NULL AS open FROM "TeachingAssignment" WHERE "sectionId" = $1 ORDER BY 1, 2, 3, 4`, [section]);
    let change = '';
    await attempt(client, async () => {
      await client.query(`UPDATE "Section" SET "classTeacherId" = $2 WHERE id = $1`, [secA, teacherB]);
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      const r = await openFor(secA);
      const ct = r.filter((x) => x.r === 'CLASS_TEACHER');
      change = `${ct.length}:${ct.filter((x) => x.open).map((x) => (x.t === teacherB ? 'B' : 'A')).join('')}:${ct.filter((x) => !x.open).map((x) => (x.t === teacherA ? 'A' : 'B')).join('')}`;
    });
    // Regression (found in BL-07 e2e): removing the class teacher must close the row.
    let removed = '';
    await attempt(client, async () => {
      await client.query(`UPDATE "Section" SET "classTeacherId" = NULL WHERE id = $1`, [secA]);
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      const r = await openFor(secA);
      removed = String(r.filter((x) => x.r === 'CLASS_TEACHER' && x.open).length);
    });
    let resave = '';
    await attempt(client, async () => {
      const n0 = (await one(`SELECT count(*)::int n FROM "TeachingAssignment"`)).n;
      await client.query(`CREATE TEMP TABLE tt ON COMMIT DROP AS SELECT * FROM "Timetable" WHERE "sectionId" = $1`, [secA]);
      await client.query(`DELETE FROM "Timetable" WHERE "sectionId" = $1`, [secA]);
      await client.query(`INSERT INTO "Timetable" SELECT * FROM tt`);
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      const n1 = (await one(`SELECT count(*)::int n, count(*) FILTER (WHERE "endDate" IS NOT NULL)::int closed FROM "TeachingAssignment"`));
      resave = `${n1.n - n0}:${n1.closed}`;
    });
    let teacherDeleted = '';
    await attempt(client, async () => {
      // attendance keeps the actor in markedByUserId (M1); the Teacher link is what blocks deletion
      await client.query(`UPDATE "Attendance" SET "markedById" = NULL WHERE "markedById" = $1`, [teacherB]);
      await client.query(`DELETE FROM "Teacher" WHERE id = $1`, [teacherB]);
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      const r = await one(`SELECT count(*) FILTER (WHERE "teacherId" IS NULL AND "teacherName" = 'Teacher B')::int kept,
        count(*) FILTER (WHERE "teacherId" IS NULL AND "endDate" IS NULL)::int still_open FROM "TeachingAssignment"`);
      teacherDeleted = `${r.kept > 0}:${r.still_open}`;
    });
    const rewrite = await attempt(client, () => client.query(`UPDATE "TeachingAssignment" SET "teacherName" = 'X' WHERE "sectionId" = $1`, [secA]));
    const reopen = await attempt(client, async () => {
      await client.query(`UPDATE "TeachingAssignment" SET "endDate" = now() WHERE "sectionId" = $1`, [secA]);
      await client.query(`UPDATE "TeachingAssignment" SET "endDate" = now() + interval '1 day' WHERE "sectionId" = $1`, [secA]);
    });
    // Regression (found in BL-07 e2e): deleting a class whose section still has an OPEN assignment.
    let classDeleted = '';
    const classDelete = await attempt(client, async () => {
      const cls = (await client.query(`SELECT "campusId", "academicSessionId" FROM "Class" LIMIT 1`)).rows[0];
      await client.query(`INSERT INTO "Class" (id, "campusId", "academicSessionId", name, "updatedAt") VALUES ('m8-cls', $1, $2, 'M8 Temp Class', now())`, [cls.campusId, cls.academicSessionId]);
      await client.query(`INSERT INTO "Section" (id, "classId", name, "classTeacherId", "updatedAt") VALUES ('m8-sec', 'm8-cls', 'T', $1, now())`, [teacherA]);
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      await client.query('SET CONSTRAINTS ALL DEFERRED');
      await client.query(`DELETE FROM "Class" WHERE id = 'm8-cls'`);
      await client.query('SET CONSTRAINTS ALL IMMEDIATE');
      const r = await one(`SELECT count(*)::int n, bool_and("endDate" IS NOT NULL AND "classId" IS NULL AND "sectionId" IS NULL AND "className" = 'M8 Temp Class') ok FROM "TeachingAssignment" WHERE "sectionName" = 'T' AND "className" = 'M8 Temp Class'`);
      classDeleted = `${r.n}:${r.ok}`;
    });

    return [
      expectEq('no source rows changed (sections, timetables)', `${after.Section.hash}|${after.Timetable.hash}`, `${before.Section.hash}|${before.Timetable.hash}`),
      expectEq('one open row per class teacher and distinct (section, teacher, subject)', rows.n, expected.n),
      expectEq('backfilled rows are open and flagged startDateUnknown', rows.open_unknown, expected.n),
      expectEq('backfilled start = session start', rows.wrong_start, 0),
      expectEq('snapshot labels', `${ctA.t}|${ctA.c}|${ctA.s}|${ctA.l.length > 0}`, `Teacher A|${ctA.c}|A|true`),
      expectEq('class-teacher change closes A and opens B', change, '2:B:A'),
      expectEq('class teacher removed (set to none) closes the row', removed, '0'),
      expectEq('timetable re-saved unchanged: nothing opened or closed', resave, '0:0'),
      expectEq('deleted teacher: history kept by name and closed', teacherDeleted, 'true:0'),
      expectEq('rewriting history is refused (23514)', rewrite, '23514'),
      expectEq('changing a closed row is refused (23514)', reopen, '23514'),
      expectEq('deleting a class with an open assignment succeeds', classDelete, 'ok'),
      expectEq('…and its history row is closed and kept by name', classDeleted, '1:true'),
    ];
  },
};
