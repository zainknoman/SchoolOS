-- M8 follow-ups (BL-25), found by the BL-07 e2e:
-- 1. Removing a section's class teacher (set to none) left the old assignment OPEN: the sync compared
--    teacherId = NULL, which is never true in SQL. The function is replaced with a NULL-safe test.
-- 2. Deleting a school, campus or class that still had OPEN assignments failed: the section BEFORE
--    DELETE trigger closes the rows while their classId (campusId, …) still points at the parent
--    being deleted, and the immediate foreign-key check rejected that UPDATE. The checks are now
--    deferred to COMMIT; the ON DELETE SET NULL actions still run at once.
ALTER TABLE "TeachingAssignment" ALTER CONSTRAINT "TeachingAssignment_teacherId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "TeachingAssignment" ALTER CONSTRAINT "TeachingAssignment_schoolId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "TeachingAssignment" ALTER CONSTRAINT "TeachingAssignment_campusId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "TeachingAssignment" ALTER CONSTRAINT "TeachingAssignment_academicSessionId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "TeachingAssignment" ALTER CONSTRAINT "TeachingAssignment_classId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "TeachingAssignment" ALTER CONSTRAINT "TeachingAssignment_sectionId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "TeachingAssignment" ALTER CONSTRAINT "TeachingAssignment_subjectId_fkey" DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION "sync_teaching_assignments"(p_section TEXT, p_unknown_start BOOLEAN DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  s RECORD;
BEGIN
  SELECT sec.id, sec.name AS section_name, sec."classTeacherId" AS class_teacher_id,
         c.id AS class_id, c.name AS class_name, cp.id AS campus_id, cp."schoolId" AS school_id,
         ses.id AS session_id, ses.label AS session_label, ses."startDate" AS session_start
    INTO s
    FROM "Section" sec
    JOIN "Class" c ON c.id = sec."classId"
    JOIN "Campus" cp ON cp.id = c."campusId"
    JOIN "AcademicSession" ses ON ses.id = c."academicSessionId"
   WHERE sec.id = p_section;

  -- close what no longer holds
  UPDATE "TeachingAssignment" ta SET "endDate" = now()
   WHERE ta."sectionId" = p_section AND ta."endDate" IS NULL
     AND NOT (
       s.id IS NOT NULL AND ta."teacherId" IS NOT NULL AND (
         (ta."role" = 'CLASS_TEACHER' AND s.class_teacher_id IS NOT NULL AND ta."teacherId" = s.class_teacher_id)
         OR (ta."role" = 'SUBJECT_TEACHER' AND EXISTS (
               SELECT 1 FROM "Timetable" t
                WHERE t."sectionId" = p_section AND t."teacherId" = ta."teacherId" AND t."subjectId" = ta."subjectId"))
       )
     );
  IF s.id IS NULL THEN
    RETURN;
  END IF;

  -- open what holds and has no open row
  INSERT INTO "TeachingAssignment" (id, "role", "teacherId", "teacherName", "schoolId", "campusId", "academicSessionId",
      "sessionLabel", "classId", "className", "sectionId", "sectionName", "subjectId", "subjectName", "startDate", "startDateUnknown")
  SELECT gen_random_uuid()::text, 'CLASS_TEACHER', tch.id, tch.name, s.school_id, s.campus_id, s.session_id,
         s.session_label, s.class_id, s.class_name, s.id, s.section_name, NULL, NULL,
         CASE WHEN p_unknown_start THEN s.session_start ELSE now() END, p_unknown_start
    FROM "Teacher" tch
   WHERE tch.id = s.class_teacher_id
     AND NOT EXISTS (SELECT 1 FROM "TeachingAssignment" ta
                      WHERE ta."sectionId" = s.id AND ta."endDate" IS NULL AND ta."role" = 'CLASS_TEACHER' AND ta."teacherId" = tch.id);

  INSERT INTO "TeachingAssignment" (id, "role", "teacherId", "teacherName", "schoolId", "campusId", "academicSessionId",
      "sessionLabel", "classId", "className", "sectionId", "sectionName", "subjectId", "subjectName", "startDate", "startDateUnknown")
  SELECT gen_random_uuid()::text, 'SUBJECT_TEACHER', x.teacher_id, x.teacher_name, s.school_id, s.campus_id, s.session_id,
         s.session_label, s.class_id, s.class_name, s.id, s.section_name, x.subject_id, x.subject_name,
         CASE WHEN p_unknown_start THEN s.session_start ELSE now() END, p_unknown_start
    FROM (SELECT DISTINCT tch.id AS teacher_id, tch.name AS teacher_name, sub.id AS subject_id, sub.name AS subject_name
            FROM "Timetable" t
            JOIN "Teacher" tch ON tch.id = t."teacherId"
            JOIN "Subject" sub ON sub.id = t."subjectId"
           WHERE t."sectionId" = s.id) x
   WHERE NOT EXISTS (SELECT 1 FROM "TeachingAssignment" ta
                      WHERE ta."sectionId" = s.id AND ta."endDate" IS NULL AND ta."role" = 'SUBJECT_TEACHER'
                        AND ta."teacherId" = x.teacher_id AND ta."subjectId" = x.subject_id);
END;
$$;
