// BL-04/BL-23 migration M6 backfill — rules G4/G5 of docs/database/MIGRATION-STRATEGY.md (decision D6).
//   G4 relationship text: mother/father/guardian (case-insensitive, trimmed) -> MOTHER/FATHER/GUARDIAN;
//      "other" -> OTHER; anything else -> OTHER with the original text kept in relationshipNote.
//      "guardian" was the column default, so those links are counted as unconfirmed (not blocking).
//   G5 primary slots (Q4: at most 2 per student), only for students that have no slot yet:
//      isPrimary links -> slots 1, 2 in createdAt, id order; a single link without a primary -> slot 1;
//      more than 2 primaries -> none assigned, GUARDIAN_MULTIPLE_PRIMARY (blocking);
//      several links, none primary -> none assigned, GUARDIAN_PRIMARY_SLOT_REVIEW (informational).
// Idempotent: G4 is a pure function of the legacy text; G5 skips students that already have a slot.
import { randomUUID } from 'node:crypto';

const review = (client, category, entity, entityId, detail, blocking) =>
  client.query(
    `INSERT INTO "MigrationReviewItem" (id, migration, category, entity, "entityId", detail, blocking)
     VALUES ($1, 'M6', $2, $3, $4, $5, $6)
     ON CONFLICT (migration, category, entity, "entityId") DO NOTHING`,
    [randomUUID(), category, entity, entityId, detail, blocking],
  );

const MAPPED = { father: 'FATHER', mother: 'MOTHER', guardian: 'GUARDIAN', other: 'OTHER' };

export async function runM6Backfill(client) {
  const out = { relationshipsTyped: 0, relationshipsOther: 0, defaultGuardianUnconfirmed: 0, slotsAssigned: 0, studentsMultiplePrimary: 0, studentsNoPrimary: 0 };
  await client.query('BEGIN');
  try {
    // ---- G4
    const links = (await client.query(`SELECT id, relationship, "relationshipType", "relationshipNote" FROM "StudentParent"`)).rows;
    for (const l of links) {
      const key = (l.relationship ?? '').trim().toLowerCase();
      const type = MAPPED[key] ?? 'OTHER';
      const note = MAPPED[key] ? l.relationshipNote : l.relationship.trim();
      if (key === 'guardian') out.defaultGuardianUnconfirmed++;
      if (type === l.relationshipType && note === l.relationshipNote) continue;
      await client.query(`UPDATE "StudentParent" SET "relationshipType" = $2::"GuardianRelationship", "relationshipNote" = $3 WHERE id = $1`, [l.id, type, note]);
      if (MAPPED[key]) out.relationshipsTyped++;
      else out.relationshipsOther++;
    }

    // ---- G5
    const rows = (await client.query(`
      SELECT sp.id, sp."studentId", sp."isPrimary", s."grNumber"
      FROM "StudentParent" sp JOIN "Student" s ON s.id = sp."studentId"
      WHERE NOT EXISTS (SELECT 1 FROM "StudentParent" x WHERE x."studentId" = sp."studentId" AND x."primarySlot" IS NOT NULL)
      ORDER BY sp."studentId", sp."createdAt", sp.id`)).rows;
    const byStudent = new Map();
    for (const r of rows) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), r]);
    for (const [studentId, ls] of byStudent) {
      const primaries = ls.filter((l) => l.isPrimary);
      const grNumber = ls[0].grNumber;
      if (primaries.length > 2) {
        await review(client, 'GUARDIAN_MULTIPLE_PRIMARY', 'Student', studentId, `${grNumber}: ${primaries.length} guardians flagged primary — Q4 allows 2; choose them on the parent screen (no slot assigned)`, true);
        out.studentsMultiplePrimary++;
        continue;
      }
      const chosen = primaries.length > 0 ? primaries : ls.length === 1 ? ls : [];
      if (chosen.length === 0) {
        await review(client, 'GUARDIAN_PRIMARY_SLOT_REVIEW', 'Student', studentId, `${grNumber}: ${ls.length} guardians, none primary — choose up to 2 primary guardians (informational)`, false);
        out.studentsNoPrimary++;
        continue;
      }
      for (const [i, l] of chosen.entries()) {
        await client.query(`UPDATE "StudentParent" SET "primarySlot" = $2, "isPrimary" = true WHERE id = $1`, [l.id, i + 1]);
        out.slotsAssigned++;
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  return out;
}
