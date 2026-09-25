// BL-61 migration M7 backfill — rules L1/L2 of docs/database/MIGRATION-STRATEGY.md (RD-10).
//   L1 a Student with status LEFT whose LATEST promotion (decidedAt, then id) is TRANSFERRED (the renamed
//      TRANSFERRED_OUT) -> status TRANSFERRED, with an AuditLog row keeping the previous status.
//   L2 every other LEFT row -> unchanged; LIFECYCLE_LEFT_MANUAL_REVIEW (blocking for the contract step
//      that drops LEFT from the enum). Never renamed on a guess.
//   L3 EnrollmentStatus is not touched.
// Idempotent: L1 only matches rows still LEFT; review rows use ON CONFLICT DO NOTHING.
import { randomUUID } from 'node:crypto';

export async function runM7Backfill(client) {
  const out = { transferred: 0, leftForReview: 0 };
  await client.query('BEGIN');
  try {
    const left = (await client.query(`
      SELECT s.id, s."grNumber",
        (SELECT p.decision::text FROM "StudentPromotion" p WHERE p."studentId" = s.id ORDER BY p."decidedAt" DESC, p.id DESC LIMIT 1) AS latest
      FROM "Student" s WHERE s.status = 'LEFT' ORDER BY s."grNumber", s.id`)).rows;
    for (const s of left) {
      if (s.latest === 'TRANSFERRED') {
        await client.query(`UPDATE "Student" SET status = 'TRANSFERRED', "updatedAt" = now() WHERE id = $1 AND status = 'LEFT'`, [s.id]);
        await client.query(
          `INSERT INTO "AuditLog" (id, action, entity, "entityId", metadata) VALUES ($1, 'migration.m7.lifecycle', 'Student', $2, $3)`,
          [randomUUID(), s.id, JSON.stringify({ rule: 'L1', from: 'LEFT', to: 'TRANSFERRED' })],
        );
        out.transferred++;
        continue;
      }
      await client.query(
        `INSERT INTO "MigrationReviewItem" (id, migration, category, entity, "entityId", detail, blocking)
         VALUES ($1, 'M7', 'LIFECYCLE_LEFT_MANUAL_REVIEW', 'Student', $2, $3, true)
         ON CONFLICT (migration, category, entity, "entityId") DO NOTHING`,
        [randomUUID(), s.id, `${s.grNumber}: status LEFT without a matching transfer promotion (latest: ${s.latest ?? 'none'}) — set TRANSFERRED, WITHDRAWN or GRADUATED on the student profile`],
      );
      out.leftForReview++;
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  return out;
}
