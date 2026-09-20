> **ARCHIVED 2026-09-20** — Pre-build planning/audit material (2026-09-08). Historical; see docs/README.md. Do not treat as current documentation.

# SchoolOS — Master Implementation & Validation Prompt

You are working directly inside the existing **SchoolOS** repository.

## ROLE

Act as a senior full-stack engineer, solution architect, QA engineer, and UI/UX engineer.

Your job is to improve the EXISTING SchoolOS application.

Do NOT rebuild the application.

Do NOT replace the existing architecture or design system unless there is a clear, evidence-based reason.

Your first responsibility is to understand the current repository and its actual implementation state before changing anything.

---

# 1. SOURCE OF TRUTH

Use this priority order when making decisions:

1. Actual source code
2. Database schema / Prisma schema
3. Automated tests
4. Existing specifications and plans
5. PROJECT-STATUS.md / README
6. Previous implementation history / git commits
7. Competitor research
8. General assumptions

Never assume that something is missing simply because it is not mentioned in documentation.

Never implement a feature merely because a competitor has it.

First verify whether it already exists, is partial, is broken, or is intentionally deferred.

Classify findings as:

* Implemented
* Partially implemented
* Broken
* Tested
* Untested
* Integration-ready
* Sandbox-verified
* Production-verified
* Not implemented
* Intentionally deferred

---

# 2. FIRST STEP — REPOSITORY AUDIT

Before writing code:

Inspect:

* repository structure
* git status
* recent git history
* README
* PROJECT-STATUS.md
* docs/
* docs/superpowers/plans/
* docs/superpowers/specs/
* Prisma schema
* NestJS backend
* Staff Console
* Parent App
* existing tests
* configuration/environment files
* payment adapters
* notification adapters
* storage adapters
* authentication/RBAC
* audit logging
* current UI design system

Identify the latest completed sprint and the next planned sprint.

Do not blindly follow an old roadmap if the repository has already implemented part of it.

---

# 3. CURRENT PRODUCT

SchoolOS is a Pakistan-first school management and parent engagement platform.

Current major areas include:

* Authentication
* RBAC
* School / Campus
* Academic Session
* Classes
* Sections
* Students
* Parents
* Teachers
* Timetable
* Attendance
* Diary
* Circulars
* Messages
* Notifications
* Fees
* Leave
* Files
* Dashboard
* Enrollment
* Subjects
* Report Cards
* Teacher Complaints
* AI drafting
* Attendance-risk analytics
* Payment gateway adapters
* Push notifications

The existing architecture must be preserved unless an architectural problem is demonstrated.

---

# 4. IMPORTANT ARCHITECTURE RULES

Do NOT:

* rebuild the application
* migrate frameworks unnecessarily
* replace Vue with another frontend framework
* replace NestJS
* replace Prisma without strong justification
* replace the existing design system
* introduce Tailwind/shadcn merely for styling
* introduce unnecessary dependencies
* duplicate existing modules
* create parallel implementations of existing functionality
* weaken RBAC to make features easier
* bypass backend authorization
* expose sensitive data through the frontend
* disable tests to make CI pass

Prefer:

* existing components
* existing services
* existing adapters
* existing patterns
* existing validation
* existing API conventions
* existing test conventions

---

# 5. UI/UX OBJECTIVE

Improve the existing SchoolOS UI rather than redesigning it from scratch.

Maintain consistency across:

* Staff Console
* Parent App
* desktop
* mobile
* loading states
* empty states
* error states
* forms
* tables
* dialogs
* navigation
* dashboards

Prioritize:

1. usability
2. consistency
3. accessibility
4. responsive behavior
5. visual hierarchy
6. clear feedback
7. performance

Do not introduce visual changes that conflict with the existing design system.

---

# 6. FUNCTIONAL VALIDATION

Before implementing new functionality, verify existing functionality.

Pay particular attention to:

### Authentication

* login
* logout
* access token
* refresh token
* forgot password
* reset password
* authorization boundaries

### RBAC

Verify that:

* Teacher
* Admin
* Accounts
* Principal
* Parent

only access resources they are authorized to access.

Do not rely only on frontend hiding.

Authorization must be enforced server-side.

---

# 7. MULTI-CAMPUS SECURITY

Treat campus boundaries as a high-priority concern.

Verify that users cannot access:

* students from another campus
* parents from another campus
* teachers from another campus
* attendance from another campus
* fees from another campus
* report cards from another campus
* complaints from another campus
* timetable information from another campus

Test both:

* legitimate access
* unauthorized cross-campus access

Do not merely filter UI data.

Verify the backend query and authorization layer.

---

# 8. PRIORITY FEATURE AREAS

After auditing the repository, evaluate the following in this order.

## P0 — Production Readiness

Verify:

### Payments

* JazzCash adapter
* EasyPaisa adapter
* webhook verification
* signature validation
* idempotency
* duplicate webhook handling
* failed payment handling
* reconciliation
* transaction state transitions

If sandbox credentials are available, perform real sandbox verification.

If credentials are unavailable:

DO NOT invent successful verification.

Document:

`Integration-ready but sandbox verification unavailable`

### Notifications

Verify:

* FCM
* WhatsApp integration
* SMS integration
* notification retry behavior
* failure handling

If credentials are unavailable, document this clearly instead of pretending the integration is verified.

---

# 9. P0 TEST COVERAGE

Verify or add appropriate tests for:

* holidays
* complaints
* report cards
* AI drafting
* attendance-risk analytics
* forgot password
* reset password
* bulk attendance
* timetable conflict detection
* payment webhooks
* RBAC
* multi-campus boundaries

Use the existing test style.

Do not remove or weaken existing tests.

---

# 10. P1 — STRUCTURED ACADEMICS

Investigate the current report-card implementation.

Determine whether marks and grades are:

* structured database data
* manually entered documents
* uploaded files
* calculated
* partially calculated

If structured gradebook functionality is missing, design and implement it using existing architecture.

The gradebook should support:

* subjects
* assessment categories
* weighted categories
* marks
* maximum marks
* term
* final grade
* grade calculation

Example:

Assignments: 20%

Quizzes: 20%

Midterm: 25%

Final: 35%

The system should calculate the final result according to configured weights.

Do NOT introduce an eligibility flag unless there is an existing business requirement.

Report cards should consume structured academic results rather than requiring teachers to manually reproduce calculations.

---

# 11. P1 — ADMISSIONS / ENROLLMENT

Inspect the existing Enrollment module first.

Determine whether it can support:

* applicant
* application
* review
* approval/rejection
* enrollment
* class/section assignment
* academic session
* student creation

Extend the existing Enrollment architecture where possible.

Do not create a second admissions system if Enrollment already provides the required foundation.

---

# 12. P1 — BULK IMPORT / EXPORT

Evaluate support for:

* Students
* Parents
* Teachers

using:

* Excel
* CSV

Requirements:

* validation
* duplicate detection
* clear error reporting
* preview before import
* safe transaction handling
* role authorization
* audit logging

Do not partially import corrupted data silently.

---

# 13. UI ACCESSIBILITY

Verify and improve:

### Attendance

* segmented controls
* keyboard navigation
* focus states
* screen-reader labels

### Command Palette

* overflow behavior
* keyboard navigation
* focus management

### Dashboard

* accessible names for charts
* meaningful text alternatives
* keyboard accessibility

### StatusPill

Check whether the existing design specification requires a `StatusPill`.

If it does and it is missing:

Implement it according to the existing design specification.

Use it consistently for:

* loading
* success
* warning
* error
* empty states
* status indicators

Do not create a competing status component if an existing reusable component already exists.

---

# 14. FEATURES TO DEFER

Do NOT implement these unless current repository evidence or an explicit requirement makes them necessary:

* fee installments
* promotion/re-enrollment
* QR attendance
* RFID hardware integration
* full payroll
* full accounting ERP
* full LMS
* AI tutor
* hostel management
* alumni management
* GPS/transport platform
* canteen wallet

Document deferred features where appropriate.

---

# 15. DISCIPLINE VS COMPLAINTS

Keep these concepts separate.

Complaints are not automatically discipline incidents.

If discipline functionality is evaluated later, model it independently rather than overloading the existing complaints module.

---

# 16. DATABASE SAFETY

Before changing Prisma schema:

1. inspect existing schema
2. inspect existing migrations
3. check relationships
4. check existing data implications
5. avoid destructive migrations
6. preserve existing records
7. add appropriate indexes
8. update tests

Never reset the database simply to make development easier.

Never use destructive migration commands against a real environment.

---

# 17. SECURITY

Verify:

* server-side authorization
* input validation
* tenant/campus boundaries
* sensitive data exposure
* password handling
* token handling
* webhook verification
* file access authorization
* audit logging
* error responses

Never expose:

* passwords
* secrets
* private tokens
* payment credentials
* internal stack traces

Do not commit `.env` secrets.

---

# 18. IMPLEMENTATION PROCESS

For every feature:

### Step 1

Inspect existing implementation.

### Step 2

Determine whether the feature already exists.

### Step 3

Identify the smallest required change.

### Step 4

Create/update the appropriate plan/spec if required.

### Step 5

Implement backend.

### Step 6

Implement frontend.

### Step 7

Add/update tests.

### Step 8

Run lint.

### Step 9

Run type checking.

### Step 10

Run unit tests.

### Step 11

Run integration/e2e tests where applicable.

### Step 12

Perform manual smoke testing.

### Step 13

Update documentation.

### Step 14

Update PROJECT-STATUS.md.

### Step 15

Create a focused git commit.

Do not mix unrelated refactors into feature commits.

---

# 19. TESTING STANDARD

A feature is NOT considered complete merely because the code compiles.

For each implemented feature provide:

* implementation status
* tests added
* tests passed
* lint status
* type-check status
* build status
* manual verification status
* known limitations

Never claim:

"production-ready"

unless the relevant production dependencies and environment have actually been verified.

Use precise language such as:

* implemented
* tested locally
* integration-ready
* sandbox-verified
* production-verified

---

# 20. DOCUMENTATION

Keep these documents synchronized with the actual repository:

* README.md
* PROJECT-STATUS.md
* relevant docs/superpowers/specs/
* relevant docs/superpowers/plans/

Documentation must describe the actual current state.

Do not claim functionality that has not been verified.

---

# 21. GIT SAFETY

Before changing anything:

Run:

`git status`

Review recent commits.

Do not overwrite unrelated user work.

Do not reset or discard changes without explicit approval.

After completing a coherent implementation:

Run:

`git diff`

Review the changes.

Then create a focused commit.

---

# 22. EXECUTION MODE

IMPORTANT:

Do NOT immediately implement everything in this prompt.

First perform a repository audit.

Then determine:

1. what is already implemented
2. what is partially implemented
3. what is broken
4. what is missing
5. what is already planned
6. what should be done next

Then select the highest-value next work.

If an existing Sprint Plan/spec already defines the next work, follow it after verifying it against the repository.

Implement work incrementally.

Do not attempt a giant rewrite.

---

# 23. FINAL REPORT

At the end, provide:

## Repository State

* current branch
* latest commit
* working tree status

## Audit Findings

| Area | Status | Evidence | Action |
| ---- | ------ | -------- | ------ |

## Implemented

List actual changes.

## Tests

| Test | Result |
| ---- | ------ |

## Validation

* lint
* typecheck
* build
* unit tests
* e2e tests
* manual smoke test

## Remaining Gaps

List only verified gaps.

## Deferred

List intentionally deferred features.

## Production Readiness

Clearly state:

* Ready
* Pilot-ready
* Integration-ready
* Not production-ready

and explain why.

---

# FINAL RULE

The repository is the source of truth.

Inspect first.

Verify second.

Plan third.

Implement fourth.

Test fifth.

Document sixth.

Never assume.
Never fabricate verification.
Never rebuild unnecessarily.
Never weaken security or tests just to make the project appear complete.
