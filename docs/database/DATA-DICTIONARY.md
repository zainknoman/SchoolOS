# Data Dictionary

> **Status:** CURRENT · **Generated** by `scripts/docs/generate.mjs` (BL-66) from `backend/prisma/schema.prisma`: **63 models, 19 enums** — do not edit by hand · **Owner:** Engineering Lead
> Columns: field · type (`?` nullable, `[]` list) · attributes as written in the schema (relations show `fields`, `references`, `onDelete`). Fields whose type is another model are relation fields (no column).

## Enums

- **Role**: SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, ACCOUNTS, PARENT
- **GuardianRelationship**: FATHER, MOTHER, GUARDIAN, OTHER
- **StaffGrant**: ADMISSIONS, COMPLAINTS, MESSAGES
- **AttendanceStatus**: PRESENT, ABSENT, LATE, LEAVE, HOLIDAY
- **EnrollmentStatus**: ACTIVE, TRANSFERRED, COMPLETED, WITHDRAWN
- **PromotionDecision**: PROMOTED, PROMOTED_WITH_CONDITIONS, RETAINED, TRANSFERRED, GRADUATED, WITHDRAWN
- **OrgStatus**: ACTIVE, INACTIVE
- **ConversationRecipientType**: CLASS_TEACHER, SCHOOL_ADMIN, ACCOUNTS, PRINCIPAL
- **NotificationChannel**: PUSH, WHATSAPP, SMS
- **Gender**: MALE, FEMALE, OTHER
- **BloodGroup**: A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG, UNKNOWN
- **TeachingRole**: CLASS_TEACHER, SUBJECT_TEACHER
- **StudentStatus**: ACTIVE, LEFT, GRADUATED, WITHDRAWN, TRANSFERRED
- **EmployeeType**: TEACHER, OFFICE_STAFF, JANITORIAL, HELPER, GUARD, OTHER
- **EmploymentStatus**: ACTIVE, ON_LEAVE, TERMINATED, RESIGNED
- **DocumentType**: BIRTH_CERTIFICATE, B_FORM, LEAVING_CERTIFICATE, TRANSFER_CERTIFICATE, PREVIOUS_REPORT_CARD, PHOTOGRAPH, MEDICAL_CERTIFICATE, CNIC, DEGREE_CERTIFICATE, CV, OTHER
- **DocumentVerificationStatus**: PENDING, VERIFIED, REJECTED
- **FeeStructureStatus**: DRAFT, ACTIVE, LOCKED, ARCHIVED
- **RetentionCategory**: STUDENT, GUARDIAN, STAFF, ATTENDANCE, ACADEMIC_RESULTS, FEES_FINANCIAL, COMPLAINTS, AUDIT_LOGS, AUTH_SECURITY_LOGS, UPLOADED_DOCUMENTS, BACKUPS

## Identity

### User

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| identifier | String | @unique |
| passwordHash | String |  |
| role | Role (enum) |  |
| isLocked | Boolean | @default(false) |
| isPrincipal | Boolean | @default(false) |
| schoolId | String? |  |
| school | School? (relation) | @relation(fields: [schoolId], references: [id], onDelete: Restrict) |
| campusId | String? |  |
| campus | Campus? (relation) | @relation(fields: [campusId], references: [id], onDelete: Restrict) |
| mustChangePassword | Boolean | @default(false) |
| tokenVersion | Int | @default(0) |
| grants | StaffGrant[] (enum) | @default([]) |
| lockedUntil | DateTime? |  |
| failedLoginCount | Int | @default(0) |
| notificationChannel | NotificationChannel (enum) | @default(PUSH) |
| digestEnabled | Boolean | @default(false) |
| studentsArchived | Student[] (relation) | @relation("StudentArchivedBy") |
| staffArchived | Staff[] (relation) | @relation("StaffArchivedBy") |
| retentionPoliciesUpdated | RetentionPolicy[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |
| parentProfile | ParentProfile? (relation) |  |
| teacher | Teacher? (relation) |  |
| refreshTokens | RefreshToken[] (relation) |  |
| auditLogs | AuditLog[] (relation) |  |
| deviceTokens | DeviceToken[] (relation) |  |
| circularsCreated | Circular[] (relation) | @relation("CircularAuthor") |
| circularRecipients | CircularRecipient[] (relation) |  |
| diaryEntriesAuthored | DiaryEntry[] (relation) |  |
| conversationsAsParent | Conversation[] (relation) | @relation("ConversationParent") |
| conversationsAsStaff | Conversation[] (relation) | @relation("ConversationStaff") |
| messagesSent | Message[] (relation) | @relation("MessageSender") |
| passwordResetTokens | PasswordResetToken[] (relation) |  |
| complaintsRaised | Complaint[] (relation) |  |
| reportCardsUploaded | ReportCard[] (relation) |  |
| draftSuggestions | DraftSuggestion[] (relation) |  |
| marksEntered | Mark[] (relation) |  |
| reviewedApplications | Application[] (relation) |  |
| verifiedStudentDocuments | StudentDocument[] (relation) |  |
| staff | Staff? (relation) |  |
| verifiedStaffDocuments | StaffDocument[] (relation) |  |
| reviewedHiringApplications | HiringApplication[] (relation) |  |
| promotionsDecided | StudentPromotion[] (relation) |  |
| attendanceMarked | Attendance[] (relation) | @relation("AttendanceMarkedByUser") |
| migrationReviewsResolved | MigrationReviewItem[] (relation) |  |
| promotionPoliciesUpdated | PromotionPolicy[] (relation) | @relation("PromotionPolicyUpdatedBy") |
| syllabiUpdated | Syllabus[] (relation) | @relation("SyllabusUpdatedBy") |

Block attributes: `@@index([role])` · `@@index([schoolId])` · `@@index([campusId])`

### RefreshToken

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| userId | String |  |
| user | User (relation) | @relation(fields: [userId], references: [id], onDelete: Cascade) |
| tokenHash | String | @unique |
| expiresAt | DateTime |  |
| revokedAt | DateTime? |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([userId])`

### PasswordResetToken

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| userId | String |  |
| user | User (relation) | @relation(fields: [userId], references: [id], onDelete: Cascade) |
| tokenHash | String | @unique |
| expiresAt | DateTime |  |
| usedAt | DateTime? |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([userId])`

### DeviceToken

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| userId | String |  |
| user | User (relation) | @relation(fields: [userId], references: [id], onDelete: Cascade) |
| token | String | @unique |
| platform | String |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([userId])`

### AuditLog

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| userId | String? |  |
| user | User? (relation) | @relation(fields: [userId], references: [id], onDelete: SetNull) |
| action | String |  |
| entity | String |  |
| entityId | String? |  |
| metadata | String? |  |
| ip | String? |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([userId])` · `@@index([entity, entityId])`

### MigrationReviewItem

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| migration | String |  |
| category | String |  |
| entity | String |  |
| entityId | String |  |
| detail | String |  |
| blocking | Boolean | @default(false) |
| status | String | @default("OPEN") |
| resolution | String? |  |
| resolvedById | String? |  |
| resolvedBy | User? (relation) | @relation(fields: [resolvedById], references: [id], onDelete: SetNull) |
| resolvedAt | DateTime? |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@unique([migration, category, entity, entityId])` · `@@index([status])`

### RetentionPolicy

| Field | Type | Attributes |
|---|---|---|
| category | RetentionCategory (enum) | @id |
| periodMonths | Int? |  |
| legalBasis | String? |  |
| updatedById | String? |  |
| updatedBy | User? (relation) | @relation(fields: [updatedById], references: [id], onDelete: SetNull) |
| updatedAt | DateTime | @default(now()) @updatedAt |

## Organization

### School

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| name | String |  |
| code | String? | @unique |
| registrationNumber | String? |  |
| website | String? |  |
| logoFileId | String? |  |
| logo | File? (relation) | @relation(fields: [logoFileId], references: [id], onDelete: SetNull) |
| principalName | String? |  |
| principalPhone | String? |  |
| principalEmail | String? |  |
| establishedDate | DateTime? |  |
| schoolType | String? |  |
| educationBoard | String? |  |
| status | OrgStatus (enum) | @default(ACTIVE) |
| timezone | String? | @default("Asia/Karachi") |
| currency | String? | @default("PKR") |
| alternatePhone | String? |  |
| addressId | String? |  |
| structuredAddress | Address? (relation) | @relation(fields: [addressId], references: [id], onDelete: SetNull) |
| address | String? |  |
| phone | String? |  |
| email | String? |  |
| campuses | Campus[] (relation) |  |
| users | User[] (relation) |  |
| circulars | Circular[] (relation) |  |
| holidays | Holiday[] (relation) |  |
| academicSessions | AcademicSession[] (relation) |  |
| subjects | Subject[] (relation) |  |
| feeStructures | FeeStructure[] (relation) |  |
| promotionPolicy | PromotionPolicy? (relation) |  |
| teachingAssignments | TeachingAssignment[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

### Campus

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| schoolId | String |  |
| school | School (relation) | @relation(fields: [schoolId], references: [id], onDelete: Cascade) |
| name | String |  |
| code | String? |  |
| campusType | String? |  |
| logoFileId | String? |  |
| logo | File? (relation) | @relation(fields: [logoFileId], references: [id], onDelete: SetNull) |
| principalName | String? |  |
| principalPhone | String? |  |
| principalEmail | String? |  |
| openingDate | DateTime? |  |
| capacity | Int? |  |
| latitude | Float? |  |
| longitude | Float? |  |
| status | OrgStatus (enum) | @default(ACTIVE) |
| departments | String[] | @default([]) |
| alternatePhone | String? |  |
| addressId | String? |  |
| structuredAddress | Address? (relation) | @relation(fields: [addressId], references: [id], onDelete: SetNull) |
| address | String? |  |
| phone | String? |  |
| email | String? |  |
| classes | Class[] (relation) |  |
| enrollments | Enrollment[] (relation) |  |
| holidays | Holiday[] (relation) |  |
| teachers | Teacher[] (relation) |  |
| staff | Staff[] (relation) |  |
| users | User[] (relation) |  |
| hiringApplications | HiringApplication[] (relation) |  |
| teachingAssignments | TeachingAssignment[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([schoolId, code])` · `@@index([schoolId])`

### AcademicSession

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| schoolId | String? |  |
| school | School? (relation) | @relation(fields: [schoolId], references: [id], onDelete: Cascade) |
| legacySessionId | String? |  |
| label | String |  |
| startDate | DateTime |  |
| endDate | DateTime |  |
| isActive | Boolean | @default(false) |
| classes | Class[] (relation) |  |
| feeVouchers | FeeVoucher[] (relation) |  |
| enrollments | Enrollment[] (relation) |  |
| reportCards | ReportCard[] (relation) |  |
| terms | Term[] (relation) |  |
| applications | Application[] (relation) |  |
| teachingAssignments | TeachingAssignment[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([schoolId])`

### Class

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| campusId | String |  |
| campus | Campus (relation) | @relation(fields: [campusId], references: [id], onDelete: Cascade) |
| academicSessionId | String |  |
| academicSession | AcademicSession (relation) | @relation(fields: [academicSessionId], references: [id], onDelete: Cascade) |
| name | String |  |
| sections | Section[] (relation) |  |
| assessmentCategories | AssessmentCategory[] (relation) |  |
| applications | Application[] (relation) |  |
| teachingAssignments | TeachingAssignment[] (relation) |  |
| syllabi | Syllabus[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([campusId])` · `@@index([academicSessionId])`

### Section

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| classId | String |  |
| class | Class (relation) | @relation(fields: [classId], references: [id], onDelete: Cascade) |
| name | String |  |
| enrollments | Enrollment[] (relation) |  |
| timetables | Timetable[] (relation) |  |
| classTeacherId | String? |  |
| classTeacher | Teacher? (relation) | @relation(fields: [classTeacherId], references: [id], onDelete: SetNull) |
| diaryEntries | DiaryEntry[] (relation) |  |
| circulars | Circular[] (relation) |  |
| teachingAssignments | TeachingAssignment[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([classId])`

### Subject

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| schoolId | String? |  |
| school | School? (relation) | @relation(fields: [schoolId], references: [id], onDelete: Cascade) |
| isActive | Boolean | @default(true) |
| legacySubjectId | String? |  |
| name | String |  |
| timetables | Timetable[] (relation) |  |
| diaryEntries | DiaryEntry[] (relation) |  |
| assessments | Assessment[] (relation) |  |
| teachingAssignments | TeachingAssignment[] (relation) |  |
| syllabi | Syllabus[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([schoolId, name])` · `@@index([schoolId])`

### Term

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| academicSessionId | String |  |
| academicSession | AcademicSession (relation) | @relation(fields: [academicSessionId], references: [id], onDelete: Cascade) |
| label | String |  |
| order | Int |  |
| startDate | DateTime |  |
| endDate | DateTime |  |
| assessmentCategories | AssessmentCategory[] (relation) |  |
| syllabusUnits | SyllabusUnit[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([academicSessionId, label])` · `@@index([academicSessionId])`

### Syllabus

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| classId | String |  |
| class | Class (relation) | @relation(fields: [classId], references: [id], onDelete: Cascade) |
| subjectId | String |  |
| subject | Subject (relation) | @relation(fields: [subjectId], references: [id], onDelete: NoAction) |
| overview | String? |  |
| units | SyllabusUnit[] (relation) |  |
| updatedById | String? |  |
| updatedBy | User? (relation) | @relation("SyllabusUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([classId, subjectId])` · `@@index([subjectId])`

### SyllabusUnit

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| syllabusId | String |  |
| syllabus | Syllabus (relation) | @relation(fields: [syllabusId], references: [id], onDelete: Cascade) |
| order | Int |  |
| title | String |  |
| topics | String? |  |
| termId | String? |  |
| term | Term? (relation) | @relation(fields: [termId], references: [id], onDelete: SetNull) |
| plannedStart | DateTime? |  |
| plannedEnd | DateTime? |  |

Block attributes: `@@unique([syllabusId, order])` · `@@index([termId])`

### Holiday

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| title | String |  |
| startDate | DateTime |  |
| endDate | DateTime |  |
| schoolId | String? |  |
| school | School? (relation) | @relation(fields: [schoolId], references: [id], onDelete: Cascade) |
| campusId | String? |  |
| campus | Campus? (relation) | @relation(fields: [campusId], references: [id], onDelete: Cascade) |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([campusId])` · `@@index([schoolId])` · `@@index([startDate, endDate])`

## People

### Student

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| grNumber | String | @unique |
| name | String |  |
| firstName | String? |  |
| middleName | String? |  |
| lastName | String? |  |
| preferredName | String? |  |
| gender | Gender? (enum) |  |
| dateOfBirth | DateTime? |  |
| placeOfBirth | String? |  |
| nationality | String? | @default("Pakistani") |
| religion | String? |  |
| bFormNumber | String? | @unique |
| profilePhotoFileId | String? |  |
| profilePhoto | File? (relation) | @relation(fields: [profilePhotoFileId], references: [id], onDelete: SetNull) |
| status | StudentStatus (enum) | @default(ACTIVE) |
| admissionDate | DateTime? |  |
| leavingDate | DateTime? |  |
| leavingReason | String? |  |
| studentMobile | String? |  |
| studentEmail | String? |  |
| currentAddressId | String? |  |
| currentAddress | Address? (relation) | @relation("StudentCurrentAddress", fields: [currentAddressId], references: [id], onDelete: SetNull) |
| permanentAddressId | String? |  |
| permanentAddress | Address? (relation) | @relation("StudentPermanentAddress", fields: [permanentAddressId], references: [id], onDelete: SetNull) |
| previousSchool | StudentPreviousSchool? (relation) |  |
| emergencyContacts | StudentEmergencyContact[] (relation) |  |
| medicalInfo | StudentMedicalInfo? (relation) |  |
| documents | StudentDocument[] (relation) |  |
| parents | StudentParent[] (relation) |  |
| enrollments | Enrollment[] (relation) |  |
| attendance | Attendance[] (relation) |  |
| feeVouchers | FeeVoucher[] (relation) |  |
| leaveRequests | LeaveRequest[] (relation) |  |
| conversations | Conversation[] (relation) |  |
| complaints | Complaint[] (relation) |  |
| reportCards | ReportCard[] (relation) |  |
| attendanceRiskFlag | AttendanceRiskFlag? (relation) |  |
| marks | Mark[] (relation) |  |
| application | Application? (relation) |  |
| promotions | StudentPromotion[] (relation) |  |
| archivedAt | DateTime? |  |
| archivedById | String? |  |
| archivedBy | User? (relation) | @relation("StudentArchivedBy", fields: [archivedById], references: [id], onDelete: SetNull) |
| archiveReason | String? |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([status])` · `@@index([archivedAt])`

### ParentProfile

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| userId | String | @unique |
| user | User (relation) | @relation(fields: [userId], references: [id], onDelete: Cascade) |
| name | String |  |
| phone | String? |  |
| cnic | String? | @unique |
| gender | Gender? (enum) |  |
| dateOfBirth | DateTime? |  |
| alternatePhone | String? |  |
| whatsappNumber | String? |  |
| email | String? |  |
| occupation | String? |  |
| employerName | String? |  |
| designation | String? |  |
| currentAddressId | String? |  |
| currentAddress | Address? (relation) | @relation("ParentCurrentAddress", fields: [currentAddressId], references: [id], onDelete: SetNull) |
| permanentAddressId | String? |  |
| permanentAddress | Address? (relation) | @relation("ParentPermanentAddress", fields: [permanentAddressId], references: [id], onDelete: SetNull) |
| children | StudentParent[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

### StudentParent

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Cascade) |
| parentProfileId | String |  |
| parentProfile | ParentProfile (relation) | @relation(fields: [parentProfileId], references: [id], onDelete: Cascade) |
| relationship | String | @default("guardian") |
| isPrimary | Boolean | @default(false) |
| isEmergencyContact | Boolean | @default(false) |
| relationshipType | GuardianRelationship (enum) | @default(OTHER) |
| relationshipNote | String? |  |
| primarySlot | Int? |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@unique([studentId, parentProfileId])` · `@@unique([studentId, primarySlot])` · `@@index([parentProfileId])` · `@@index([studentId])`

### Address

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| line1 | String |  |
| line2 | String? |  |
| area | String? |  |
| city | String? |  |
| district | String? |  |
| province | String? |  |
| postalCode | String? |  |
| country | String | @default("Pakistan") |
| studentsCurrent | Student[] (relation) | @relation("StudentCurrentAddress") |
| studentsPermanent | Student[] (relation) | @relation("StudentPermanentAddress") |
| previousSchools | StudentPreviousSchool[] (relation) |  |
| emergencyContacts | StudentEmergencyContact[] (relation) |  |
| staffCurrent | Staff[] (relation) | @relation("StaffCurrentAddress") |
| staffPermanent | Staff[] (relation) | @relation("StaffPermanentAddress") |
| staffEmergencyContacts | StaffEmergencyContact[] (relation) |  |
| parentsCurrent | ParentProfile[] (relation) | @relation("ParentCurrentAddress") |
| parentsPermanent | ParentProfile[] (relation) | @relation("ParentPermanentAddress") |
| schools | School[] (relation) |  |
| campuses | Campus[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

### StudentPreviousSchool

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String | @unique |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Cascade) |
| schoolName | String |  |
| addressId | String? |  |
| address | Address? (relation) | @relation(fields: [addressId], references: [id], onDelete: SetNull) |
| contactNumber | String? |  |
| email | String? |  |
| lastClassAttended | String? |  |
| admissionDate | DateTime? |  |
| leavingDate | DateTime? |  |
| leavingCertificateNumber | String? |  |
| leavingCertificateDate | DateTime? |  |
| reasonForLeaving | String? |  |
| academicRemarks | String? |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

### StudentEmergencyContact

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Cascade) |
| name | String |  |
| relationship | String |  |
| phone | String |  |
| alternatePhone | String? |  |
| email | String? |  |
| addressId | String? |  |
| address | Address? (relation) | @relation(fields: [addressId], references: [id], onDelete: SetNull) |
| priority | Int | @default(1) |
| isPrimary | Boolean | @default(false) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([studentId])`

### StudentMedicalInfo

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String | @unique |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Cascade) |
| bloodGroup | BloodGroup? (enum) |  |
| allergies | String? |  |
| medicalConditions | String? |  |
| specialEducationalNeeds | String? |  |
| medicationNotes | String? |  |
| emergencyMedicalNotes | String? |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

### StudentDocument

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Cascade) |
| documentType | DocumentType (enum) |  |
| fileId | String |  |
| file | File (relation) | @relation(fields: [fileId], references: [id], onDelete: Restrict) |
| expiryDate | DateTime? |  |
| verificationStatus | DocumentVerificationStatus (enum) | @default(PENDING) |
| verifiedById | String? |  |
| verifiedBy | User? (relation) | @relation(fields: [verifiedById], references: [id], onDelete: SetNull) |
| verifiedAt | DateTime? |  |
| notes | String? |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([studentId])`

### Teacher

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| userId | String | @unique |
| user | User (relation) | @relation(fields: [userId], references: [id], onDelete: Cascade) |
| name | String |  |
| campusId | String |  |
| campus | Campus (relation) | @relation(fields: [campusId], references: [id], onDelete: Restrict) |
| timetables | Timetable[] (relation) |  |
| classTeacherOfSections | Section[] (relation) |  |
| attendanceMarks | Attendance[] (relation) | @relation("AttendanceMarkedBy") |
| staff | Staff? (relation) |  |
| teachingAssignments | TeachingAssignment[] (relation) |  |
| archivedAt | DateTime? |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([campusId])` · `@@index([archivedAt])`

### TeachingAssignment

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| role | TeachingRole (enum) |  |
| teacherId | String? |  |
| teacher | Teacher? (relation) | @relation(fields: [teacherId], references: [id], onDelete: SetNull) |
| teacherName | String |  |
| schoolId | String? |  |
| school | School? (relation) | @relation(fields: [schoolId], references: [id], onDelete: SetNull) |
| campusId | String? |  |
| campus | Campus? (relation) | @relation(fields: [campusId], references: [id], onDelete: SetNull) |
| academicSessionId | String? |  |
| academicSession | AcademicSession? (relation) | @relation(fields: [academicSessionId], references: [id], onDelete: SetNull) |
| sessionLabel | String |  |
| classId | String? |  |
| class | Class? (relation) | @relation(fields: [classId], references: [id], onDelete: SetNull) |
| className | String |  |
| sectionId | String? |  |
| section | Section? (relation) | @relation(fields: [sectionId], references: [id], onDelete: SetNull) |
| sectionName | String |  |
| subjectId | String? |  |
| subject | Subject? (relation) | @relation(fields: [subjectId], references: [id], onDelete: SetNull) |
| subjectName | String? |  |
| startDate | DateTime |  |
| startDateUnknown | Boolean | @default(false) |
| endDate | DateTime? |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([teacherId])` · `@@index([sectionId])` · `@@index([academicSessionId])` · `@@index([schoolId])`

### Staff

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| userId | String? | @unique |
| user | User? (relation) | @relation(fields: [userId], references: [id], onDelete: SetNull) |
| name | String |  |
| firstName | String? |  |
| middleName | String? |  |
| lastName | String? |  |
| employeeType | EmployeeType (enum) |  |
| campusId | String |  |
| campus | Campus (relation) | @relation(fields: [campusId], references: [id], onDelete: Restrict) |
| gender | Gender? (enum) |  |
| dateOfBirth | DateTime? |  |
| cnic | String? | @unique |
| mobile | String? |  |
| email | String? |  |
| profilePhotoFileId | String? |  |
| profilePhoto | File? (relation) | @relation(fields: [profilePhotoFileId], references: [id], onDelete: SetNull) |
| currentAddressId | String? |  |
| currentAddress | Address? (relation) | @relation("StaffCurrentAddress", fields: [currentAddressId], references: [id], onDelete: SetNull) |
| permanentAddressId | String? |  |
| permanentAddress | Address? (relation) | @relation("StaffPermanentAddress", fields: [permanentAddressId], references: [id], onDelete: SetNull) |
| joiningDate | DateTime? |  |
| employmentStatus | EmploymentStatus (enum) | @default(ACTIVE) |
| leavingDate | DateTime? |  |
| leavingReason | String? |  |
| teacherId | String? | @unique |
| teacher | Teacher? (relation) | @relation(fields: [teacherId], references: [id], onDelete: SetNull) |
| emergencyContacts | StaffEmergencyContact[] (relation) |  |
| experience | StaffExperience[] (relation) |  |
| documents | StaffDocument[] (relation) |  |
| hiringApplication | HiringApplication? (relation) |  |
| archivedAt | DateTime? |  |
| archivedById | String? |  |
| archivedBy | User? (relation) | @relation("StaffArchivedBy", fields: [archivedById], references: [id], onDelete: SetNull) |
| archiveReason | String? |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([campusId])` · `@@index([employeeType])` · `@@index([archivedAt])`

### StaffEmergencyContact

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| staffId | String |  |
| staff | Staff (relation) | @relation(fields: [staffId], references: [id], onDelete: Cascade) |
| name | String |  |
| relationship | String |  |
| phone | String |  |
| alternatePhone | String? |  |
| email | String? |  |
| addressId | String? |  |
| address | Address? (relation) | @relation(fields: [addressId], references: [id], onDelete: SetNull) |
| priority | Int | @default(1) |
| isPrimary | Boolean | @default(false) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([staffId])`

### StaffExperience

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| staffId | String |  |
| staff | Staff (relation) | @relation(fields: [staffId], references: [id], onDelete: Cascade) |
| organization | String |  |
| role | String |  |
| fromDate | DateTime? |  |
| toDate | DateTime? |  |
| description | String? |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([staffId])`

### StaffDocument

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| staffId | String |  |
| staff | Staff (relation) | @relation(fields: [staffId], references: [id], onDelete: Cascade) |
| documentType | DocumentType (enum) |  |
| fileId | String |  |
| file | File (relation) | @relation(fields: [fileId], references: [id], onDelete: Restrict) |
| expiryDate | DateTime? |  |
| verificationStatus | DocumentVerificationStatus (enum) | @default(PENDING) |
| verifiedById | String? |  |
| verifiedBy | User? (relation) | @relation(fields: [verifiedById], references: [id], onDelete: SetNull) |
| verifiedAt | DateTime? |  |
| notes | String? |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([staffId])`

## Enrollment & admissions & hiring

### Enrollment

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Cascade) |
| campusId | String |  |
| campus | Campus (relation) | @relation(fields: [campusId], references: [id], onDelete: Restrict) |
| sectionId | String |  |
| section | Section (relation) | @relation(fields: [sectionId], references: [id], onDelete: Restrict) |
| academicSessionId | String |  |
| academicSession | AcademicSession (relation) | @relation(fields: [academicSessionId], references: [id], onDelete: Restrict) |
| startDate | DateTime |  |
| endDate | DateTime? |  |
| status | EnrollmentStatus (enum) | @default(ACTIVE) |
| rollNumber | String? |  |
| promotionDate | DateTime? |  |
| remarks | String? |  |
| promotedFrom | StudentPromotion? (relation) | @relation("PromotionFromEnrollment") |
| promotedTo | StudentPromotion? (relation) | @relation("PromotionToEnrollment") |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([studentId], map: "Enrollment_one_active_per_student", where: raw("status = 'ACTIVE'"))` · `@@index([studentId])` · `@@index([sectionId])` · `@@index([campusId])`

### StudentPromotion

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Cascade) |
| fromEnrollmentId | String | @unique |
| fromEnrollment | Enrollment (relation) | @relation("PromotionFromEnrollment", fields: [fromEnrollmentId], references: [id], onDelete: Restrict) |
| toEnrollmentId | String? | @unique |
| toEnrollment | Enrollment? (relation) | @relation("PromotionToEnrollment", fields: [toEnrollmentId], references: [id], onDelete: Restrict) |
| decision | PromotionDecision (enum) |  |
| remarks | String? |  |
| conditions | String? |  |
| indicators | Json? |  |
| decidedById | String |  |
| decidedBy | User (relation) | @relation(fields: [decidedById], references: [id]) |
| decidedAt | DateTime | @default(now()) |

Block attributes: `@@index([studentId])`

### PromotionPolicy

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| schoolId | String | @unique |
| school | School (relation) | @relation(fields: [schoolId], references: [id], onDelete: Cascade) |
| minAttendancePercent | Int | @default(75) |
| minResultPercent | Int | @default(40) |
| blockOnAttendance | Boolean | @default(false) |
| blockOnResults | Boolean | @default(false) |
| blockOnFees | Boolean | @default(false) |
| updatedById | String? |  |
| updatedBy | User? (relation) | @relation("PromotionPolicyUpdatedBy", fields: [updatedById], references: [id], onDelete: SetNull) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

### Applicant

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| name | String |  |
| dateOfBirth | DateTime |  |
| guardianName | String |  |
| guardianPhone | String |  |
| applications | Application[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([guardianPhone])`

### Application

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| applicantId | String |  |
| applicant | Applicant (relation) | @relation(fields: [applicantId], references: [id], onDelete: Restrict) |
| desiredClassId | String |  |
| desiredClass | Class (relation) | @relation(fields: [desiredClassId], references: [id], onDelete: Restrict) |
| academicSessionId | String |  |
| academicSession | AcademicSession (relation) | @relation(fields: [academicSessionId], references: [id], onDelete: Restrict) |
| status | String | @default("SUBMITTED") |
| decisionNotes | String? |  |
| reviewedById | String? |  |
| reviewedBy | User? (relation) | @relation(fields: [reviewedById], references: [id]) |
| createdStudentId | String? | @unique |
| createdStudent | Student? (relation) | @relation(fields: [createdStudentId], references: [id]) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([applicantId])` · `@@index([academicSessionId, status])`

### HiringCandidate

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| name | String |  |
| dateOfBirth | DateTime? |  |
| cnic | String? |  |
| contactPhone | String |  |
| contactEmail | String? |  |
| resumeFileId | String? |  |
| resumeFile | File? (relation) | @relation(fields: [resumeFileId], references: [id], onDelete: SetNull) |
| applications | HiringApplication[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([contactPhone])`

### HiringApplication

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| candidateId | String |  |
| candidate | HiringCandidate (relation) | @relation(fields: [candidateId], references: [id], onDelete: Restrict) |
| employeeType | EmployeeType (enum) |  |
| campusId | String |  |
| campus | Campus (relation) | @relation(fields: [campusId], references: [id], onDelete: Restrict) |
| status | String | @default("SUBMITTED") |
| decisionNotes | String? |  |
| reviewedById | String? |  |
| reviewedBy | User? (relation) | @relation(fields: [reviewedById], references: [id]) |
| createdStaffId | String? | @unique |
| createdStaff | Staff? (relation) | @relation(fields: [createdStaffId], references: [id]) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([candidateId])` · `@@index([campusId, status])`

## Academics

### Timetable

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| sectionId | String |  |
| section | Section (relation) | @relation(fields: [sectionId], references: [id], onDelete: Restrict) |
| subjectId | String |  |
| subject | Subject (relation) | @relation(fields: [subjectId], references: [id], onDelete: Cascade) |
| teacherId | String? |  |
| teacher | Teacher? (relation) | @relation(fields: [teacherId], references: [id], onDelete: SetNull) |
| dayOfWeek | Int |  |
| period | Int |  |
| startTime | String |  |
| endTime | String |  |
| room | String? |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([sectionId])`

### Attendance

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Restrict) |
| date | DateTime |  |
| status | AttendanceStatus (enum) |  |
| markedById | String? |  |
| markedBy | Teacher? (relation) | @relation("AttendanceMarkedBy", fields: [markedById], references: [id], onDelete: Restrict) |
| markedByUserId | String? |  |
| markedByUser | User? (relation) | @relation("AttendanceMarkedByUser", fields: [markedByUserId], references: [id], onDelete: SetNull) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([studentId, date])` · `@@index([studentId])` · `@@index([markedByUserId])`

### AttendanceRiskFlag

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String | @unique |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Cascade) |
| absenceRate | Float |  |
| flagged | Boolean |  |
| windowStart | DateTime |  |
| windowEnd | DateTime |  |
| updatedAt | DateTime | @updatedAt |

### DiaryEntry

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| sectionId | String |  |
| section | Section (relation) | @relation(fields: [sectionId], references: [id], onDelete: Restrict) |
| subjectId | String |  |
| subject | Subject (relation) | @relation(fields: [subjectId], references: [id], onDelete: Cascade) |
| authorId | String |  |
| author | User (relation) | @relation(fields: [authorId], references: [id]) |
| date | DateTime |  |
| text | String |  |
| dueDate | DateTime? |  |
| attachments | DiaryAttachment[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([sectionId, subjectId, date])` · `@@index([sectionId])`

### DiaryAttachment

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| diaryEntryId | String |  |
| diaryEntry | DiaryEntry (relation) | @relation(fields: [diaryEntryId], references: [id], onDelete: Cascade) |
| fileId | String |  |
| file | File (relation) | @relation(fields: [fileId], references: [id]) |
| createdAt | DateTime | @default(now()) |

### AssessmentCategory

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| classId | String |  |
| class | Class (relation) | @relation(fields: [classId], references: [id], onDelete: Cascade) |
| termId | String |  |
| term | Term (relation) | @relation(fields: [termId], references: [id], onDelete: Cascade) |
| name | String |  |
| weightPercent | Float |  |
| assessments | Assessment[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([classId, termId, name])` · `@@index([classId, termId])`

### Assessment

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| assessmentCategoryId | String |  |
| assessmentCategory | AssessmentCategory (relation) | @relation(fields: [assessmentCategoryId], references: [id], onDelete: Cascade) |
| subjectId | String |  |
| subject | Subject (relation) | @relation(fields: [subjectId], references: [id], onDelete: Restrict) |
| label | String |  |
| maxMarks | Float |  |
| marks | Mark[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([assessmentCategoryId])` · `@@index([subjectId])`

### Mark

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| assessmentId | String |  |
| assessment | Assessment (relation) | @relation(fields: [assessmentId], references: [id], onDelete: Cascade) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Cascade) |
| obtainedMarks | Float |  |
| enteredById | String |  |
| enteredBy | User (relation) | @relation(fields: [enteredById], references: [id]) |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([assessmentId, studentId])` · `@@index([studentId])`

### ReportCard

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Restrict) |
| academicSessionId | String |  |
| academicSession | AcademicSession (relation) | @relation(fields: [academicSessionId], references: [id], onDelete: Restrict) |
| fileId | String | @unique |
| file | File (relation) | @relation(fields: [fileId], references: [id], onDelete: Restrict) |
| uploadedById | String |  |
| uploadedBy | User (relation) | @relation(fields: [uploadedById], references: [id]) |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@unique([studentId, academicSessionId])`

### LeaveRequest

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Restrict) |
| startDate | DateTime |  |
| endDate | DateTime |  |
| reason | String |  |
| status | String | @default("pending") |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

### Complaint

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Restrict) |
| raisedById | String |  |
| raisedBy | User (relation) | @relation(fields: [raisedById], references: [id]) |
| subject | String |  |
| description | String |  |
| status | String | @default("open") |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([studentId])`

## Communication

### Circular

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| title | String |  |
| description | String |  |
| scope | String |  |
| schoolId | String? |  |
| school | School? (relation) | @relation(fields: [schoolId], references: [id], onDelete: Cascade) |
| sectionId | String? |  |
| section | Section? (relation) | @relation(fields: [sectionId], references: [id], onDelete: Restrict) |
| priority | String | @default("normal") |
| authorId | String |  |
| author | User (relation) | @relation("CircularAuthor", fields: [authorId], references: [id]) |
| publishedAt | DateTime | @default(now()) |
| expiresAt | DateTime? |  |
| attachments | CircularAttachment[] (relation) |  |
| recipients | CircularRecipient[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@index([sectionId])` · `@@index([schoolId])`

### CircularRecipient

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| circularId | String |  |
| circular | Circular (relation) | @relation(fields: [circularId], references: [id], onDelete: Cascade) |
| userId | String |  |
| user | User (relation) | @relation(fields: [userId], references: [id], onDelete: Cascade) |
| readAt | DateTime? |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@unique([circularId, userId])` · `@@index([userId])`

### CircularAttachment

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| circularId | String |  |
| circular | Circular (relation) | @relation(fields: [circularId], references: [id], onDelete: Cascade) |
| fileId | String |  |
| file | File (relation) | @relation(fields: [fileId], references: [id]) |
| createdAt | DateTime | @default(now()) |

### Conversation

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| parentUserId | String |  |
| parentUser | User (relation) | @relation("ConversationParent", fields: [parentUserId], references: [id], onDelete: Cascade) |
| staffUserId | String |  |
| staffUser | User (relation) | @relation("ConversationStaff", fields: [staffUserId], references: [id], onDelete: Cascade) |
| recipientType | ConversationRecipientType (enum) |  |
| studentId | String? |  |
| student | Student? (relation) | @relation(fields: [studentId], references: [id], onDelete: SetNull) |
| messages | Message[] (relation) |  |
| parentReadAt | DateTime? |  |
| staffReadAt | DateTime? |  |
| lastMessageAt | DateTime | @default(now()) |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([parentUserId])` · `@@index([staffUserId])`

### Message

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| conversationId | String |  |
| conversation | Conversation (relation) | @relation(fields: [conversationId], references: [id], onDelete: Cascade) |
| senderId | String |  |
| sender | User (relation) | @relation("MessageSender", fields: [senderId], references: [id]) |
| body | String |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([conversationId])`

### Notification

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| userId | String |  |
| type | String |  |
| title | String |  |
| body | String |  |
| entityRef | String? |  |
| readAt | DateTime? |  |
| dispatchedAt | DateTime? |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([userId])`

### DraftSuggestion

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| userId | String? |  |
| user | User? (relation) | @relation(fields: [userId], references: [id], onDelete: SetNull) |
| targetType | String |  |
| prompt | String |  |
| suggestion | String |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([userId])`

## Finance & files

### FeeStructure

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| schoolId | String? |  |
| school | School? (relation) | @relation(fields: [schoolId], references: [id], onDelete: Cascade) |
| status | FeeStructureStatus (enum) | @default(ACTIVE) |
| legacyFeeStructureId | String? |  |
| name | String |  |
| amount | Int |  |
| items | FeeItem[] (relation) |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@index([schoolId])`

### FeeVoucher

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| studentId | String |  |
| student | Student (relation) | @relation(fields: [studentId], references: [id], onDelete: Restrict) |
| academicSessionId | String |  |
| academicSession | AcademicSession (relation) | @relation(fields: [academicSessionId], references: [id]) |
| month | String |  |
| issueDate | DateTime |  |
| dueDate | DateTime |  |
| items | FeeItem[] (relation) |  |
| allocations | FeePaymentAllocation[] (relation) |  |
| createdAt | DateTime | @default(now()) |
| updatedAt | DateTime | @updatedAt |

Block attributes: `@@unique([studentId, academicSessionId, month])` · `@@index([studentId])`

### FeeItem

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| feeVoucherId | String |  |
| feeVoucher | FeeVoucher (relation) | @relation(fields: [feeVoucherId], references: [id], onDelete: Cascade) |
| feeStructureId | String? |  |
| feeStructure | FeeStructure? (relation) | @relation(fields: [feeStructureId], references: [id], onDelete: Restrict) |
| label | String |  |
| amount | Int |  |

Block attributes: `@@index([feeStructureId])`

### FeePayment

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| amount | Int |  |
| method | String |  |
| status | String |  |
| reference | String? | @unique |
| allocations | FeePaymentAllocation[] (relation) |  |
| receipt | Receipt? (relation) |  |
| createdAt | DateTime | @default(now()) |

### FeePaymentAllocation

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| feePaymentId | String |  |
| feePayment | FeePayment (relation) | @relation(fields: [feePaymentId], references: [id], onDelete: Restrict) |
| feeVoucherId | String |  |
| feeVoucher | FeeVoucher (relation) | @relation(fields: [feeVoucherId], references: [id], onDelete: Restrict) |
| amount | Int |  |
| createdAt | DateTime | @default(now()) |

Block attributes: `@@unique([feePaymentId, feeVoucherId])` · `@@index([feeVoucherId])`

### Receipt

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| feePaymentId | String | @unique |
| feePayment | FeePayment (relation) | @relation(fields: [feePaymentId], references: [id], onDelete: Restrict) |
| receiptNumber | String | @unique |
| createdAt | DateTime | @default(now()) |

### File

| Field | Type | Attributes |
|---|---|---|
| id | String | @id @default(uuid()) |
| storageKey | String | @unique |
| originalName | String |  |
| mimeType | String |  |
| sizeBytes | Int |  |
| diaryAttachments | DiaryAttachment[] (relation) |  |
| circularAttachments | CircularAttachment[] (relation) |  |
| reportCard | ReportCard? (relation) |  |
| studentProfilePhotos | Student[] (relation) |  |
| studentDocuments | StudentDocument[] (relation) |  |
| staffProfilePhotos | Staff[] (relation) |  |
| staffDocuments | StaffDocument[] (relation) |  |
| hiringCandidateResumes | HiringCandidate[] (relation) |  |
| schoolLogos | School[] (relation) |  |
| campusLogos | Campus[] (relation) |  |
| createdAt | DateTime | @default(now()) |
