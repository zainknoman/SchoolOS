# Sprint O — Admissions/Enrollment Pipeline (Phase 8 remainder, P1)

Status: approved (design), ready for implementation planning.
As of `main` post-Sprint-L.
Spec source: `docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`, Implementation
Checklist, Sprint O.

Design decisions locked with the user before this spec was written:
- **Staff-entered only** — no public/unauthenticated application form and no new prospective-parent
  auth type this sprint.
- **EMI-style fee installments are split out** of this sprint entirely (carried forward as an
  unscheduled, explicitly-deferred backlog item — not bundled here, not given a sprint letter yet).

## Reconciliation with the roadmap doc before scoping work

Verified directly against `build/backend/src/enrollment` and `schema.prisma`.

- `EnrollmentService` (`enrollment.service.ts`) is confirmed to expose only
  `getCurrentEnrollment(studentId)` / `getEnrollmentForDate(studentId, date)` — both read-only
  lookups against an **already-existing** `Student`'s `Enrollment` rows. There is no create-path,
  no applicant concept, no review/approval workflow anywhere in this module or schema. The
  roadmap's characterization is accurate, not stale.
- `Enrollment` (`schema.prisma:219-`) requires `studentId`, `campusId`, `sectionId`,
  `academicSessionId` — i.e. a `Student` row and a `Section` assignment must already exist before an
  `Enrollment` can be created at all. An admissions pipeline's "approve" action is therefore
  necessarily a **student-creation** action (reusing `StudentService.create()`'s transaction shape,
  `student/student.service.ts:52-133`), not merely an `Enrollment`-table insert.
- `StudentService.create()` requires exactly one of `parentProfileId` (an existing `ParentProfile`)
  or `newParent` (identifier/password/name/phone, provisions a new `User`+`ParentProfile` via
  `createParentWithUser`, `parent/create-parent-with-user.ts`). An approved `Application` must
  supply equivalent data for whichever path applies — modeled directly on `Applicant`'s own fields
  (Design §1), not re-derived ad hoc at approval time.

## Decisions this spec makes so engineering doesn't have to guess

**`Applicant` is a deliberately separate model from `Student`/`ParentProfile`**, not a "draft"
row in either of those tables. An applicant who is never approved should never pollute the real
student/parent tables, and a rejected/withdrawn application's data has no reason to satisfy
`Student`'s constraints (e.g. a unique `grNumber`, which an applicant doesn't have yet).

**One `Applicant` can have multiple `Application` rows over time** (e.g. rejected one year,
reapplies the next) — `Application` carries the per-cycle state (`desiredClassId`,
`academicSessionId`, `status`), `Applicant` carries the person's static identity/contact data. This
mirrors the existing `Student`/`Enrollment` split (one person, many enrollment-period rows) rather
than inventing a new shape.

**Status machine is linear, no lottery/waitlist state this sprint:**
`SUBMITTED → UNDER_REVIEW → APPROVED | REJECTED`, plus `WITHDRAWN` (staff can mark an application
withdrawn at any point before a terminal state) — matches the Build-list's own explicit "core
application flow only, sized for a single school... not district scale" scope note; a
lottery-fairness audit trail is explicitly deferred (Build vs Defer §13 of the roadmap already says
so).

**Approval is transactional and atomic**: it either produces a real `Student` + `Enrollment` (+
`ParentProfile`/`User` if the applicant's guardian isn't already a parent in the system) and flips
the `Application` to `APPROVED`, or nothing happens at all. This reuses
`StudentService.create()`'s exact transaction body rather than writing a second, parallel
student-creation code path — a new `AdmissionsService.approve()` calls into the same
`$transaction` shape (extracted to a shared helper if `StudentService.create()`'s body isn't already
easily reusable as-is — confirm during implementation whether to extract or duplicate the ~15 lines,
leaning extract since two independent copies of "create a student + enrollment + parent
transactionally" is exactly the kind of duplication this codebase has consistently avoided
elsewhere, e.g. `createParentWithUser` itself being pulled out for the same reason).

**No public intake surface, so no new abuse-surface work this sprint** — no CAPTCHA, no rate
limiting beyond what already exists globally, no email-verification flow for a prospective parent.
Every `Application` is created by an authenticated staff member (`SCHOOL_ADMIN`/`ACCOUNTS`/
`SUPER_ADMIN`) on behalf of a family who applied by whatever offline channel the school already
uses (phone, in person, WhatsApp) — consistent with the "staff-entered only" decision.

**Duplicate-applicant detection is a soft warning, not a hard block.** Two `Applicant` rows with the
same name+guardian-contact could be a genuine duplicate entry or two different children from the
same family — the create endpoint checks for a same-name-and-phone match and returns it as a
`possibleDuplicate` hint in the response, but still creates the new row; staff decide, the system
doesn't guess.

## Design

### 1. New models

```prisma
model Applicant {
  id             String        @id @default(uuid())
  name           String
  dateOfBirth    DateTime
  guardianName   String
  guardianPhone  String
  applications   Application[]
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@index([guardianPhone])
}

model Application {
  id                String          @id @default(uuid())
  applicantId       String
  applicant         Applicant       @relation(fields: [applicantId], references: [id], onDelete: Restrict)
  desiredClassId    String
  desiredClass      Class           @relation(fields: [desiredClassId], references: [id], onDelete: Restrict)
  academicSessionId String
  academicSession   AcademicSession @relation(fields: [academicSessionId], references: [id], onDelete: Restrict)
  status            String          @default("SUBMITTED") // SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED | WITHDRAWN
  decisionNotes     String?
  reviewedById       String?
  reviewedBy         User?          @relation(fields: [reviewedById], references: [id])
  createdStudentId  String?         @unique // set only on APPROVED — links back to the real Student it produced
  createdStudent    Student?        @relation(fields: [createdStudentId], references: [id])
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([applicantId])
  @@index([academicSessionId, status])
}
```
Additive migration. `Class`/`AcademicSession`/`User`/`Student` each gain a back-relation array/
optional field — bookkeeping only, no behavior change to any existing model.

Note on `status` as a `String` rather than a Prisma `enum`: matches this schema's own existing
convention for every other status field (`FeePayment.status`, `LeaveRequest.status`,
`Complaint.status` are all plain strings with a comment listing valid values) — not introducing a
new pattern.

### 2. New `AdmissionsModule` (`backend/src/admissions/`)

- `POST /api/v1/applicants` — `@Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')`. Body: name, DOB,
  guardian name/phone. Returns the created row plus a `possibleDuplicate: Applicant | null` hint
  (Decisions above).
- `GET /api/v1/applicants?guardianPhone=` — same roles, for the duplicate-check UI and general
  lookup when staff are entering a returning family's second child.
- `POST /api/v1/applications` — body `{ applicantId, desiredClassId, academicSessionId }`, status
  defaults `SUBMITTED`.
- `GET /api/v1/applications?academicSessionId=&status=` — list/filter for the admissions queue
  screen.
- `PATCH /api/v1/applications/:id` — status transitions `SUBMITTED → UNDER_REVIEW`, or
  `→ WITHDRAWN` from any non-terminal state, plus `decisionNotes` updates. Rejects an attempt to set
  `APPROVED`/`REJECTED` directly through this route — those are their own dedicated endpoints below,
  since approval has side effects a plain PATCH shouldn't silently trigger.
- `POST /api/v1/applications/:id/reject` — body `{ decisionNotes }`, sets `status: REJECTED`,
  `reviewedById`. Terminal — no route un-rejects an application; staff create a fresh `Application`
  for the same `Applicant` if the family reapplies.
- `POST /api/v1/applications/:id/approve` — body: either `{ parentProfileId }` (link to an existing
  parent — e.g. a returning family's second child) or `{ newParent: { identifier, password, name,
  phone } }` (provision a new parent), plus `{ grNumber, sectionId }` (the concrete section within
  `desiredClassId` the student is actually being enrolled into — a class may have multiple
  sections, the application only names the class). Exactly-one-of validation mirrors
  `CreateStudentDto`'s existing `parentProfileId`/`newParent` shape exactly (Decisions above) rather
  than inventing a new validation shape. On success, in one `$transaction`: creates `Student` +
  `Enrollment` (+ `ParentProfile`/`User` if `newParent`) using the same body
  `StudentService.create()` already runs, sets `Application.status = APPROVED`,
  `createdStudentId`, `reviewedById`. On any failure (duplicate GR number, section not found), the
  whole transaction rolls back and the application stays in its prior state — never left
  half-approved.
- Every write role-gated `SCHOOL_ADMIN`/`ACCOUNTS`/`SUPER_ADMIN` — no `TEACHER` access (admissions is
  an office-staff function in this product's scope, matching Fees' existing role gating, not
  Attendance/Diary's teacher-inclusive gating). No `PARENT` access at all (staff-entered only).

### 3. Vue (staff-console)

- New `AdmissionsQueueView.vue` — list of `Application` rows (`EntityTable.vue`-based), filterable
  by academic session and status, following the existing Complaints-queue pattern (list + status
  action, not a full CRUD form).
- New `ApplicationDetailView.vue` — one application's full detail: applicant info, desired
  class/session, status history (`decisionNotes`), and the three actions (`Under Review` / `Reject`
  with a notes field / `Approve` with the section-picker + parent-linking sub-form described in
  Design §2). The Approve form reuses whatever component `StudentManagementView.vue`'s "create"
  form already uses for the parent-existing-vs-new choice, rather than rebuilding that toggle.
- New `ApplicantIntakeView.vue` — the staff-facing "create an applicant + first application" form
  (two logical steps, one screen), including the duplicate-hint surfaced from `POST /applicants`'s
  response (a dismissible banner: "A similar applicant already exists — [name], view?").
- Add a `nav-admissions` link to the admin nav group in `AppShell.vue`, gated the same way every
  other admin-only nav entry already is.

## Testing

- e2e: `POST /applicants` with a matching name+phone against an existing row returns
  `possibleDuplicate` populated but still creates the new row.
- e2e: `PATCH /applications/:id` rejects a direct `status: APPROVED`/`REJECTED` write (400) —
  those must go through their dedicated endpoints.
- e2e: `POST /applications/:id/approve` with `newParent` creates exactly one `Student`, one
  `Enrollment`, one `ParentProfile`+`User`, and sets `Application.status = APPROVED` +
  `createdStudentId` — all in one transaction; a duplicate `grNumber` in the request rolls back
  the entire transaction and leaves `Application.status` unchanged (still whatever it was before
  the call, e.g. `UNDER_REVIEW`).
- e2e: `POST /applications/:id/approve` with `parentProfileId` links to the existing parent instead
  of creating a new `User` row — confirm no duplicate `ParentProfile` is created for a repeat-family
  scenario.
- e2e: `POST /applications/:id/reject` is terminal — a second call (or an approve call afterward) on
  an already-rejected application is rejected (409 or 400, confirm which convention this codebase's
  other terminal-state checks use, e.g. `report-cards`' duplicate-upload 409).
- e2e: `TEACHER` and `PARENT` roles get 403 on every admissions route.
- Component tests: `AdmissionsQueueView.vue`'s status filter; `ApplicationDetailView.vue`'s
  Approve form correctly submits the exactly-one-of parent shape and surfaces a transaction-rollback
  error (e.g. duplicate GR number) as a visible message, not a silent failure.

## Out of scope this sprint

- EMI-style fee installments — explicitly split into its own future sprint, not scheduled with a
  letter yet; not touched by this spec at all.
- Any public/unauthenticated application form or prospective-parent self-service account type.
- Lottery/waitlist logic and a full audit-trail-of-every-status-change view (Build vs Defer §13
  already scopes the audit-trail depth as a stretch goal beyond the core flow).
- Application-stage fee handling (e.g. an admission/processing fee) — not named in the roadmap's
  Sprint O scope line, not invented here.
