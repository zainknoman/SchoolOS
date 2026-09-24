-- BL-02 migration M4 (expand step; MIGRATION-STRATEGY rules U1-U3). The global unique on Subject.name is
-- relaxed to (schoolId, name) so per-school clones can share a name — relaxing is backward-compatible.
-- Backfill: npm run backfill:m4 (idempotent).
-- DropIndex
DROP INDEX "Subject_name_key";

-- AlterTable
ALTER TABLE "Subject" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "legacySubjectId" TEXT,
ADD COLUMN     "schoolId" TEXT;

-- CreateIndex
CREATE INDEX "Subject_schoolId_idx" ON "Subject"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_schoolId_name_key" ON "Subject"("schoolId", "name");

-- AddForeignKey
ALTER TABLE "Subject" ADD CONSTRAINT "Subject_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

