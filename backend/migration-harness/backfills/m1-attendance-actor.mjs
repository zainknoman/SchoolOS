// BL-60 migration M1 backfill (rules A1–A3 of docs/database/MIGRATION-STRATEGY.md).
// Sets Attendance.markedByUserId from the audit actions the code actually writes:
//   A1 attendance.mark        — AuditLog.entityId is the Attendance row
//   A2 attendance.mark-bulk   — metadata.date + metadata.studentIds
//   A2 leave-request.approve  — LEAVE rows inside the approved request's date range
// The latest matching audit row written up to 5 s after the row's last update wins (the audit row
// is written just after the upsert). A3: no evidence -> stays NULL; markedById is NEVER changed.
// Idempotent: only rows whose markedByUserId IS NULL are touched; a second run updates nothing.
export const M1_BACKFILL_SQL = `
WITH bulk AS MATERIALIZED (
  SELECT "userId", "createdAt", metadata::jsonb AS m
  FROM "AuditLog" WHERE action = 'attendance.mark-bulk' AND "userId" IS NOT NULL
),
candidates AS (
  SELECT a.id AS att_id, l."userId", l."createdAt"
  FROM "Attendance" a
  JOIN "AuditLog" l ON l.action = 'attendance.mark' AND l."entityId" = a.id AND l."userId" IS NOT NULL
  UNION ALL
  SELECT a.id, b."userId", b."createdAt"
  FROM "Attendance" a
  JOIN bulk b ON left(b.m ->> 'date', 10) = to_char(a.date, 'YYYY-MM-DD') AND (b.m -> 'studentIds') ? a."studentId"
  UNION ALL
  SELECT a.id, l."userId", l."createdAt"
  FROM "Attendance" a
  JOIN "LeaveRequest" r ON r."studentId" = a."studentId" AND a.date BETWEEN r."startDate" AND r."endDate"
  JOIN "AuditLog" l ON l.action = 'leave-request.approve' AND l."entityId" = r.id AND l."userId" IS NOT NULL
  WHERE a.status = 'LEAVE'
),
latest AS (
  SELECT DISTINCT ON (c.att_id) c.att_id, c."userId"
  FROM candidates c
  JOIN "Attendance" a ON a.id = c.att_id
  JOIN "User" u ON u.id = c."userId"
  WHERE c."createdAt" <= a."updatedAt" + interval '5 seconds'
  ORDER BY c.att_id, c."createdAt" DESC
)
UPDATE "Attendance" a
SET "markedByUserId" = latest."userId"
FROM latest
WHERE a.id = latest.att_id AND a."markedByUserId" IS NULL`;

export async function counts(client) {
  const { rows } = await client.query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE "markedByUserId" IS NOT NULL)::int AS resolved,
           count(*) FILTER (WHERE "markedByUserId" IS NULL)::int AS unresolved
    FROM "Attendance"`);
  return rows[0];
}

/** Runs the backfill in one transaction; returns rows updated and the resulting counts. */
export async function runM1Backfill(client) {
  await client.query('BEGIN');
  try {
    const res = await client.query(M1_BACKFILL_SQL);
    await client.query('COMMIT');
    return { updated: res.rowCount, ...(await counts(client)) };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
