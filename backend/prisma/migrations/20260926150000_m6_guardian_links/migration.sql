-- M6 (BL-04 + BL-23, owner Q4): typed guardian relationship and at most two primary guardians per student.
-- Expand only: new enum + columns; the legacy "relationship" text and "isPrimary" flag stay (the code keeps
-- them in step) until a later contract migration. Existing links are converted by `npm run backfill:m6`
-- (rules G4/G5 in docs/database/MIGRATION-STRATEGY.md), not here.
CREATE TYPE "GuardianRelationship" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN', 'OTHER');

ALTER TABLE "StudentParent"
  ADD COLUMN "relationshipType" "GuardianRelationship" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "relationshipNote" TEXT,
  ADD COLUMN "primarySlot" INTEGER,
  ADD CONSTRAINT "StudentParent_primarySlot_check" CHECK ("primarySlot" IN (1, 2));

-- Slot 1 and slot 2 each belong to at most one guardian of a student (NULL = not primary).
CREATE UNIQUE INDEX "StudentParent_studentId_primarySlot_key" ON "StudentParent"("studentId", "primarySlot");
