-- M12 (BL-53, KI-12, KI-13): database invariants the code relied on but never enforced.
--   * at most one ACTIVE enrolment per student (partial unique index)
--   * at most one fee voucher per student, session and month (unique)
--   * status columns that are free strings accept only the values the code writes (CHECK)
-- DATA CHECK FIRST: the block below refuses the whole migration (nothing is changed) when existing
-- rows violate any rule. `npm run migration:dry-run` lists the offending rows as M12_* review items;
-- resolve them, then `npx prisma migrate resolve --rolled-back 20260926120000_m12_db_invariants`
-- and deploy again (docs/operations/RUNBOOKS.md).
DO $$
DECLARE
  dup_enrolments int;
  dup_vouchers int;
  bad_status text;
BEGIN
  SELECT count(*) INTO dup_enrolments FROM (
    SELECT 1 FROM "Enrollment" WHERE status = 'ACTIVE' GROUP BY "studentId" HAVING count(*) > 1) d;
  SELECT count(*) INTO dup_vouchers FROM (
    SELECT 1 FROM "FeeVoucher" GROUP BY "studentId", "academicSessionId", "month" HAVING count(*) > 1) d;
  SELECT string_agg(t, ', ') INTO bad_status FROM (
    SELECT 'Complaint' AS t WHERE EXISTS (SELECT 1 FROM "Complaint" WHERE status NOT IN ('open', 'in_progress', 'resolved'))
    UNION ALL SELECT 'LeaveRequest' WHERE EXISTS (SELECT 1 FROM "LeaveRequest" WHERE status NOT IN ('pending', 'approved', 'rejected'))
    UNION ALL SELECT 'FeePayment' WHERE EXISTS (SELECT 1 FROM "FeePayment" WHERE status NOT IN ('pending', 'completed', 'failed'))
    UNION ALL SELECT 'Application' WHERE EXISTS (SELECT 1 FROM "Application" WHERE status NOT IN ('SUBMITTED', 'UNDER_REVIEW', 'WITHDRAWN', 'APPROVED', 'REJECTED'))
    UNION ALL SELECT 'HiringApplication' WHERE EXISTS (SELECT 1 FROM "HiringApplication" WHERE status NOT IN ('SUBMITTED', 'SHORTLISTED', 'INTERVIEWED', 'APPROVED', 'REJECTED'))
    UNION ALL SELECT 'MigrationReviewItem' WHERE EXISTS (SELECT 1 FROM "MigrationReviewItem" WHERE status NOT IN ('OPEN', 'RESOLVED', 'WONTFIX'))
  ) s;
  IF dup_enrolments > 0 OR dup_vouchers > 0 OR bad_status IS NOT NULL THEN
    RAISE EXCEPTION 'M12 refused: % student(s) with more than one ACTIVE enrolment, % duplicate voucher group(s), invalid status values in: %. Run npm run migration:dry-run and resolve the M12_* review rows first.',
      dup_enrolments, dup_vouchers, coalesce(bad_status, 'none');
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_one_active_per_student" ON "Enrollment"("studentId") WHERE (status = 'ACTIVE');

-- CreateIndex
CREATE UNIQUE INDEX "FeeVoucher_studentId_academicSessionId_month_key" ON "FeeVoucher"("studentId", "academicSessionId", "month");

-- Status value checks (not modelled by Prisma; the allowed lists mirror the DTOs/services).
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_status_check" CHECK (status IN ('open', 'in_progress', 'resolved'));
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_status_check" CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE "FeePayment" ADD CONSTRAINT "FeePayment_status_check" CHECK (status IN ('pending', 'completed', 'failed'));
ALTER TABLE "Application" ADD CONSTRAINT "Application_status_check" CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'WITHDRAWN', 'APPROVED', 'REJECTED'));
ALTER TABLE "HiringApplication" ADD CONSTRAINT "HiringApplication_status_check" CHECK (status IN ('SUBMITTED', 'SHORTLISTED', 'INTERVIEWED', 'APPROVED', 'REJECTED'));
ALTER TABLE "MigrationReviewItem" ADD CONSTRAINT "MigrationReviewItem_status_check" CHECK (status IN ('OPEN', 'RESOLVED', 'WONTFIX'));
