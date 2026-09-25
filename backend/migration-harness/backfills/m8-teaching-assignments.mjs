// BL-25 migration M8 backfill — records the assignments that exist when M8 is deployed.
//   Every section's current class teacher and every distinct (teacher, subject) of its timetable get an
//   OPEN TeachingAssignment with startDateUnknown = true and startDate = the session's start date
//   (the real start was never recorded). Later changes are written by the M8 triggers.
// Idempotent: sync_teaching_assignments() only opens a row when no open row exists for the same
// section/role/teacher/subject.
export async function runM8Backfill(client) {
  await client.query('BEGIN');
  try {
    const before = (await client.query(`SELECT count(*)::int AS n FROM "TeachingAssignment"`)).rows[0].n;
    const sections = (await client.query(`SELECT id FROM "Section" ORDER BY id`)).rows;
    for (const { id } of sections) await client.query(`SELECT "sync_teaching_assignments"($1, true)`, [id]);
    const after = (await client.query(`SELECT count(*)::int AS n FROM "TeachingAssignment"`)).rows[0].n;
    await client.query('COMMIT');
    return { sections: sections.length, assignmentsRecorded: after - before };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
}
