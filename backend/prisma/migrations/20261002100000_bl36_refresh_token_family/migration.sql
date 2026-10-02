-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "rotatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
