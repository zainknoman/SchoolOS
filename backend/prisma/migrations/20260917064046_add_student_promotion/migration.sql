-- CreateEnum
CREATE TYPE "PromotionDecision" AS ENUM ('PROMOTED', 'RETAINED', 'TRANSFERRED_OUT', 'GRADUATED', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "EnrollmentStatus" ADD VALUE 'WITHDRAWN';

-- CreateTable
CREATE TABLE "StudentPromotion" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromEnrollmentId" TEXT NOT NULL,
    "toEnrollmentId" TEXT,
    "decision" "PromotionDecision" NOT NULL,
    "remarks" TEXT,
    "decidedById" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentPromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentPromotion_fromEnrollmentId_key" ON "StudentPromotion"("fromEnrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentPromotion_toEnrollmentId_key" ON "StudentPromotion"("toEnrollmentId");

-- CreateIndex
CREATE INDEX "StudentPromotion_studentId_idx" ON "StudentPromotion"("studentId");

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_fromEnrollmentId_fkey" FOREIGN KEY ("fromEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_toEnrollmentId_fkey" FOREIGN KEY ("toEnrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPromotion" ADD CONSTRAINT "StudentPromotion_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
