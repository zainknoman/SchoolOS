-- BL-03 migration M5 (expand step, additive; MIGRATION-STRATEGY rules F1-F5). Existing structures stay ACTIVE
-- (issuable) until the backfill sets their school and lifecycle. Backfill: npm run backfill:m5 (idempotent).
-- CreateEnum
CREATE TYPE "FeeStructureStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LOCKED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "FeeItem" ADD COLUMN     "feeStructureId" TEXT;

-- AlterTable
ALTER TABLE "FeeStructure" ADD COLUMN     "legacyFeeStructureId" TEXT,
ADD COLUMN     "schoolId" TEXT,
ADD COLUMN     "status" "FeeStructureStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "FeeItem_feeStructureId_idx" ON "FeeItem"("feeStructureId");

-- CreateIndex
CREATE INDEX "FeeStructure_schoolId_idx" ON "FeeStructure"("schoolId");

-- AddForeignKey
ALTER TABLE "FeeStructure" ADD CONSTRAINT "FeeStructure_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeItem" ADD CONSTRAINT "FeeItem_feeStructureId_fkey" FOREIGN KEY ("feeStructureId") REFERENCES "FeeStructure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

