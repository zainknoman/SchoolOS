-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('ACTIVE', 'LEFT', 'GRADUATED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('BIRTH_CERTIFICATE', 'B_FORM', 'LEAVING_CERTIFICATE', 'TRANSFER_CERTIFICATE', 'PREVIOUS_REPORT_CARD', 'PHOTOGRAPH', 'MEDICAL_CERTIFICATE', 'CNIC', 'DEGREE_CERTIFICATE', 'CV', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "promotionDate" TIMESTAMP(3),
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "rollNumber" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "admissionDate" TIMESTAMP(3),
ADD COLUMN     "bFormNumber" TEXT,
ADD COLUMN     "currentAddressId" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "leavingDate" TIMESTAMP(3),
ADD COLUMN     "leavingReason" TEXT,
ADD COLUMN     "middleName" TEXT,
ADD COLUMN     "nationality" TEXT DEFAULT 'Pakistani',
ADD COLUMN     "permanentAddressId" TEXT,
ADD COLUMN     "placeOfBirth" TEXT,
ADD COLUMN     "preferredName" TEXT,
ADD COLUMN     "profilePhotoFileId" TEXT,
ADD COLUMN     "religion" TEXT,
ADD COLUMN     "status" "StudentStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "studentEmail" TEXT,
ADD COLUMN     "studentMobile" TEXT;

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "area" TEXT,
    "city" TEXT,
    "district" TEXT,
    "province" TEXT,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Pakistan',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentPreviousSchool" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolName" TEXT NOT NULL,
    "addressId" TEXT,
    "contactNumber" TEXT,
    "email" TEXT,
    "lastClassAttended" TEXT,
    "admissionDate" TIMESTAMP(3),
    "leavingDate" TIMESTAMP(3),
    "leavingCertificateNumber" TEXT,
    "leavingCertificateDate" TIMESTAMP(3),
    "reasonForLeaving" TEXT,
    "academicRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPreviousSchool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentEmergencyContact" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "email" TEXT,
    "addressId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentMedicalInfo" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "bloodGroup" "BloodGroup",
    "allergies" TEXT,
    "medicalConditions" TEXT,
    "specialEducationalNeeds" TEXT,
    "medicationNotes" TEXT,
    "emergencyMedicalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentMedicalInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentDocument" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileId" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentPreviousSchool_studentId_key" ON "StudentPreviousSchool"("studentId");

-- CreateIndex
CREATE INDEX "StudentEmergencyContact_studentId_idx" ON "StudentEmergencyContact"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMedicalInfo_studentId_key" ON "StudentMedicalInfo"("studentId");

-- CreateIndex
CREATE INDEX "StudentDocument_studentId_idx" ON "StudentDocument"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_bFormNumber_key" ON "Student"("bFormNumber");

-- CreateIndex
CREATE INDEX "Student_status_idx" ON "Student"("status");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_profilePhotoFileId_fkey" FOREIGN KEY ("profilePhotoFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_currentAddressId_fkey" FOREIGN KEY ("currentAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_permanentAddressId_fkey" FOREIGN KEY ("permanentAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPreviousSchool" ADD CONSTRAINT "StudentPreviousSchool_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPreviousSchool" ADD CONSTRAINT "StudentPreviousSchool_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEmergencyContact" ADD CONSTRAINT "StudentEmergencyContact_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentEmergencyContact" ADD CONSTRAINT "StudentEmergencyContact_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentMedicalInfo" ADD CONSTRAINT "StudentMedicalInfo_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentDocument" ADD CONSTRAINT "StudentDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
