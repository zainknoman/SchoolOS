# Staff & Hiring Foundation (Sub-project 3, backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Staff` model generalizing `Teacher` to every employee type (teacher, office staff,
janitorial, helper, guard, other) with Address/EmergencyContact/Experience/Document satellites
mirroring Student's, plus a `HiringCandidate`/`HiringApplication` recruitment pipeline (mirrors
Admission's `Applicant`/`Application`) whose approval creates the `Staff` record — and, for
teachers, the linked `Teacher` row via the same `createTeacherWithUser` helper `TeacherService`
already uses. All of it additive: `Teacher` gets zero column changes.

**Architecture:** New `StaffModule` (a `StaffService`/`StaffController` pair for the "all staff"
list, mirroring `StudentService`/`StudentController`'s list responsibility, and a
`StaffProfileService`/`StaffProfileController` pair for the profile sub-resource family —
identity/contact/address, emergency contacts, experience, documents — mirroring
`StudentProfileService`/`StudentProfileController` exactly). New `HiringModule`
(`HiringCandidatesService`/`Controller` mirroring `ApplicantsService`/`Controller`,
`HiringApplicationsService`/`Controller` mirroring `ApplicationsService`/`Controller`, including an
`approve()` that mirrors `ApplicationsService.approve()`'s transaction shape). A new
`createStaffWithOptionalTeacher` helper mirrors `createStudentWithEnrollment`/
`createTeacherWithUser`'s "one place this gets created, takes a transaction client" shape.

**Tech Stack:** NestJS, Prisma (Postgres), class-validator/class-transformer, Jest.

**Spec:** `docs/database/data-model-design.md` (Sub-project 3 section), `docs/database/
migration-plan.md` (Sub-project 3 section).

## Global Constraints

- Every schema change is additive: 6 new tables, 2 new enums, zero `ALTER TABLE` against any
  existing table. `Teacher`/`Campus`/`File`/`User`/`Address` gain only virtual Prisma
  back-relations. No `prisma migrate reset`.
- `Teacher` is not modified in any way — no existing Teacher-consuming file (27 backend + 20
  staff-console files, enumerated in the design doc) needs to change for this plan to apply.
- Staff creation happens **only** through `HiringApplicationsService.approve()` — there is no
  direct "create staff" admin endpoint, matching the confirmed "full candidate pipeline, not
  direct creation" decision. `StaffService`/`StaffController` in this plan are list/read-only.
- **Scope cut:** only `employeeType: TEACHER` hires get a linked `User`/login (via the existing
  `Teacher.userId` requirement). Every other `employeeType` gets `Staff.userId: null` — no
  `Role` enum value or permission model exists yet for non-teaching staff logins; wiring that is
  an explicit, separate future decision, not made here.
- Every new route requiring elevated access is `SCHOOL_ADMIN`/`SUPER_ADMIN` only (no `ACCOUNTS`,
  unlike Admissions — hiring is an HR function, not a fee-adjacent one).
- Dates arrive over the wire as ISO strings (`@IsDateString`) and are converted to `Date` in the
  service layer, matching `UpdateStudentProfileDto`/`CreateStudentEmergencyContactDto`'s existing
  pattern.
- `AddressDto` (`backend/src/common/dto/address.dto.ts`) is reused as-is — it is already the
  shared address shape Sub-project 1 built for exactly this purpose. No new address DTO is
  created.
- Out of scope for this plan (deferred, not silently dropped): staff-console UI (a separate
  follow-on plan, matching how Sub-project 1B followed Sub-project 1), e2e test coverage (matches
  Student's unit-test-only precedent), backfilling a `Staff` wrapper row for the 3 seeded
  pre-existing `Teacher` rows (a product decision flagged in the migration plan, not resolved
  here — this plan's seed step adds *new* representative `Staff`/`Hiring` rows alongside them),
  bulk-import for Staff.

---

### Task 1: Schema — enums, Staff + satellite + Hiring models; migration; seed

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`
- Create (generated, not hand-written): `backend/prisma/migrations/<timestamp>_add_staff_and_hiring/migration.sql`

**Interfaces:**
- Produces: Prisma models/enums `EmployeeType`, `EmploymentStatus`, `Staff`,
  `StaffEmergencyContact`, `StaffExperience`, `StaffDocument`, `HiringCandidate`,
  `HiringApplication` — every later task's Prisma calls depend on these exact names and fields.

- [ ] **Step 1: Add the new enums to `schema.prisma`**

  Insert immediately after the existing `enum DocumentVerificationStatus { ... }` block (currently
  ending at line 96, right before the `// --- Identity ---` comment):

  ```prisma
  enum EmployeeType {
    TEACHER
    OFFICE_STAFF
    JANITORIAL
    HELPER
    GUARD
    OTHER
  }

  enum EmploymentStatus {
    ACTIVE
    ON_LEAVE
    TERMINATED
    RESIGNED
  }
  ```

- [ ] **Step 2: Add the `Staff` model and its satellites**

  Insert immediately after the existing `model Teacher { ... }` block (currently ending at line
  254, right before `model Student {`):

  ```prisma
  // --- Staff & Hiring ----------------------------------------------------------

  model Staff {
    id                 String                  @id @default(uuid())
    userId             String?                 @unique
    user               User?                   @relation(fields: [userId], references: [id], onDelete: SetNull)
    name               String
    firstName          String?
    middleName         String?
    lastName           String?
    employeeType       EmployeeType
    campusId           String
    campus             Campus                  @relation(fields: [campusId], references: [id], onDelete: Restrict)
    gender             Gender?
    dateOfBirth        DateTime?
    cnic               String?                 @unique
    mobile             String?
    email              String?
    profilePhotoFileId String?
    profilePhoto       File?                   @relation(fields: [profilePhotoFileId], references: [id], onDelete: SetNull)
    currentAddressId   String?
    currentAddress     Address?                @relation("StaffCurrentAddress", fields: [currentAddressId], references: [id], onDelete: SetNull)
    permanentAddressId String?
    permanentAddress   Address?                @relation("StaffPermanentAddress", fields: [permanentAddressId], references: [id], onDelete: SetNull)
    joiningDate        DateTime?
    employmentStatus   EmploymentStatus        @default(ACTIVE)
    leavingDate        DateTime?
    leavingReason      String?
    teacherId          String?                 @unique
    teacher            Teacher?                @relation(fields: [teacherId], references: [id], onDelete: SetNull)
    emergencyContacts  StaffEmergencyContact[]
    experience         StaffExperience[]
    documents          StaffDocument[]
    hiringApplication  HiringApplication?
    createdAt          DateTime                @default(now())
    updatedAt          DateTime                @updatedAt

    @@index([campusId])
    @@index([employeeType])
  }

  model StaffEmergencyContact {
    id             String   @id @default(uuid())
    staffId        String
    staff          Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
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

    @@index([staffId])
  }

  model StaffExperience {
    id           String    @id @default(uuid())
    staffId      String
    staff        Staff     @relation(fields: [staffId], references: [id], onDelete: Cascade)
    organization String
    role         String
    fromDate     DateTime?
    toDate       DateTime?
    description  String?
    createdAt    DateTime  @default(now())
    updatedAt    DateTime  @updatedAt

    @@index([staffId])
  }

  model StaffDocument {
    id                 String                     @id @default(uuid())
    staffId            String
    staff              Staff                      @relation(fields: [staffId], references: [id], onDelete: Cascade)
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

    @@index([staffId])
  }

  model HiringCandidate {
    id           String              @id @default(uuid())
    name         String
    dateOfBirth  DateTime?
    cnic         String?
    contactPhone String
    contactEmail String?
    resumeFileId String?
    resumeFile   File?               @relation(fields: [resumeFileId], references: [id], onDelete: SetNull)
    applications HiringApplication[]
    createdAt    DateTime            @default(now())
    updatedAt    DateTime            @updatedAt

    @@index([contactPhone])
  }

  model HiringApplication {
    id             String          @id @default(uuid())
    candidateId    String
    candidate      HiringCandidate @relation(fields: [candidateId], references: [id], onDelete: Restrict)
    employeeType   EmployeeType
    campusId       String
    campus         Campus          @relation(fields: [campusId], references: [id], onDelete: Restrict)
    status         String          @default("SUBMITTED")
    decisionNotes  String?
    reviewedById   String?
    reviewedBy     User?           @relation(fields: [reviewedById], references: [id])
    createdStaffId String?         @unique
    createdStaff   Staff?          @relation(fields: [createdStaffId], references: [id])
    createdAt      DateTime        @default(now())
    updatedAt      DateTime        @updatedAt

    @@index([candidateId])
    @@index([campusId, status])
  }
  ```

- [ ] **Step 3: Generate the migration and inspect the SQL**

  ```bash
  cd backend
  npx prisma migrate dev --create-only --name add_staff_and_hiring
  ```

  Open the generated `migration.sql` and confirm it contains **zero** `ALTER TABLE "Teacher"`,
  `ALTER TABLE "Campus"`, `ALTER TABLE "File"`, `ALTER TABLE "User"`, or `ALTER TABLE "Address"`
  statements — only `CREATE TYPE`/`CREATE TABLE` for the two enums and six new tables, plus their
  FK/unique-index `ALTER TABLE ... ADD CONSTRAINT` clauses (those are expected — they're on the
  *new* tables). If any pre-existing table shows an `ALTER TABLE ... ADD COLUMN`, stop and check
  the schema for an accidentally-required field or a relation declared on the wrong model.

- [ ] **Step 4: Apply the migration**

  ```bash
  npx prisma migrate dev
  npx prisma validate
  ```

  Expected: applies cleanly; `prisma validate` reports the schema is valid.

- [ ] **Step 5: Update the seed script**

  Open `backend/prisma/seed.ts` and find where the 3 seeded `Teacher` rows are created. After
  that block, add representative Staff/Hiring seed data:

  ```typescript
  // One Staff row per employeeType, including one linked to an existing seeded Teacher.
  const existingTeacher = await prisma.teacher.findFirst();
  const staffJanitor = await prisma.staff.create({
    data: {
      name: 'Nazir Ahmed',
      employeeType: 'JANITORIAL',
      campusId: pechsCampus.id, // reuse whichever campus variable the seed script already has in scope
      mobile: '0300-1112233',
      joiningDate: new Date('2023-01-15'),
      employmentStatus: 'ACTIVE',
      experience: {
        create: [
          { organization: 'City Grammar School', role: 'Janitorial Staff', fromDate: new Date('2020-01-01'), toDate: new Date('2022-12-31') },
        ],
      },
    },
  });
  if (existingTeacher) {
    await prisma.staff.create({
      data: {
        name: existingTeacher.name,
        employeeType: 'TEACHER',
        campusId: existingTeacher.campusId,
        userId: existingTeacher.userId,
        teacherId: existingTeacher.id,
        joiningDate: new Date('2021-08-01'),
        employmentStatus: 'ACTIVE',
      },
    });
  }

  // One HiringCandidate + one HiringApplication per pipeline stage, for local dev/demo data.
  const candidateSubmitted = await prisma.hiringCandidate.create({
    data: { name: 'Bilal Hussain', contactPhone: '0333-4445566', contactEmail: 'bilal@example.com' },
  });
  await prisma.hiringApplication.create({
    data: { candidateId: candidateSubmitted.id, employeeType: 'GUARD', campusId: pechsCampus.id, status: 'SUBMITTED' },
  });
  const candidateShortlisted = await prisma.hiringCandidate.create({
    data: { name: 'Sana Malik', contactPhone: '0333-7778899' },
  });
  await prisma.hiringApplication.create({
    data: { candidateId: candidateShortlisted.id, employeeType: 'OFFICE_STAFF', campusId: pechsCampus.id, status: 'SHORTLISTED' },
  });
  ```

  Adjust variable names (`pechsCampus`, etc.) to match whatever campus/teacher variables the
  existing seed script actually has in scope at that point — read the surrounding ~30 lines of
  `seed.ts` before inserting to match names exactly.

- [ ] **Step 6: Run the seed and verify**

  ```bash
  npx prisma db seed
  ```

  Expected: completes with no errors; a quick `npx prisma studio` (or a `SELECT count(*) FROM
  "Staff"` / `"HiringCandidate"` / `"HiringApplication"`) shows the new rows.

- [ ] **Step 7: Commit**

  ```bash
  git add prisma/schema.prisma prisma/seed.ts prisma/migrations
  git commit -m "feat(staff): add Staff/Hiring schema, migration, and seed data"
  ```

---

### Task 2: `StaffModule` — list + core profile (identity/contact/address)

**Files:**
- Create: `backend/src/staff/staff.service.ts`
- Create: `backend/src/staff/staff.controller.ts`
- Create: `backend/src/staff/staff-profile.service.ts`
- Create: `backend/src/staff/staff-profile.controller.ts`
- Create: `backend/src/staff/staff.module.ts`
- Create: `backend/src/staff/dto/update-staff-profile.dto.ts`
- Create: `backend/src/staff/staff.service.spec.ts`
- Create: `backend/src/staff/staff-profile.service.spec.ts`

**Interfaces:**
- Consumes: `AddressDto` (`../common/dto/address.dto`), `assertCreatable`
  (`../common/prisma-create-guard`), `PrismaService`.
- Produces: `StaffProfileService.getProfile`/`updateProfile`, the `STAFF_PROFILE_INCLUDE` const,
  and `StaffService.list` — Tasks 3-5 add more methods to `StaffProfileService` in this same
  file; Task 8 reuses `STAFF_PROFILE_INCLUDE`'s shape as a reference for what `approve()`'s
  returned application should *not* need to duplicate.

- [ ] **Step 1: Write the DTO**

  ```typescript
  // backend/src/staff/dto/update-staff-profile.dto.ts
  import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
  import { Type } from 'class-transformer';
  import { Gender, EmploymentStatus } from '@prisma/client';
  import { AddressDto } from '../../common/dto/address.dto';

  export class UpdateStaffProfileDto {
    @IsOptional() @IsString() @MinLength(1) firstName?: string;
    @IsOptional() @IsString() middleName?: string;
    @IsOptional() @IsString() @MinLength(1) lastName?: string;
    @IsOptional() @IsEnum(Gender) gender?: Gender;
    @IsOptional() @IsDateString() dateOfBirth?: string;
    @IsOptional() @IsString() cnic?: string;
    @IsOptional() @IsString() mobile?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsString() profilePhotoFileId?: string;
    @IsOptional() @IsDateString() joiningDate?: string;
    @IsOptional() @IsEnum(EmploymentStatus) employmentStatus?: EmploymentStatus;
    @IsOptional() @IsDateString() leavingDate?: string;
    @IsOptional() @IsString() leavingReason?: string;
    @IsOptional() @ValidateNested() @Type(() => AddressDto) currentAddress?: AddressDto;
    @IsOptional() @ValidateNested() @Type(() => AddressDto) permanentAddress?: AddressDto;
  }
  ```

  `name`, `employeeType`, and `campusId` are deliberately not editable here — a hire's type/campus
  transfer is out of scope for this plan (same cut Student made for `grNumber`).

- [ ] **Step 2: Write the failing tests for `StaffService.list`**

  ```typescript
  // backend/src/staff/staff.service.spec.ts
  import { Test } from '@nestjs/testing';
  import { StaffService } from './staff.service';
  import { PrismaService } from '../prisma/prisma.service';

  describe('StaffService', () => {
    let service: StaffService;
    let prisma: { staff: { findMany: jest.Mock } };

    beforeEach(async () => {
      prisma = { staff: { findMany: jest.fn() } };
      const moduleRef = await Test.createTestingModule({
        providers: [StaffService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = moduleRef.get(StaffService);
    });

    it('lists staff ordered by name, with campus name included', async () => {
      prisma.staff.findMany.mockResolvedValue([
        { id: 's1', name: 'Nazir Ahmed', employeeType: 'JANITORIAL', employmentStatus: 'ACTIVE', campus: { name: 'PECHS Campus' } },
      ]);

      const result = await service.list();

      expect(result).toEqual([
        { id: 's1', name: 'Nazir Ahmed', employeeType: 'JANITORIAL', employmentStatus: 'ACTIVE', campusName: 'PECHS Campus' },
      ]);
      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { name: 'asc' } }),
      );
    });

    it('filters by employeeType when provided', async () => {
      prisma.staff.findMany.mockResolvedValue([]);

      await service.list('GUARD');

      expect(prisma.staff.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { employeeType: 'GUARD' } }),
      );
    });
  });
  ```

- [ ] **Step 3: Run the tests to verify they fail**

  Run: `cd backend && npx jest src/staff/staff.service.spec.ts`
  Expected: FAIL — `Cannot find module './staff.service'`.

- [ ] **Step 4: Write `StaffService`**

  ```typescript
  // backend/src/staff/staff.service.ts
  import { Injectable } from '@nestjs/common';
  import { EmployeeType } from '@prisma/client';
  import { PrismaService } from '../prisma/prisma.service';

  export interface StaffSummary {
    id: string;
    name: string;
    employeeType: EmployeeType;
    employmentStatus: string;
    campusName: string;
  }

  const WITH_CAMPUS = { campus: { select: { name: true } } } as const;

  @Injectable()
  export class StaffService {
    constructor(private readonly prisma: PrismaService) {}

    private toSummary(record: {
      id: string; name: string; employeeType: EmployeeType; employmentStatus: string;
      campus: { name: string };
    }): StaffSummary {
      return {
        id: record.id,
        name: record.name,
        employeeType: record.employeeType,
        employmentStatus: record.employmentStatus,
        campusName: record.campus.name,
      };
    }

    async list(employeeType?: EmployeeType): Promise<StaffSummary[]> {
      const records = await this.prisma.staff.findMany({
        where: employeeType ? { employeeType } : undefined,
        include: WITH_CAMPUS,
        orderBy: { name: 'asc' },
      });
      return records.map((r) => this.toSummary(r));
    }
  }
  ```

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npx jest src/staff/staff.service.spec.ts`
  Expected: PASS, 2 tests.

- [ ] **Step 6: Write `StaffController`**

  ```typescript
  // backend/src/staff/staff.controller.ts
  import { Controller, Get, Query } from '@nestjs/common';
  import { EmployeeType } from '@prisma/client';
  import { StaffService } from './staff.service';
  import { Roles } from '../auth/decorators/roles.decorator';

  @Controller('api/v1/admin/staff')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  export class StaffController {
    constructor(private readonly staffService: StaffService) {}

    @Get()
    list(@Query('employeeType') employeeType?: EmployeeType) {
      return this.staffService.list(employeeType);
    }
  }
  ```

- [ ] **Step 7: Write the failing tests for `StaffProfileService.getProfile`/`updateProfile`**

  ```typescript
  // backend/src/staff/staff-profile.service.spec.ts
  import { Test } from '@nestjs/testing';
  import { NotFoundException } from '@nestjs/common';
  import { StaffProfileService } from './staff-profile.service';
  import { PrismaService } from '../prisma/prisma.service';

  describe('StaffProfileService', () => {
    let service: StaffProfileService;
    let prisma: {
      staff: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
      file: { findUnique: jest.Mock };
      auditLog: { create: jest.Mock };
      staffEmergencyContact: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
      staffExperience: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
      staffDocument: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    };

    beforeEach(async () => {
      prisma = {
        staff: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
        file: { findUnique: jest.fn() },
        auditLog: { create: jest.fn() },
        staffEmergencyContact: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        staffExperience: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
        staffDocument: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      };
      const moduleRef = await Test.createTestingModule({
        providers: [StaffProfileService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = moduleRef.get(StaffProfileService);
    });

    describe('getProfile', () => {
      it('throws NotFoundException when the staff member does not exist', async () => {
        prisma.staff.findUnique.mockResolvedValue(null);
        await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
      });

      it('returns the full profile include when the staff member exists', async () => {
        prisma.staff.findUnique.mockResolvedValue({ id: 'st1' });
        prisma.staff.findUniqueOrThrow.mockResolvedValue({ id: 'st1', name: 'Nazir Ahmed' });

        const result = await service.getProfile('st1');

        expect(result).toEqual({ id: 'st1', name: 'Nazir Ahmed' });
        expect(prisma.staff.findUniqueOrThrow).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: 'st1' } }),
        );
      });
    });

    describe('updateProfile', () => {
      it('throws NotFoundException when the staff member does not exist', async () => {
        prisma.staff.findUnique.mockResolvedValue(null);
        await expect(service.updateProfile('missing', { mobile: '0300-1112233' }, 'admin-1')).rejects.toThrow(
          NotFoundException,
        );
      });

      it('creates a new currentAddress when the staff member has none yet', async () => {
        prisma.staff.findUnique.mockResolvedValue({ id: 'st1', currentAddressId: null, permanentAddressId: null });
        prisma.staff.update.mockResolvedValue({ id: 'st1' });

        await service.updateProfile('st1', { currentAddress: { line1: 'House 1' } }, 'admin-1');

        expect(prisma.staff.update).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ currentAddress: { create: { line1: 'House 1' } } }),
          }),
        );
      });

      it('writes an audit log entry naming only the changed field keys, never their values', async () => {
        prisma.staff.findUnique.mockResolvedValue({ id: 'st1', currentAddressId: null, permanentAddressId: null });
        prisma.staff.update.mockResolvedValue({ id: 'st1' });

        await service.updateProfile('st1', { cnic: '42101-1234567-1' }, 'admin-1');

        expect(prisma.auditLog.create).toHaveBeenCalledWith(
          expect.objectContaining({ data: expect.objectContaining({ metadata: JSON.stringify({ fields: ['cnic'] }) }) }),
        );
      });
    });
  });
  ```

- [ ] **Step 8: Run the tests to verify they fail**

  Run: `npx jest src/staff/staff-profile.service.spec.ts`
  Expected: FAIL — `Cannot find module './staff-profile.service'`.

- [ ] **Step 9: Write `StaffProfileService` (getProfile/updateProfile only — Tasks 3-5 append more methods)**

  ```typescript
  // backend/src/staff/staff-profile.service.ts
  import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
  import { Prisma } from '@prisma/client';
  import { PrismaService } from '../prisma/prisma.service';
  import { assertCreatable } from '../common/prisma-create-guard';
  import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
  import { AddressDto } from '../common/dto/address.dto';

  export const STAFF_PROFILE_INCLUDE = {
    currentAddress: true,
    permanentAddress: true,
    teacher: true,
    emergencyContacts: { include: { address: true }, orderBy: { priority: 'asc' as const } },
    experience: { orderBy: { fromDate: 'desc' as const } },
    documents: { include: { file: true }, orderBy: { createdAt: 'desc' as const } },
  };

  @Injectable()
  export class StaffProfileService {
    constructor(private readonly prisma: PrismaService) {}

    private addressWrite(address: AddressDto | undefined, existingAddressId: string | null | undefined) {
      if (!address) return undefined;
      return existingAddressId ? { update: address } : { create: address };
    }

    private async requireStaff(staffId: string) {
      const staff = await this.prisma.staff.findUnique({ where: { id: staffId } });
      if (!staff) {
        throw new NotFoundException('Staff member not found');
      }
      return staff;
    }

    async getProfile(staffId: string) {
      await this.requireStaff(staffId);
      return this.prisma.staff.findUniqueOrThrow({ where: { id: staffId }, include: STAFF_PROFILE_INCLUDE });
    }

    async updateProfile(staffId: string, dto: UpdateStaffProfileDto, actingUserId: string) {
      const existing = await this.requireStaff(staffId);

      if (dto.profilePhotoFileId !== undefined) {
        const file = await this.prisma.file.findUnique({ where: { id: dto.profilePhotoFileId } });
        if (!file) {
          throw new BadRequestException('Upload the photo first via POST /api/v1/files, then link it here.');
        }
      }

      const data: Prisma.StaffUpdateInput = {
        profilePhoto:
          dto.profilePhotoFileId !== undefined ? { connect: { id: dto.profilePhotoFileId } } : undefined,
        ...(dto.firstName !== undefined ? { firstName: dto.firstName } : {}),
        ...(dto.middleName !== undefined ? { middleName: dto.middleName } : {}),
        ...(dto.lastName !== undefined ? { lastName: dto.lastName } : {}),
        ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
        ...(dto.dateOfBirth !== undefined ? { dateOfBirth: new Date(dto.dateOfBirth) } : {}),
        ...(dto.cnic !== undefined ? { cnic: dto.cnic } : {}),
        ...(dto.mobile !== undefined ? { mobile: dto.mobile } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.joiningDate !== undefined ? { joiningDate: new Date(dto.joiningDate) } : {}),
        ...(dto.employmentStatus !== undefined ? { employmentStatus: dto.employmentStatus } : {}),
        ...(dto.leavingDate !== undefined ? { leavingDate: new Date(dto.leavingDate) } : {}),
        ...(dto.leavingReason !== undefined ? { leavingReason: dto.leavingReason } : {}),
      };

      data.currentAddress = this.addressWrite(dto.currentAddress, existing.currentAddressId);
      data.permanentAddress = this.addressWrite(dto.permanentAddress, existing.permanentAddressId);

      let record;
      try {
        record = await this.prisma.staff.update({ where: { id: staffId }, data, include: STAFF_PROFILE_INCLUDE });
      } catch (error) {
        assertCreatable(error, 'This CNIC is already in use.');
      }

      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'staff.profile.update',
          entity: 'Staff',
          entityId: staffId,
          metadata: JSON.stringify({ fields: Object.keys(dto) }),
        },
      });

      return record;
    }
  }
  ```

- [ ] **Step 10: Write `StaffProfileController` (profile route only — Tasks 3-5 append more routes)**

  ```typescript
  // backend/src/staff/staff-profile.controller.ts
  import { Body, Controller, Get, Param, Patch, Req } from '@nestjs/common';
  import type { Request } from 'express';
  import { StaffProfileService } from './staff-profile.service';
  import { UpdateStaffProfileDto } from './dto/update-staff-profile.dto';
  import { Roles } from '../auth/decorators/roles.decorator';
  import type { RequestUser } from '../common/student-access.service';

  interface AuthenticatedRequest extends Request {
    user: RequestUser;
  }

  @Controller('api/v1/admin/staff/:staffId')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  export class StaffProfileController {
    constructor(private readonly service: StaffProfileService) {}

    @Get('profile')
    getProfile(@Param('staffId') staffId: string) {
      return this.service.getProfile(staffId);
    }

    @Patch('profile')
    updateProfile(
      @Param('staffId') staffId: string,
      @Body() dto: UpdateStaffProfileDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.updateProfile(staffId, dto, req.user.id);
    }
  }
  ```

- [ ] **Step 11: Write `StaffModule`**

  ```typescript
  // backend/src/staff/staff.module.ts
  import { Module } from '@nestjs/common';
  import { StaffService } from './staff.service';
  import { StaffController } from './staff.controller';
  import { StaffProfileService } from './staff-profile.service';
  import { StaffProfileController } from './staff-profile.controller';

  @Module({
    providers: [StaffService, StaffProfileService],
    controllers: [StaffController, StaffProfileController],
  })
  export class StaffModule {}
  ```

- [ ] **Step 12: Run the tests to verify they pass**

  Run: `npx jest src/staff`
  Expected: PASS, all tests in both spec files.

- [ ] **Step 13: Commit**

  ```bash
  git add src/staff
  git commit -m "feat(staff): add staff list and core profile endpoints"
  ```

---

### Task 3: Staff emergency contacts (list/create/update/delete)

**Files:**
- Create: `backend/src/staff/dto/create-staff-emergency-contact.dto.ts`
- Create: `backend/src/staff/dto/update-staff-emergency-contact.dto.ts`
- Modify: `backend/src/staff/staff-profile.service.ts`
- Modify: `backend/src/staff/staff-profile.controller.ts`
- Modify: `backend/src/staff/staff-profile.service.spec.ts`

**Interfaces:**
- Consumes: `requireStaff`, `addressWrite` (private methods already on `StaffProfileService` from
  Task 2 — this task adds methods to the same class, so it reuses them directly, not via import).
- Produces: `StaffProfileService.listEmergencyContacts`/`createEmergencyContact`/
  `updateEmergencyContact`/`deleteEmergencyContact` — no later task depends on these.

- [ ] **Step 1: Write the DTOs**

  ```typescript
  // backend/src/staff/dto/create-staff-emergency-contact.dto.ts
  import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
  import { Type } from 'class-transformer';
  import { AddressDto } from '../../common/dto/address.dto';

  export class CreateStaffEmergencyContactDto {
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

  ```typescript
  // backend/src/staff/dto/update-staff-emergency-contact.dto.ts
  import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
  import { Type } from 'class-transformer';
  import { AddressDto } from '../../common/dto/address.dto';

  export class UpdateStaffEmergencyContactDto {
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

- [ ] **Step 2: Write the failing tests**

  Add to `staff-profile.service.spec.ts`, inside the `describe('StaffProfileService', ...)` block:

  ```typescript
  describe('emergency contacts', () => {
    it('creates a contact scoped to the staff member', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'st1' });
      prisma.staffEmergencyContact.create.mockResolvedValue({ id: 'ec1', name: 'Bushra Ahmed' });

      await service.createEmergencyContact('st1', { name: 'Bushra Ahmed', relationship: 'Spouse', phone: '0300-1112233' }, 'admin-1');

      expect(prisma.staffEmergencyContact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ staff: { connect: { id: 'st1' } }, name: 'Bushra Ahmed' }),
        }),
      );
    });

    it('throws NotFoundException updating a contact that belongs to a different staff member', async () => {
      prisma.staffEmergencyContact.findUnique.mockResolvedValue({ id: 'ec1', staffId: 'st-other', addressId: null });

      await expect(
        service.updateEmergencyContact('st1', 'ec1', { name: 'New name' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes a contact scoped to the staff member', async () => {
      prisma.staffEmergencyContact.findUnique.mockResolvedValue({ id: 'ec1', staffId: 'st1' });

      await service.deleteEmergencyContact('st1', 'ec1', 'admin-1');

      expect(prisma.staffEmergencyContact.delete).toHaveBeenCalledWith({ where: { id: 'ec1' } });
    });
  });
  ```

- [ ] **Step 3: Run the tests to verify they fail**

  Run: `npx jest src/staff/staff-profile.service.spec.ts`
  Expected: FAIL — the three new methods don't exist on `StaffProfileService`.

- [ ] **Step 4: Add the methods to `StaffProfileService`**

  Add these imports at the top of `staff-profile.service.ts`:

  ```typescript
  import { CreateStaffEmergencyContactDto } from './dto/create-staff-emergency-contact.dto';
  import { UpdateStaffEmergencyContactDto } from './dto/update-staff-emergency-contact.dto';
  ```

  Add these methods to the `StaffProfileService` class, after `updateProfile`:

  ```typescript
    async listEmergencyContacts(staffId: string) {
      await this.requireStaff(staffId);
      return this.prisma.staffEmergencyContact.findMany({
        where: { staffId },
        include: { address: true },
        orderBy: { priority: 'asc' },
      });
    }

    async createEmergencyContact(staffId: string, dto: CreateStaffEmergencyContactDto, actingUserId: string) {
      await this.requireStaff(staffId);
      const record = await this.prisma.staffEmergencyContact.create({
        data: {
          staff: { connect: { id: staffId } },
          name: dto.name,
          relationship: dto.relationship,
          phone: dto.phone,
          alternatePhone: dto.alternatePhone,
          email: dto.email,
          priority: dto.priority ?? 1,
          isPrimary: dto.isPrimary ?? false,
          address: dto.address ? { create: dto.address } : undefined,
        },
        include: { address: true },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'staff.emergencyContact.create',
          entity: 'StaffEmergencyContact',
          entityId: record.id,
          metadata: JSON.stringify({ fields: Object.keys(dto) }),
        },
      });
      return record;
    }

    async updateEmergencyContact(
      staffId: string,
      contactId: string,
      dto: UpdateStaffEmergencyContactDto,
      actingUserId: string,
    ) {
      const existing = await this.prisma.staffEmergencyContact.findUnique({ where: { id: contactId } });
      if (!existing || existing.staffId !== staffId) {
        throw new NotFoundException('Emergency contact not found');
      }

      const record = await this.prisma.staffEmergencyContact.update({
        where: { id: contactId },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.relationship !== undefined ? { relationship: dto.relationship } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
          ...(dto.alternatePhone !== undefined ? { alternatePhone: dto.alternatePhone } : {}),
          ...(dto.email !== undefined ? { email: dto.email } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.isPrimary !== undefined ? { isPrimary: dto.isPrimary } : {}),
          address: this.addressWrite(dto.address, existing.addressId),
        },
        include: { address: true },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'staff.emergencyContact.update',
          entity: 'StaffEmergencyContact',
          entityId: contactId,
          metadata: JSON.stringify({ fields: Object.keys(dto) }),
        },
      });
      return record;
    }

    async deleteEmergencyContact(staffId: string, contactId: string, actingUserId: string) {
      const existing = await this.prisma.staffEmergencyContact.findUnique({ where: { id: contactId } });
      if (!existing || existing.staffId !== staffId) {
        throw new NotFoundException('Emergency contact not found');
      }
      await this.prisma.staffEmergencyContact.delete({ where: { id: contactId } });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'staff.emergencyContact.delete',
          entity: 'StaffEmergencyContact',
          entityId: contactId,
        },
      });
    }
  ```

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npx jest src/staff/staff-profile.service.spec.ts`
  Expected: PASS, all tests.

- [ ] **Step 6: Add the routes to `StaffProfileController`**

  Add these imports:

  ```typescript
  import { Delete, Post } from '@nestjs/common';
  import { CreateStaffEmergencyContactDto } from './dto/create-staff-emergency-contact.dto';
  import { UpdateStaffEmergencyContactDto } from './dto/update-staff-emergency-contact.dto';
  ```

  (Merge `Delete`/`Post` into the existing `@nestjs/common` import line rather than adding a
  second one.) Add these routes to the controller, after `updateProfile`:

  ```typescript
    @Get('emergency-contacts')
    listEmergencyContacts(@Param('staffId') staffId: string) {
      return this.service.listEmergencyContacts(staffId);
    }

    @Post('emergency-contacts')
    createEmergencyContact(
      @Param('staffId') staffId: string,
      @Body() dto: CreateStaffEmergencyContactDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.createEmergencyContact(staffId, dto, req.user.id);
    }

    @Patch('emergency-contacts/:contactId')
    updateEmergencyContact(
      @Param('staffId') staffId: string,
      @Param('contactId') contactId: string,
      @Body() dto: UpdateStaffEmergencyContactDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.updateEmergencyContact(staffId, contactId, dto, req.user.id);
    }

    @Delete('emergency-contacts/:contactId')
    async deleteEmergencyContact(
      @Param('staffId') staffId: string,
      @Param('contactId') contactId: string,
      @Req() req: AuthenticatedRequest,
    ) {
      await this.service.deleteEmergencyContact(staffId, contactId, req.user.id);
    }
  ```

- [ ] **Step 7: Type-check and run the full backend test suite**

  Run: `cd backend && npx tsc --noEmit && npx jest`
  Expected: both pass.

- [ ] **Step 8: Commit**

  ```bash
  git add src/staff
  git commit -m "feat(staff): add emergency contacts CRUD"
  ```

---

### Task 4: Staff experience (list/create/update/delete)

**Files:**
- Create: `backend/src/staff/dto/create-staff-experience.dto.ts`
- Create: `backend/src/staff/dto/update-staff-experience.dto.ts`
- Modify: `backend/src/staff/staff-profile.service.ts`
- Modify: `backend/src/staff/staff-profile.controller.ts`
- Modify: `backend/src/staff/staff-profile.service.spec.ts`

**Interfaces:**
- Consumes: `requireStaff` (Task 2).
- Produces: `StaffProfileService.listExperience`/`createExperience`/`updateExperience`/
  `deleteExperience` — this is the "extend fields for teacher like student, with past experience"
  requirement, and it applies to every `employeeType`, not just `TEACHER`.

- [ ] **Step 1: Write the DTOs**

  ```typescript
  // backend/src/staff/dto/create-staff-experience.dto.ts
  import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

  export class CreateStaffExperienceDto {
    @IsString() @MinLength(1) organization!: string;
    @IsString() @MinLength(1) role!: string;
    @IsOptional() @IsDateString() fromDate?: string;
    @IsOptional() @IsDateString() toDate?: string;
    @IsOptional() @IsString() description?: string;
  }
  ```

  ```typescript
  // backend/src/staff/dto/update-staff-experience.dto.ts
  import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

  export class UpdateStaffExperienceDto {
    @IsOptional() @IsString() @MinLength(1) organization?: string;
    @IsOptional() @IsString() @MinLength(1) role?: string;
    @IsOptional() @IsDateString() fromDate?: string;
    @IsOptional() @IsDateString() toDate?: string;
    @IsOptional() @IsString() description?: string;
  }
  ```

- [ ] **Step 2: Write the failing tests**

  Add to `staff-profile.service.spec.ts`:

  ```typescript
  describe('experience', () => {
    it('creates an experience entry scoped to the staff member', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'st1' });
      prisma.staffExperience.create.mockResolvedValue({ id: 'exp1', organization: 'City Grammar School' });

      await service.createExperience('st1', { organization: 'City Grammar School', role: 'Janitorial Staff' }, 'admin-1');

      expect(prisma.staffExperience.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ staffId: 'st1', organization: 'City Grammar School', role: 'Janitorial Staff' }),
        }),
      );
    });

    it('throws NotFoundException deleting an entry that belongs to a different staff member', async () => {
      prisma.staffExperience.findUnique.mockResolvedValue({ id: 'exp1', staffId: 'st-other' });

      await expect(service.deleteExperience('st1', 'exp1', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });
  ```

- [ ] **Step 3: Run the tests to verify they fail**

  Run: `npx jest src/staff/staff-profile.service.spec.ts`
  Expected: FAIL — `createExperience`/`deleteExperience` don't exist yet.

- [ ] **Step 4: Add the methods to `StaffProfileService`**

  Add imports:

  ```typescript
  import { CreateStaffExperienceDto } from './dto/create-staff-experience.dto';
  import { UpdateStaffExperienceDto } from './dto/update-staff-experience.dto';
  ```

  Add methods, after `deleteEmergencyContact`:

  ```typescript
    async listExperience(staffId: string) {
      await this.requireStaff(staffId);
      return this.prisma.staffExperience.findMany({ where: { staffId }, orderBy: { fromDate: 'desc' } });
    }

    async createExperience(staffId: string, dto: CreateStaffExperienceDto, actingUserId: string) {
      await this.requireStaff(staffId);
      const record = await this.prisma.staffExperience.create({
        data: {
          staffId,
          organization: dto.organization,
          role: dto.role,
          fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
          toDate: dto.toDate ? new Date(dto.toDate) : undefined,
          description: dto.description,
        },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'staff.experience.create',
          entity: 'StaffExperience',
          entityId: record.id,
          metadata: JSON.stringify({ fields: Object.keys(dto) }),
        },
      });
      return record;
    }

    async updateExperience(staffId: string, experienceId: string, dto: UpdateStaffExperienceDto, actingUserId: string) {
      const existing = await this.prisma.staffExperience.findUnique({ where: { id: experienceId } });
      if (!existing || existing.staffId !== staffId) {
        throw new NotFoundException('Experience entry not found');
      }
      const record = await this.prisma.staffExperience.update({
        where: { id: experienceId },
        data: {
          ...(dto.organization !== undefined ? { organization: dto.organization } : {}),
          ...(dto.role !== undefined ? { role: dto.role } : {}),
          ...(dto.fromDate !== undefined ? { fromDate: new Date(dto.fromDate) } : {}),
          ...(dto.toDate !== undefined ? { toDate: new Date(dto.toDate) } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
        },
      });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'staff.experience.update',
          entity: 'StaffExperience',
          entityId: experienceId,
          metadata: JSON.stringify({ fields: Object.keys(dto) }),
        },
      });
      return record;
    }

    async deleteExperience(staffId: string, experienceId: string, actingUserId: string) {
      const existing = await this.prisma.staffExperience.findUnique({ where: { id: experienceId } });
      if (!existing || existing.staffId !== staffId) {
        throw new NotFoundException('Experience entry not found');
      }
      await this.prisma.staffExperience.delete({ where: { id: experienceId } });
      await this.prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action: 'staff.experience.delete',
          entity: 'StaffExperience',
          entityId: experienceId,
        },
      });
    }
  ```

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npx jest src/staff/staff-profile.service.spec.ts`
  Expected: PASS, all tests.

- [ ] **Step 6: Add the routes to `StaffProfileController`**

  Add import:

  ```typescript
  import { CreateStaffExperienceDto } from './dto/create-staff-experience.dto';
  import { UpdateStaffExperienceDto } from './dto/update-staff-experience.dto';
  ```

  Add routes, after `deleteEmergencyContact`:

  ```typescript
    @Get('experience')
    listExperience(@Param('staffId') staffId: string) {
      return this.service.listExperience(staffId);
    }

    @Post('experience')
    createExperience(
      @Param('staffId') staffId: string,
      @Body() dto: CreateStaffExperienceDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.createExperience(staffId, dto, req.user.id);
    }

    @Patch('experience/:experienceId')
    updateExperience(
      @Param('staffId') staffId: string,
      @Param('experienceId') experienceId: string,
      @Body() dto: UpdateStaffExperienceDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.updateExperience(staffId, experienceId, dto, req.user.id);
    }

    @Delete('experience/:experienceId')
    async deleteExperience(
      @Param('staffId') staffId: string,
      @Param('experienceId') experienceId: string,
      @Req() req: AuthenticatedRequest,
    ) {
      await this.service.deleteExperience(staffId, experienceId, req.user.id);
    }
  ```

- [ ] **Step 7: Type-check and run the full backend test suite**

  Run: `npx tsc --noEmit && npx jest`
  Expected: both pass.

- [ ] **Step 8: Commit**

  ```bash
  git add src/staff
  git commit -m "feat(staff): add experience CRUD"
  ```

---

### Task 5: Staff documents (list/add/verify)

**Files:**
- Create: `backend/src/staff/dto/create-staff-document.dto.ts`
- Create: `backend/src/staff/dto/verify-staff-document.dto.ts`
- Modify: `backend/src/staff/staff-profile.service.ts`
- Modify: `backend/src/staff/staff-profile.controller.ts`
- Modify: `backend/src/staff/staff-profile.service.spec.ts`

**Interfaces:**
- Consumes: `requireStaff` (Task 2), `DocumentType`/`DocumentVerificationStatus` (already exist
  from Sub-project 1 — reused as-is, no new enum).
- Produces: `StaffProfileService.listDocuments`/`addDocument`/`verifyDocument`.

- [ ] **Step 1: Write the DTOs**

  ```typescript
  // backend/src/staff/dto/create-staff-document.dto.ts
  import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
  import { DocumentType } from '@prisma/client';

  export class CreateStaffDocumentDto {
    @IsEnum(DocumentType) documentType!: DocumentType;
    @IsString() @MinLength(1) fileId!: string;
    @IsOptional() @IsDateString() expiryDate?: string;
    @IsOptional() @IsString() notes?: string;
  }
  ```

  ```typescript
  // backend/src/staff/dto/verify-staff-document.dto.ts
  import { IsBoolean } from 'class-validator';

  export class VerifyStaffDocumentDto {
    @IsBoolean() verified!: boolean;
  }
  ```

- [ ] **Step 2: Write the failing tests**

  Add to `staff-profile.service.spec.ts`:

  ```typescript
  describe('documents', () => {
    it('rejects adding a document whose fileId was never uploaded', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'st1' });
      prisma.file.findUnique.mockResolvedValue(null);

      await expect(
        service.addDocument('st1', { documentType: 'CNIC', fileId: 'missing' }, 'admin-1'),
      ).rejects.toThrow('Upload the file first');
    });

    it('marks a document verified and records who verified it', async () => {
      prisma.staffDocument.findUnique.mockResolvedValue({ id: 'doc1', staffId: 'st1' });
      prisma.staffDocument.update.mockResolvedValue({ id: 'doc1', verificationStatus: 'VERIFIED' });

      await service.verifyDocument('st1', 'doc1', true, 'admin-1');

      expect(prisma.staffDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ verificationStatus: 'VERIFIED', verifiedById: 'admin-1' }),
        }),
      );
    });
  });
  ```

- [ ] **Step 3: Run the tests to verify they fail**

  Run: `npx jest src/staff/staff-profile.service.spec.ts`
  Expected: FAIL — `addDocument`/`verifyDocument` don't exist yet.

- [ ] **Step 4: Add the methods to `StaffProfileService`**

  Add imports:

  ```typescript
  import { CreateStaffDocumentDto } from './dto/create-staff-document.dto';
  ```

  Add methods, after `deleteExperience`:

  ```typescript
    async listDocuments(staffId: string) {
      await this.requireStaff(staffId);
      return this.prisma.staffDocument.findMany({
        where: { staffId },
        include: { file: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    async addDocument(staffId: string, dto: CreateStaffDocumentDto, actingUserId: string) {
      await this.requireStaff(staffId);
      const file = await this.prisma.file.findUnique({ where: { id: dto.fileId } });
      if (!file) {
        throw new BadRequestException('Upload the file first via POST /api/v1/files, then link it here.');
      }
      const record = await this.prisma.staffDocument.create({
        data: {
          staffId,
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
          action: 'staff.document.add',
          entity: 'StaffDocument',
          entityId: record.id,
          metadata: JSON.stringify({ documentType: dto.documentType, fileId: dto.fileId }),
        },
      });
      return record;
    }

    async verifyDocument(staffId: string, documentId: string, verified: boolean, actingUserId: string) {
      const existing = await this.prisma.staffDocument.findUnique({ where: { id: documentId } });
      if (!existing || existing.staffId !== staffId) {
        throw new NotFoundException('Document not found');
      }
      const record = await this.prisma.staffDocument.update({
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
          action: 'staff.document.verify',
          entity: 'StaffDocument',
          entityId: documentId,
          metadata: JSON.stringify({ verified }),
        },
      });
      return record;
    }
  ```

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npx jest src/staff/staff-profile.service.spec.ts`
  Expected: PASS, all tests.

- [ ] **Step 6: Add the routes to `StaffProfileController`**

  Add imports:

  ```typescript
  import { CreateStaffDocumentDto } from './dto/create-staff-document.dto';
  import { VerifyStaffDocumentDto } from './dto/verify-staff-document.dto';
  ```

  Add routes, after `deleteExperience`:

  ```typescript
    @Get('documents')
    listDocuments(@Param('staffId') staffId: string) {
      return this.service.listDocuments(staffId);
    }

    @Post('documents')
    addDocument(
      @Param('staffId') staffId: string,
      @Body() dto: CreateStaffDocumentDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.addDocument(staffId, dto, req.user.id);
    }

    @Patch('documents/:documentId/verify')
    verifyDocument(
      @Param('staffId') staffId: string,
      @Param('documentId') documentId: string,
      @Body() dto: VerifyStaffDocumentDto,
      @Req() req: AuthenticatedRequest,
    ) {
      return this.service.verifyDocument(staffId, documentId, dto.verified, req.user.id);
    }
  ```

- [ ] **Step 7: Type-check and run the full backend test suite**

  Run: `npx tsc --noEmit && npx jest`
  Expected: both pass. `StaffModule`/`StaffProfileService`/`StaffProfileController` are now
  feature-complete for this plan.

- [ ] **Step 8: Commit**

  ```bash
  git add src/staff
  git commit -m "feat(staff): add documents list/add/verify"
  ```

---

### Task 6: `HiringModule` — candidates (create/find by phone)

**Files:**
- Create: `backend/src/hiring/dto/create-hiring-candidate.dto.ts`
- Create: `backend/src/hiring/hiring-candidates.service.ts`
- Create: `backend/src/hiring/hiring-candidates.controller.ts`
- Create: `backend/src/hiring/hiring-candidates.service.spec.ts`

**Interfaces:**
- Produces: `HiringCandidatesService.create`/`findByPhone`, the `HiringCandidateSummary`
  interface — Task 8's `approve()` reads `candidate.name` off the Prisma record directly (not
  through this summary type), so no dependency there.

- [ ] **Step 1: Write the DTO**

  ```typescript
  // backend/src/hiring/dto/create-hiring-candidate.dto.ts
  import { IsDateString, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

  export class CreateHiringCandidateDto {
    @IsString() @MinLength(1) name!: string;
    @IsOptional() @IsDateString() dateOfBirth?: string;
    @IsOptional() @IsString() cnic?: string;
    @IsString() @MinLength(1) contactPhone!: string;
    @IsOptional() @IsEmail() contactEmail?: string;
    @IsOptional() @IsString() resumeFileId?: string;
  }
  ```

- [ ] **Step 2: Write the failing tests**

  ```typescript
  // backend/src/hiring/hiring-candidates.service.spec.ts
  import { Test } from '@nestjs/testing';
  import { BadRequestException } from '@nestjs/common';
  import { HiringCandidatesService } from './hiring-candidates.service';
  import { PrismaService } from '../prisma/prisma.service';

  describe('HiringCandidatesService', () => {
    let service: HiringCandidatesService;
    let prisma: {
      hiringCandidate: { findFirst: jest.Mock; create: jest.Mock; findMany: jest.Mock };
      file: { findUnique: jest.Mock };
    };

    beforeEach(async () => {
      prisma = {
        hiringCandidate: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
        file: { findUnique: jest.fn() },
      };
      const moduleRef = await Test.createTestingModule({
        providers: [HiringCandidatesService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = moduleRef.get(HiringCandidatesService);
    });

    it('creates a candidate and flags a possible duplicate by name+phone', async () => {
      prisma.hiringCandidate.findFirst.mockResolvedValue({ id: 'c-old', name: 'Bilal Hussain', dateOfBirth: null, cnic: null, contactPhone: '0333-4445566', contactEmail: null, resumeFileId: null });
      prisma.hiringCandidate.create.mockResolvedValue({ id: 'c-new', name: 'Bilal Hussain', dateOfBirth: null, cnic: null, contactPhone: '0333-4445566', contactEmail: null, resumeFileId: null });

      const result = await service.create({ name: 'Bilal Hussain', contactPhone: '0333-4445566' });

      expect(result.candidate.id).toBe('c-new');
      expect(result.possibleDuplicate?.id).toBe('c-old');
    });

    it('rejects a resumeFileId that was never uploaded', async () => {
      prisma.file.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ name: 'Bilal Hussain', contactPhone: '0333-4445566', resumeFileId: 'missing' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('finds candidates by contact phone, most recent first', async () => {
      prisma.hiringCandidate.findMany.mockResolvedValue([]);

      await service.findByPhone('0333-4445566');

      expect(prisma.hiringCandidate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { contactPhone: '0333-4445566' }, orderBy: { createdAt: 'desc' } }),
      );
    });
  });
  ```

- [ ] **Step 3: Run the tests to verify they fail**

  Run: `npx jest src/hiring/hiring-candidates.service.spec.ts`
  Expected: FAIL — `Cannot find module './hiring-candidates.service'`.

- [ ] **Step 4: Write `HiringCandidatesService`**

  ```typescript
  // backend/src/hiring/hiring-candidates.service.ts
  import { Injectable, BadRequestException } from '@nestjs/common';
  import { PrismaService } from '../prisma/prisma.service';
  import { CreateHiringCandidateDto } from './dto/create-hiring-candidate.dto';

  export interface HiringCandidateSummary {
    id: string;
    name: string;
    dateOfBirth: string | null;
    cnic: string | null;
    contactPhone: string;
    contactEmail: string | null;
    resumeFileId: string | null;
  }

  @Injectable()
  export class HiringCandidatesService {
    constructor(private readonly prisma: PrismaService) {}

    private toSummary(record: {
      id: string; name: string; dateOfBirth: Date | null; cnic: string | null;
      contactPhone: string; contactEmail: string | null; resumeFileId: string | null;
    }): HiringCandidateSummary {
      return {
        id: record.id,
        name: record.name,
        dateOfBirth: record.dateOfBirth ? record.dateOfBirth.toISOString().slice(0, 10) : null,
        cnic: record.cnic,
        contactPhone: record.contactPhone,
        contactEmail: record.contactEmail,
        resumeFileId: record.resumeFileId,
      };
    }

    async create(
      dto: CreateHiringCandidateDto,
    ): Promise<{ candidate: HiringCandidateSummary; possibleDuplicate: HiringCandidateSummary | null }> {
      if (dto.resumeFileId) {
        const file = await this.prisma.file.findUnique({ where: { id: dto.resumeFileId } });
        if (!file) {
          throw new BadRequestException('Upload the résumé first via POST /api/v1/files, then link it here.');
        }
      }
      const existingMatch = await this.prisma.hiringCandidate.findFirst({
        where: { name: dto.name, contactPhone: dto.contactPhone },
      });
      const record = await this.prisma.hiringCandidate.create({
        data: {
          name: dto.name,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          cnic: dto.cnic,
          contactPhone: dto.contactPhone,
          contactEmail: dto.contactEmail,
          resumeFileId: dto.resumeFileId,
        },
      });
      return {
        candidate: this.toSummary(record),
        possibleDuplicate: existingMatch ? this.toSummary(existingMatch) : null,
      };
    }

    async findByPhone(contactPhone: string): Promise<HiringCandidateSummary[]> {
      const records = await this.prisma.hiringCandidate.findMany({
        where: { contactPhone },
        orderBy: { createdAt: 'desc' },
      });
      return records.map((r) => this.toSummary(r));
    }
  }
  ```

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npx jest src/hiring/hiring-candidates.service.spec.ts`
  Expected: PASS, 3 tests.

- [ ] **Step 6: Write `HiringCandidatesController`**

  ```typescript
  // backend/src/hiring/hiring-candidates.controller.ts
  import { Body, Controller, Get, Post, Query } from '@nestjs/common';
  import { HiringCandidatesService } from './hiring-candidates.service';
  import { CreateHiringCandidateDto } from './dto/create-hiring-candidate.dto';
  import { Roles } from '../auth/decorators/roles.decorator';

  @Controller('api/v1/hiring/candidates')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  export class HiringCandidatesController {
    constructor(private readonly hiringCandidatesService: HiringCandidatesService) {}

    @Post()
    create(@Body() dto: CreateHiringCandidateDto) {
      return this.hiringCandidatesService.create(dto);
    }

    @Get()
    findByPhone(@Query('contactPhone') contactPhone: string) {
      return this.hiringCandidatesService.findByPhone(contactPhone);
    }
  }
  ```

- [ ] **Step 7: Type-check**

  Run: `npx tsc --noEmit`
  Expected: no errors (the module isn't registered in `app.module.ts` yet — that's Task 9 — so
  this only proves the new files compile).

- [ ] **Step 8: Commit**

  ```bash
  git add src/hiring/dto/create-hiring-candidate.dto.ts src/hiring/hiring-candidates.service.ts src/hiring/hiring-candidates.controller.ts src/hiring/hiring-candidates.service.spec.ts
  git commit -m "feat(hiring): add candidate intake endpoints"
  ```

---

### Task 7: `HiringApplicationsService`/`Controller` (create/list/find/shortlist/interview/reject)

**Files:**
- Create: `backend/src/hiring/dto/create-hiring-application.dto.ts`
- Create: `backend/src/hiring/dto/update-hiring-application.dto.ts`
- Create: `backend/src/hiring/hiring-applications.service.ts`
- Create: `backend/src/hiring/hiring-applications.controller.ts`
- Create: `backend/src/hiring/hiring-applications.service.spec.ts`

**Interfaces:**
- Produces: `HiringApplicationsService.create`/`findOne`/`findMany`/`updateStatus`/`reject`, the
  `TERMINAL_STATUSES`/`WITH_CANDIDATE` consts, and the `HiringApplicationSummary` interface —
  Task 8 adds `approve()` to this same class and reuses `getOrThrow`/`toSummary`/
  `TERMINAL_STATUSES` directly.

- [ ] **Step 1: Write the DTOs**

  ```typescript
  // backend/src/hiring/dto/create-hiring-application.dto.ts
  import { IsEnum, IsString, MinLength } from 'class-validator';
  import { EmployeeType } from '@prisma/client';

  export class CreateHiringApplicationDto {
    @IsString() @MinLength(1) candidateId!: string;
    @IsEnum(EmployeeType) employeeType!: EmployeeType;
    @IsString() @MinLength(1) campusId!: string;
  }
  ```

  ```typescript
  // backend/src/hiring/dto/update-hiring-application.dto.ts
  import { IsIn, IsOptional, IsString } from 'class-validator';

  export const NON_TERMINAL_HIRING_STATUSES = ['SHORTLISTED', 'INTERVIEWED'] as const;

  export class UpdateHiringApplicationDto {
    @IsOptional()
    @IsIn(NON_TERMINAL_HIRING_STATUSES)
    status?: (typeof NON_TERMINAL_HIRING_STATUSES)[number];

    @IsOptional()
    @IsString()
    decisionNotes?: string;
  }
  ```

- [ ] **Step 2: Write the failing tests**

  ```typescript
  // backend/src/hiring/hiring-applications.service.spec.ts
  import { Test } from '@nestjs/testing';
  import { BadRequestException, NotFoundException } from '@nestjs/common';
  import { HiringApplicationsService } from './hiring-applications.service';
  import { PrismaService } from '../prisma/prisma.service';

  describe('HiringApplicationsService', () => {
    let service: HiringApplicationsService;
    let prisma: {
      hiringApplication: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
      $transaction: jest.Mock;
    };

    const withCandidate = (overrides: Record<string, unknown> = {}) => ({
      id: 'app1', candidateId: 'c1', candidate: { name: 'Bilal Hussain' },
      employeeType: 'GUARD', campusId: 'cam1', status: 'SUBMITTED',
      decisionNotes: null, reviewedById: null, createdStaffId: null,
      ...overrides,
    });

    beforeEach(async () => {
      prisma = {
        hiringApplication: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
        $transaction: jest.fn(),
      };
      const moduleRef = await Test.createTestingModule({
        providers: [HiringApplicationsService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      service = moduleRef.get(HiringApplicationsService);
    });

    it('creates an application in SUBMITTED status', async () => {
      prisma.hiringApplication.create.mockResolvedValue(withCandidate());

      const result = await service.create({ candidateId: 'c1', employeeType: 'GUARD', campusId: 'cam1' });

      expect(result.status).toBe('SUBMITTED');
      expect(prisma.hiringApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SUBMITTED' }) }),
      );
    });

    it('moves a SUBMITTED application to SHORTLISTED', async () => {
      prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate());
      prisma.hiringApplication.update.mockResolvedValue(withCandidate({ status: 'SHORTLISTED' }));

      const result = await service.updateStatus('app1', { status: 'SHORTLISTED' });

      expect(result.status).toBe('SHORTLISTED');
    });

    it('rejects changing status on an already-APPROVED application', async () => {
      prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate({ status: 'APPROVED' }));

      await expect(service.updateStatus('app1', { status: 'SHORTLISTED' })).rejects.toThrow(BadRequestException);
    });

    it('rejects an application with decision notes', async () => {
      prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate());
      prisma.hiringApplication.update.mockResolvedValue(withCandidate({ status: 'REJECTED', decisionNotes: 'Not a fit', reviewedById: 'admin-1' }));

      const result = await service.reject('app1', 'Not a fit', 'admin-1');

      expect(result.status).toBe('REJECTED');
      expect(result.reviewedById).toBe('admin-1');
    });

    it('throws NotFoundException for an unknown application id', async () => {
      prisma.hiringApplication.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });
  ```

- [ ] **Step 3: Run the tests to verify they fail**

  Run: `npx jest src/hiring/hiring-applications.service.spec.ts`
  Expected: FAIL — `Cannot find module './hiring-applications.service'`.

- [ ] **Step 4: Write `HiringApplicationsService` (create/findOne/findMany/updateStatus/reject
  only — Task 8 adds `approve()`)**

  ```typescript
  // backend/src/hiring/hiring-applications.service.ts
  import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
  import { PrismaService } from '../prisma/prisma.service';
  import { CreateHiringApplicationDto } from './dto/create-hiring-application.dto';
  import { UpdateHiringApplicationDto } from './dto/update-hiring-application.dto';
  import type { EmployeeType } from '@prisma/client';

  export interface HiringApplicationSummary {
    id: string;
    candidateId: string;
    candidateName: string;
    employeeType: EmployeeType;
    campusId: string;
    status: string;
    decisionNotes: string | null;
    reviewedById: string | null;
    createdStaffId: string | null;
  }

  export const TERMINAL_STATUSES = ['APPROVED', 'REJECTED'];
  const WITH_CANDIDATE = { candidate: { select: { name: true } } } as const;

  @Injectable()
  export class HiringApplicationsService {
    constructor(private readonly prisma: PrismaService) {}

    private toSummary(record: {
      id: string; candidateId: string; candidate: { name: string }; employeeType: EmployeeType;
      campusId: string; status: string; decisionNotes: string | null; reviewedById: string | null;
      createdStaffId: string | null;
    }): HiringApplicationSummary {
      return {
        id: record.id,
        candidateId: record.candidateId,
        candidateName: record.candidate.name,
        employeeType: record.employeeType,
        campusId: record.campusId,
        status: record.status,
        decisionNotes: record.decisionNotes,
        reviewedById: record.reviewedById,
        createdStaffId: record.createdStaffId,
      };
    }

    async create(dto: CreateHiringApplicationDto): Promise<HiringApplicationSummary> {
      const record = await this.prisma.hiringApplication.create({
        data: {
          candidateId: dto.candidateId,
          employeeType: dto.employeeType,
          campusId: dto.campusId,
          status: 'SUBMITTED',
        },
        include: WITH_CANDIDATE,
      });
      return this.toSummary(record);
    }

    async findOne(id: string): Promise<HiringApplicationSummary> {
      const existing = await this.getOrThrow(id);
      return this.toSummary(existing);
    }

    async findMany(campusId?: string, status?: string): Promise<HiringApplicationSummary[]> {
      const records = await this.prisma.hiringApplication.findMany({
        where: {
          ...(campusId ? { campusId } : {}),
          ...(status ? { status } : {}),
        },
        include: WITH_CANDIDATE,
        orderBy: { createdAt: 'desc' },
      });
      return records.map((r) => this.toSummary(r));
    }

    private async getOrThrow(id: string) {
      const existing = await this.prisma.hiringApplication.findUnique({ where: { id }, include: WITH_CANDIDATE });
      if (!existing) {
        throw new NotFoundException('Hiring application not found');
      }
      return existing;
    }

    async updateStatus(id: string, dto: UpdateHiringApplicationDto): Promise<HiringApplicationSummary> {
      const existing = await this.getOrThrow(id);
      if (TERMINAL_STATUSES.includes(existing.status)) {
        throw new BadRequestException(`Application is already ${existing.status.toLowerCase()} and cannot be changed`);
      }
      const record = await this.prisma.hiringApplication.update({
        where: { id },
        include: WITH_CANDIDATE,
        data: {
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.decisionNotes !== undefined ? { decisionNotes: dto.decisionNotes } : {}),
        },
      });
      return this.toSummary(record);
    }

    async reject(id: string, decisionNotes: string, reviewedById: string): Promise<HiringApplicationSummary> {
      const existing = await this.getOrThrow(id);
      if (TERMINAL_STATUSES.includes(existing.status)) {
        throw new BadRequestException(`Application is already ${existing.status.toLowerCase()}`);
      }
      const record = await this.prisma.hiringApplication.update({
        where: { id },
        include: WITH_CANDIDATE,
        data: { status: 'REJECTED', decisionNotes, reviewedById },
      });
      return this.toSummary(record);
    }
  }
  ```

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `npx jest src/hiring/hiring-applications.service.spec.ts`
  Expected: PASS, all 5 tests.

- [ ] **Step 6: Write `HiringApplicationsController` (approve route stubbed as `NotImplementedException` — Task 8 fills it in)**

  ```typescript
  // backend/src/hiring/hiring-applications.controller.ts
  import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
  import type { Request } from 'express';
  import { HiringApplicationsService } from './hiring-applications.service';
  import { CreateHiringApplicationDto } from './dto/create-hiring-application.dto';
  import { UpdateHiringApplicationDto } from './dto/update-hiring-application.dto';
  import { Roles } from '../auth/decorators/roles.decorator';
  import type { RequestUser } from '../common/student-access.service';

  interface AuthenticatedRequest extends Request {
    user: RequestUser;
  }

  @Controller('api/v1/hiring/applications')
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  export class HiringApplicationsController {
    constructor(private readonly hiringApplicationsService: HiringApplicationsService) {}

    @Post()
    create(@Body() dto: CreateHiringApplicationDto) {
      return this.hiringApplicationsService.create(dto);
    }

    @Get()
    list(@Query('campusId') campusId?: string, @Query('status') status?: string) {
      return this.hiringApplicationsService.findMany(campusId, status);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
      return this.hiringApplicationsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: UpdateHiringApplicationDto) {
      return this.hiringApplicationsService.updateStatus(id, dto);
    }

    @Post(':id/reject')
    reject(@Param('id') id: string, @Body('decisionNotes') decisionNotes: string, @Req() req: AuthenticatedRequest) {
      return this.hiringApplicationsService.reject(id, decisionNotes, req.user.id);
    }
  }
  ```

  (The `approve` route is added in Task 8, alongside `HiringApplicationsService.approve()` — it
  is not stubbed here because a stub with no real body would violate this plan's "no
  placeholders" rule.)

- [ ] **Step 7: Type-check**

  Run: `npx tsc --noEmit`
  Expected: no errors.

- [ ] **Step 8: Commit**

  ```bash
  git add src/hiring/dto/create-hiring-application.dto.ts src/hiring/dto/update-hiring-application.dto.ts src/hiring/hiring-applications.service.ts src/hiring/hiring-applications.controller.ts src/hiring/hiring-applications.service.spec.ts
  git commit -m "feat(hiring): add application intake, listing, and shortlist/interview/reject"
  ```

---

### Task 8: Approve a hiring application (creates Staff, and Teacher for TEACHER hires)

**Files:**
- Create: `backend/src/hiring/dto/approve-hiring-application.dto.ts`
- Create: `backend/src/hiring/create-staff-with-optional-teacher.ts`
- Modify: `backend/src/hiring/hiring-applications.service.ts`
- Modify: `backend/src/hiring/hiring-applications.controller.ts`
- Modify: `backend/src/hiring/hiring-applications.service.spec.ts`

**Interfaces:**
- Consumes: `createTeacherWithUser` (`../teacher/create-teacher-with-user`, unmodified — this is
  the load-bearing proof that `Teacher` needed zero changes), `TERMINAL_STATUSES`/`getOrThrow`/
  `toSummary`/`WITH_CANDIDATE` (Task 7, same class).
- Produces: `HiringApplicationsService.approve`, `createStaffWithOptionalTeacher` — nothing later
  depends on these; this is the final piece of the pipeline.

- [ ] **Step 1: Write the DTO**

  ```typescript
  // backend/src/hiring/dto/approve-hiring-application.dto.ts
  import { IsDateString, IsEmail, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
  import { Type } from 'class-transformer';

  class HiringLoginDto {
    @IsString() @MinLength(1) identifier!: string;
    @IsString() @MinLength(8) password!: string;
  }

  export class ApproveHiringApplicationDto {
    @IsOptional() @IsDateString() dateOfBirth?: string;
    @IsOptional() @IsString() cnic?: string;
    @IsOptional() @IsString() mobile?: string;
    @IsOptional() @IsEmail() email?: string;
    @IsOptional() @IsDateString() joiningDate?: string;
    // Required when the application's employeeType is TEACHER (enforced in the service, not
    // here, since the rule depends on the application record, not just this DTO's own shape).
    // Ignored for every other employeeType — see this sub-project's scope cut in
    // docs/database/data-model-design.md.
    @IsOptional() @ValidateNested() @Type(() => HiringLoginDto) login?: HiringLoginDto;
  }
  ```

- [ ] **Step 2: Write the failing test for `createStaffWithOptionalTeacher`**

  ```typescript
  // backend/src/hiring/create-staff-with-optional-teacher.spec.ts
  import { createStaffWithOptionalTeacher } from './create-staff-with-optional-teacher';

  describe('createStaffWithOptionalTeacher', () => {
    it('creates a Staff row with no linked Teacher/User for a non-teacher hire', async () => {
      const tx = {
        staff: { create: jest.fn().mockResolvedValue({ id: 'st1', name: 'Nazir Ahmed' }) },
      } as any;

      const result = await createStaffWithOptionalTeacher(tx, {
        name: 'Nazir Ahmed',
        employeeType: 'JANITORIAL',
        campusId: 'cam1',
      });

      expect(result).toEqual({ id: 'st1', name: 'Nazir Ahmed' });
      expect(tx.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ teacherId: undefined, userId: undefined }) }),
      );
    });

    it('creates a linked Teacher (and User) and wires their ids onto the Staff row for a TEACHER hire', async () => {
      const tx = {
        teacher: {
          create: jest.fn().mockResolvedValue({ id: 't1', userId: 'u1', name: 'Ayesha Khan' }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't1', userId: 'u1' }),
        },
        user: { create: jest.fn().mockResolvedValue({ id: 'u1', identifier: 'ayesha.khan' }) },
        staff: { create: jest.fn().mockResolvedValue({ id: 'st1', name: 'Ayesha Khan' }) },
      } as any;

      await createStaffWithOptionalTeacher(tx, {
        name: 'Ayesha Khan',
        employeeType: 'TEACHER',
        campusId: 'cam1',
        login: { identifier: 'ayesha.khan', password: 'a-strong-password' },
      });

      expect(tx.staff.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ teacherId: 't1', userId: 'u1' }) }),
      );
    });
  });
  ```

- [ ] **Step 3: Run the test to verify it fails**

  Run: `npx jest src/hiring/create-staff-with-optional-teacher.spec.ts`
  Expected: FAIL — `Cannot find module './create-staff-with-optional-teacher'`.

- [ ] **Step 4: Write `createStaffWithOptionalTeacher`**

  ```typescript
  // backend/src/hiring/create-staff-with-optional-teacher.ts
  import { Prisma, EmployeeType } from '@prisma/client';
  import { createTeacherWithUser } from '../teacher/create-teacher-with-user';

  export interface CreateStaffInput {
    name: string;
    employeeType: EmployeeType;
    campusId: string;
    dateOfBirth?: string;
    cnic?: string;
    mobile?: string;
    email?: string;
    joiningDate?: string;
    login?: { identifier: string; password: string };
  }

  export interface CreatedStaff {
    id: string;
    name: string;
  }

  /**
   * The one place a Staff row (+ linked Teacher + User, for employeeType TEACHER) is created —
   * called from HiringApplicationsService.approve() inside its own transaction. Mirrors
   * createStudentWithEnrollment's/createTeacherWithUser's shape: takes a transaction client, not
   * PrismaService, so the caller controls the transaction boundary.
   *
   * Scope cut (docs/database/data-model-design.md, Sub-project 3): only TEACHER hires get a
   * linked User/login. `login` is ignored for every other employeeType.
   */
  export async function createStaffWithOptionalTeacher(
    tx: Prisma.TransactionClient,
    input: CreateStaffInput,
  ): Promise<CreatedStaff> {
    let userId: string | undefined;
    let teacherId: string | undefined;

    if (input.employeeType === 'TEACHER') {
      if (!input.login) {
        // The caller (HiringApplicationsService.approve()) already validates this before opening
        // the transaction — this is a defensive invariant, not user-facing validation.
        throw new Error('login is required when employeeType is TEACHER');
      }
      const teacher = await createTeacherWithUser(tx, {
        identifier: input.login.identifier,
        password: input.login.password,
        name: input.name,
        campusId: input.campusId,
      });
      teacherId = teacher.id;
      const teacherRow = await tx.teacher.findUniqueOrThrow({ where: { id: teacher.id } });
      userId = teacherRow.userId;
    }

    const staff = await tx.staff.create({
      data: {
        name: input.name,
        employeeType: input.employeeType,
        campusId: input.campusId,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        cnic: input.cnic,
        mobile: input.mobile,
        email: input.email,
        joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
        userId,
        teacherId,
      },
    });

    return { id: staff.id, name: staff.name };
  }
  ```

- [ ] **Step 5: Run the test to verify it passes**

  Run: `npx jest src/hiring/create-staff-with-optional-teacher.spec.ts`
  Expected: PASS, 2 tests.

- [ ] **Step 6: Write the failing tests for `approve()`**

  Add to `hiring-applications.service.spec.ts`, inside the `describe` block (add `createStaffId:
  null` is already in the `withCandidate` fixture):

  ```typescript
  describe('approve', () => {
    it('rejects approving a TEACHER application with no login supplied', async () => {
      prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate({ employeeType: 'TEACHER' }));

      await expect(service.approve('app1', {}, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects approving an application that is already terminal', async () => {
      prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate({ status: 'REJECTED' }));

      await expect(service.approve('app1', {}, 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('creates the Staff record and marks the application APPROVED on success', async () => {
      prisma.hiringApplication.findUnique.mockResolvedValue(withCandidate());
      prisma.$transaction.mockImplementation(async (fn: any) =>
        fn({
          staff: { create: jest.fn().mockResolvedValue({ id: 'st1', name: 'Bilal Hussain' }) },
          hiringApplication: {
            update: jest.fn().mockResolvedValue(withCandidate({ status: 'APPROVED', createdStaffId: 'st1', reviewedById: 'admin-1' })),
          },
        }),
      );

      const result = await service.approve('app1', {}, 'admin-1');

      expect(result.status).toBe('APPROVED');
      expect(result.createdStaffId).toBe('st1');
    });
  });
  ```

- [ ] **Step 7: Run the tests to verify they fail**

  Run: `npx jest src/hiring/hiring-applications.service.spec.ts`
  Expected: FAIL — `service.approve is not a function`.

- [ ] **Step 8: Add `approve()` to `HiringApplicationsService`**

  Add imports at the top of `hiring-applications.service.ts`:

  ```typescript
  import { ApproveHiringApplicationDto } from './dto/approve-hiring-application.dto';
  import { createStaffWithOptionalTeacher } from './create-staff-with-optional-teacher';
  import { assertCreatable } from '../common/prisma-create-guard';
  ```

  Add the method, after `reject`:

  ```typescript
    async approve(id: string, dto: ApproveHiringApplicationDto, reviewedById: string): Promise<HiringApplicationSummary> {
      const existing = await this.getOrThrow(id);
      if (TERMINAL_STATUSES.includes(existing.status)) {
        throw new BadRequestException(`Application is already ${existing.status.toLowerCase()}`);
      }
      if (existing.employeeType === 'TEACHER' && !dto.login) {
        throw new BadRequestException('A login identifier/password is required to hire a teacher.');
      }

      let record: Parameters<HiringApplicationsService['toSummary']>[0];
      try {
        record = await this.prisma.$transaction(async (tx) => {
          const { id: staffId } = await createStaffWithOptionalTeacher(tx, {
            name: existing.candidate.name,
            employeeType: existing.employeeType,
            campusId: existing.campusId,
            dateOfBirth: dto.dateOfBirth,
            cnic: dto.cnic,
            mobile: dto.mobile,
            email: dto.email,
            joiningDate: dto.joiningDate,
            login: dto.login,
          });
          return tx.hiringApplication.update({
            where: { id },
            include: WITH_CANDIDATE,
            data: { status: 'APPROVED', reviewedById, createdStaffId: staffId },
          });
        });
      } catch (error) {
        assertCreatable(error, 'This CNIC or login identifier is already in use.');
      }
      return this.toSummary(record);
    }
  ```

- [ ] **Step 9: Run the tests to verify they pass**

  Run: `npx jest src/hiring/hiring-applications.service.spec.ts`
  Expected: PASS, all 8 tests.

- [ ] **Step 10: Add the approve route to `HiringApplicationsController`**

  Add import:

  ```typescript
  import { ApproveHiringApplicationDto } from './dto/approve-hiring-application.dto';
  ```

  Add route, after `reject`:

  ```typescript
    @Post(':id/approve')
    approve(@Param('id') id: string, @Body() dto: ApproveHiringApplicationDto, @Req() req: AuthenticatedRequest) {
      return this.hiringApplicationsService.approve(id, dto, req.user.id);
    }
  ```

- [ ] **Step 11: Type-check and run the full backend test suite**

  Run: `npx tsc --noEmit && npx jest`
  Expected: both pass.

- [ ] **Step 12: Commit**

  ```bash
  git add src/hiring/dto/approve-hiring-application.dto.ts src/hiring/create-staff-with-optional-teacher.ts src/hiring/create-staff-with-optional-teacher.spec.ts src/hiring/hiring-applications.service.ts src/hiring/hiring-applications.controller.ts src/hiring/hiring-applications.service.spec.ts
  git commit -m "feat(hiring): approve applications into Staff (+ Teacher for teacher hires)"
  ```

---

### Task 9: Wire up modules, register in `app.module.ts`, final verification

**Files:**
- Create: `backend/src/hiring/hiring.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `StaffModule` (Task 2), `HiringModule` (this task) — both register in
  `AppModule.imports`.
- Produces: nothing further — this is the plan's final task.

- [ ] **Step 1: Write `HiringModule`**

  ```typescript
  // backend/src/hiring/hiring.module.ts
  import { Module } from '@nestjs/common';
  import { HiringCandidatesService } from './hiring-candidates.service';
  import { HiringCandidatesController } from './hiring-candidates.controller';
  import { HiringApplicationsService } from './hiring-applications.service';
  import { HiringApplicationsController } from './hiring-applications.controller';

  @Module({
    providers: [HiringCandidatesService, HiringApplicationsService],
    controllers: [HiringCandidatesController, HiringApplicationsController],
  })
  export class HiringModule {}
  ```

- [ ] **Step 2: Register both modules in `app.module.ts`**

  Add these two imports near the existing `import { StudentModule } from './student/student.module';`
  line:

  ```typescript
  import { StaffModule } from './staff/staff.module';
  import { HiringModule } from './hiring/hiring.module';
  ```

  Add `StaffModule` and `HiringModule` to the `imports` array, right after the existing
  `StudentModule,` entry:

  ```typescript
      StudentModule,
      StaffModule,
      HiringModule,
  ```

- [ ] **Step 3: Full verification**

  ```bash
  cd backend
  npx prisma validate
  npx tsc --noEmit
  npx jest
  npm run build
  ```

  Expected: schema valid, no type errors, every test passes (existing suite + this plan's new
  `src/staff`/`src/hiring` specs), build succeeds. This is the load-bearing check that nothing in
  the 27-file "references Teacher" set broke — none of those files were touched by this plan, so
  their existing tests passing unmodified is the proof.

- [ ] **Step 4: Update `docs/database/migration-plan.md`'s Sub-project 3 checklist**

  Check off the items that are now true (schema/migration/seed, `StaffProfileController`/
  `HiringCandidatesController`/`HiringApplicationsController` endpoints validated with unit
  tests) — leave the staff-console UI item unchecked, since it's a separate follow-on plan.

- [ ] **Step 5: Commit**

  ```bash
  git add src/hiring/hiring.module.ts src/app.module.ts ../docs/database/migration-plan.md
  git commit -m "feat(hiring): wire StaffModule and HiringModule into AppModule"
  ```

---

## What this plan deliberately does not include

- **Staff-console UI** (Staff profile page, Hiring queue/intake/review pages) — a separate
  follow-on implementation plan, matching how Sub-project 1B followed Sub-project 1's backend
  plan. Not started.
- **Non-teaching staff logins/RBAC** — flagged as an explicit open decision in the design doc, not
  guessed at here.
- **Backfilling `Staff` wrapper rows for the 3 pre-existing seeded `Teacher` rows** — a product
  decision (does the future "all staff" list need to show teachers hired before this plan
  existed?), flagged in the migration plan, not resolved by this plan.
- **Bulk-import for Staff** — no bulk-import path exists for this plan's new models; Student's own
  bulk-import gap (noted in Sub-project 1's plan) isn't closed here either.
