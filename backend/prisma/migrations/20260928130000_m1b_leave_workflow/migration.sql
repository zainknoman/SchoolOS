-- BL-29 (M1b, additive): leave recommendation (teacher) and decision (school admin), each with its
-- real actor, time and note. No backfill: decided legacy rows keep NULL decider (the audit log has it).
-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "decidedById" TEXT,
ADD COLUMN     "decisionNote" TEXT,
ADD COLUMN     "recommendationNote" TEXT,
ADD COLUMN     "recommendedAt" TIMESTAMP(3),
ADD COLUMN     "recommendedById" TEXT,
ADD COLUMN     "recommendsApproval" BOOLEAN;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_recommendedById_fkey" FOREIGN KEY ("recommendedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
