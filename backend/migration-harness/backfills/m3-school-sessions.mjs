// BL-01 migration M3 backfill — rules S1–S6 of docs/database/MIGRATION-STRATEGY.md (decisions D1, D2, D7).
//   S1 session used by one school                 -> schoolId = that school
//   S2 session used by several schools             -> the ANCHOR school (most dependent rows; ties: school
//      createdAt, id) keeps the original; every other school gets a clone (same label/dates/isActive,
//      legacySessionId = original) with cloned Terms, and that school's Class, Enrollment, Application,
//      FeeVoucher/ReportCard (via the student's enrolment) and AssessmentCategory.termId are re-pointed
//   S3 FeeVoucher/ReportCard whose student has no enrolment in its session -> stays; reviewed (non-blocking)
//   S4 session used by nobody                      -> one school exists: assign; else reviewed (blocking)
//   S5 a school would end up with >1 active session -> the backfill REFUSES to run (blocking rows written)
//   S6 two sessions of one school share a label     -> reviewed (blocking for the contract step)
// Idempotent: only sessions whose schoolId IS NULL are processed; clones are found again by
// (legacySessionId, schoolId); review rows are keyed.
import { randomUUID } from 'node:crypto';

const review = (client, category, entity, entityId, detail, blocking) =>
  client.query(
    `INSERT INTO "MigrationReviewItem" (id, migration, category, entity, "entityId", detail, blocking)
     VALUES ($1, 'M3', $2, $3, $4, $5, $6)
     ON CONFLICT (migration, category, entity, "entityId") DO NOTHING`,
    [randomUUID(), category, entity, entityId, detail, blocking],
  );

/** Per unassigned session: dependent-row counts per school. */
async function usage(client) {
  const { rows } = await client.query(`
    WITH deps AS (
      SELECT c."academicSessionId" AS sid, cp."schoolId" FROM "Class" c JOIN "Campus" cp ON cp.id = c."campusId"
      UNION ALL
      SELECT e."academicSessionId", cp."schoolId" FROM "Enrollment" e JOIN "Campus" cp ON cp.id = e."campusId"
      UNION ALL
      SELECT a."academicSessionId", cp."schoolId" FROM "Application" a JOIN "Class" c ON c.id = a."desiredClassId" JOIN "Campus" cp ON cp.id = c."campusId"
      UNION ALL
      SELECT DISTINCT ON (v.id) v."academicSessionId", cp."schoolId" FROM "FeeVoucher" v
        JOIN "Enrollment" e ON e."studentId" = v."studentId" AND e."academicSessionId" = v."academicSessionId" JOIN "Campus" cp ON cp.id = e."campusId"
      UNION ALL
      SELECT DISTINCT ON (r.id) r."academicSessionId", cp."schoolId" FROM "ReportCard" r
        JOIN "Enrollment" e ON e."studentId" = r."studentId" AND e."academicSessionId" = r."academicSessionId" JOIN "Campus" cp ON cp.id = e."campusId"
    )
    SELECT s.id, s.label, s."isActive", d."schoolId", count(d."schoolId")::int AS n, sc."createdAt" AS school_created
    FROM "AcademicSession" s
    LEFT JOIN deps d ON d.sid = s.id
    LEFT JOIN "School" sc ON sc.id = d."schoolId"
    WHERE s."schoolId" IS NULL
    GROUP BY s.id, s.label, s."isActive", d."schoolId", sc."createdAt"
    ORDER BY s.id`);
  const map = new Map();
  for (const r of rows) {
    const e = map.get(r.id) ?? { id: r.id, label: r.label, isActive: r.isActive, schools: [] };
    if (r.schoolId) e.schools.push({ schoolId: r.schoolId, n: r.n, created: r.school_created });
    map.set(r.id, e);
  }
  for (const e of map.values()) {
    e.schools.sort((a, b) => b.n - a.n || a.created - b.created || (a.schoolId < b.schoolId ? -1 : 1));
  }
  return [...map.values()];
}

export async function runM3Backfill(client) {
  const out = { assigned: 0, split: 0, clones: 0, unreferenced: 0, dependentsUnresolvable: 0, labelCollisions: 0 };
  const sessions = await usage(client);
  const allSchools = (await client.query(`SELECT id FROM "School" ORDER BY "createdAt", id`)).rows.map((r) => r.id);

  // S5 pre-check: count, per school, the active sessions it will own afterwards.
  const activePerSchool = new Map();
  const bump = (school, id) => activePerSchool.set(school, [...(activePerSchool.get(school) ?? []), id]);
  for (const r of (await client.query(`SELECT id, "schoolId" FROM "AcademicSession" WHERE "isActive" AND "schoolId" IS NOT NULL`)).rows) {
    bump(r.schoolId, r.id);
  }
  for (const s of sessions.filter((x) => x.isActive)) {
    const owners = s.schools.length ? s.schools.map((x) => x.schoolId) : allSchools.length === 1 ? allSchools : [];
    for (const school of owners) bump(school, s.id);
  }
  const clashes = [...activePerSchool.entries()].filter(([, ids]) => ids.length > 1);
  if (clashes.length) {
    for (const [school, ids] of clashes) {
      for (const id of ids) {
        await review(client, 'SESSION_MULTIPLE_ACTIVE', 'AcademicSession', id, `one of ${ids.length} active sessions of school ${school} — leave exactly one active, then re-run M3`, true);
      }
    }
    throw new Error(`M3 refused: ${clashes.length} school(s) would have more than one active session (see MigrationReviewItem SESSION_MULTIPLE_ACTIVE)`);
  }

  await client.query('BEGIN');
  try {
    for (const s of sessions) {
      if (s.schools.length === 0) {
        if (allSchools.length === 1) {
          await client.query(`UPDATE "AcademicSession" SET "schoolId" = $1 WHERE id = $2`, [allSchools[0], s.id]);
          out.assigned++;
        } else {
          await review(client, 'SESSION_UNREFERENCED', 'AcademicSession', s.id, `${s.label} is used by nothing — assign it to a school or delete it`, true);
          out.unreferenced++;
        }
        continue;
      }
      const [anchor, ...others] = s.schools;
      for (const { schoolId: x } of others) {
        let clone = (await client.query(`SELECT id FROM "AcademicSession" WHERE "legacySessionId" = $1 AND "schoolId" = $2`, [s.id, x])).rows[0]?.id;
        if (!clone) {
          clone = randomUUID();
          await client.query(
            `INSERT INTO "AcademicSession" (id, label, "startDate", "endDate", "isActive", "schoolId", "legacySessionId", "createdAt", "updatedAt")
             SELECT $1, label, "startDate", "endDate", "isActive", $2, id, now(), now() FROM "AcademicSession" WHERE id = $3`,
            [clone, x, s.id],
          );
          out.clones++;
        }
        await client.query(
          `INSERT INTO "Term" (id, "academicSessionId", label, "order", "startDate", "endDate", "createdAt", "updatedAt")
           SELECT gen_random_uuid()::text, $1, t.label, t."order", t."startDate", t."endDate", now(), now()
           FROM "Term" t WHERE t."academicSessionId" = $2
             AND NOT EXISTS (SELECT 1 FROM "Term" t2 WHERE t2."academicSessionId" = $1 AND t2.label = t.label)`,
          [clone, s.id],
        );
        const inSchool = `cp."schoolId" = $3`;
        await client.query(`UPDATE "Class" c SET "academicSessionId" = $1 FROM "Campus" cp WHERE c."campusId" = cp.id AND ${inSchool} AND c."academicSessionId" = $2`, [clone, s.id, x]);
        await client.query(`UPDATE "Enrollment" e SET "academicSessionId" = $1 FROM "Campus" cp WHERE e."campusId" = cp.id AND ${inSchool} AND e."academicSessionId" = $2`, [clone, s.id, x]);
        await client.query(`UPDATE "Application" a SET "academicSessionId" = $1 FROM "Class" c JOIN "Campus" cp ON cp.id = c."campusId" WHERE a."desiredClassId" = c.id AND ${inSchool} AND a."academicSessionId" = $2`, [clone, s.id, x]);
        for (const table of ['FeeVoucher', 'ReportCard']) {
          await client.query(
            `UPDATE "${table}" v SET "academicSessionId" = $1 WHERE v."academicSessionId" = $2
               AND EXISTS (SELECT 1 FROM "Enrollment" e JOIN "Campus" cp ON cp.id = e."campusId"
                           WHERE e."studentId" = v."studentId" AND e."academicSessionId" = $1 AND ${inSchool})`,
            [clone, s.id, x],
          );
        }
        await client.query(
          `UPDATE "AssessmentCategory" ac SET "termId" = ct.id
           FROM "Class" c, "Campus" cp, "Term" t, "Term" ct
           WHERE ac."classId" = c.id AND c."campusId" = cp.id AND ${inSchool}
             AND ac."termId" = t.id AND t."academicSessionId" = $2
             AND ct."academicSessionId" = $1 AND ct.label = t.label`,
          [clone, s.id, x],
        );
      }
      await client.query(`UPDATE "AcademicSession" SET "schoolId" = $1 WHERE id = $2`, [anchor.schoolId, s.id]);
      if (others.length) {
        out.split++;
        await review(client, 'SESSION_SPLIT_REQUIRED', 'AcademicSession', s.id, `${s.label} split: kept by ${anchor.schoolId}, cloned for ${others.map((o) => o.schoolId).join(', ')}`, false);
      } else {
        out.assigned++;
      }
    }

    // S3: dependents whose student has no enrolment in their session.
    const orphans = (await client.query(`
      SELECT 'FeeVoucher' AS entity, v.id FROM "FeeVoucher" v
        WHERE NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."studentId" = v."studentId" AND e."academicSessionId" = v."academicSessionId")
      UNION ALL
      SELECT 'ReportCard', r.id FROM "ReportCard" r
        WHERE NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."studentId" = r."studentId" AND e."academicSessionId" = r."academicSessionId")`)).rows;
    for (const o of orphans) {
      await review(client, 'SESSION_DEPENDENT_UNRESOLVABLE', o.entity, o.id, 'student has no enrolment in this session — left on its session; check it belongs to the right school', false);
    }
    out.dependentsUnresolvable = orphans.length;

    // S6: label collisions inside a school.
    const collisions = (await client.query(`
      SELECT s.id, s.label, s."schoolId" FROM "AcademicSession" s
      JOIN (SELECT "schoolId", label FROM "AcademicSession" WHERE "schoolId" IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1) d
        ON d."schoolId" = s."schoolId" AND d.label = s.label`)).rows;
    for (const c of collisions) {
      await review(client, 'SESSION_LABEL_COLLISION', 'AcademicSession', c.id, `school ${c.schoolId} has several sessions labelled "${c.label}" — rename before the contract step`, true);
    }
    out.labelCollisions = collisions.length;
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}
