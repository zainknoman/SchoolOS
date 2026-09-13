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
3. **Teacher/Staff** — Teacher expansion, TeacherSubject/TeacherClass assignment models,
   TeacherDocument.
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
