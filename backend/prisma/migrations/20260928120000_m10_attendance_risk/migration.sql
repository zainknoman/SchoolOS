-- BL-28 (M10, part 4; additive): per-school attendance-risk settings (no row = defaults 30/25/5).
-- CreateTable
CREATE TABLE "AttendanceRiskPolicy" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "windowDays" INTEGER NOT NULL DEFAULT 30,
    "thresholdPercent" INTEGER NOT NULL DEFAULT 25,
    "minTrackedDays" INTEGER NOT NULL DEFAULT 5,
    "notifyParents" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRiskPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRiskPolicy_schoolId_key" ON "AttendanceRiskPolicy"("schoolId");

-- AddForeignKey
ALTER TABLE "AttendanceRiskPolicy" ADD CONSTRAINT "AttendanceRiskPolicy_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRiskPolicy" ADD CONSTRAINT "AttendanceRiskPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
