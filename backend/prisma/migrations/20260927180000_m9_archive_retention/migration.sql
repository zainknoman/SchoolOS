-- M9 (BL-07 + BL-63, Q7, RD-6): archive instead of hard delete, and a configurable retention policy.
-- Additive only; no data changes. Nothing is ever deleted automatically.

-- BL-07: archived students, staff and teachers leave the active lists but stay readable.
ALTER TABLE "Student"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT,
  ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "Student" ADD CONSTRAINT "Student_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Student_archivedAt_idx" ON "Student"("archivedAt");

ALTER TABLE "Staff"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT,
  ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Staff_archivedAt_idx" ON "Staff"("archivedAt");

ALTER TABLE "Teacher" ADD COLUMN "archivedAt" TIMESTAMP(3);
CREATE INDEX "Teacher_archivedAt_idx" ON "Teacher"("archivedAt");

-- BL-63: one row per data category; every period starts UNSET (legal review pending, RD-6).
CREATE TYPE "RetentionCategory" AS ENUM (
  'STUDENT', 'GUARDIAN', 'STAFF', 'ATTENDANCE', 'ACADEMIC_RESULTS', 'FEES_FINANCIAL',
  'COMPLAINTS', 'AUDIT_LOGS', 'AUTH_SECURITY_LOGS', 'UPLOADED_DOCUMENTS', 'BACKUPS');

CREATE TABLE "RetentionPolicy" (
    "category" "RetentionCategory" NOT NULL,
    "periodMonths" INTEGER,
    "legalBasis" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("category"),
    CONSTRAINT "RetentionPolicy_periodMonths_check" CHECK ("periodMonths" IS NULL OR "periodMonths" > 0)
);
ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "RetentionPolicy" ("category")
SELECT unnest(enum_range(NULL::"RetentionCategory"));
