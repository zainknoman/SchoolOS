-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Campus" ADD COLUMN     "addressId" TEXT,
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "campusType" TEXT,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "departments" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "logoFileId" TEXT,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "openingDate" TIMESTAMP(3),
ADD COLUMN     "principalEmail" TEXT,
ADD COLUMN     "principalName" TEXT,
ADD COLUMN     "principalPhone" TEXT,
ADD COLUMN     "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "School" ADD COLUMN     "addressId" TEXT,
ADD COLUMN     "alternatePhone" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "currency" TEXT DEFAULT 'PKR',
ADD COLUMN     "educationBoard" TEXT,
ADD COLUMN     "establishedDate" TIMESTAMP(3),
ADD COLUMN     "logoFileId" TEXT,
ADD COLUMN     "principalEmail" TEXT,
ADD COLUMN     "principalName" TEXT,
ADD COLUMN     "principalPhone" TEXT,
ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "schoolType" TEXT,
ADD COLUMN     "status" "OrgStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "timezone" TEXT DEFAULT 'Asia/Karachi',
ADD COLUMN     "website" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Campus_schoolId_code_key" ON "Campus"("schoolId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "School_code_key" ON "School"("code");

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_logoFileId_fkey" FOREIGN KEY ("logoFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

