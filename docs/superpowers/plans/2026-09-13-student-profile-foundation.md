# Student Profile Foundation (Sub-project 1, backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Student data model (schema + backend API) with identity/contact/academic
fields, a reusable Address model, previous-school, emergency-contact, medical/welfare, and document
sub-resources — all additive, none of it breaking the existing minimal Student CRUD/enrollment/bulk
import flows.

**Architecture:** All new schema is additive (new tables, or new nullable/defaulted columns on
`Student`/`Enrollment`) per `docs/database/migration-plan.md`. A new `StudentProfileController` +
`StudentProfileService` pair owns every new sub-resource route, kept separate from the existing
`StudentController`/`StudentService` (which keeps its current responsibility: core create/list/
update/delete + enrollment). Existing generic `File` model is reused for documents via a new
`StudentDocument` join model, mirroring the existing `DiaryAttachment`/`CircularAttachment`
pattern.

**Tech Stack:** NestJS, Prisma (Postgres), class-validator/class-transformer, Jest.

**Spec:** `docs/database/data-model-design.md` (Sub-project 1 section), `docs/database/
migration-plan.md` (Sub-project 1 section), `docs/database/full-data-model-audit.md`.

## Global Constraints

- Every schema change is additive: new tables, or new nullable/defaulted columns. No existing
  column is renamed, retyped destructively, or dropped. No `prisma migrate reset`.
- Every existing `Student`/`Enrollment` consumer (DTOs, controllers, seed, bulk-import,
  `student.service.spec.ts`) must keep passing unmodified — new fields are additive and optional.
- No re-enrollment/transfer/promotion *workflow* is built here (that's explicitly out of scope,
  per the audit) — only a minimal roll-number/remarks edit on the student's current active
  enrollment, not a new-Enrollment-row-creation flow.
- Out of scope for this plan (deferred to follow-on sub-projects/plans, not silently dropped):
  staff-console UI for these new fields (Sub-project 1B), e2e test coverage (no `Student` e2e
  suite exists today — this plan adds unit coverage only, matching the module's existing
  unit-test-only pattern), bulk-import CSV columns for the new fields, parent-app visibility of
  documents.
- Roles: every new route is `SCHOOL_ADMIN`/`SUPER_ADMIN` only, matching the existing
  `StudentController`.
- Money/dates: dates arrive over the wire as ISO strings (`@IsDateString`) and are converted to
  `Date` in the service layer, matching how `CreateStudentDto`/existing DTOs handle strings.

---

### Task 1: Schema — enums, Address, Student sub-tables, additive columns; migration; seed

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`
- Create (generated, not hand-written): `backend/prisma/migrations/<timestamp>_add_student_profile_and_documents/migration.sql`

**Interfaces:**
- Produces: Prisma models/enums `Gender`, `BloodGroup`, `StudentStatus`, `DocumentType`,
  `DocumentVerificationStatus`, `Address`, `StudentPreviousSchool`, `StudentEmergencyContact`,
  `StudentMedicalInfo`, `StudentDocument`, plus new fields on `Student` and `Enrollment` — every
  later task's Prisma calls depend on these exact names.

- [ ] **Step 1: Add the new enums to `schema.prisma`**

  Insert immediately after the existing `enum NotificationChannel { ... }` block (currently ending
  around line 48):

  ```prisma
  enum Gender {
    MALE
    FEMALE
    OTHER
  }

  enum BloodGroup {
    A_POS
    A_NEG
    B_POS
    B_NEG
    AB_POS
    AB_NEG
    O_POS
    O_NEG
    UNKNOWN
  }

  enum StudentStatus {
    ACTIVE
    LEFT
    GRADUATED
    WITHDRAWN
  }

  // Shared across every document join model added for Student/Parent/Teacher/Application across
  // all four data-model sub-projects — extend this enum's members later, never fork a per-owner
  // copy of it.
  enum DocumentType {
    BIRTH_CERTIFICATE
    B_FORM
    LEAVING_CERTIFICATE
    TRANSFER_CERTIFICATE
    PREVIOUS_REPORT_CARD
    PHOTOGRAPH
    MEDICAL_CERTIFICATE
    CNIC
    DEGREE_CERTIFICATE
    CV
    OTHER
  }

  enum DocumentVerificationStatus {
    PENDING
    VERIFIED
    REJECTED
  }
  ```

- [ ] **Step 2: Add the new `Student` fields and relations**

  In `model Student { ... }`, replace:

  ```prisma
  model Student {
    id                 String              @id @default(uuid())
    grNumber           String              @unique
    name               String
    parents            StudentParent[]
  ```

  with:

  ```prisma
  model Student {
    id                 String                    @id @default(uuid())
    grNumber           String                    @unique
    name               String
    firstName          String?
    middleName         String?
    lastName           String?
    preferredName      String?
    gender             Gender?
    dateOfBirth        DateTime?
    placeOfBirth       String?
    nationality        String?                   @default("Pakistani")
    religion           String?
    bFormNumber        String?                   @unique
    profilePhotoFileId String?
    profilePhoto       File?                     @relation(fields: [profilePhotoFileId], references: [id], onDelete: SetNull)
    status             StudentStatus             @default(ACTIVE)
    admissionDate      DateTime?
    leavingDate        DateTime?
    leavingReason       String?
    studentMobile      String?
    studentEmail       String?
    currentAddressId   String?
    currentAddress     Address?                  @relation("StudentCurrentAddress", fields: [currentAddressId], references: [id], onDelete: SetNull)
    permanentAddressId String?
    permanentAddress   Address?                  @relation("StudentPermanentAddress", fields: [permanentAddressId], references: [id], onDelete: SetNull)
    previousSchool     StudentPreviousSchool?
    emergencyContacts  StudentEmergencyContact[]
    medicalInfo        StudentMedicalInfo?
    documents          StudentDocument[]
    parents            StudentParent[]
  ```

  Leave every other existing field on `Student` (`enrollments`, `attendance`, `feeVouchers`,
  `leaveRequests`, `conversations`, `complaints`, `reportCards`, `attendanceRiskFlag`, `marks`,
  `application`, `createdAt`, `updatedAt`) exactly as-is. Add one index at the end of the model
  body, before the closing `}`:

  ```prisma
    @@index([status])
  ```

- [ ] **Step 3: Add the additive `Enrollment` columns**

  In `model Enrollment { ... }`, change:

  ```prisma
    startDate         DateTime
    endDate           DateTime?
    status            EnrollmentStatus @default(ACTIVE)
    createdAt         DateTime         @default(now())
  ```

  to:

  ```prisma
    startDate         DateTime
    endDate           DateTime?
    status            EnrollmentStatus @default(ACTIVE)
    rollNumber         String?
    promotionDate      DateTime?
    remarks            String?
    createdAt         DateTime         @default(now())
  ```

- [ ] **Step 4: Add the new standalone models**

  Insert a new section after `model StudentParent { ... }` (currently ending around line 273):

  ```prisma
  // --- Student profile satellite models (Sub-project 1) --------------------------------------

  // Reusable address value-object, referenced by plain nullable FK from whichever entity needs
  // it. Each row is owned by exactly one FK — never shared/reused across owners.
  model Address {
    id                String                    @id @default(uuid())
    line1             String
    line2             String?
    area              String?
    city              String?
    district          String?
    province          String?
    postalCode        String?
    country           String                    @default("Pakistan")
    studentsCurrent   Student[]                 @relation("StudentCurrentAddress")
    studentsPermanent Student[]                 @relation("StudentPermanentAddress")
    previousSchools   StudentPreviousSchool[]
    emergencyContacts StudentEmergencyContact[]
    createdAt         DateTime                  @default(now())
    updatedAt         DateTime                  @updatedAt
  }

  model StudentPreviousSchool {
    id                       String    @id @default(uuid())
    studentId                String    @unique
    student                  Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
    schoolName               String
    addressId                String?
    address                  Address?  @relation(fields: [addressId], references: [id], onDelete: SetNull)
    contactNumber            String?
    email                    String?
    lastClassAttended        String?
    admissionDate            DateTime?
    leavingDate              DateTime?
    leavingCertificateNumber String?
    leavingCertificateDate   DateTime?
    reasonForLeaving         String?
    academicRemarks          String?
    createdAt                DateTime  @default(now())
    updatedAt                DateTime  @updatedAt
  }

  model StudentEmergencyContact {
    id             String   @id @default(uuid())
    studentId      String
    student        Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
    name           String
    relationship   String
    phone          String
    alternatePhone String?
    email          String?
    addressId      String?
    address        Address? @relation(fields: [addressId], references: [id], onDelete: SetNull)
    priority       Int      @default(1)
    isPrimary      Boolean  @default(false)
    createdAt      DateTime @default(now())
    updatedAt      DateTime @updatedAt

    @@index([studentId])
  }

  model StudentMedicalInfo {
    id                      String      @id @default(uuid())
    studentId               String      @unique
    student                 Student     @relation(fields: [studentId], references: [id], onDelete: Cascade)
    bloodGroup              BloodGroup?
    allergies               String?
    medicalConditions       String?
    specialEducationalNeeds String?
    medicationNotes         String?
    emergencyMedicalNotes   String?
    createdAt               DateTime    @default(now())
    updatedAt               DateTime    @updatedAt
  }

  model StudentDocument {
    id                 String                     @id @default(uuid())
    studentId          String
    student            Student                    @relation(fields: [studentId], references: [id], onDelete: Cascade)
    documentType       DocumentType
    fileId             String
    file               File                       @relation(fields: [fileId], references: [id], onDelete: Restrict)
    expiryDate         DateTime?
    verificationStatus DocumentVerificationStatus @default(PENDING)
    verifiedById       String?
    verifiedBy         User?                      @relation(fields: [verifiedById], references: [id], onDelete: SetNull)
    verifiedAt         DateTime?
    notes              String?
    createdAt          DateTime                   @default(now())
    updatedAt          DateTime                   @updatedAt

    @@index([studentId])
  }
  ```

- [ ] **Step 5: Add back-relations on `File` and `User`**

  In `model File { ... }`, add one line among the other back-relation fields (next to
  `reportCard ReportCard?`):

  ```prisma
    studentProfilePhotos Student[]
    studentDocuments     StudentDocument[]
  ```

  In `model User { ... }`, add one line among the other back-relation fields (next to
  `reviewedApplications Application[]`):

  ```prisma
    verifiedStudentDocuments StudentDocument[]
  ```

- [ ] **Step 6: Validate and generate the migration**

  Run:
  ```bash
  cd backend
  npx prisma format
  npx prisma validate
  npx prisma migrate dev --name add_student_profile_and_documents
  ```
  Expected: migration created under `prisma/migrations/`, applied cleanly to the local dev
  Postgres database, `Prisma Client` regenerated. If `prisma format` reorders field alignment,
  that's fine — it doesn't change semantics.

- [ ] **Step 7: Update the seed script with representative profile data**

  In `backend/prisma/seed.ts`, find where the 3 students are created (search for `GR-1001`). After
  the 3 `Student` (+ `Enrollment`) creations, add (using whatever variable names the existing seed
  already uses for the 3 created student records — call them `student1`, `student2`, `student3`
  below, matching whichever names the file actually uses):

  ```typescript
  const studentHomeAddress = await prisma.address.create({
    data: {
      line1: 'House 12, Street 4, Block A',
      area: 'Gulistan-e-Jauhar',
      city: 'Karachi',
      province: 'Sindh',
      postalCode: '75290',
    },
  });

  await prisma.student.update({
    where: { id: student1.id },
    data: {
      firstName: 'Eshaal',
      lastName: 'Sample',
      gender: 'FEMALE',
      dateOfBirth: new Date('2016-03-14'),
      nationality: 'Pakistani',
      status: 'ACTIVE',
      admissionDate: new Date('2022-08-01'),
      currentAddressId: studentHomeAddress.id,
    },
  });

  await prisma.studentEmergencyContact.create({
    data: {
      studentId: student1.id,
      name: 'Amina Sample',
      relationship: 'Mother',
      phone: '0300-1234567',
      isPrimary: true,
    },
  });

  await prisma.studentMedicalInfo.create({
    data: { studentId: student1.id, bloodGroup: 'O_POS', allergies: 'None known' },
  });
  ```

  Leave `student2`/`student3` with only the base fields the seed already sets (no new-field
  population needed for every seeded student — one representative profile is enough for local
  dev/demo purposes).

- [ ] **Step 8: Re-seed and verify**

  Run:
  ```bash
  npx prisma migrate reset --skip-seed
  ```
  **Do NOT run this against any environment with real data — local dev only, and only because the
  local dev DB currently holds nothing but seed data.** Then:
  ```bash
  npm run prisma:seed
  ```
  Expected: seed completes with no errors, including the new `Address`/`StudentEmergencyContact`/
  `StudentMedicalInfo` rows.

- [ ] **Step 9: Run the full existing backend test suite**

  Run:
  ```bash
  npm test
  ```
  Expected: every currently-passing test still passes unmodified — this step only changed the
  schema/seed, no application code yet.

- [ ] **Step 10: Commit**

  ```bash
  git add backend/prisma/schema.prisma backend/prisma/seed.ts backend/prisma/migrations
  git commit -m "feat(db): add Student profile schema (Address, previous school, emergency contacts, medical info, documents)"
  ```

---

### Task 2: Student profile GET/PATCH + current-enrollment roll number

**Files:**
- Create: `backend/src/common/dto/address.dto.ts`
- Create: `backend/src/student/dto/update-student-profile.dto.ts`
- Create: `backend/src/student/dto/update-current-enrollment.dto.ts`
- Create: `backend/src/student/student-profile.service.ts`
- Create: `backend/src/student/student-profile.service.spec.ts`
- Create: `backend/src/student/student-profile.controller.ts`
- Modify: `backend/src/student/student.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (from `../prisma/prisma.service`), `assertCreatable` (from
  `../common/prisma-create-guard`), `RequestUser`/`Roles` decorator (same pattern as
  `student.controller.ts`).
- Produces: `AddressDto` (reused by every later task/sub-project that needs an address),
  `StudentProfileService.getProfile(studentId): Promise<...>`,
  `StudentProfileService.updateProfile(studentId, dto, actingUserId): Promise<...>`,
  `StudentProfileService.updateCurrentEnrollment(studentId, dto, actingUserId): Promise<...>`,
  the `PROFILE_INCLUDE` Prisma include object (reused by every later step in this file).

- [ ] **Step 1: Write the shared `AddressDto`**

  `backend/src/common/dto/address.dto.ts`:
  ```typescript
  import { IsOptional, IsString, MinLength } from 'class-validator';

  // Shared by every entity that needs an address (Student today; Parent/Teacher in their own
  // sub-projects reuse this same DTO rather than duplicating the field list).
  export class AddressDto {
    @IsString()
    @MinLength(1)
    line1!: string;

    @IsOptional() @IsString() line2?: string;
    @IsOptional() @IsString() area?: string;
    @IsOptional() @IsString() city?: string;
    @IsOptional() @IsString() district?: string;
    @IsOptional() @IsString() province?: string;
    @IsOptional() @IsString() postalCode?: string;
    @IsOptional() @IsString() country?: string;
  }
  ```

- [ ] **Step 2: Write the failing test for `StudentProfileService.getProfile`/`updateProfile`**

  `backend/src/student/student-profile.service.spec.ts`:
  ```typescript
  import { Test } from '@nestjs/testing';
  import { NotFoundException } from '@nestjs/common';
  import { Prisma } from '@prisma/client';
  import { StudentProfileService } from './student-profile.service';
  import { PrismaService } from '../prisma/prisma.service';

  describe('StudentProfileService', () => {
    let service: StudentProfileService;
    let prisma: {
      student: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
      enrollment: { findFirst: jest.Mock; update: jest.Mock };
      file: { findUnique: jest.Mock };
      auditLog: { create: jest.Mock };
    };

    beforeEach(async () => {
      prisma = {
        student: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
        enrollment: { findFirst: jest.fn(), update: jest.fn() },
        file: { findUnique: jest.fn() },
        auditLog: { create: jest.fn() },
      };
      const moduleRef = await Test.createTestingModule({
        providers: [StudentProfileService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = moduleRef.get(StudentProfileService);
    });

    describe('getProfile', () => {
      it('throws NotFoundException when the student does not exist', async () => {
        prisma.student.findUnique.mockResolvedValue(null);
        await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
      });

      it('returns the full profile include when the student exists', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 's1' });
        prisma.student.findUniqueOrThrow.mockResolvedValue({ id: 's1', firstName: 'Eshaal' });

        const result = await service.getProfile('s1');

        expect(result).toEqual({ id: 's1', firstName: 'Eshaal' });
        expect(prisma.student.findUniqueOrThrow).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 's1' } }),
        );
      });
    });

    describe('updateProfile', () => {
      it('throws NotFoundException when the student does not exist', async () => {
        prisma.student.findUnique.mockResolvedValue(null);
        await expect(service.updateProfile('missing', { firstName: 'X' }, 'admin-1')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('creates a new currentAddress when the student has none yet', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
        prisma.student.update.mockResolvedValue({ id: 's1' });

        await service.updateProfile(
          's1',
          { currentAddress: { line1: 'House 1' } },
          'admin-1',
        );

        expect(prisma.student.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: 's1' },
            data: expect.objectContaining({ currentAddress: { create: { line1: 'House 1' } } }),
          }),
        );
      });

      it('updates the existing currentAddress in place when one is already linked', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: 'addr-1', permanentAddressId: null });
        prisma.student.update.mockResolvedValue({ id: 's1' });

        await service.updateProfile('s1', { currentAddress: { line1: 'New line' } }, 'admin-1');

        expect(prisma.student.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ currentAddress: { update: { line1: 'New line' } } }),
          }),
        );
      });

      it('rejects a profilePhotoFileId that was never uploaded', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
        prisma.file.findUnique.mockResolvedValue(null);

        await expect(
          service.updateProfile('s1', { profilePhotoFileId: 'missing-file' }, 'admin-1'),
        ).rejects.toThrow('Upload the photo first via POST /api/v1/files, then link it here.');
        expect(prisma.student.update).not.toHaveBeenCalled();
      });

      it('accepts a profilePhotoFileId that was already uploaded', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
        prisma.file.findUnique.mockResolvedValue({ id: 'f1' });
        prisma.student.update.mockResolvedValue({ id: 's1', profilePhotoFileId: 'f1' });

        await service.updateProfile('s1', { profilePhotoFileId: 'f1' }, 'admin-1');

        expect(prisma.student.update).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ profilePhotoFileId: 'f1' }) }),
        );
      });

      it('translates a duplicate bFormNumber into a BadRequestException', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
        prisma.student.update.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
        );

        await expect(
          service.updateProfile('s1', { bFormNumber: 'dupe' }, 'admin-1'),
        ).rejects.toThrow('This B-Form number is already in use.');
      });

      it('writes an audit log row on success', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
        prisma.student.update.mockResolvedValue({ id: 's1', firstName: 'Eshaal' });

        await service.updateProfile('s1', { firstName: 'Eshaal' }, 'admin-1');

        expect(prisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ action: 'student.profile.update', entityId: 's1' }),
          }),
        );
      });
    });

    describe('updateCurrentEnrollment', () => {
      it('throws NotFoundException when the student has no active enrollment', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 's1' });
        prisma.enrollment.findFirst.mockResolvedValue(null);

        await expect(
          service.updateCurrentEnrollment('s1', { rollNumber: '12' }, 'admin-1'),
        ).rejects.toThrow(NotFoundException);
      });

      it('updates rollNumber/remarks on the active enrollment', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 's1' });
        prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
        prisma.enrollment.update.mockResolvedValue({ id: 'enr-1', rollNumber: '12' });

        await service.updateCurrentEnrollment('s1', { rollNumber: '12' }, 'admin-1');

        expect(prisma.enrollment.update).toHaveBeenCalledWith({
          where: { id: 'enr-1' },
          data: { rollNumber: '12' },
        });
      });
    });
  });
  ```

- [ ] **Step 3: Run the test to verify it fails**

  Run: `cd backend && npx jest student-profile.service.spec.ts`
  Expected: FAIL — `Cannot find module './student-profile.service'`.

- [ ] **Step 4: Write the DTOs**

  `backend/src/student/dto/update-student-profile.dto.ts`:
  ```typescript
  import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
  import { Type } from 'class-transformer';
  import { Gender, StudentStatus } from '@prisma/client';
  import { AddressDto } from '../../common/dto/address.dto';

  export class UpdateStudentProfileDto {
    @IsOptional() @IsString() @MinLength(1) firstName?: string;
    @IsOptional() @IsString() middleName?: string;
    @IsOptional() @IsString() @MinLength(1) lastName?: string;
    @IsOptional() @IsString() preferredName?: string;
    @IsOptional() @IsEnum(Gender) gender?: Gender;
    @IsOptional() @IsDateString() dateOfBirth?: string;
    @IsOptional() @IsString() placeOfBirth?: string;
    @IsOptional() @IsString() nationality?: string;
    @IsOptional() @IsString() religion?: string;
    @IsOptional() @IsString() bFormNumber?: string;
    @IsOptional() @IsEnum(StudentStatus) status?: StudentStatus;
    @IsOptional() @IsDateString() admissionDate?: string;
    @IsOptional() @IsDateString() leavingDate?: string;
    @IsOptional() @IsString() leavingReason?: string;
    @IsOptional() @IsString() studentMobile?: string;
    @IsOptional() @IsEmail() studentEmail?: string;
    @IsOptional() @IsString() profilePhotoFileId?: string;
    @IsOptional() @ValidateNested() @Type(() => AddressDto) currentAddress?: AddressDto;
    @IsOptional() @ValidateNested() @Type(() => AddressDto) permanentAddress?: AddressDto;
  }
  ```

  `backend/src/student/dto/update-current-enrollment.dto.ts`:
  ```typescript
  import { IsOptional, IsString } from 'class-validator';

  export class UpdateCurrentEnrollmentDto {
    @IsOptional() @IsString() rollNumber?: string;
    @IsOptional() @IsString() remarks?: string;
  }
  ```

- [ ] **Step 5: Write `StudentProfileService`**

  `backend/src/student/student-profile.service.ts`:
  ```typescript
  import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
  import { Prisma } from '@prisma/client';
  import { PrismaService } from '../prisma/prisma.service';
  import { assertCreatable } from '../common/prisma-create-guard';
  import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
  import { UpdateCurrentEnrollmentDto } from './dto/update-current-enrollment.dto';

  export const PROFILE_INCLUDE = {
    currentAddress: true,
    permanentAddress: true,
    previousSchool: { include: { address: true } },
    emergencyContacts: { include: { address: true }, orderBy: { priority: 'asc' as const } },
    medicalInfo: true,
    documents: { include: { file: true }, orderBy: { createdAt: 'desc' as const } },
    enrollments: {
      where: { status: 'ACTIVE' as const },
      orderBy: { startDate: 'desc' as const },
      take: 1,
      include: { section: { include: { class: { include: { campus: true } } } } },
    },
  };

  @Injectable()
  export class StudentProfileService {
    constructor(private readonly prisma: PrismaService) {}

    private async requireStudent(studentId: string) {
      const student = await this.prisma.student.findUnique({ where: { id: studentId } });
      if (!student) {
        throw new NotFoundException('Student not found');
      }
      return student;
    }

    async getProfile(studentId: string) {
      await this.requireStudent(studentId);
      return this.prisma.student.findUniqueOrThrow({ where: { id: studentId }, include: PROFILE_INCLUDE });
    }

    async updateProfile(studentId: string, dto: UpdateStudentProfileDto, actingUserId: string) {
      const existing = await this.requireStudent(studentId);

      if (dto.profilePhotoFileId !== undefined) {
        const file = await this.prisma.file.findUnique({ where: { id: dto.profilePhotoFileId } });
        if (!file) {
          throw new BadRequestException('Upload the photo first via POST /api/v1/files, then link it here.');
        }
      }

      const data: Prisma.StudentUpdateInput = {
        ...(dto.profilePhotoFileId !== undefined ? { profilePhotoFileId: dto.profilePhotoFileId } : {}),
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.middleName !== undefined ? { middleName: dto.middleName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.preferredName !== undefined ? { preferredName: dto.preferredName } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
        ...(dto.placeOfBirth !== undefined ? { placeOfBirth: dto.placeOfBirth } : {}),
        ...(dto.nationality !== undefined ? { nationality: dto.nationality } : {}),
        ...(dto.religion !== undefined ? { religion: dto.religion } : {}),
        ...(dto.bFormNumber !== undefined ? { bFormNumber: dto.bFormNumber } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.admissionDate !== undefined ? { admissionDate: new Date(dto.admissionDate) } : {}),
        ...(dto.leavingDate !== undefined ? { leavingDate: new Date(dto.leavingDate) } : {}),
        ...(dto.leavingReason !== undefined ? { leavingReason: dto.leavingReason } : {}),
        ...(dto.studentMobile !== undefined ? { studentMobile: dto.studentMobile } : {}),
        ...(dto.studentEmail !== undefined ? { studentEmail: dto.studentEmail } : {}),
      };

      if (dto.currentAddress) {
        data.currentAddress = existing.currentAddressId
          ? { update: dto.currentAddress }
          : { create: dto.currentAddress };
      }
      if (dto.permanentAddress) {
        data.permanentAddress = existing.permanentAddressId
          ? { update: dto.permanentAddress }
          : { create: dto.permanentAddress };
      }

      let record;
      try {
        record = await this.prisma.student.update({ where: { id: studentId }, data, include: PROFILE_INCLUDE });
      } catch (error) {
        assertCreatable(error, 'This B-Form number is already in use.');
      }

      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'student.profile.update',
          entity: 'Student',
          entityId: studentId,
          metadata: JSON.stringify(dto),
        },
      });

      return record;
    }

    async updateCurrentEnrollment(studentId: string, dto: UpdateCurrentEnrollmentDto, actingUserId: string) {
      await this.requireStudent(studentId);

      const active = await this.prisma.enrollment.findFirst({
        where: { studentId, status: 'ACTIVE' },
        orderBy: { startDate: 'desc' },
      });
      if (!active) {
        throw new NotFoundException('This student has no active enrollment');
      }

      const record = await this.prisma.enrollment.update({
        where: { id: active.id },
        data: {
          ...(dto.rollNumber !== undefined ? { rollNumber: dto.rollNumber } : {}),
          ...(dto.remarks !== undefined ? { remarks: dto.remarks } : {}),
        },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'student.enrollment.update',
          entity: 'Enrollment',
          entityId: active.id,
          metadata: JSON.stringify(dto),
        },
      });

      return record;
    }
  }
  ```

- [ ] **Step 6: Run the test to verify it passes**

  Run: `npx jest student-profile.service.spec.ts`
  Expected: PASS, all cases.

- [ ] **Step 7: Write the controller**

  `backend/src/student/student-profile.controller.ts`:
  ```typescript
  import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
  import type { Request } from 'express';
  import { StudentProfileService } from './student-profile.service';
  import { UpdateStudentProfileDto } from './dto/update-student-profile.dto';
  import { UpdateCurrentEnrollmentDto } from './dto/update-current-enrollment.dto';
  import { Roles } from '../auth/decorators/roles.decorator';
  import type { RequestUser } from '../common/student-access.service';

  interface AuthenticatedRequest extends Request {
    user: RequestUser;
  }

  @Controller('api/v1/admin/students/:studentId')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  export class StudentProfileController {
    constructor(private readonly service: StudentProfileService) {}

    @Get('profile')
    getProfile(@Param('studentId') studentId: string) {
      return this.service.getProfile(studentId);
    }

    @Patch('profile')
    updateProfile(
      @Param('studentId') studentId: string,
      @Body() dto: UpdateStudentProfileDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.updateProfile(studentId, dto, req.user.id);
    }

    @Patch('current-enrollment')
    updateCurrentEnrollment(
      @Param('studentId') studentId: string,
      @Body() dto: UpdateCurrentEnrollmentDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.updateCurrentEnrollment(studentId, dto, req.user.id);
    }
  }
  ```

- [ ] **Step 8: Register the new controller/service in `StudentModule`**

  `backend/src/student/student.module.ts` — replace the whole file with:
  ```typescript
  import { Module } from '@nestjs/common';
  import { StudentService } from './student.service';
  import { StudentController } from './student.controller';
  import { StudentProfileService } from './student-profile.service';
  import { StudentProfileController } from './student-profile.controller';

  @Module({
    providers: [StudentService, StudentProfileService],
    controllers: [StudentController, StudentProfileController],
  })
  export class StudentModule {}
  ```

- [ ] **Step 9: Run the full test suite**

  Run: `npm test`
  Expected: all pass, including the new `student-profile.service.spec.ts`.

- [ ] **Step 10: Commit**

  ```bash
  git add backend/src/common/dto/address.dto.ts backend/src/student
  git commit -m "feat(student): add profile GET/PATCH and current-enrollment roll number endpoints"
  ```

---

### Task 3: Previous school PUT

**Files:**
- Create: `backend/src/student/dto/update-student-previous-school.dto.ts`
- Modify: `backend/src/student/student-profile.service.ts`
- Modify: `backend/src/student/student-profile.service.spec.ts`
- Modify: `backend/src/student/student-profile.controller.ts`

**Interfaces:**
- Consumes: `PROFILE_INCLUDE`, `requireStudent` pattern from Task 2 (same file, same class).
- Produces: `StudentProfileService.upsertPreviousSchool(studentId, dto, actingUserId): Promise<...>`.

- [ ] **Step 1: Write the failing test**

  Append to `student-profile.service.spec.ts`, inside the top-level `describe('StudentProfileService', ...)`,
  and extend the `prisma` mock object built in `beforeEach` with
  `studentPreviousSchool: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }`:
  ```typescript
  describe('upsertPreviousSchool', () => {
    it('creates a new previous-school record when none exists yet', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentPreviousSchool.findUnique.mockResolvedValue(null);
      prisma.studentPreviousSchool.create.mockResolvedValue({ id: 'ps1', schoolName: 'Old School' });

      await service.upsertPreviousSchool('s1', { schoolName: 'Old School' }, 'admin-1');

      expect(prisma.studentPreviousSchool.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ studentId: 's1', schoolName: 'Old School' }) }),
      );
    });

    it('updates the existing previous-school record in place', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentPreviousSchool.findUnique.mockResolvedValue({ id: 'ps1', addressId: null });
      prisma.studentPreviousSchool.update.mockResolvedValue({ id: 'ps1', schoolName: 'Renamed' });

      await service.upsertPreviousSchool('s1', { schoolName: 'Renamed' }, 'admin-1');

      expect(prisma.studentPreviousSchool.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's1' } }),
      );
      expect(prisma.studentPreviousSchool.create).not.toHaveBeenCalled();
    });

    it('creates a nested address when one is provided and none exists yet', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentPreviousSchool.findUnique.mockResolvedValue(null);
      prisma.studentPreviousSchool.create.mockResolvedValue({ id: 'ps1' });

      await service.upsertPreviousSchool(
        's1',
        { schoolName: 'Old School', address: { line1: 'Old address line' } },
        'admin-1',
      );

      expect(prisma.studentPreviousSchool.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ address: { create: { line1: 'Old address line' } } }),
        }),
      );
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx jest student-profile.service.spec.ts`
  Expected: FAIL — `service.upsertPreviousSchool is not a function`.

- [ ] **Step 3: Write the DTO**

  `backend/src/student/dto/update-student-previous-school.dto.ts`:
  ```typescript
  import { IsDateString, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
  import { Type } from 'class-transformer';
  import { AddressDto } from '../../common/dto/address.dto';

  export class UpdateStudentPreviousSchoolDto {
    @IsString() @MinLength(1) schoolName!: string;
    @IsOptional() @IsString() contactNumber?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsString() lastClassAttended?: string;
    @IsOptional() @IsDateString() admissionDate?: string;
    @IsOptional() @IsDateString() leavingDate?: string;
    @IsOptional() @IsString() leavingCertificateNumber?: string;
    @IsOptional() @IsDateString() leavingCertificateDate?: string;
    @IsOptional() @IsString() reasonForLeaving?: string;
    @IsOptional() @IsString() academicRemarks?: string;
    @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  }
  ```

- [ ] **Step 4: Add `upsertPreviousSchool` to `StudentProfileService`**

  Add this method to the class, and add the import
  `import { UpdateStudentPreviousSchoolDto } from './dto/update-student-previous-school.dto';`
  at the top of `student-profile.service.ts`:
  ```typescript
    async upsertPreviousSchool(studentId: string, dto: UpdateStudentPreviousSchoolDto, actingUserId: string) {
      await this.requireStudent(studentId);

      const scalarData = {
        schoolName: dto.schoolName,
        contactNumber: dto.contactNumber,
        email: dto.email,
        lastClassAttended: dto.lastClassAttended,
        admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : undefined,
        leavingDate: dto.leavingDate ? new Date(dto.leavingDate) : undefined,
        leavingCertificateNumber: dto.leavingCertificateNumber,
        leavingCertificateDate: dto.leavingCertificateDate ? new Date(dto.leavingCertificateDate) : undefined,
        reasonForLeaving: dto.reasonForLeaving,
        academicRemarks: dto.academicRemarks,
      };

      const existing = await this.prisma.studentPreviousSchool.findUnique({ where: { studentId } });

      let record;
      if (existing) {
        record = await this.prisma.studentPreviousSchool.update({
          where: { studentId },
          data: {
            ...scalarData,
            ...(dto.address
              ? { address: existing.addressId ? { update: dto.address } : { create: dto.address } }
              : {}),
          },
          include: { address: true },
        });
      } else {
        record = await this.prisma.studentPreviousSchool.create({
          data: {
            studentId,
            ...scalarData,
            ...(dto.address ? { address: { create: dto.address } } : {}),
          },
          include: { address: true },
        });
      }

      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'student.previousSchool.upsert',
          entity: 'StudentPreviousSchool',
          entityId: record.id,
          metadata: JSON.stringify(dto),
        },
      });

      return record;
    }
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx jest student-profile.service.spec.ts`
  Expected: PASS.

- [ ] **Step 6: Add the route to the controller**

  Add to `student-profile.controller.ts` (import `Put` from `@nestjs/common` and
  `UpdateStudentPreviousSchoolDto`):
  ```typescript
    @Put('previous-school')
    upsertPreviousSchool(
      @Param('studentId') studentId: string,
      @Body() dto: UpdateStudentPreviousSchoolDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.upsertPreviousSchool(studentId, dto, req.user.id);
    }
  ```

- [ ] **Step 7: Run the full test suite**

  Run: `npm test` — expect all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add backend/src/student
  git commit -m "feat(student): add previous-school upsert endpoint"
  ```

---

### Task 4: Emergency contacts CRUD

**Files:**
- Create: `backend/src/student/dto/create-student-emergency-contact.dto.ts`
- Create: `backend/src/student/dto/update-student-emergency-contact.dto.ts`
- Modify: `backend/src/student/student-profile.service.ts`
- Modify: `backend/src/student/student-profile.service.spec.ts`
- Modify: `backend/src/student/student-profile.controller.ts`

**Interfaces:**
- Produces: `StudentProfileService.listEmergencyContacts(studentId)`,
  `.createEmergencyContact(studentId, dto, actingUserId)`,
  `.updateEmergencyContact(studentId, contactId, dto, actingUserId)`,
  `.deleteEmergencyContact(studentId, contactId, actingUserId)`.

- [ ] **Step 1: Write the failing tests**

  Extend the `prisma` mock's `studentEmergencyContact` to
  `{ findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() }`
  and append:
  ```typescript
  describe('emergency contacts', () => {
    it('lists contacts ordered by priority', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentEmergencyContact.findMany.mockResolvedValue([{ id: 'c1', priority: 1 }]);

      const result = await service.listEmergencyContacts('s1');

      expect(result).toEqual([{ id: 'c1', priority: 1 }]);
      expect(prisma.studentEmergencyContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's1' }, orderBy: { priority: 'asc' } }),
      );
    });

    it('creates a contact scoped to the student', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentEmergencyContact.create.mockResolvedValue({ id: 'c1' });

      await service.createEmergencyContact(
        's1',
        { name: 'Amina', relationship: 'Mother', phone: '0300-0000000' },
        'admin-1',
      );

      expect(prisma.studentEmergencyContact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: 's1', name: 'Amina', priority: 1, isPrimary: false }),
        }),
      );
    });

    it('throws NotFoundException updating a contact that does not belong to this student', async () => {
      prisma.studentEmergencyContact.findUnique.mockResolvedValue({ id: 'c1', studentId: 'other-student' });

      await expect(
        service.updateEmergencyContact('s1', 'c1', { name: 'Renamed' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates a contact that belongs to the student', async () => {
      prisma.studentEmergencyContact.findUnique.mockResolvedValue({ id: 'c1', studentId: 's1', addressId: null });
      prisma.studentEmergencyContact.update.mockResolvedValue({ id: 'c1', name: 'Renamed' });

      await service.updateEmergencyContact('s1', 'c1', { name: 'Renamed' }, 'admin-1');

      expect(prisma.studentEmergencyContact.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1' }, data: expect.objectContaining({ name: 'Renamed' }) }),
      );
    });

    it('throws NotFoundException deleting a contact that does not belong to this student', async () => {
      prisma.studentEmergencyContact.findUnique.mockResolvedValue({ id: 'c1', studentId: 'other-student' });

      await expect(service.deleteEmergencyContact('s1', 'c1', 'admin-1')).rejects.toThrow(NotFoundException);
      expect(prisma.studentEmergencyContact.delete).not.toHaveBeenCalled();
    });

    it('deletes a contact that belongs to the student and audit-logs it', async () => {
      prisma.studentEmergencyContact.findUnique.mockResolvedValue({ id: 'c1', studentId: 's1' });

      await service.deleteEmergencyContact('s1', 'c1', 'admin-1');

      expect(prisma.studentEmergencyContact.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'student.emergencyContact.delete' }) }),
      );
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx jest student-profile.service.spec.ts` — expect FAIL (methods don't exist yet).

- [ ] **Step 3: Write the DTOs**

  `backend/src/student/dto/create-student-emergency-contact.dto.ts`:
  ```typescript
  import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
  import { Type } from 'class-transformer';
  import { AddressDto } from '../../common/dto/address.dto';

  export class CreateStudentEmergencyContactDto {
    @IsString() @MinLength(1) name!: string;
    @IsString() @MinLength(1) relationship!: string;
    @IsString() @MinLength(1) phone!: string;
    @IsOptional() @IsString() alternatePhone?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsInt() @Min(1) priority?: number;
    @IsOptional() @IsBoolean() isPrimary?: boolean;
    @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  }
  ```

  `backend/src/student/dto/update-student-emergency-contact.dto.ts`:
  ```typescript
  import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
  import { Type } from 'class-transformer';
  import { AddressDto } from '../../common/dto/address.dto';

  export class UpdateStudentEmergencyContactDto {
    @IsOptional() @IsString() @MinLength(1) name?: string;
    @IsOptional() @IsString() @MinLength(1) relationship?: string;
    @IsOptional() @IsString() @MinLength(1) phone?: string;
    @IsOptional() @IsString() alternatePhone?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsInt() @Min(1) priority?: number;
    @IsOptional() @IsBoolean() isPrimary?: boolean;
    @IsOptional() @ValidateNested() @Type(() => AddressDto) address?: AddressDto;
  }
  ```

- [ ] **Step 4: Add the four methods to `StudentProfileService`**

  Add the imports and methods:
  ```typescript
  import { CreateStudentEmergencyContactDto } from './dto/create-student-emergency-contact.dto';
  import { UpdateStudentEmergencyContactDto } from './dto/update-student-emergency-contact.dto';
  ```
  ```typescript
    async listEmergencyContacts(studentId: string) {
      await this.requireStudent(studentId);
      return this.prisma.studentEmergencyContact.findMany({
        where: { studentId },
        include: { address: true },
        orderBy: { priority: 'asc' },
      });
    }

    async createEmergencyContact(studentId: string, dto: CreateStudentEmergencyContactDto, actingUserId: string) {
      await this.requireStudent(studentId);
      const record = await this.prisma.studentEmergencyContact.create({
        data: {
          studentId,
          name: dto.name,
          relationship: dto.relationship,
          phone: dto.phone,
          alternatePhone: dto.alternatePhone,
          email: dto.email,
          priority: dto.priority ?? 1,
          isPrimary: dto.isPrimary ?? false,
          ...(dto.address ? { address: { create: dto.address } } : {}),
        },
        include: { address: true },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'student.emergencyContact.create',
          entity: 'StudentEmergencyContact',
          entityId: record.id,
          metadata: JSON.stringify(dto),
        },
      });
      return record;
    }

    async updateEmergencyContact(
      studentId: string,
      contactId: string,
      dto: UpdateStudentEmergencyContactDto,
      actingUserId: string,
    ) {
      const existing = await this.prisma.studentEmergencyContact.findUnique({ where: { id: contactId } });
      if (!existing || existing.studentId !== studentId) {
        throw new NotFoundException('Emergency contact not found');
      }

      const record = await this.prisma.studentEmergencyContact.update({
        where: { id: contactId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.relationship !== undefined ? { relationship: dto.relationship } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.alternatePhone !== undefined ? { alternatePhone: dto.alternatePhone } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          ...(dto.address
            ? { address: existing.addressId ? { update: dto.address } : { create: dto.address } }
            : {}),
        },
        include: { address: true },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'student.emergencyContact.update',
          entity: 'StudentEmergencyContact',
          entityId: contactId,
          metadata: JSON.stringify(dto),
        },
      });
      return record;
    }

    async deleteEmergencyContact(studentId: string, contactId: string, actingUserId: string) {
      const existing = await this.prisma.studentEmergencyContact.findUnique({ where: { id: contactId } });
      if (!existing || existing.studentId !== studentId) {
        throw new NotFoundException('Emergency contact not found');
      }
      await this.prisma.studentEmergencyContact.delete({ where: { id: contactId } });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'student.emergencyContact.delete',
          entity: 'StudentEmergencyContact',
          entityId: contactId,
        },
      });
    }
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx jest student-profile.service.spec.ts` — expect PASS.

- [ ] **Step 6: Add the routes to the controller**

  Add to `student-profile.controller.ts` (import `Delete`, `Post` from `@nestjs/common` and the
  two new DTOs):
  ```typescript
    @Get('emergency-contacts')
    listEmergencyContacts(@Param('studentId') studentId: string) {
      return this.service.listEmergencyContacts(studentId);
    }

    @Post('emergency-contacts')
    createEmergencyContact(
      @Param('studentId') studentId: string,
      @Body() dto: CreateStudentEmergencyContactDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.createEmergencyContact(studentId, dto, req.user.id);
    }

    @Patch('emergency-contacts/:contactId')
    updateEmergencyContact(
      @Param('studentId') studentId: string,
      @Param('contactId') contactId: string,
      @Body() dto: UpdateStudentEmergencyContactDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.updateEmergencyContact(studentId, contactId, dto, req.user.id);
    }

    @Delete('emergency-contacts/:contactId')
    async deleteEmergencyContact(
      @Param('studentId') studentId: string,
      @Param('contactId') contactId: string,
      @Req() req: AuthenticatedRequest,
    ) {
      await this.service.deleteEmergencyContact(studentId, contactId, req.user.id);
    }
  ```

- [ ] **Step 7: Run the full test suite**

  Run: `npm test` — expect all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add backend/src/student
  git commit -m "feat(student): add emergency contacts CRUD endpoints"
  ```

---

### Task 5: Medical info PUT

**Files:**
- Create: `backend/src/student/dto/update-student-medical-info.dto.ts`
- Modify: `backend/src/student/student-profile.service.ts`
- Modify: `backend/src/student/student-profile.service.spec.ts`
- Modify: `backend/src/student/student-profile.controller.ts`

**Interfaces:**
- Produces: `StudentProfileService.upsertMedicalInfo(studentId, dto, actingUserId)`.

- [ ] **Step 1: Write the failing test**

  Extend the `prisma` mock's `studentMedicalInfo` to `{ upsert: jest.fn() }` and append:
  ```typescript
  describe('upsertMedicalInfo', () => {
    it('upserts on studentId and audit-logs it', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentMedicalInfo.upsert.mockResolvedValue({ id: 'm1', bloodGroup: 'O_POS' });

      await service.upsertMedicalInfo('s1', { bloodGroup: 'O_POS' }, 'admin-1');

      expect(prisma.studentMedicalInfo.upsert).toHaveBeenCalledWith({
        where: { studentId: 's1' },
        create: { studentId: 's1', bloodGroup: 'O_POS' },
        update: { bloodGroup: 'O_POS' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'student.medicalInfo.upsert' }) }),
      );
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx jest student-profile.service.spec.ts` — expect FAIL.

- [ ] **Step 3: Write the DTO**

  `backend/src/student/dto/update-student-medical-info.dto.ts`:
  ```typescript
  import { IsEnum, IsOptional, IsString } from 'class-validator';
  import { BloodGroup } from '@prisma/client';

  export class UpdateStudentMedicalInfoDto {
    @IsOptional() @IsEnum(BloodGroup) bloodGroup?: BloodGroup;
    @IsOptional() @IsString() allergies?: string;
    @IsOptional() @IsString() medicalConditions?: string;
    @IsOptional() @IsString() specialEducationalNeeds?: string;
    @IsOptional() @IsString() medicationNotes?: string;
    @IsOptional() @IsString() emergencyMedicalNotes?: string;
  }
  ```

- [ ] **Step 4: Add `upsertMedicalInfo` to `StudentProfileService`**

  Add the import `import { UpdateStudentMedicalInfoDto } from './dto/update-student-medical-info.dto';`
  and the method:
  ```typescript
    async upsertMedicalInfo(studentId: string, dto: UpdateStudentMedicalInfoDto, actingUserId: string) {
      await this.requireStudent(studentId);
      const record = await this.prisma.studentMedicalInfo.upsert({
        where: { studentId },
        create: { studentId, ...dto },
        update: { ...dto },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'student.medicalInfo.upsert',
          entity: 'StudentMedicalInfo',
          entityId: record.id,
          metadata: JSON.stringify(dto),
        },
      });
      return record;
    }
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx jest student-profile.service.spec.ts` — expect PASS.

- [ ] **Step 6: Add the route to the controller**

  Add to `student-profile.controller.ts` (import `UpdateStudentMedicalInfoDto`):
  ```typescript
    @Put('medical-info')
    upsertMedicalInfo(
      @Param('studentId') studentId: string,
      @Body() dto: UpdateStudentMedicalInfoDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.upsertMedicalInfo(studentId, dto, req.user.id);
    }
  ```

- [ ] **Step 7: Run the full test suite**

  Run: `npm test` — expect all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add backend/src/student
  git commit -m "feat(student): add medical/welfare info upsert endpoint"
  ```

---

### Task 6: Documents (add/list/verify)

**Files:**
- Create: `backend/src/student/dto/create-student-document.dto.ts`
- Create: `backend/src/student/dto/verify-student-document.dto.ts`
- Modify: `backend/src/student/student-profile.service.ts`
- Modify: `backend/src/student/student-profile.service.spec.ts`
- Modify: `backend/src/student/student-profile.controller.ts`

**Interfaces:**
- Consumes: existing `File` model (already populated via the existing `POST /api/v1/files`
  endpoint — this task's `addDocument` links an already-uploaded file, it does not re-implement
  upload).
- Produces: `StudentProfileService.listDocuments(studentId)`,
  `.addDocument(studentId, dto, actingUserId)`, `.verifyDocument(studentId, documentId, verified, actingUserId)`.

- [ ] **Step 1: Write the failing tests**

  Extend the `prisma` mock's `studentDocument` to
  `{ findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() }`
  (`file: { findUnique: jest.fn() }` was already added to the mock in Task 2), then append:
  ```typescript
  describe('documents', () => {
    it('lists documents newest-first', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentDocument.findMany.mockResolvedValue([{ id: 'd1' }]);

      const result = await service.listDocuments('s1');

      expect(result).toEqual([{ id: 'd1' }]);
      expect(prisma.studentDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's1' }, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('rejects adding a document whose fileId was never uploaded', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.file.findUnique.mockResolvedValue(null);

      await expect(
        service.addDocument('s1', { documentType: 'BIRTH_CERTIFICATE', fileId: 'missing-file' }, 'admin-1'),
      ).rejects.toThrow('Upload the file first via POST /api/v1/files, then link it here.');
    });

    it('links an already-uploaded file as a document', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.file.findUnique.mockResolvedValue({ id: 'f1' });
      prisma.studentDocument.create.mockResolvedValue({ id: 'd1', documentType: 'BIRTH_CERTIFICATE' });

      await service.addDocument('s1', { documentType: 'BIRTH_CERTIFICATE', fileId: 'f1' }, 'admin-1');

      expect(prisma.studentDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: 's1', documentType: 'BIRTH_CERTIFICATE', fileId: 'f1' }),
        }),
      );
    });

    it('throws NotFoundException verifying a document that does not belong to this student', async () => {
      prisma.studentDocument.findUnique.mockResolvedValue({ id: 'd1', studentId: 'other-student' });

      await expect(service.verifyDocument('s1', 'd1', true, 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('marks a document VERIFIED, stamping verifiedById/verifiedAt', async () => {
      prisma.studentDocument.findUnique.mockResolvedValue({ id: 'd1', studentId: 's1' });
      prisma.studentDocument.update.mockResolvedValue({ id: 'd1', verificationStatus: 'VERIFIED' });

      await service.verifyDocument('s1', 'd1', true, 'admin-1');

      expect(prisma.studentDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd1' },
          data: expect.objectContaining({ verificationStatus: 'VERIFIED', verifiedById: 'admin-1' }),
        }),
      );
    });

    it('marks a document REJECTED when verified is false', async () => {
      prisma.studentDocument.findUnique.mockResolvedValue({ id: 'd1', studentId: 's1' });
      prisma.studentDocument.update.mockResolvedValue({ id: 'd1', verificationStatus: 'REJECTED' });

      await service.verifyDocument('s1', 'd1', false, 'admin-1');

      expect(prisma.studentDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ verificationStatus: 'REJECTED' }) }),
      );
    });
  });
  ```

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npx jest student-profile.service.spec.ts` — expect FAIL.

- [ ] **Step 3: Write the DTOs**

  `backend/src/student/dto/create-student-document.dto.ts`:
  ```typescript
  import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
  import { DocumentType } from '@prisma/client';

  export class CreateStudentDocumentDto {
    @IsEnum(DocumentType) documentType!: DocumentType;
    @IsString() @MinLength(1) fileId!: string;
    @IsOptional() @IsDateString() expiryDate?: string;
    @IsOptional() @IsString() notes?: string;
  }
  ```

  `backend/src/student/dto/verify-student-document.dto.ts`:
  ```typescript
  import { IsBoolean } from 'class-validator';

  export class VerifyStudentDocumentDto {
    @IsBoolean() verified!: boolean;
  }
  ```

- [ ] **Step 4: Add the three methods to `StudentProfileService`**

  Add the import (`BadRequestException` is already imported as of Task 2):
  ```typescript
  import { CreateStudentDocumentDto } from './dto/create-student-document.dto';
  ```
  and the methods:
  ```typescript
    async listDocuments(studentId: string) {
      await this.requireStudent(studentId);
      return this.prisma.studentDocument.findMany({
        where: { studentId },
        include: { file: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    async addDocument(studentId: string, dto: CreateStudentDocumentDto, actingUserId: string) {
      await this.requireStudent(studentId);
      const file = await this.prisma.file.findUnique({ where: { id: dto.fileId } });
      if (!file) {
        throw new BadRequestException('Upload the file first via POST /api/v1/files, then link it here.');
      }
      const record = await this.prisma.studentDocument.create({
        data: {
          studentId,
          documentType: dto.documentType,
          fileId: dto.fileId,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          notes: dto.notes,
        },
        include: { file: true },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'student.document.add',
          entity: 'StudentDocument',
          entityId: record.id,
          metadata: JSON.stringify({ documentType: dto.documentType, fileId: dto.fileId }),
        },
      });
      return record;
    }

    async verifyDocument(studentId: string, documentId: string, verified: boolean, actingUserId: string) {
      const existing = await this.prisma.studentDocument.findUnique({ where: { id: documentId } });
      if (!existing || existing.studentId !== studentId) {
        throw new NotFoundException('Document not found');
      }
      const record = await this.prisma.studentDocument.update({
        where: { id: documentId },
        data: {
          verificationStatus: verified ? 'VERIFIED' : 'REJECTED',
          verifiedById: actingUserId,
          verifiedAt: new Date(),
        },
        include: { file: true },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'student.document.verify',
          entity: 'StudentDocument',
          entityId: documentId,
          metadata: JSON.stringify({ verified }),
        },
      });
      return record;
    }
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx jest student-profile.service.spec.ts` — expect PASS, all tests in the file.

- [ ] **Step 6: Add the routes to the controller**

  Add to `student-profile.controller.ts` (import the two new DTOs):
  ```typescript
    @Get('documents')
    listDocuments(@Param('studentId') studentId: string) {
      return this.service.listDocuments(studentId);
    }

    @Post('documents')
    addDocument(
      @Param('studentId') studentId: string,
      @Body() dto: CreateStudentDocumentDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.addDocument(studentId, dto, req.user.id);
    }

    @Patch('documents/:documentId/verify')
    verifyDocument(
      @Param('studentId') studentId: string,
      @Param('documentId') documentId: string,
      @Body() dto: VerifyStudentDocumentDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.verifyDocument(studentId, documentId, dto.verified, req.user.id);
    }
  ```

- [ ] **Step 7: Run the full test suite**

  Run: `npm test` — expect all pass.

- [ ] **Step 8: Commit**

  ```bash
  git add backend/src/student
  git commit -m "feat(student): add document add/list/verify endpoints"
  ```

---

### Task 7: Final regression pass

**Files:** none created/modified — verification only.

- [ ] **Step 1: Run the full backend test suite**

  Run: `cd backend && npm test`
  Expected: every test passes — the pre-existing suite (auth, student core CRUD, parent, teacher,
  admissions, enrollment, attendance, fees, etc.) plus every new test added in Tasks 1-6.

- [ ] **Step 2: Run typecheck/build**

  Run: `npm run build`
  Expected: compiles with no TypeScript errors.

- [ ] **Step 3: Run lint**

  Run: `npm run lint`
  Expected: no new lint errors introduced by this plan's files.

- [ ] **Step 4: Manually smoke-test one full flow**

  Start the backend (`npm run start:dev`), log in as the seeded `SCHOOL_ADMIN`, and:
  1. `GET /api/v1/admin/students/<seeded-student-1-id>/profile` — confirm it returns the seeded
     `firstName`/`currentAddress`/`emergencyContacts`/`medicalInfo` from Task 1's seed update.
  2. `PATCH .../profile` with a new `permanentAddress` — confirm a new `Address` row is created and
     linked.
  3. `POST .../emergency-contacts` — confirm it appears in a subsequent `GET .../emergency-contacts`.
  4. `PUT .../medical-info` twice with different `allergies` values — confirm the second call
     updates the same row (no duplicate row created).

- [ ] **Step 5: Update `PROJECT-STATUS.md`**

  Add a new checklist entry under the current sprint section (matching this repo's existing
  convention — see project memory `roadmap-checklist-convention`) noting: schema extended with
  Student profile/Address/PreviousSchool/EmergencyContact/MedicalInfo/Document models; new
  `StudentProfileController` endpoints; staff-console UI and e2e coverage deferred to a follow-on
  plan.

- [ ] **Step 6: Commit**

  ```bash
  git add PROJECT-STATUS.md
  git commit -m "docs: log Student profile foundation sub-project in PROJECT-STATUS"
  ```
