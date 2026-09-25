// BL-62 dry-run classifier (READ-ONLY). Given a database at the current (legacy) schema it reports how each
// planned Wave-3/4 migration would classify existing rows: mappable, split-required, or needing manual review.
// It never writes. Run it on a production-like copy before any data migration executes (BL-62 gate).
//
// Coverage (F7): session usage is derived from every dependent that can name a school — Class, Enrollment,
// Application (desired class), FeeVoucher and ReportCard (the student's enrolment in that session); Term has no
// school of its own and follows its session. Subject usage is derived from Timetable, Assessment (category → class)
// and DiaryEntry (section → class). FeeStructure has NO foreign key from any table — vouchers copy name/amount
// into FeeItem — so a structure's school can only be INFERRED from FeeItem.label = FeeStructure.name; such
// attributions are reported as inferences, and name collisions go to manual review.
export async function dryRun(client) {
  const q = async (sql, params = []) => (await client.query(sql, params)).rows;
  const review = [];
  const summary = {};

  // ---- sessions: which schools use each session (every dependent that can name a school)
  const sessions = await q(`
    SELECT s.id, s.label, COALESCE(array_agg(DISTINCT u."schoolId") FILTER (WHERE u."schoolId" IS NOT NULL), '{}') AS schools
    FROM "AcademicSession" s
    LEFT JOIN (
      SELECT c."academicSessionId" AS sid, cp."schoolId" FROM "Class" c JOIN "Campus" cp ON cp.id = c."campusId"
      UNION
      SELECT e."academicSessionId", cp."schoolId" FROM "Enrollment" e JOIN "Campus" cp ON cp.id = e."campusId"
      UNION
      SELECT a."academicSessionId", cp."schoolId" FROM "Application" a JOIN "Class" c ON c.id = a."desiredClassId" JOIN "Campus" cp ON cp.id = c."campusId"
      UNION
      SELECT v."academicSessionId", cp."schoolId" FROM "FeeVoucher" v
        JOIN "Enrollment" e ON e."studentId" = v."studentId" AND e."academicSessionId" = v."academicSessionId" JOIN "Campus" cp ON cp.id = e."campusId"
      UNION
      SELECT r."academicSessionId", cp."schoolId" FROM "ReportCard" r
        JOIN "Enrollment" e ON e."studentId" = r."studentId" AND e."academicSessionId" = r."academicSessionId" JOIN "Campus" cp ON cp.id = e."campusId"
    ) u ON u.sid = s.id
    GROUP BY s.id, s.label ORDER BY s.label`);
  summary.sessions = sessions.length;
  summary.sessionsSharedAcrossSchools = sessions.filter((s) => s.schools.length > 1).length;
  summary.sessionsSingleSchool = sessions.filter((s) => s.schools.length === 1).length;
  summary.sessionsUnreferenced = sessions.filter((s) => s.schools.length === 0).length;
  // Activation is global today (activating one deactivates all), so more than one active row means direct writes;
  // M3 refuses to run until each school resolves to at most one active session (BL-62 rule S5).
  const active = await q(`SELECT id, label FROM "AcademicSession" WHERE "isActive" ORDER BY label`);
  summary.sessionsActive = active.length;
  if (active.length > 1) for (const s of active) review.push({ category: 'SESSION_MULTIPLE_ACTIVE', entity: 'AcademicSession', id: s.id, detail: `${s.label} is one of ${active.length} active sessions — choose one active session per school before M3 (blocking)` });
  const sharedIds = sessions.filter((s) => s.schools.length > 1).map((s) => s.id);
  summary.termsOnSharedSessions = (await q(`SELECT count(*)::int AS n FROM "Term" WHERE "academicSessionId" = ANY($1::text[])`, [sharedIds]))[0].n;
  for (const s of sessions) {
    if (s.schools.length > 1) review.push({ category: 'SESSION_SPLIT_REQUIRED', entity: 'AcademicSession', id: s.id, detail: `${s.label} used by ${s.schools.length} schools — clone per school and re-point dependents` });
    if (s.schools.length === 0) review.push({ category: 'SESSION_UNREFERENCED', entity: 'AcademicSession', id: s.id, detail: `${s.label} not used by any dependent — school cannot be inferred; assign or delete explicitly (BL-62 rule S4)` });
  }
  // Dependents whose school cannot be derived (student has no enrolment in the row's session) — never guessed.
  const orphanDeps = await q(`
    SELECT 'FeeVoucher' AS entity, v.id FROM "FeeVoucher" v
      WHERE NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."studentId" = v."studentId" AND e."academicSessionId" = v."academicSessionId")
    UNION ALL
    SELECT 'ReportCard', r.id FROM "ReportCard" r
      WHERE NOT EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."studentId" = r."studentId" AND e."academicSessionId" = r."academicSessionId")`);
  summary.sessionDependentsUnresolvable = orphanDeps.length;
  for (const r of orphanDeps) review.push({ category: 'SESSION_DEPENDENT_UNRESOLVABLE', entity: r.entity, id: r.id, detail: 'student has no enrolment in this session — school cannot be derived; assign manually before re-pointing' });

  // ---- subjects (Timetable / Assessment / DiaryEntry → Class → Campus → School)
  const subjects = await q(`
    SELECT s.id, s.name, COALESCE(array_agg(DISTINCT cp."schoolId") FILTER (WHERE cp."schoolId" IS NOT NULL), '{}') AS schools
    FROM "Subject" s
    LEFT JOIN (
      SELECT t."subjectId" AS sid, c."campusId" FROM "Timetable" t JOIN "Section" sec ON sec.id = t."sectionId" JOIN "Class" c ON c.id = sec."classId"
      UNION
      SELECT a."subjectId", c."campusId" FROM "Assessment" a JOIN "AssessmentCategory" ac ON ac.id = a."assessmentCategoryId" JOIN "Class" c ON c.id = ac."classId"
      UNION
      SELECT d."subjectId", c."campusId" FROM "DiaryEntry" d JOIN "Section" sec ON sec.id = d."sectionId" JOIN "Class" c ON c.id = sec."classId"
    ) u ON u.sid = s.id
    LEFT JOIN "Campus" cp ON cp.id = u."campusId"
    GROUP BY s.id, s.name ORDER BY s.name`);
  summary.subjects = subjects.length;
  summary.subjectsSharedAcrossSchools = subjects.filter((s) => s.schools.length > 1).length;
  summary.subjectsSingleSchool = subjects.filter((s) => s.schools.length === 1).length;
  summary.subjectsUnreferenced = subjects.filter((s) => s.schools.length === 0).length;
  for (const s of subjects) {
    if (s.schools.length > 1) review.push({ category: 'SUBJECT_CLONE_REQUIRED', entity: 'Subject', id: s.id, detail: `${s.name} used by ${s.schools.length} schools` });
    if (s.schools.length === 0) review.push({ category: 'SUBJECT_UNREFERENCED', entity: 'Subject', id: s.id, detail: `${s.name} unused — BL-62 rule U3: assign to its school or delete explicitly (never copied, never guessed)` });
  }

  // ---- fee structures (no FK: attribution is inferred from FeeItem.label = FeeStructure.name, see header)
  const fees = await q(`
    SELECT f.id, f.name,
      (SELECT count(*)::int FROM "FeeStructure" f2 WHERE f2.name = f.name) AS same_name,
      COALESCE(array_agg(DISTINCT cp."schoolId") FILTER (WHERE cp."schoolId" IS NOT NULL), '{}') AS schools
    FROM "FeeStructure" f
    LEFT JOIN "FeeItem" i ON i.label = f.name
    LEFT JOIN "FeeVoucher" v ON v.id = i."feeVoucherId"
    LEFT JOIN "Enrollment" e ON e."studentId" = v."studentId" AND e."academicSessionId" = v."academicSessionId"
    LEFT JOIN "Campus" cp ON cp.id = e."campusId"
    GROUP BY f.id, f.name ORDER BY f.name`);
  summary.feeStructures = fees.length;
  summary.feeStructuresNameCollision = fees.filter((f) => f.same_name > 1).length;
  const feeClear = fees.filter((f) => f.same_name === 1);
  summary.feeStructuresSharedAcrossSchools = feeClear.filter((f) => f.schools.length > 1).length;
  summary.feeStructuresSingleSchool = feeClear.filter((f) => f.schools.length === 1).length;
  summary.feeStructuresUnreferenced = feeClear.filter((f) => f.schools.length === 0).length;
  for (const f of fees) {
    if (f.same_name > 1) review.push({ category: 'FEE_STRUCTURE_NAME_COLLISION', entity: 'FeeStructure', id: f.id, detail: `${f.name}: ${f.same_name} structures share this name — label-based attribution impossible; assign school manually` });
    else if (f.schools.length > 1) review.push({ category: 'FEE_STRUCTURE_CLONE_REQUIRED', entity: 'FeeStructure', id: f.id, detail: `${f.name} issued (by label) in ${f.schools.length} schools — clone per school; clones start LOCKED` });
    else if (f.schools.length === 0) review.push({ category: 'FEE_STRUCTURE_UNREFERENCED', entity: 'FeeStructure', id: f.id, detail: `${f.name} never issued — BL-62 rule F3: assign to its school or archive explicitly (never copied, never guessed)` });
    else review.push({ category: 'FEE_STRUCTURE_ATTRIBUTED_BY_LABEL', entity: 'FeeStructure', id: f.id, detail: `${f.name} attributed to one school by FeeItem label only — confirm (non-blocking, BL-62 rule F1)` });
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
  // StudentParent already carries relationship/isPrimary (migration 20260919090000); M6 only adds the primary-slot rule.
  const multiPrimary = await q(`SELECT "studentId", count(*)::int AS n FROM "StudentParent" WHERE "isPrimary" GROUP BY "studentId" HAVING count(*) > 2`);
  summary.studentsWithMoreThanTwoPrimaryGuardians = multiPrimary.length;
  for (const r of multiPrimary) review.push({ category: 'GUARDIAN_MULTIPLE_PRIMARY', entity: 'Student', id: r.studentId, detail: `${r.n} links flagged isPrimary — Q4 allows at most 2 primary guardians; choose manually (BL-62 rule G5)` });
  summary.guardianLinksDefaultRelationship = (await q(`SELECT count(*)::int AS n FROM "StudentParent" WHERE relationship = 'guardian'`))[0].n;
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

  // ---- attendance actor backfill (M1): the audit actions the code ACTUALLY writes (attendance.service.ts,
  // leave.service.ts) — `attendance.mark` (entityId = the Attendance row), `attendance.mark-bulk` (metadata.date +
  // metadata.studentIds) and `leave-request.approve` (LEAVE rows inside the approved request's date range).
  // There is no `attendance.update` action; the earlier plan text naming it was wrong.
  const att = await q(`
    SELECT a.id, (
      EXISTS (SELECT 1 FROM "AuditLog" l WHERE l.action = 'attendance.mark' AND l."userId" IS NOT NULL AND l."entityId" = a.id)
      OR EXISTS (SELECT 1 FROM "AuditLog" l WHERE l.action = 'attendance.mark-bulk' AND l."userId" IS NOT NULL
        AND left(l.metadata::jsonb ->> 'date', 10) = to_char(a.date, 'YYYY-MM-DD')
        AND (l.metadata::jsonb -> 'studentIds') ? a."studentId")
      OR (a.status = 'LEAVE' AND EXISTS (SELECT 1 FROM "AuditLog" l JOIN "LeaveRequest" r ON r.id = l."entityId"
        WHERE l.action = 'leave-request.approve' AND l."userId" IS NOT NULL
          AND r."studentId" = a."studentId" AND a.date BETWEEN r."startDate" AND r."endDate"))
    ) AS backfillable FROM "Attendance" a`);
  summary.attendance = att.length;
  summary.attendanceActorBackfillable = att.filter((r) => r.backfillable).length;
  summary.attendanceActorUnresolvable = att.filter((r) => !r.backfillable).length;
  summary.sectionsWithoutClassTeacher = (await q(`SELECT count(*)::int AS n FROM "Section" WHERE "classTeacherId" IS NULL`))[0].n;

  // ---- M12 (BL-53) invariants: migration 20260926120000 refuses to run while any of these exist (all blocking).
  const dupEnr = await q(`SELECT "studentId", array_agg(id ORDER BY "startDate") AS ids FROM "Enrollment" WHERE status = 'ACTIVE' GROUP BY 1 HAVING count(*) > 1`);
  summary.studentsWithSeveralActiveEnrolments = dupEnr.length;
  for (const r of dupEnr) review.push({ category: 'M12_DUPLICATE_ACTIVE_ENROLMENT', entity: 'Student', id: r.studentId, detail: `${r.ids.length} ACTIVE enrolments (${r.ids.join(', ')}) — close all but the current one before M12 (blocking)` });
  const dupVch = await q(`SELECT "studentId", "academicSessionId", month, array_agg(id ORDER BY "createdAt") AS ids FROM "FeeVoucher" GROUP BY 1, 2, 3 HAVING count(*) > 1`);
  summary.duplicateVoucherGroups = dupVch.length;
  for (const r of dupVch) review.push({ category: 'M12_DUPLICATE_VOUCHER', entity: 'FeeVoucher', id: r.ids.join('|'), detail: `student ${r.studentId}: ${r.ids.length} vouchers for ${r.month} in one session — keep one (move payments first) before M12 (blocking)` });
  const allowed = {
    Complaint: ['open', 'in_progress', 'resolved'],
    LeaveRequest: ['pending', 'approved', 'rejected'],
    FeePayment: ['pending', 'completed', 'failed'],
    Application: ['SUBMITTED', 'UNDER_REVIEW', 'WITHDRAWN', 'APPROVED', 'REJECTED'],
    HiringApplication: ['SUBMITTED', 'SHORTLISTED', 'INTERVIEWED', 'APPROVED', 'REJECTED'],
  };
  summary.invalidStatusRows = 0;
  for (const [table, values] of Object.entries(allowed)) {
    const bad = await q(`SELECT id, status FROM "${table}" WHERE status <> ALL($1::text[])`, [values]);
    summary.invalidStatusRows += bad.length;
    for (const r of bad) review.push({ category: 'M12_INVALID_STATUS', entity: table, id: r.id, detail: `status "${r.status}" is not one of ${values.join('/')} — correct it before M12 (blocking)` });
  }

  return { summary, review };
}
