# Historical Records and Auditability

> **Status:** CURRENT · **Verified:** 2026-09-20 against `main@15362b7` · **Sources:** `schema.prisma`, `promotions.service.ts`, `AuditLog` writers · **Owner:** Engineering Lead

| Record | Kept as history? | How | Gaps |
|---|---|---|---|
| Student placement (section/session) | **Yes** | `Enrollment` rows with `startDate`, `endDate`, `status`, `rollNumber`; closed (not deleted) on promotion | No DB constraint for a single ACTIVE enrollment (BR-ENR-01) |
| Promotion decisions | **Yes** | `StudentPromotion` (decision, remarks, from/to enrollment) | No eligibility inputs stored (Q5) |
| Attendance | Yes | one row per student per day (`@@unique([studentId, date])`) | Corrections overwrite? (verify service behaviour) |
| Marks / grades | Current values only | `Mark` unique per assessment+student; no change log | No mark-edit history |
| Fees | Yes | `FeeVoucher`, `FeePayment`, `FeePaymentAllocation` (zeroed on failed payments), `Receipt` | No adjustments/refund records (Q9) |
| Report cards | One per student per session | `ReportCard` (+`File`) | — |
| Student previous school / documents | Yes | satellites with verification status | — |
| Teacher/staff assignment history | **No** | `Section.classTeacherId`, `Timetable.teacherId` hold only the current state | Cannot answer "who taught Grade 3-A in 2025?" |
| Deleted records | **No** | Hard deletes (`student.delete` etc., only FK-restricted); an `AuditLog` row remembers the action, not the data | No soft delete or archive (Q7) |
| Who did what | Partly | `AuditLog(userId, action, entity, entityId, createdAt)` written by many services (students, campuses, sessions, classes, fees, files, leave, promotions, bulk import, hiring …) | Completeness unproven; no old/new values; no read access logging |

`AuditLog` writers found by `grep AuditLog|auditLog`: academic-session, attendance, bulk-import (4), campus, circulars, class, diary, fees (3), files, gradebook (assessments), leave, me, messages (conversations), parent, promotions, and more; not exhaustive.
