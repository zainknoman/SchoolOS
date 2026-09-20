# SchoolOS — Glossary

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `backend/prisma/schema.prisma`, `seed.ts`, UI labels · **Owner:** project owner
> Decision **G3 (recommended option applied):** the canonical product name is **SchoolOS**; "SchoolPortal"/`schoolportal` survives only in seed identifiers, the default database name and archived documents (intentional rebrand exclusion) and must not be used in new docs.

| Term | Meaning in SchoolOS | Code |
|---|---|---|
| School | A legal school organisation; parent of campuses. Has principal/contact profile fields. | `School` |
| Campus | A physical branch of a school. The seed calls them "branches"; **use "campus"**. | `Campus` |
| Academic session | A school year label (e.g. `2026-2027`) with start/end dates and an `isActive` flag. **Platform-global today** (no school link). | `AcademicSession` |
| Term | A subdivision of an academic session used by the gradebook. | `Term` |
| Class | A grade level within a campus **and** an academic session (e.g. "Grade 3"). The seed says "grade". Use "class". | `Class` |
| Section | A division of a class (e.g. "A"); has an optional class teacher. | `Section` |
| Class teacher | The teacher assigned to a section (`Section.classTeacherId`); required for attendance and leave approval; recipient of parent messages. | `Section.classTeacherId` |
| Subject | A globally-unique named subject; can only be seeded today. | `Subject` |
| Student | A learner record. **Students have no login.** | `Student` |
| GR number | General Register (admission) number — the student's unique registration ID; also usable as a login identifier for parent accounts. | `Student.grNumber`, `User.identifier` |
| B-Form | Pakistani child registration certificate number, stored on the student. | student profile |
| Enrollment | A dated placement of a student in a section/session with status ACTIVE, TRANSFERRED, COMPLETED, WITHDRAWN; the historical record of where a student studied. | `Enrollment` |
| Promotion | End-of-session decision per student (PROMOTED, RETAINED, GRADUATED, TRANSFERRED_OUT, WITHDRAWN) that closes an enrollment and, for PROMOTED/RETAINED, opens a new one. | `StudentPromotion`, `PromotionDecision` |
| Parent / guardian | A parent account (`PARENT` role) with a `ParentProfile`, linked to children through `StudentParent`. | `ParentProfile`, `StudentParent` |
| Applicant / Application | An admissions prospect and their application to a desired class in a target session; approval creates the student. | `Applicant`, `Application` |
| Hiring candidate / application | A prospective staff member and their application; approval creates a staff (and optionally teacher) record. | `HiringCandidate`, `HiringApplication` |
| Staff | Any employee record (teaching or not); `EmployeeType` classifies it (includes a `PRINCIPAL` value). | `Staff` |
| Teacher | A staff member with a `TEACHER` login; separate `Teacher` model linked to a `User` and campus. | `Teacher` |
| Principal | A `SCHOOL_ADMIN` user with `isPrincipal = true`. **Not a role.** Also a contact name on School/Campus profiles and an `EmployeeType` value — three different things. | `User.isPrincipal` |
| Role | One of SUPER_ADMIN, SCHOOL_ADMIN, TEACHER, ACCOUNTS, PARENT. | `Role` |
| Scope | The school/campus/section/child set a user may touch, resolved by `OrgScopeService` and `StudentAccessService`. | `common/` |
| Diary | Teacher-written homework/activity entries per section/subject, visible to parents. | `DiaryEntry` |
| Circular | A broadcast notice to a school or sections with read receipts. | `Circular` |
| Assessment category | A weighted grading bucket (e.g. "Quiz 20 %") for a class/term. | `AssessmentCategory` |
| Assessment / Mark | A graded item with max marks; per-student obtained marks. | `Assessment`, `Mark` |
| Report card | A per-student, per-session record with an attached document. | `ReportCard` |
| Fee structure | A named fee amount (integer, smallest currency unit). | `FeeStructure` |
| Voucher | A fee bill issued to a student for a month/session, made of items. | `FeeVoucher`, `FeeItem` |
| Payment / Allocation / Receipt | A payment (gateway or manual), its split across vouchers, and its receipt. | `FeePayment`, `FeePaymentAllocation`, `Receipt` |
| Reconcile | Manual marking of a voucher as paid/settled by accounts staff. | `POST /fee-vouchers/:id/reconcile` |
| Attendance status | PRESENT, ABSENT, LATE, LEAVE, HOLIDAY. | `AttendanceStatus` |
| Attendance risk | A flag for students with high recent absence (daily job). | `AttendanceRiskFlag` |
| Adapter | A swappable integration interface (storage, payments, push, mail, SMS, WhatsApp, AI) with a development fallback. | `storage/`, `notifications/`, `fees/gateways/` |
| Stub | Development-only fake implementation of an adapter. Not evidence of a working integration. | — |
| Audit log | Record of state-changing actions with user, action, entity. | `AuditLog` |
| Staff console / Parent app | The two client applications. | `staff-console/`, `parent-app/` |
