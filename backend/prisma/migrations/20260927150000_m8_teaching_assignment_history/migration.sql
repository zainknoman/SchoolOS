-- M8 (BL-25, Q15): teaching-assignment history — who was class teacher / subject teacher of which
-- section, in which session, from when to when.
--
-- Rows are written by the database itself, so every path that changes an assignment is covered
-- (section API, timetable edits and "replace", copy-structure, bulk import, and the SET NULL
-- cascades when a teacher or subject is deleted):
--   * Section.classTeacherId and every Timetable row fire a DEFERRED constraint trigger that
--     re-syncs the section's open assignments at COMMIT — a timetable saved again unchanged
--     (delete + re-insert in one transaction) therefore closes and opens nothing;
--   * a change end-dates the old row and opens a new one; nothing is overwritten;
--   * a section about to be deleted has its open rows closed first.
-- Rows keep name/label snapshots, so they stay readable after the teacher, section or subject is
-- deleted (their foreign keys become NULL). Existing assignments are recorded by
-- `npm run backfill:m8` with startDateUnknown = true (start = the session's start date).
CREATE TYPE "TeachingRole" AS ENUM ('CLASS_TEACHER', 'SUBJECT_TEACHER');

CREATE TABLE "TeachingAssignment" (
    "id" TEXT NOT NULL,
    "role" "TeachingRole" NOT NULL,
    "teacherId" TEXT,
    "teacherName" TEXT NOT NULL,
    "schoolId" TEXT,
    "campusId" TEXT,
    "academicSessionId" TEXT,
    "sessionLabel" TEXT NOT NULL,
    "classId" TEXT,
    "className" TEXT NOT NULL,
    "sectionId" TEXT,
    "sectionName" TEXT NOT NULL,
    "subjectId" TEXT,
    "subjectName" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "startDateUnknown" BOOLEAN NOT NULL DEFAULT false,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TeachingAssignment_teacherId_idx" ON "TeachingAssignment"("teacherId");
CREATE INDEX "TeachingAssignment_sectionId_idx" ON "TeachingAssignment"("sectionId");
CREATE INDEX "TeachingAssignment_academicSessionId_idx" ON "TeachingAssignment"("academicSessionId");
CREATE INDEX "TeachingAssignment_schoolId_idx" ON "TeachingAssignment"("schoolId");
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_academicSessionId_fkey" FOREIGN KEY ("academicSessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- History is immutable: only closing an open row (endDate NULL -> a date) and a foreign key
-- becoming NULL (its target was deleted) are allowed.
CREATE FUNCTION "teaching_assignment_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."role" IS DISTINCT FROM OLD."role"
     OR NEW."teacherName" IS DISTINCT FROM OLD."teacherName"
     OR NEW."sessionLabel" IS DISTINCT FROM OLD."sessionLabel"
     OR NEW."className" IS DISTINCT FROM OLD."className"
     OR NEW."sectionName" IS DISTINCT FROM OLD."sectionName"
     OR NEW."subjectName" IS DISTINCT FROM OLD."subjectName"
     OR NEW."startDate" IS DISTINCT FROM OLD."startDate"
     OR NEW."startDateUnknown" IS DISTINCT FROM OLD."startDateUnknown"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR (OLD."endDate" IS NOT NULL AND NEW."endDate" IS DISTINCT FROM OLD."endDate")
     OR (NEW."teacherId" IS DISTINCT FROM OLD."teacherId" AND NEW."teacherId" IS NOT NULL)
     OR (NEW."schoolId" IS DISTINCT FROM OLD."schoolId" AND NEW."schoolId" IS NOT NULL)
     OR (NEW."campusId" IS DISTINCT FROM OLD."campusId" AND NEW."campusId" IS NOT NULL)
     OR (NEW."academicSessionId" IS DISTINCT FROM OLD."academicSessionId" AND NEW."academicSessionId" IS NOT NULL)
     OR (NEW."classId" IS DISTINCT FROM OLD."classId" AND NEW."classId" IS NOT NULL)
     OR (NEW."sectionId" IS DISTINCT FROM OLD."sectionId" AND NEW."sectionId" IS NOT NULL)
     OR (NEW."subjectId" IS DISTINCT FROM OLD."subjectId" AND NEW."subjectId" IS NOT NULL) THEN
    RAISE EXCEPTION 'TeachingAssignment rows are history and cannot be modified (only closed)' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "TeachingAssignment_immutable" BEFORE UPDATE ON "TeachingAssignment"
  FOR EACH ROW EXECUTE FUNCTION "teaching_assignment_immutable"();

-- Re-syncs one section's OPEN assignments with its current class teacher and timetable.
-- p_unknown_start: used only by the M8 backfill (start = session start, flagged unknown).
CREATE FUNCTION "sync_teaching_assignments"(p_section TEXT, p_unknown_start BOOLEAN DEFAULT false) RETURNS void LANGUAGE plpgsql AS $$
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
         (ta."role" = 'CLASS_TEACHER' AND ta."teacherId" = s.class_teacher_id)
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

CREATE FUNCTION "teaching_assignment_timetable_changed"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    PERFORM "sync_teaching_assignments"(OLD."sectionId");
  END IF;
  IF TG_OP <> 'DELETE' AND (TG_OP = 'INSERT' OR NEW."sectionId" IS DISTINCT FROM OLD."sectionId") THEN
    PERFORM "sync_teaching_assignments"(NEW."sectionId");
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Timetable_teaching_assignment" AFTER INSERT OR UPDATE OR DELETE ON "Timetable"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "teaching_assignment_timetable_changed"();

CREATE FUNCTION "teaching_assignment_section_changed"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM "sync_teaching_assignments"(NEW.id);
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER "Section_teaching_assignment" AFTER INSERT OR UPDATE OF "classTeacherId" ON "Section"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "teaching_assignment_section_changed"();

CREATE FUNCTION "teaching_assignment_section_deleted"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "TeachingAssignment" SET "endDate" = now() WHERE "sectionId" = OLD.id AND "endDate" IS NULL;
  RETURN OLD;
END;
$$;
CREATE TRIGGER "Section_teaching_assignment_delete" BEFORE DELETE ON "Section"
  FOR EACH ROW EXECUTE FUNCTION "teaching_assignment_section_deleted"();
