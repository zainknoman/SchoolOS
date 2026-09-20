// BL-62 dry-run classifier (READ-ONLY). Given a database at the current (legacy) schema it reports how each
// planned Wave-3/4 migration would classify existing rows: mappable, split-required, or needing manual review.
// It never writes. Run it on a production-like copy before any data migration executes (BL-62 gate).
//
// Limits (documented, not hidden): subject usage is derived from Timetable only; session usage from Class and
// Enrollment only. Extend the queries when a migration needs another dependent table.
export async function dryRun(client) {
  const q = async (sql, params = []) => (await client.query(sql, params)).rows;
  const review = [];
  const summary = {};

  // ---- sessions: which schools use each session (via Class → Campus and Enrollment → Campus)
  const sessions = await q(`
    SELECT s.id, s.label, COALESCE(array_agg(DISTINCT u."schoolId") FILTER (WHERE u."schoolId" IS NOT NULL), '{}') AS schools
    FROM "AcademicSession" s
    LEFT JOIN (
      SELECT c."academicSessionId" AS sid, cp."schoolId" FROM "Class" c JOIN "Campus" cp ON cp.id = c."campusId"
      UNION
      SELECT e."academicSessionId", cp."schoolId" FROM "Enrollment" e JOIN "Campus" cp ON cp.id = e."campusId"
    ) u ON u.sid = s.id
    GROUP BY s.id, s.label ORDER BY s.label`);
  summary.sessions = sessions.length;
  summary.sessionsSharedAcrossSchools = sessions.filter((s) => s.schools.length > 1).length;
  summary.sessionsSingleSchool = sessions.filter((s) => s.schools.length === 1).length;
  summary.sessionsUnreferenced = sessions.filter((s) => s.schools.length === 0).length;
  for (const s of sessions) {
    if (s.schools.length > 1) review.push({ category: 'SESSION_SPLIT_REQUIRED', entity: 'AcademicSession', id: s.id, detail: `${s.label} used by ${s.schools.length} schools — clone per school and re-point dependents` });
    if (s.schools.length === 0) review.push({ category: 'SESSION_UNREFERENCED', entity: 'AcademicSession', id: s.id, detail: `${s.label} not used by any class/enrolment — school cannot be inferred` });
  }

  // ---- subjects (Timetable → Section → Class → Campus → School)
  const subjects = await q(`
    SELECT s.id, s.name, COALESCE(array_agg(DISTINCT cp."schoolId") FILTER (WHERE cp."schoolId" IS NOT NULL), '{}') AS schools
    FROM "Subject" s
    LEFT JOIN "Timetable" t ON t."subjectId" = s.id
    LEFT JOIN "Section" sec ON sec.id = t."sectionId"
    LEFT JOIN "Class" c ON c.id = sec."classId"
    LEFT JOIN "Campus" cp ON cp.id = c."campusId"
    GROUP BY s.id, s.name ORDER BY s.name`);
  summary.subjects = subjects.length;
  summary.subjectsSharedAcrossSchools = subjects.filter((s) => s.schools.length > 1).length;
  summary.subjectsUnreferenced = subjects.filter((s) => s.schools.length === 0).length;
  for (const s of subjects) {
    if (s.schools.length > 1) review.push({ category: 'SUBJECT_CLONE_REQUIRED', entity: 'Subject', id: s.id, detail: `${s.name} used by ${s.schools.length} schools` });
    if (s.schools.length === 0) review.push({ category: 'SUBJECT_UNREFERENCED', entity: 'Subject', id: s.id, detail: `${s.name} unused — strategy rule required (BL-62)` });
  }

  // ---- guardians. CNIC and User.identifier are already UNIQUE, so exact duplicates on them cannot exist today; a duplicate
  // parent appears when a second school creates a NEW profile (different identifier, often no CNIC). Candidates are flagged
  // from shared phone/e-mail only, for MANUAL review — names are reported but NEVER used to match, and nothing is auto-merged.
  const dupContact = await q(`
    SELECT 'phone' AS kind, "phone" AS val, array_agg(id ORDER BY id) AS ids FROM "ParentProfile" WHERE "phone" IS NOT NULL AND "phone" <> '' GROUP BY "phone" HAVING count(*) > 1
    UNION ALL
    SELECT 'email', lower("email"), array_agg(id ORDER BY id) FROM "ParentProfile" WHERE "email" IS NOT NULL AND "email" <> '' GROUP BY lower("email") HAVING count(*) > 1`);
  summary.parentProfiles = (await q(`SELECT count(*)::int AS n FROM "ParentProfile"`))[0].n;
  summary.duplicateContactGroups = dupContact.length;
  for (const g of dupContact) review.push({ category: 'GUARDIAN_DUPLICATE_CANDIDATE', entity: 'ParentProfile', id: g.ids.join('|'), detail: `shared ${g.kind} — candidate only, manual merge review (never auto-merged)` });
  const sameNameDiffCnic = await q(`SELECT name, count(DISTINCT "cnic")::int AS c FROM "ParentProfile" GROUP BY name HAVING count(*) > 1 AND count(DISTINCT "cnic") > 1`);
  summary.sameNameDifferentCnic = sameNameDiffCnic.length;
  const many = await q(`SELECT "studentId", count(*)::int AS n FROM "StudentParent" GROUP BY "studentId" HAVING count(*) > 2`);
  summary.studentsWithMoreThanTwoGuardians = many.length;
  for (const r of many) review.push({ category: 'GUARDIAN_PRIMARY_SLOT_REVIEW', entity: 'Student', id: r.studentId, detail: `${r.n} guardian links — primary/non-primary must be chosen manually` });
  const cross = await q(`
    SELECT sp."parentProfileId" AS id, count(DISTINCT cp."schoolId")::int AS schools
    FROM "StudentParent" sp JOIN "Enrollment" e ON e."studentId" = sp."studentId" JOIN "Campus" cp ON cp.id = e."campusId"
    GROUP BY sp."parentProfileId" HAVING count(DISTINCT cp."schoolId") > 1`);
  summary.guardiansAcrossSchools = cross.length;
  summary.guardianLinks = (await q(`SELECT count(*)::int AS n FROM "StudentParent"`))[0].n;

  // ---- lifecycle: LEFT + latest promotion decision TRANSFERRED_OUT → TRANSFERRED; every other LEFT → review
  const left = await q(`
    SELECT s.id, s."grNumber",
      (SELECT p.decision::text FROM "StudentPromotion" p WHERE p."studentId" = s.id ORDER BY p."decidedAt" DESC, p.id DESC LIMIT 1) AS latest
    FROM "Student" s WHERE s.status = 'LEFT' ORDER BY s."grNumber"`);
  summary.leftStudents = left.length;
  summary.leftWithTransferredOut = left.filter((r) => r.latest === 'TRANSFERRED_OUT').length;
  summary.leftWithoutMatchingPromotion = left.filter((r) => r.latest !== 'TRANSFERRED_OUT').length;
  for (const r of left.filter((x) => x.latest !== 'TRANSFERRED_OUT')) review.push({ category: 'LIFECYCLE_LEFT_MANUAL_REVIEW', entity: 'Student', id: r.id, detail: `${r.grNumber}: status LEFT without a matching TRANSFERRED_OUT promotion (latest: ${r.latest ?? 'none'}) — never renamed automatically` });

  // ---- circular / holiday school anchors
  const circ = await q(`
    SELECT c.id, c.scope, u."schoolId" AS author_school, cp."schoolId" AS section_school
    FROM "Circular" c LEFT JOIN "User" u ON u.id = c."authorId"
    LEFT JOIN "Section" s ON s.id = c."sectionId" LEFT JOIN "Class" cl ON cl.id = s."classId" LEFT JOIN "Campus" cp ON cp.id = cl."campusId"`);
  summary.circulars = circ.length;
  const circAmbiguous = circ.filter((c) => !(c.section_school || c.author_school));
  summary.circularsAmbiguous = circAmbiguous.length;
  for (const c of circAmbiguous) review.push({ category: 'CIRCULAR_SCHOOL_UNRESOLVABLE', entity: 'Circular', id: c.id, detail: 'no section and author has no school (e.g. SUPER_ADMIN) — assign a school manually' });
  const hol = await q(`SELECT h.id, h."campusId" FROM "Holiday" h`);
  summary.holidays = hol.length;
  const holAmbiguous = hol.filter((h) => h.campusId === null);
  summary.holidaysAmbiguous = holAmbiguous.length;
  for (const h of holAmbiguous) review.push({ category: 'HOLIDAY_NO_CAMPUS', entity: 'Holiday', id: h.id, detail: 'null campus applies to every school today — choose the owning school(s) manually' });

  // ---- attendance actor backfill (M1): audit log rows can identify the real actor for some rows
  const att = await q(`
    SELECT a.id, EXISTS (
      SELECT 1 FROM "AuditLog" l WHERE l.action = 'attendance.update' AND l."userId" IS NOT NULL
        AND l.metadata::jsonb ->> 'studentId' = a."studentId"
        AND l.metadata::jsonb ->> 'date' = to_char(a.date, 'YYYY-MM-DD')
    ) AS backfillable FROM "Attendance" a`);
  summary.attendance = att.length;
  summary.attendanceActorBackfillable = att.filter((r) => r.backfillable).length;
  summary.attendanceActorUnresolvable = att.filter((r) => !r.backfillable).length;
  summary.sectionsWithoutClassTeacher = (await q(`SELECT count(*)::int AS n FROM "Section" WHERE "classTeacherId" IS NULL`))[0].n;

  return { summary, review };
}
