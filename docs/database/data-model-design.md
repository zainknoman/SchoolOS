# Data Model Design (Phase 2)

Living design document for the production-ready school-management data model. Built incrementally,
one sub-project at a time, on top of the findings in `docs/database/full-data-model-audit.md`.
Every change here follows the schema's own established pattern (confirmed in the audit): **additive
only** — new tables, or new nullable/defaulted columns on existing tables. Nothing existing is
removed, renamed, or made required without a backfill.

## Rollout decomposition

The full brief (Student + Parent + Teacher + Admission + shared Address/Document/Emergency/Medical
models, across schema + backend + two frontends) is too large for one design/plan/implementation
cycle. It is split into four sub-projects, each independently designed, planned, implemented, and
tested:

1. **Shared foundation + Student** (this document's first section) — Address, generic Document
   join-model pattern, Student identity/contact/academic/status fields, StudentPreviousSchool,
   StudentEmergencyContact, StudentMedicalInfo, StudentDocument, Enrollment additions.
2. **Parent/Guardian** — ParentProfile expansion, StudentParent relationship enrichment,
   ParentDocument.
3. **Staff & Hiring** (this document's third section) — a new `Staff` model generalizing `Teacher`
   to every employee type (teacher, office staff, janitorial, helper, guard, other), with
   Address/EmergencyContact/Document/Experience satellites mirroring Student's, plus a
   `HiringCandidate`/`HiringApplication` recruitment pipeline (mirrors Admission's
   `Applicant`/`Application`) whose approval creates the `Staff` record (and, for teachers, the
   linked `Teacher` row). `Teacher` itself is **not modified** — see that section's "Why `Teacher`
   is untouched" note.
4. **Admission** — Applicant/Application workflow expansion, ApplicationDocument, and the
   Applicant↔ParentProfile/Student boundary decision flagged in the audit.

Each sub-project gets its own implementation plan under `docs/superpowers/plans/` (this repo's
established planning location — see project memory) and lands in its own git worktree, merged when
its tests pass. This document and `docs/database/migration-plan.md` accumulate across all four.

---

## Sub-project 1 — Shared foundation + Student

### Design goals

- Extend `Student` with the Identity/Contact/Academic/Status fields from the brief, as additive
  nullable columns — no existing `Student` consumer (DTOs, forms, bulk import, seed) breaks.
- Introduce one reusable `Address` model, referenced by plain FK columns (not a polymorphic
  ownerType/ownerId table — Prisma/Postgres can't enforce referential integrity on that, and it adds
  indirection with no real benefit at this scale).
- Introduce document support for Student by extending the *existing* generic `File` model with a new
  join model (`StudentDocument`), mirroring the established `DiaryAttachment`/`CircularAttachment`
  pattern — not a new file-storage system, not per-field file columns.
- Split genuinely separate concerns (previous school, emergency contacts, medical/welfare, documents)
  into their own tables rather than widening `Student` — each is either 1:many or a logically
  distinct 1:1 concern with its own UI section.
- Add `rollNumber`/`promotionDate`/`remarks` to `Enrollment` (not `Student`) — a roll number is
  per-section-per-year, so it must live on the historical record, not the permanent student row.

### New enums

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

// Shared across Student/Teacher/Parent/Application document join models added across all
// four sub-projects — extend this enum's members as later sub-projects need new types, never
// fork a per-owner copy of it.
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

### New models

```prisma
// Reusable address value-object. Referenced by plain nullable FK from whichever entity needs
// it (Student.currentAddressId, Student.permanentAddressId, StudentPreviousSchool.addressId,
// StudentEmergencyContact.addressId today; ParentProfile/Teacher get their own FK columns in
// their sub-projects). Each row is owned by exactly one FK — never shared/reused across owners,
// so update-in-place is always safe.
model Address {
  id         String   @id @default(uuid())
  line1      String
  line2      String?
  area       String?
  city       String?
  district   String?
  province   String?
  postalCode String?
  country    String   @default("Pakistan")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
}

model StudentPreviousSchool {
  id                      String    @id @default(uuid())
  studentId               String    @unique
  student                 Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  schoolName              String
  addressId               String?
  address                 Address?  @relation(fields: [addressId], references: [id], onDelete: SetNull)
  contactNumber           String?
  email                   String?
  lastClassAttended       String?
  admissionDate           DateTime?
  leavingDate             DateTime?
  leavingCertificateNumber String?
  leavingCertificateDate  DateTime?
  reasonForLeaving        String?
  academicRemarks         String?
  createdAt               DateTime  @default(now())
  updatedAt                DateTime @updatedAt
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

### Changed models

`Student` — additive nullable columns only, existing `id`/`grNumber`/`name`/`createdAt`/`updatedAt`
untouched:

| Field | Type | Notes |
|---|---|---|
| `firstName` | `String?` | New structured name alongside existing `name`, not replacing it |
| `middleName` | `String?` | |
| `lastName` | `String?` | |
| `preferredName` | `String?` | |
| `gender` | `Gender?` | |
| `dateOfBirth` | `DateTime?` | |
| `placeOfBirth` | `String?` | |
| `nationality` | `String?` | default `"Pakistani"` |
| `religion` | `String?` | |
| `bFormNumber` | `String?` | `@unique` — nullable-unique is safe on Postgres (multiple NULLs allowed) |
| `profilePhotoFileId` | `String?` | FK → `File`, `onDelete: SetNull` |
| `status` | `StudentStatus` | default `ACTIVE` |
| `admissionDate` | `DateTime?` | |
| `leavingDate` | `DateTime?` | |
| `leavingReason` | `String?` | |
| `studentMobile` | `String?` | |
| `studentEmail` | `String?` | |
| `currentAddressId` | `String?` | FK → `Address`, `onDelete: SetNull` |
| `permanentAddressId` | `String?` | FK → `Address`, `onDelete: SetNull` |

New relations on `Student`: `previousSchool StudentPreviousSchool?`, `emergencyContacts
StudentEmergencyContact[]`, `medicalInfo StudentMedicalInfo?`, `documents StudentDocument[]`.

`Enrollment` — additive nullable columns:

| Field | Type | Notes |
|---|---|---|
| `rollNumber` | `String?` | Per-section-per-year, not on `Student` |
| `promotionDate` | `DateTime?` | Distinct from `startDate` — the date a promotion decision was recorded |
| `remarks` | `String?` | |

`File` — new back-relation `studentDocuments StudentDocument[]` (no column changes).

`User` — new back-relation `verifiedStudentDocuments StudentDocument[]` (no column changes).

### Relationships & cardinality

- `Student 1 — 0/1 StudentPreviousSchool` (one prior school record, matching the brief's singular
  framing; not a full transfer history)
- `Student 1 — 0/1 StudentMedicalInfo`
- `Student 1 — 0..N StudentEmergencyContact`
- `Student 1 — 0..N StudentDocument`
- `Address 1 — 0..N` consumers via distinct FK columns (each Address row has exactly one live FK
  pointing at it in practice, even though the schema doesn't enforce single-ownership — acceptable
  since rows are always created scoped to one owner, never shared)

### Required vs optional

Every new column on `Student`/`Enrollment` is optional. Every new model's FK back to `Student` is
required (rows only exist scoped to a student) except the FK *to* `Address`/`File`, which stays
optional so a document/address can be added later without blocking record creation.

### Indexes & unique constraints

- `StudentPreviousSchool.studentId`, `StudentMedicalInfo.studentId` — `@unique` (1:1)
- `StudentEmergencyContact.studentId`, `StudentDocument.studentId` — `@@index` (1:many lookups)
- `Student.bFormNumber` — `@unique`

### Backward compatibility / migration strategy

- All new `Student`/`Enrollment` columns are nullable or defaulted → existing rows (seed data, any
  live data) remain valid with no backfill required.
- No existing column is renamed, retyped, or dropped.
- No existing DTO/controller/form breaks — they simply don't send the new fields yet, which is fine
  since all are optional.
- Full migration mechanics (migration file plan, apply order, rollback notes) are in
  `docs/database/migration-plan.md`.

---

## Sub-project 3 — Staff & Hiring

> Designed out of order relative to the numbered list above: Sub-project 2 (Parent/Guardian) has
> not been designed yet. This section stands on its own — it depends only on Sub-project 1's
> `Address`/`File`/`DocumentType`/`DocumentVerificationStatus` primitives, not on Parent.

### Design goals

- Give every non-teaching employee (office staff, janitorial, helper, guard, other) a real record —
  today only `Teacher` exists, and it's minimal (`id, userId, name, campusId`). Mirrors the
  audit finding that motivated Sub-project 1: the fix is additive schema, not a rewrite.
- One `employeeType` field says what kind of employee a `Staff` row is — "type of employee will
  tell if he is teacher or not" (the brief's own framing). Every employee type shares the same
  core HR record (identity, contact, address, employment status, documents, past experience);
  only `TEACHER` additionally gets a linked teaching-specific record.
- **Why `Teacher` is untouched:** 27 backend files and 20 staff-console files reference `Teacher`
  today (`Timetable.teacherId`, `Section.classTeacherOfSections`, `Attendance` marking, the
  `teacher`/`teachers` admin modules, bulk-import, sections DTOs, etc.). Renaming or restructuring
  it would touch all of them for no functional gain, and would violate this document's own
  additive-only rule (top of this file: "Nothing existing is removed, renamed, or made required").
  Instead, `Staff` gets a new optional `teacherId` FK pointing *at* the existing `Teacher` table.
  For an `employeeType: TEACHER` hire, the Hiring approval flow creates a `Teacher` row exactly the
  way `TeacherService.create()` already does today (reusing `createTeacherWithUser`), then links it
  from the new `Staff` row. Every existing Teacher-consuming file keeps working unmodified; `Staff`
  is purely additive alongside it.
- `Staff.name`/`campusId` duplicate the linked `Teacher.name`/`campusId` for a teacher-type hire.
  This is the same accepted duplication Sub-project 1 used for `Student.name` alongside
  `firstName`/`middleName`/`lastName` — intentional, not an oversight.
- `Staff.userId` is **optional**, unlike `Teacher.userId` (required). Most non-teaching roles
  (guard, janitorial, helper) have no reason to log into the staff console; a `Staff` row only
  gets a `User`/login when the role needs one. `Teacher`'s own `userId` stays required exactly as
  it is today — a `TEACHER`-type hire always gets both a `User` (required by `Teacher`) and
  `Staff.userId` set to that same `User.id` so the two records agree on identity.
  **Scope cut for this sub-project:** the `User.role` enum has no value for a non-teaching
  employee type today (`OFFICE_STAFF`/`JANITORIAL`/`HELPER`/`GUARD` aren't valid `Role`s, and no
  permission model exists for them), so the Hiring approve flow in this plan only ever creates a
  `User` for `employeeType: TEACHER`. Every other `employeeType` gets `Staff.userId: null` — no
  login, by design, not by oversight. Giving non-teaching staff console logins is a real future
  need but a separate, unscoped decision (new `Role` values + what they're allowed to do) that
  this sub-project deliberately does not make.
- Past experience (the brief's explicit ask) is modeled as `StaffExperience`, available to any
  `employeeType` — a janitor or guard can have prior-employer history just as easily as a teacher.
- The Hiring module is a real pipeline (`HiringCandidate` → `HiringApplication`, staged
  `SUBMITTED → SHORTLISTED → INTERVIEWED → APPROVED/REJECTED`), structurally identical to
  Admission's `Applicant`/`Application`/`approve()` pattern — same terminal-status guard, same
  "approve creates the real record in a transaction" shape.

### New enums

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

`HiringApplication.status` is a plain `String` with `@default("SUBMITTED")`, not an enum —
matching `Application.status`'s existing precedent exactly (keeps intermediate-stage values
adjustable without a migration, same rationale that model already established). Convention (not
DB-enforced, same as `Application`): `SUBMITTED → SHORTLISTED → INTERVIEWED → APPROVED/REJECTED`,
with `APPROVED`/`REJECTED` terminal.

### New models

```prisma
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
  // Only set for employeeType: TEACHER. Points at the existing Teacher table — see "Why Teacher
  // is untouched" above. onDelete: SetNull, not Cascade — a Teacher row is never deleted by
  // deleting the Staff wrapper around it (nothing in this codebase hard-deletes Teacher today).
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

// Past employment history — any employeeType, not just TEACHER (the brief's "extend fields for
// teacher like student, with past experience" generalizes naturally: every employee can have had
// a job before this one).
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

### Changed models

`Teacher` — **zero column changes.** Gains only a virtual Prisma back-relation (`staff Staff?`,
generated from `Staff.teacherId` — no migration DDL of its own).

`Campus`, `File`, `User`, `Address` — each gains only virtual back-relations for the new models
above (`Campus.staffMembers Staff[]` / `Campus.hiringApplications HiringApplication[]`,
`File.staffProfilePhotos Staff[]` / `File.staffDocuments StaffDocument[]` /
`File.hiringResumes HiringCandidate[]`, `User.staffAccount Staff?` /
`User.verifiedStaffDocuments StaffDocument[]` / `User.reviewedHiringApplications
HiringApplication[]`, `Address.staffCurrentAddress Staff[]` / `Address.staffPermanentAddress
Staff[]`). None of these require an `ALTER TABLE` — the FK columns all live on the new tables.

### Relationships & cardinality

- `Staff 0/1 — 0/1 Teacher` (optional both ways; only populated for `employeeType: TEACHER`)
- `Staff 1 — 0..N StaffEmergencyContact`, `Staff 1 — 0..N StaffExperience`, `Staff 1 — 0..N
  StaffDocument`
- `HiringCandidate 1 — 0..N HiringApplication` (a candidate can (re)apply more than once, exactly
  like `Applicant 1 — 0..N Application`)
- `HiringApplication 0/1 — 0/1 Staff` via `createdStaffId`, set only on approval — mirrors
  `Application.createdStudentId` exactly

### Required vs optional

Every `Staff` field is optional except `id`, `name`, `employeeType`, `campusId` — mirroring how
`Student` only requires `id`/`grNumber`/`name`/`status`. `HiringCandidate` requires `name` +
`contactPhone` only (a candidate can be entered from a phone call before a résumé exists).
`HiringApplication` requires `candidateId`/`employeeType`/`campusId`/`status`, matching
`Application`'s required set.

### Indexes & unique constraints

- `Staff.userId`, `Staff.teacherId`, `Staff.cnic` — `@unique`
- `Staff.campusId`, `Staff.employeeType` — `@@index`
- `StaffEmergencyContact.staffId`, `StaffExperience.staffId`, `StaffDocument.staffId` — `@@index`
- `HiringCandidate.contactPhone` — `@@index` (mirrors `Applicant.guardianPhone`)
- `HiringApplication.candidateId`, `HiringApplication.[campusId, status]` — `@@index`
- `HiringApplication.createdStaffId` — `@unique`

### Backward compatibility / migration strategy

- Every new table is new; every FK it adds lives on that new table. `Teacher`/`Campus`/`File`/
  `User`/`Address` gain zero `ALTER TABLE` statements — only virtual Prisma back-relations.
- No existing DTO, controller, form, or test that touches `Teacher` changes at all.
- Full migration mechanics are in `docs/database/migration-plan.md`'s Sub-project 3 section.