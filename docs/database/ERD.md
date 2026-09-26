# Entity Relationships

> **Status:** CURRENT · **Generated** by `scripts/docs/generate.mjs` (BL-66) from `schema.prisma` (edges: child → parent for every owning-side `@relation`) — do not edit by hand · **Owner:** Engineering Lead
> Edge label = `onDelete` (`default` = Prisma default); `optional` = nullable foreign key. Cross-domain parents appear as plain nodes.

## Identity

```mermaid
flowchart LR
  User -->|Restrict, optional| School
  User -->|Restrict, optional| Campus
  RefreshToken -->|Cascade| User
  AuditLog -->|SetNull, optional| User
  PasswordResetToken -->|Cascade| User
  DeviceToken -->|Cascade| User
  MigrationReviewItem -->|SetNull, optional| User
  RetentionPolicy -->|SetNull, optional| User
```

## Organization

```mermaid
flowchart LR
  School -->|SetNull, optional| File
  School -->|SetNull, optional| Address
  Campus -->|Cascade| School
  Campus -->|SetNull, optional| File
  Campus -->|SetNull, optional| Address
  AcademicSession -->|Cascade, optional| School
  Class -->|Cascade| Campus
  Class -->|Cascade| AcademicSession
  Section -->|Cascade| Class
  Section -->|SetNull, optional| Teacher
  Subject -->|Cascade, optional| School
  Holiday -->|Cascade, optional| School
  Holiday -->|Cascade, optional| Campus
  Syllabus -->|Cascade| Class
  Syllabus -->|NoAction| Subject
  Syllabus -->|SetNull, optional| User
  SyllabusUnit -->|Cascade| Syllabus
  SyllabusUnit -->|SetNull, optional| Term
  GradingScale -->|Cascade| School
  GradingScale -->|SetNull, optional| User
  GradeBand -->|Cascade| GradingScale
  ResultPublication -->|Cascade| Class
  ResultPublication -->|Cascade| Term
  ResultPublication -->|SetNull, optional| User
  Term -->|Cascade| AcademicSession
```

## People

```mermaid
flowchart LR
  Teacher -->|Cascade| User
  Teacher -->|Restrict| Campus
  Staff -->|SetNull, optional| User
  Staff -->|Restrict| Campus
  Staff -->|SetNull, optional| File
  Staff -->|SetNull, optional| Address
  Staff -->|SetNull, optional| Address
  Staff -->|SetNull, optional| Teacher
  Staff -->|SetNull, optional| User
  StaffEmergencyContact -->|Cascade| Staff
  StaffEmergencyContact -->|SetNull, optional| Address
  StaffExperience -->|Cascade| Staff
  StaffDocument -->|Cascade| Staff
  StaffDocument -->|Restrict| File
  StaffDocument -->|SetNull, optional| User
  Student -->|SetNull, optional| File
  Student -->|SetNull, optional| Address
  Student -->|SetNull, optional| Address
  Student -->|SetNull, optional| User
  ParentProfile -->|Cascade| User
  ParentProfile -->|SetNull, optional| Address
  ParentProfile -->|SetNull, optional| Address
  StudentParent -->|Cascade| Student
  StudentParent -->|Cascade| ParentProfile
  StudentPreviousSchool -->|Cascade| Student
  StudentPreviousSchool -->|SetNull, optional| Address
  StudentEmergencyContact -->|Cascade| Student
  StudentEmergencyContact -->|SetNull, optional| Address
  StudentMedicalInfo -->|Cascade| Student
  StudentDocument -->|Cascade| Student
  StudentDocument -->|Restrict| File
  StudentDocument -->|SetNull, optional| User
  TeachingAssignment -->|SetNull, optional| Teacher
  TeachingAssignment -->|SetNull, optional| School
  TeachingAssignment -->|SetNull, optional| Campus
  TeachingAssignment -->|SetNull, optional| AcademicSession
  TeachingAssignment -->|SetNull, optional| Class
  TeachingAssignment -->|SetNull, optional| Section
  TeachingAssignment -->|SetNull, optional| Subject
```

## Enrollment & admissions & hiring

```mermaid
flowchart LR
  HiringCandidate -->|SetNull, optional| File
  HiringApplication -->|Restrict| HiringCandidate
  HiringApplication -->|Restrict| Campus
  HiringApplication -->|default, optional| User
  HiringApplication -->|default, optional| Staff
  Enrollment -->|Cascade| Student
  Enrollment -->|Restrict| Campus
  Enrollment -->|Restrict| Section
  Enrollment -->|Restrict| AcademicSession
  PromotionPolicy -->|Cascade| School
  PromotionPolicy -->|SetNull, optional| User
  StudentPromotion -->|Cascade| Student
  StudentPromotion -->|Restrict| Enrollment
  StudentPromotion -->|Restrict, optional| Enrollment
  StudentPromotion -->|default| User
  Application -->|Restrict| Applicant
  Application -->|Restrict| Class
  Application -->|Restrict| AcademicSession
  Application -->|default, optional| User
  Application -->|default, optional| Student
```

## Academics

```mermaid
flowchart LR
  Timetable -->|Restrict| Section
  Timetable -->|Cascade| Subject
  Timetable -->|SetNull, optional| Teacher
  Attendance -->|Restrict| Student
  Attendance -->|Restrict, optional| Teacher
  Attendance -->|SetNull, optional| User
  DiaryEntry -->|Restrict| Section
  DiaryEntry -->|Cascade| Subject
  DiaryEntry -->|default| User
  DiaryAttachment -->|Cascade| DiaryEntry
  DiaryAttachment -->|default| File
  LeaveRequest -->|Restrict| Student
  Complaint -->|Restrict| Student
  Complaint -->|default| User
  ReportCard -->|Restrict| Student
  ReportCard -->|Restrict| AcademicSession
  ReportCard -->|Restrict| File
  ReportCard -->|default| User
  GeneratedReportCard -->|Restrict| Student
  GeneratedReportCard -->|NoAction| Class
  GeneratedReportCard -->|NoAction| Term
  GeneratedReportCard -->|SetNull, optional| User
  AttendanceRiskFlag -->|Cascade| Student
  AssessmentCategory -->|Cascade| Class
  AssessmentCategory -->|Cascade| Term
  Assessment -->|Cascade| AssessmentCategory
  Assessment -->|Restrict| Subject
  Mark -->|Cascade| Assessment
  Mark -->|Cascade| Student
  Mark -->|default| User
```

## Communication

```mermaid
flowchart LR
  Circular -->|Cascade, optional| School
  Circular -->|Restrict, optional| Section
  Circular -->|default| User
  CircularRecipient -->|Cascade| Circular
  CircularRecipient -->|Cascade| User
  CircularAttachment -->|Cascade| Circular
  CircularAttachment -->|default| File
  Conversation -->|Cascade| User
  Conversation -->|Cascade| User
  Conversation -->|SetNull, optional| Student
  Message -->|Cascade| Conversation
  Message -->|default| User
  DraftSuggestion -->|SetNull, optional| User
```

## Finance & files

```mermaid
flowchart LR
  FeeStructure -->|Cascade, optional| School
  FeeVoucher -->|Restrict| Student
  FeeVoucher -->|default| AcademicSession
  FeeItem -->|Cascade| FeeVoucher
  FeeItem -->|Restrict, optional| FeeStructure
  FeePaymentAllocation -->|Restrict| FeePayment
  FeePaymentAllocation -->|Restrict| FeeVoucher
  Receipt -->|Restrict| FeePayment
```
