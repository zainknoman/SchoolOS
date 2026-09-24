// BL-20 migration M2 backfill (rules C1–C3, H1–H2 of docs/database/MIGRATION-STRATEGY.md; decisions D3/D4/D8).
//   H1 Holiday with a campus            -> the campus's school
//   H2 Holiday without a campus         -> one school only: that school; several schools: the original goes to the
//                                          first school (createdAt, id) and a copy is created for every other school
//                                          (today's calendar is kept exactly); every resulting row is listed for review
//                                          (HOLIDAY_NO_CAMPUS, non-blocking) so a school can delete a copy it does not observe
//   C1 Circular with a section          -> section -> class -> campus -> school
//   C2 Circular without a section       -> the author's school
//   C3 otherwise (e.g. SUPER_ADMIN)     -> stays NULL, CIRCULAR_SCHOOL_UNRESOLVABLE (blocking for the contract step)
// Idempotent: only rows whose schoolId IS NULL are touched; review rows are keyed (migration, category, entity, id).
import { randomUUID } from 'node:crypto';

const review = (client, category, entity, entityId, detail, blocking) =>
  client.query(
    `INSERT INTO "MigrationReviewItem" (id, migration, category, entity, "entityId", detail, blocking)
     VALUES ($1, 'M2', $2, $3, $4, $5, $6)
     ON CONFLICT (migration, category, entity, "entityId") DO NOTHING`,
    [randomUUID(), category, entity, entityId, detail, blocking],
  );

export async function runM2Backfill(client) {
  const out = { holidaysFromCampus: 0, holidaysAssigned: 0, holidayCopies: 0, circularsFromSection: 0, circularsFromAuthor: 0, circularsUnresolved: 0 };
  await client.query('BEGIN');
  try {
    // H1
    out.holidaysFromCampus = (await client.query(`
      UPDATE "Holiday" h SET "schoolId" = c."schoolId"
      FROM "Campus" c WHERE h."campusId" = c.id AND h."schoolId" IS NULL`)).rowCount;

    // H2
    const schools = (await client.query(`SELECT id FROM "School" ORDER BY "createdAt", id`)).rows.map((r) => r.id);
    const orphans = (await client.query(`
      SELECT id, title, "startDate", "endDate", "createdAt" FROM "Holiday"
      WHERE "schoolId" IS NULL AND "campusId" IS NULL ORDER BY "createdAt", id`)).rows;
    for (const h of orphans) {
      if (schools.length === 0) {
        await review(client, 'HOLIDAY_NO_CAMPUS', 'Holiday', h.id, 'no school exists to own this holiday — assign manually', true);
        continue;
      }
      await client.query(`UPDATE "Holiday" SET "schoolId" = $1 WHERE id = $2`, [schools[0], h.id]);
      out.holidaysAssigned++;
      if (schools.length === 1) continue;
      await review(client, 'HOLIDAY_NO_CAMPUS', 'Holiday', h.id, `applied to every school before M2; kept for school ${schools[0]} — delete if not observed`, false);
      for (const schoolId of schools.slice(1)) {
        const copyId = randomUUID();
        await client.query(
          `INSERT INTO "Holiday" (id, title, "startDate", "endDate", "campusId", "schoolId", "createdAt")
           VALUES ($1, $2, $3, $4, NULL, $5, $6)`,
          [copyId, h.title, h.startDate, h.endDate, schoolId, h.createdAt],
        );
        out.holidayCopies++;
        await review(client, 'HOLIDAY_NO_CAMPUS', 'Holiday', copyId, `copy of ${h.id} for school ${schoolId} (it applied to every school before M2) — delete if not observed`, false);
      }
    }

    // C1
    out.circularsFromSection = (await client.query(`
      UPDATE "Circular" ci SET "schoolId" = cp."schoolId"
      FROM "Section" s JOIN "Class" cl ON cl.id = s."classId" JOIN "Campus" cp ON cp.id = cl."campusId"
      WHERE ci."sectionId" = s.id AND ci."schoolId" IS NULL`)).rowCount;
    // C2
    out.circularsFromAuthor = (await client.query(`
      UPDATE "Circular" ci SET "schoolId" = u."schoolId"
      FROM "User" u WHERE ci."authorId" = u.id AND u."schoolId" IS NOT NULL AND ci."schoolId" IS NULL`)).rowCount;
    // C3
    const unresolved = (await client.query(`SELECT id FROM "Circular" WHERE "schoolId" IS NULL`)).rows;
    for (const c of unresolved) {
      await review(client, 'CIRCULAR_SCHOOL_UNRESOLVABLE', 'Circular', c.id, 'no section and the author has no school (e.g. SUPER_ADMIN) — assign a school manually; until then only past recipients see it', true);
    }
    out.circularsUnresolved = unresolved.length;
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
