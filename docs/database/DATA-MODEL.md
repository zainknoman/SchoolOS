# Data Model

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/prisma/schema.prisma` (57 models, 14 enums, 108 foreign-key relations), 13 migrations · **Owner:** Engineering Lead
> Companions (generated from the schema): [DATA-DICTIONARY.md](DATA-DICTIONARY.md) (every field) · [ERD.md](ERD.md) (relationships by domain). Isolation: [TENANCY.md](TENANCY.md). History/audit: [HISTORY.md](HISTORY.md). Migrations: [MIGRATIONS.md](MIGRATIONS.md). Seed: [SEEDING.md](SEEDING.md).

## Conventions (observed)
- PostgreSQL via Prisma 7; string UUID primary keys (`@default(uuid())`); `createdAt` on most tables, `updatedAt` on 36 of 57 (append-only/log tables lack it).
- Money = `Int` in the smallest currency unit. Statuses are Prisma enums for core lifecycles (`Role`, `AttendanceStatus`, `EnrollmentStatus`, `PromotionDecision`, `StudentStatus`, `EmployeeType`, `EmploymentStatus`, `NotificationChannel`, `OrgStatus`, `Gender`, `BloodGroup`, `DocumentType`, `DocumentVerificationStatus`, `ConversationRecipientType`) but **free strings** for several others (`Circular.scope`, `Circular.priority`, `Complaint.status`, `LeaveRequest.status`, `FeePayment.status`, application statuses). Since BL-53 (M12) the status strings are limited by database `CHECK` constraints (`<Table>_status_check`) to the values the code writes; `Circular.scope/priority` remain code-validated.
- Foreign-key delete behaviour is a mix (108 edges): 30 `Restrict`, 38 `Cascade`, 25 `SetNull`, 15 Prisma default. Structural children (satellite profile tables, terms, recipients) cascade; business records restrict.
- Indexes: 40 of 57 models declare `@@index`/`@@unique`; 7 have none (`AcademicSession`, `Address`, `DiaryAttachment`, `CircularAttachment`, `FeeStructure`, `FeeItem`, `LeaveRequest`). Key uniques: `User.identifier`, `Student.grNumber`, `Student.bFormNumber`, `ParentProfile.cnic`, `Attendance(studentId,date)`, `Mark(assessmentId,studentId)`, `ReportCard(studentId,academicSessionId)`, `StudentParent(studentId,parentProfileId)`, `Subject.name`.
- Missing uniqueness where code assumes it: one ACTIVE `Enrollment` per student; one `FeeVoucher` per student/session/month (both enforced only in services).

## Domains
| Domain | Models |
|---|---|
| Identity & audit | `User`, `RefreshToken`, `PasswordResetToken`, `DeviceToken`, `AuditLog` |
| Organization | `School`, `Campus`, `AcademicSession`, `Class`, `Section`, `Subject`, `Term`, `Holiday` |
| People | `Student`, `ParentProfile`, `StudentParent`, `Address`, `StudentPreviousSchool`, `StudentEmergencyContact`, `StudentMedicalInfo`, `StudentDocument`, `Teacher`, `Staff`, `StaffEmergencyContact`, `StaffExperience`, `StaffDocument` |
| Enrollment, admissions, hiring | `Enrollment`, `StudentPromotion`, `Applicant`, `Application`, `HiringCandidate`, `HiringApplication` |
| Academics | `Timetable`, `Attendance`, `AttendanceRiskFlag`, `DiaryEntry`, `DiaryAttachment`, `AssessmentCategory`, `Assessment`, `Mark`, `ReportCard`, `LeaveRequest`, `Complaint` |
| Communication | `Circular`, `CircularRecipient`, `CircularAttachment`, `Conversation`, `Message`, `Notification`, `DraftSuggestion` |
| Finance & files | `FeeStructure`, `FeeVoucher`, `FeeItem`, `FeePayment`, `FeePaymentAllocation`, `Receipt`, `File` |

## Core relationships (summary — see ERD for every edge)
- `School 1—* Campus 1—* Class *—1 AcademicSession`; `Class 1—* Section`; `Section.classTeacherId → Teacher`.
- `Student 1—* Enrollment *—1 Section` (also `campusId`, `academicSessionId`); `Student *—* ParentProfile` via `StudentParent`; `ParentProfile 1—1 User`; `Teacher 1—1 User`.
- `Application → Applicant`, `desiredClass`, `academicSession`; approval sets `createdStudentId`. `HiringApplication → HiringCandidate`; approval sets `createdStaffId`.
- Academics hang off `Section` (timetable, diary) or `Student` (attendance, leave, complaints, report cards); gradebook: `Term → AssessmentCategory(class) → Assessment(subject) → Mark(student)`.
- Finance: `FeeVoucher(student, session) → FeeItem`; `FeePayment ↔ FeeVoucher` through `FeePaymentAllocation`; `Receipt`; PDFs/attachments via `File`.

## Known schema-level issues (recorded, not fixed)
| ID | Issue |
|---|---|
| DB-2 | `AcademicSession`, `Subject`, `FeeStructure` have no school column ([TENANCY](TENANCY.md)) |
| DB-3 | ~~Stringly-typed status fields~~ — **mitigated 2026-09-26 (BL-53, M12):** `CHECK` constraints on Complaint, LeaveRequest, FeePayment, Application, HiringApplication and MigrationReviewItem status; conversion to Prisma enums not done (would change every writer) |
| DB-4 | ~~Missing uniqueness for single ACTIVE enrollment and per-month vouchers~~ — **fixed 2026-09-26 (BL-53, M12):** partial unique index `Enrollment_one_active_per_student` (Prisma `partialIndexes` preview) and unique `FeeVoucher(studentId, academicSessionId, month)` |
| DB-5 | No soft delete; `Cascade` on structural children means deleting a student removes its profile satellites, and deleting an academic session removes its terms (and whatever cascades from them) |
| DB-6 | `Attendance` is daily only; no per-period attendance despite a period-based timetable |

## Generated model index (BL-66)

<!-- GENERATED:BEGIN model-index -->
Generated model index (58 models, 16 enums):

- **Identity** (6): User, RefreshToken, PasswordResetToken, DeviceToken, AuditLog, MigrationReviewItem
- **Organization** (8): School, Campus, AcademicSession, Class, Section, Subject, Term, Holiday
- **People** (13): Student, ParentProfile, StudentParent, Address, StudentPreviousSchool, StudentEmergencyContact, StudentMedicalInfo, StudentDocument, Teacher, Staff, StaffEmergencyContact, StaffExperience, StaffDocument
- **Enrollment & admissions & hiring** (6): Enrollment, StudentPromotion, Applicant, Application, HiringCandidate, HiringApplication
- **Academics** (11): Timetable, Attendance, AttendanceRiskFlag, DiaryEntry, DiaryAttachment, AssessmentCategory, Assessment, Mark, ReportCard, LeaveRequest, Complaint
- **Communication** (7): Circular, CircularRecipient, CircularAttachment, Conversation, Message, Notification, DraftSuggestion
- **Finance & files** (7): FeeStructure, FeeVoucher, FeeItem, FeePayment, FeePaymentAllocation, Receipt, File
<!-- GENERATED:END model-index -->
