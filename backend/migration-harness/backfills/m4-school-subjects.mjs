// BL-02 migration M4 backfill — rules U1–U3 of docs/database/MIGRATION-STRATEGY.md (decisions D1, D2).
//   U1 subject used (Timetable / Assessment / DiaryEntry) in one school -> schoolId = that school
//   U2 used in several schools -> the ANCHOR school (most references; ties: school createdAt, id) keeps the
//      original; every other school gets a clone (legacySubjectId = original) and ITS Timetable, Assessment and
//      DiaryEntry rows are re-pointed. Marks hang off Assessment, so history is untouched.
//   U3 unused -> one school exists: assign; else reviewed (blocking for the contract step; never copied)
// Idempotent: only subjects whose schoolId IS NULL are processed; clones are found again by (legacySubjectId, schoolId).
import { randomUUID } from 'node:crypto';

const review = (client, category, entity, entityId, detail, blocking) =>
  client.query(
    `INSERT INTO "MigrationReviewItem" (id, migration, category, entity, "entityId", detail, blocking)
     VALUES ($1, 'M4', $2, $3, $4, $5, $6)
     ON CONFLICT (migration, category, entity, "entityId") DO NOTHING`,
    [randomUUID(), category, entity, entityId, detail, blocking],
  );

const TIMETABLE_SCHOOL = `(SELECT cp."schoolId" FROM "Section" s JOIN "Class" c ON c.id = s."classId" JOIN "Campus" cp ON cp.id = c."campusId" WHERE s.id = t."sectionId")`;

export async function runM4Backfill(client) {
  const out = { assigned: 0, split: 0, clones: 0, unreferenced: 0 };
  const { rows } = await client.query(`
    WITH refs AS (
      SELECT t."subjectId" AS sid, cp."schoolId" FROM "Timetable" t JOIN "Section" s ON s.id = t."sectionId" JOIN "Class" c ON c.id = s."classId" JOIN "Campus" cp ON cp.id = c."campusId"
      UNION ALL
      SELECT a."subjectId", cp."schoolId" FROM "Assessment" a JOIN "AssessmentCategory" ac ON ac.id = a."assessmentCategoryId" JOIN "Class" c ON c.id = ac."classId" JOIN "Campus" cp ON cp.id = c."campusId"
      UNION ALL
      SELECT d."subjectId", cp."schoolId" FROM "DiaryEntry" d JOIN "Section" s ON s.id = d."sectionId" JOIN "Class" c ON c.id = s."classId" JOIN "Campus" cp ON cp.id = c."campusId"
    )
    SELECT sub.id, sub.name, r."schoolId", count(r."schoolId")::int AS n, sc."createdAt" AS school_created
    FROM "Subject" sub LEFT JOIN refs r ON r.sid = sub.id LEFT JOIN "School" sc ON sc.id = r."schoolId"
    WHERE sub."schoolId" IS NULL
    GROUP BY sub.id, sub.name, r."schoolId", sc."createdAt" ORDER BY sub.id`);
  const subjects = new Map();
  for (const r of rows) {
    const e = subjects.get(r.id) ?? { id: r.id, name: r.name, schools: [] };
    if (r.schoolId) e.schools.push({ schoolId: r.schoolId, n: r.n, created: r.school_created });
    subjects.set(r.id, e);
  }
  const allSchools = (await client.query(`SELECT id FROM "School" ORDER BY "createdAt", id`)).rows.map((r) => r.id);

  await client.query('BEGIN');
  try {
    for (const sub of subjects.values()) {
      sub.schools.sort((a, b) => b.n - a.n || a.created - b.created || (a.schoolId < b.schoolId ? -1 : 1));
      if (sub.schools.length === 0) {
        if (allSchools.length === 1) {
          await client.query(`UPDATE "Subject" SET "schoolId" = $1 WHERE id = $2`, [allSchools[0], sub.id]);
          out.assigned++;
        } else {
          await review(client, 'SUBJECT_UNREFERENCED', 'Subject', sub.id, `${sub.name} is used nowhere — assign it to a school or delete it`, true);
          out.unreferenced++;
        }
        continue;
      }
      const [anchor, ...others] = sub.schools;
      for (const { schoolId: x } of others) {
        let clone = (await client.query(`SELECT id FROM "Subject" WHERE "legacySubjectId" = $1 AND "schoolId" = $2`, [sub.id, x])).rows[0]?.id;
        if (!clone) {
          clone = randomUUID();
          await client.query(
            `INSERT INTO "Subject" (id, name, "schoolId", "isActive", "legacySubjectId", "createdAt", "updatedAt")
             SELECT $1, name, $2, "isActive", id, now(), now() FROM "Subject" WHERE id = $3`,
            [clone, x, sub.id],
          );
          out.clones++;
        }
        await client.query(`UPDATE "Timetable" t SET "subjectId" = $1 WHERE t."subjectId" = $2 AND ${TIMETABLE_SCHOOL} = $3`, [clone, sub.id, x]);
        await client.query(`UPDATE "DiaryEntry" t SET "subjectId" = $1 WHERE t."subjectId" = $2 AND ${TIMETABLE_SCHOOL} = $3`, [clone, sub.id, x]);
        await client.query(
          `UPDATE "Assessment" a SET "subjectId" = $1
           FROM "AssessmentCategory" ac JOIN "Class" c ON c.id = ac."classId" JOIN "Campus" cp ON cp.id = c."campusId"
           WHERE a."assessmentCategoryId" = ac.id AND a."subjectId" = $2 AND cp."schoolId" = $3`,
          [clone, sub.id, x],
        );
      }
      await client.query(`UPDATE "Subject" SET "schoolId" = $1 WHERE id = $2`, [anchor.schoolId, sub.id]);
      if (others.length) {
        out.split++;
        await review(client, 'SUBJECT_CLONE_REQUIRED', 'Subject', sub.id, `${sub.name} split: kept by ${anchor.schoolId}, cloned for ${others.map((o) => o.schoolId).join(', ')}`, false);
      } else {
        out.assigned++;
      }
    }
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
