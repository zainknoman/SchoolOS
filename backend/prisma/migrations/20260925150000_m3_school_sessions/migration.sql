-- BL-01 migration M3 (expand step, additive; MIGRATION-STRATEGY rules S1-S6, decisions D1/D2/D7).
-- Backfill: npm run backfill:m3 (idempotent; refuses while a school would have two active sessions).
-- AlterTable
ALTER TABLE "AcademicSession" ADD COLUMN     "legacySessionId" TEXT,
ADD COLUMN     "schoolId" TEXT;

-- CreateIndex
CREATE INDEX "AcademicSession_schoolId_idx" ON "AcademicSession"("schoolId");

-- AddForeignKey
ALTER TABLE "AcademicSession" ADD CONSTRAINT "AcademicSession_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

