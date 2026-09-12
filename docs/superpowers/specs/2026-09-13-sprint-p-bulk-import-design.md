# Sprint P — Bulk Import/Export (Phase 8, P1)

Status: approved (design), ready for implementation planning.
As of `main` post-Sprint-L.
Spec source: `docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`, Implementation
Checklist, Sprint P.

Design decisions locked with the user before this spec was written:
- **CSV-only for v1** — no `.xlsx`/Excel parsing this sprint.
- **Import only** — CSV export of existing rows is out of scope (small, low-risk, can be a quick
  follow-up any time; not bundled here).

## Reconciliation with the roadmap doc before scoping work

Verified directly against `build/backend/package.json` and the existing `student`/`parent`/
`teacher` modules.

- Confirmed: no CSV/Excel dependency anywhere in `backend/package.json`
  (`csv|xlsx|exceljs|papaparse|fast-csv` — zero matches). This is a genuinely new dependency, not an
  existing-but-unused library.
- `StudentService.create()` (`student/student.service.ts:52-133`) is the authoritative single-row
  validation/creation path for a Student: requires an active `AcademicSession`, a valid `sectionId`,
  and exactly one of `parentProfileId` (existing) or `newParent` (provisions a new `User` +
  `ParentProfile` via `createParentWithUser`). `TeacherService.create()` and `ParentService.create()`
  are the equivalent single-row paths for Teacher/Parent. Bulk import must produce the exact same
  end-state as N calls to these — reusing their transaction bodies, not reimplementing validation
  rules a second time that could silently drift from the single-row path.
- `CreateTeacherDto`/`CreateParentDto` both require a plaintext `password` field at creation time —
  a CSV file is an unsuitable place to carry real passwords in bulk (any file at rest becomes a
  password list). This spec generates a random password per new account instead (Decisions below).
- `forgot-password`/`reset-password` (`auth` module, shipped in Sprint I) is confirmed live —
  `POST /api/v1/auth/forgot-password` / `.../reset-password`, per `MASTER-PROMPT-TRACKER.md`'s
  Sprint I entry — so a bulk-created account with an unknown random password has a real,
  already-shipped way to become usable (Decisions below), not a gap this sprint has to also solve.

## Decisions this spec makes so engineering doesn't have to guess

**CSV only, via `csv-parse` (streaming, well-maintained, no native bindings — safer to add as a new
dependency than a library requiring build tooling).** `.xlsx` support is an explicit non-goal this
sprint; a school exports/saves as CSV from Excel/Google Sheets, which every spreadsheet tool
already supports natively.

**Preview-then-commit, two calls, matching the roadmap's own "preview-before-import" requirement
literally:** `POST .../preview` parses and validates without writing anything; `POST .../commit`
re-validates (never trusts a client-held preview result as authorization to skip re-validation —
the underlying data could have changed between preview and commit, e.g. another admin created a
conflicting GR number in between) and then commits the whole batch in one `$transaction`. A partial
failure anywhere in the batch rolls back the entire commit — no partially-imported file, per the
roadmap's explicit requirement.

**Validation reuses each entity's existing single-row rules, invoked per-row inside the batch
transaction — not a separate, parallel validation implementation.** Concretely: the same "exactly
one of `parentProfileId`/`newParent`", "section must exist", "active session must exist" checks
`StudentService.create()` already runs are extracted into a shared validator function called both
by the existing single-create endpoint (refactored to use it, so there is exactly one source of
truth) and by the new bulk-import path — mirrors this codebase's existing discipline of extracting
shared logic once it's used from two call sites (e.g. `createParentWithUser`).

**Duplicate detection is two-layered: within the file, and against the database.** Within-file:
two rows with the same `grNumber` (Students) or `identifier` (Teachers/Parents) in the same upload
are both flagged as errors in the preview (neither commits) — silently keeping "the last one wins"
would quietly discard data. Against the database: a row whose `grNumber`/`identifier` already
exists is flagged as a duplicate error in preview, not silently skipped or silently overwritten —
matching this schema's existing `assertCreatable` unique-constraint-violation convention
(`common/prisma-create-guard.ts`) rather than inventing new dedupe semantics.

**New accounts get a random password + are told to use the existing forgot-password flow.** For a
Student row whose `newParent` isn't linked to an existing `ParentProfile`, and for every Teacher
row, the service generates a random password (same `argon2.hash` path `createParentWithUser`/
`TeacherService.create()` already use — never a weak/predictable placeholder), does **not** include
it anywhere in the response or any log, and the commit response tells staff which
identifiers were newly created so they can be given to the family/teacher along with "use Forgot
Password to set your own." This reuses Sprint I's already-shipped flow instead of building a
second onboarding mechanism (e.g. an email invite) this sprint doesn't otherwise need.

**Only Students/Parents/Teachers, per the roadmap's own scope line** — no bulk import for
Classes/Sections/Subjects/Campuses (those are low-cardinality, admin-typed-once data at this
project's scale, not the "hundreds of rows" problem bulk import exists to solve).

**File size/row-count limits mirror Sprint B's existing upload-hardening precedent**: a hard cap
(e.g. 2,000 rows per file, confirmed against realistic school size before finalizing the exact
number in the plan) rejected up front with a clear message, rather than an unbounded parse that
could exhaust memory on a malformed or absurdly large file — same posture as the existing
`FileInterceptor` size/MIME allowlist.

## Design

### 1. New dependency
Add `csv-parse` to `backend/package.json`. No other new dependency.

### 2. New `BulkImportModule` (`backend/src/bulk-import/`)

Shared shape for all three entities (Students, Parents, Teachers) — one controller, three route
prefixes, one generic preview/commit service pattern parameterized by entity:

- `POST /api/v1/bulk-import/:entity/preview` (`entity` = `students`|`parents`|`teachers`,
  `@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')`) — multipart CSV upload. Parses via `csv-parse`, validates
  every row using the shared per-entity validator (Decisions above), returns
  `{ rows: { line: number; data: object; errors: string[] }[]; validCount: number; errorCount:
  number }`. Writes nothing to the database. Rejects (400) before parsing if row count exceeds the
  configured cap.
- `POST /api/v1/bulk-import/:entity/commit` — same file re-uploaded (not a server-side cached
  preview handle — avoids holding unconfirmed uploaded data server-side between calls, and forces
  re-validation against current DB state per the Decisions above). Re-runs the identical validation
  pass; if any row still has an error, the whole commit is rejected (400, same per-row error report)
  and nothing is written. If every row is valid, one `$transaction` creates all rows (each using the
  same per-entity creation logic — for Students, the same enrollment-creation body
  `StudentService.create()` runs; for Teachers/Parents, their existing `create()` bodies), one
  summarizing `AuditLog` row (`{ action: 'bulk-import.students', count, actingUserId }, per-row
  entityIds`) rather than one audit row per created record.

CSV column shapes (documented in the spec so the plan doesn't have to guess a schema):
- **Students:** `grNumber, name, sectionId, parentIdentifier?, newParentName?, newParentPhone?` —
  exactly one of `parentIdentifier` (links to an existing `ParentProfile.user.identifier`) or both
  `newParentName`+`newParentPhone` populated per row (same exactly-one-of rule as the single-create
  endpoint).
- **Parents:** `identifier, name, phone?`.
- **Teachers:** `identifier, name, campusId`.

### 3. Vue (staff-console)

New `BulkImportView.vue`, one per entity tab (Students/Parents/Teachers) or a single view with an
entity selector — file input → "Preview" button calls `.../preview` → a table renders every row
with its line number, parsed data, and inline error highlighting (errored rows visually distinct,
matching this codebase's existing form-validation error styling) → "Commit" is disabled while any
row has an error, enabled once `errorCount === 0` → on commit success, shows a summary
("42 students created") and a follow-up note for any new accounts ("provide these identifiers to
the families/staff; they can set their password via Forgot Password").

## Testing

- e2e: preview never writes to the database (assert row counts unchanged after a preview call with
  a fully-valid file).
- e2e: a file with two rows sharing the same `grNumber` flags both as duplicate-within-file errors;
  a row whose `grNumber` already exists in the database is flagged as a database-duplicate error;
  neither blocks the *other*, valid rows from being reported as valid in the same preview.
  response.
- e2e: commit rejects the entire batch (writes nothing) if any row still errors, even if 99 of 100
  rows are valid.
- e2e: a successful Students commit creates the `Student` + `Enrollment` (+ `ParentProfile`/`User`
  when `newParent` fields were used) exactly as the single-create endpoint would, with one summarizing
  `AuditLog` row, not one per student.
- e2e: a row count over the configured cap is rejected before parsing, with a clear error.
- e2e: `TEACHER`/`ACCOUNTS`/`PARENT` roles get 403 on every bulk-import route —
  `SCHOOL_ADMIN`/`SUPER_ADMIN` only, matching `StudentController`'s existing single-create gating
  exactly (`student/student.controller.ts:14`, no `ACCOUNTS`) rather than Fees' broader
  `ACCOUNTS`-inclusive convention — bulk import creates the same Student/Parent/Teacher rows the
  single-create endpoints do, so it takes their role gate, not a different module's.
- Component tests: `BulkImportView.vue`'s Commit button stays disabled while `errorCount > 0` and
  enables once a corrected file is re-previewed with zero errors.

## Out of scope this sprint

- `.xlsx`/Excel parsing — CSV only, per the locked decision.
- CSV export of existing Students/Parents/Teachers — a separate, smaller follow-up, not bundled
  here.
- Bulk import for Classes/Sections/Subjects/Campuses or any other entity.
- An email/SMS-based "invite" flow for newly bulk-created accounts — staff communicate the
  identifier out-of-band and the account holder uses the already-shipped Forgot Password flow.
