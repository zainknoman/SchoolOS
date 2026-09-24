-- BL-60 migration M1 (expand step, additive; see docs/database/MIGRATION-STRATEGY.md rules A1-A3).
-- markedById stays a Teacher FK but becomes optional: it is set only when the actor IS a Teacher.
-- markedByUserId records the real acting user. Backfill: npm run backfill:m1 (idempotent).
-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "markedByUserId" TEXT,
ALTER COLUMN "markedById" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Attendance_markedByUserId_idx" ON "Attendance"("markedByUserId");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_markedByUserId_fkey" FOREIGN KEY ("markedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

