-- CreateEnum
CREATE TYPE "EmployeeType" AS ENUM ('TEACHER', 'OFFICE_STAFF', 'JANITORIAL', 'HELPER', 'GUARD', 'OTHER');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED');

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "firstName" TEXT,
    "middleName" TEXT,
    "lastName" TEXT,
    "employeeType" "EmployeeType" NOT NULL,
    "campusId" TEXT NOT NULL,
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "cnic" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "profilePhotoFileId" TEXT,
    "currentAddressId" TEXT,
    "permanentAddressId" TEXT,
    "joiningDate" TIMESTAMP(3),
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "leavingDate" TIMESTAMP(3),
    "leavingReason" TEXT,
    "teacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffEmergencyContact" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
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

    CONSTRAINT "StaffEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffExperience" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "fromDate" TIMESTAMP(3),
    "toDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileId" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "verificationStatus" "DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringCandidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "cnic" TEXT,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "resumeFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiringApplication" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "employeeType" "EmployeeType" NOT NULL,
    "campusId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "decisionNotes" TEXT,
    "reviewedById" TEXT,
    "createdStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HiringApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_userId_key" ON "Staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_cnic_key" ON "Staff"("cnic");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_teacherId_key" ON "Staff"("teacherId");

-- CreateIndex
CREATE INDEX "Staff_campusId_idx" ON "Staff"("campusId");

-- CreateIndex
CREATE INDEX "Staff_employeeType_idx" ON "Staff"("employeeType");

-- CreateIndex
CREATE INDEX "StaffEmergencyContact_staffId_idx" ON "StaffEmergencyContact"("staffId");

-- CreateIndex
CREATE INDEX "StaffExperience_staffId_idx" ON "StaffExperience"("staffId");

-- CreateIndex
CREATE INDEX "StaffDocument_staffId_idx" ON "StaffDocument"("staffId");

-- CreateIndex
CREATE INDEX "HiringCandidate_contactPhone_idx" ON "HiringCandidate"("contactPhone");

-- CreateIndex
CREATE UNIQUE INDEX "HiringApplication_createdStaffId_key" ON "HiringApplication"("createdStaffId");

-- CreateIndex
CREATE INDEX "HiringApplication_candidateId_idx" ON "HiringApplication"("candidateId");

-- CreateIndex
CREATE INDEX "HiringApplication_campusId_status_idx" ON "HiringApplication"("campusId", "status");

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_profilePhotoFileId_fkey" FOREIGN KEY ("profilePhotoFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_currentAddressId_fkey" FOREIGN KEY ("currentAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_permanentAddressId_fkey" FOREIGN KEY ("permanentAddressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmergencyContact" ADD CONSTRAINT "StaffEmergencyContact_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffEmergencyContact" ADD CONSTRAINT "StaffEmergencyContact_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffExperience" ADD CONSTRAINT "StaffExperience_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringCandidate" ADD CONSTRAINT "HiringCandidate_resumeFileId_fkey" FOREIGN KEY ("resumeFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringApplication" ADD CONSTRAINT "HiringApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "HiringCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringApplication" ADD CONSTRAINT "HiringApplication_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringApplication" ADD CONSTRAINT "HiringApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiringApplication" ADD CONSTRAINT "HiringApplication_createdStaffId_fkey" FOREIGN KEY ("createdStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
