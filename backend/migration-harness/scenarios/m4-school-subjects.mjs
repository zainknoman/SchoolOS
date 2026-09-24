// Rehearsal of migration M4 (BL-02) + its backfill on the legacy dataset (BL-62 gate, BL-65).
import { buildLegacyDataset, LEGACY_SCHEMA } from '../fixtures/legacy-dataset.mjs';
import { runM4Backfill } from '../backfills/m4-school-subjects.mjs';

const expectEq = (name, actual, expected) => ({ name, ok: actual === expected, details: `actual=${actual} expected=${expected}` });

export default {
  name: 'm4-school-subjects',
  legacyUpTo: LEGACY_SCHEMA,
  buildFixture: buildLegacyDataset,
  target: { after: LEGACY_SCHEMA },
  async backfill(client) {
    await runM4Backfill(client);
  },
  async checks(client, { manifest, before, after }) {
    const q = async (sql, p = []) => (await client.query(sql, p)).rows;
    const one = async (sql, p) => (await q(sql, p))[0];
    const { schoolA, schoolB, subjMath, subjUrdu, subjEnglish, subjScience, subjUnused } = manifest.ids;
    const school = async (id) => (await one(`SELECT "schoolId" FROM "Subject" WHERE id = $1`, [id])).schoolId;
    const cross = await one(`
      SELECT
        (SELECT count(*)::int FROM "Timetable" t JOIN "Subject" s ON s.id = t."subjectId" JOIN "Section" sec ON sec.id = t."sectionId" JOIN "Class" c ON c.id = sec."classId" JOIN "Campus" cp ON cp.id = c."campusId" WHERE s."schoolId" <> cp."schoolId") AS timetables,
        (SELECT count(*)::int FROM "DiaryEntry" t JOIN "Subject" s ON s.id = t."subjectId" JOIN "Section" sec ON sec.id = t."sectionId" JOIN "Class" c ON c.id = sec."classId" JOIN "Campus" cp ON cp.id = c."campusId" WHERE s."schoolId" <> cp."schoolId") AS diary,
        (SELECT count(*)::int FROM "Assessment" a JOIN "Subject" s ON s.id = a."subjectId" JOIN "AssessmentCategory" ac ON ac.id = a."assessmentCategoryId" JOIN "Class" c ON c.id = ac."classId" JOIN "Campus" cp ON cp.id = c."campusId" WHERE s."schoolId" <> cp."schoolId") AS assessments`);
    const clones = await q(`SELECT "legacySubjectId", "schoolId", name FROM "Subject" WHERE "legacySubjectId" IS NOT NULL ORDER BY name`);
    const rev = await q(`SELECT category, blocking FROM "MigrationReviewItem" WHERE migration = 'M4'`);
    return [
      expectEq('timetable/diary/assessment counts unchanged', [after.Timetable.rows, after.DiaryEntry.rows, after.Assessment.rows].join('/'), [before.Timetable.rows, before.DiaryEntry.rows, before.Assessment.rows].join('/')),
      expectEq('two shared subjects cloned once each (Mathematics, Urdu)', clones.map((c) => c.name).join(','), 'Mathematics,Urdu'),
      expectEq('subjects +2', after.Subject.rows, before.Subject.rows + 2),
      expectEq('English (diary only, school A) -> A', await school(subjEnglish), schoolA),
      expectEq('Science (assessment only, school B) -> B', await school(subjScience), schoolB),
      expectEq('Mathematics anchor keeps a school', [schoolA, schoolB].includes(await school(subjMath)), true),
      expectEq('Urdu anchor keeps a school', [schoolA, schoolB].includes(await school(subjUrdu)), true),
      expectEq('no timetable/diary/assessment uses another school\'s subject', `${cross.timetables}/${cross.diary}/${cross.assessments}`, '0/0/0'),
      expectEq('unused subject stays unassigned (blocking review)', `${await school(subjUnused)}|${rev.filter((r) => r.category === 'SUBJECT_UNREFERENCED' && r.blocking).length}`, 'null|1'),
    ];
  },
};
