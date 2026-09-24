// BL-03 migration M5 backfill — rules F1–F5 of docs/database/MIGRATION-STRATEGY.md (decisions D1, D2, D5).
// FeeStructure has no foreign key from anything before M5 (vouchers copied name/amount into FeeItem), so its
// school can only be INFERRED from FeeItem.label = FeeStructure.name → voucher → the student's enrolment.
//   F4 two or more unassigned structures share a name -> label attribution impossible; reviewed (blocking)
//   F1 name issued in one school  -> schoolId = that school, status LOCKED (it has been invoiced); reviewed (non-blocking)
//   F2 name issued in several     -> anchor (most issued lines) keeps it, a LOCKED clone per other school
//   F3 never issued               -> one school exists: assign as DRAFT; else reviewed (blocking)
//   F5 legacy FeeItem lines are linked to the structure of the SAME school with that exact name, only when unique
// Idempotent: only structures whose schoolId IS NULL and items whose feeStructureId IS NULL are touched.
import { randomUUID } from 'node:crypto';

const review = (client, category, entity, entityId, detail, blocking) =>
  client.query(
    `INSERT INTO "MigrationReviewItem" (id, migration, category, entity, "entityId", detail, blocking)
     VALUES ($1, 'M5', $2, $3, $4, $5, $6)
     ON CONFLICT (migration, category, entity, "entityId") DO NOTHING`,
    [randomUUID(), category, entity, entityId, detail, blocking],
  );

const ITEM_SCHOOL = `
  FROM "FeeItem" i
  JOIN "FeeVoucher" v ON v.id = i."feeVoucherId"
  JOIN "Enrollment" e ON e."studentId" = v."studentId" AND e."academicSessionId" = v."academicSessionId"
  JOIN "Campus" cp ON cp.id = e."campusId"`;

export async function runM5Backfill(client) {
  const out = { assigned: 0, locked: 0, clones: 0, unreferenced: 0, collisions: 0, itemsLinked: 0 };
  const { rows } = await client.query(`
    SELECT f.id, f.name,
      (SELECT count(*)::int FROM "FeeStructure" f2 WHERE f2.name = f.name AND f2."schoolId" IS NULL) AS same_name,
      u."schoolId", count(u."schoolId")::int AS n, sc."createdAt" AS school_created
    FROM "FeeStructure" f
    LEFT JOIN (SELECT DISTINCT i.id AS item, i.label, cp."schoolId" ${ITEM_SCHOOL}) u ON u.label = f.name
    LEFT JOIN "School" sc ON sc.id = u."schoolId"
    WHERE f."schoolId" IS NULL
    GROUP BY f.id, f.name, u."schoolId", sc."createdAt" ORDER BY f.id`);
  const structures = new Map();
  for (const r of rows) {
    const e = structures.get(r.id) ?? { id: r.id, name: r.name, sameName: r.same_name, schools: [] };
    if (r.schoolId) e.schools.push({ schoolId: r.schoolId, n: r.n, created: r.school_created });
    structures.set(r.id, e);
  }
  const allSchools = (await client.query(`SELECT id FROM "School" ORDER BY "createdAt", id`)).rows.map((r) => r.id);

  await client.query('BEGIN');
  try {
    for (const f of structures.values()) {
      if (f.sameName > 1) {
        await review(client, 'FEE_STRUCTURE_NAME_COLLISION', 'FeeStructure', f.id, `"${f.name}": ${f.sameName} structures share this name — assign each one's school manually`, true);
        out.collisions++;
        continue;
      }
      f.schools.sort((a, b) => b.n - a.n || a.created - b.created || (a.schoolId < b.schoolId ? -1 : 1));
      if (f.schools.length === 0) {
        if (allSchools.length === 1) {
          await client.query(`UPDATE "FeeStructure" SET "schoolId" = $1, status = 'DRAFT' WHERE id = $2`, [allSchools[0], f.id]);
          out.assigned++;
        } else {
          await review(client, 'FEE_STRUCTURE_UNREFERENCED', 'FeeStructure', f.id, `"${f.name}" was never issued — assign it to a school or archive it`, true);
          out.unreferenced++;
        }
        continue;
      }
      const [anchor, ...others] = f.schools;
      for (const { schoolId: x } of others) {
        const existing = (await client.query(`SELECT id FROM "FeeStructure" WHERE "legacyFeeStructureId" = $1 AND "schoolId" = $2`, [f.id, x])).rows[0];
        if (!existing) {
          await client.query(
            `INSERT INTO "FeeStructure" (id, name, amount, "schoolId", status, "legacyFeeStructureId", "createdAt")
             SELECT $1, name, amount, $2, 'LOCKED', id, now() FROM "FeeStructure" WHERE id = $3`,
            [randomUUID(), x, f.id],
          );
          out.clones++;
        }
      }
      await client.query(`UPDATE "FeeStructure" SET "schoolId" = $1, status = 'LOCKED' WHERE id = $2`, [anchor.schoolId, f.id]);
      out.locked++;
      await review(
        client,
        others.length ? 'FEE_STRUCTURE_CLONE_REQUIRED' : 'FEE_STRUCTURE_ATTRIBUTED_BY_LABEL',
        'FeeStructure',
        f.id,
        others.length
          ? `"${f.name}" issued in ${f.schools.length} schools: kept by ${anchor.schoolId}, LOCKED clones for the others`
          : `"${f.name}" attributed to ${anchor.schoolId} from voucher labels only — confirm`,
        false,
      );
    }

    // F5: link legacy lines where exactly one structure of the item's school carries the label.
    out.itemsLinked = (await client.query(`
      UPDATE "FeeItem" it SET "feeStructureId" = m.fs
      FROM (
        SELECT i.id AS item, min(f.id) AS fs
        ${ITEM_SCHOOL}
        JOIN "FeeStructure" f ON f.name = i.label AND f."schoolId" = cp."schoolId"
        WHERE i."feeStructureId" IS NULL
        GROUP BY i.id HAVING count(DISTINCT f.id) = 1
      ) m
      WHERE it.id = m.item`)).rowCount;
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
