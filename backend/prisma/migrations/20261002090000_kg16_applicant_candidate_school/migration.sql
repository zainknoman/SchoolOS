-- AlterTable
ALTER TABLE "Applicant" ADD COLUMN     "schoolId" TEXT;

-- AlterTable
ALTER TABLE "HiringCandidate" ADD COLUMN     "schoolId" TEXT;

-- CreateIndex
CREATE INDEX "Applicant_schoolId_idx" ON "Applicant"("schoolId");

-- CreateIndex
CREATE INDEX "HiringCandidate_schoolId_idx" ON "HiringCandidate"("schoolId");

-- AddForeignKey
ALTER TABLE "HiringCandidate" ADD CONSTRAINT "HiringCandidate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Applicant" ADD CONSTRAINT "Applicant_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;
