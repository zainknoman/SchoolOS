-- AlterTable
ALTER TABLE "ParentProfile" ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "cnic" TEXT,
ADD COLUMN     "currentAddressId" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "employerName" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "permanentAddressId" TEXT,
ADD COLUMN     "whatsappNumber" TEXT;

-- AlterTable
ALTER TABLE "StudentParent" ADD COLUMN     "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPrimary" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_cnic_key" ON "ParentProfile"("cnic");

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_currentAddressId_fkey" FOREIGN KEY ("currentAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_permanentAddressId_fkey" FOREIGN KEY ("permanentAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

