# Student Profile UI (Sub-project 1B) — Design

**Status:** Approved by user, 2026-09-14. Ready for implementation planning.

## Background

Sub-project 1 of the data-model overhaul (`docs/superpowers/plans/2026-09-13-student-profile-foundation.md`,
merged to `main`) added a `StudentProfileController` backend surface — identity/contact/academic
fields on `Student`, a reusable `Address` model, and four satellite models
(`StudentPreviousSchool`, `StudentEmergencyContact`, `StudentMedicalInfo`, `StudentDocument`) — plus
a roll-number/remarks edit on the student's current `Enrollment`. That plan explicitly deferred the
staff-console UI as "Sub-project 1B." This spec covers that UI: a new detail page for staff to view
and edit everything the backend now exposes for a single student.

Out of scope (unchanged from the backend plan): e2e test coverage, bulk-import CSV columns for the
new fields, parent-app visibility of documents.

## Backend API surface this UI consumes

All routes are `SCHOOL_ADMIN`/`SUPER_ADMIN`-only, under `/api/v1/admin/students/:studentId/`:

| Method | Path | Purpose |
|---|---|---|
| GET | `profile` | Full nested profile: student fields, `currentAddress`, `permanentAddress`, `previousSchool` (+address), `emergencyContacts` (+address, ordered by priority), `medicalInfo`, `documents` (+file, newest first), `enrollments` (active one, +section/class/campus) |
| PATCH | `profile` | Partial update of identity/contact/academic fields, `profilePhotoFileId`, `currentAddress`, `permanentAddress` |
| PATCH | `current-enrollment` | `rollNumber`, `remarks` on the active enrollment |
| PUT | `previous-school` | Upsert (one per student) |
| GET | `emergency-contacts` | List, ordered by priority |
| POST | `emergency-contacts` | Create |
| PATCH | `emergency-contacts/:contactId` | Update |
| DELETE | `emergency-contacts/:contactId` | Delete |
| PUT | `medical-info` | Upsert (one per student) |
| GET | `documents` | List, newest first |
| POST | `documents` | Add (links an already-uploaded `fileId`) |
| PATCH | `documents/:documentId/verify` | `{ verified: boolean }` → `VERIFIED`/`REJECTED` |

The UI only ever calls `GET profile` for reads — it already nests everything above. The individual
GET/list endpoints exist for other consumers but this page has no need for them.

## Scope

One new route, `/admin/students/:id`, added as a `StudentProfilePageView.vue` → `StudentProfileView.vue`
pair (matching every other detail page in this app — see `ApplicationDetailPageView.vue` →
`ApplicationDetailView.vue`). Reached via a "View Profile" `RouterLink` added to each row of the
existing `StudentManagementView.vue` table, using the exact pattern `AdmissionsQueueView.vue`
already uses to reach `ApplicationDetailView.vue`.

The page covers, as separate sections:
1. Identity/contact/academic profile fields + current & permanent address
2. Current enrollment (read-only class/section, editable roll number + remarks)
3. Previous school
4. Emergency contacts (list + add/edit/delete)
5. Medical/welfare info
6. Documents (list + add + verify/reject)

## Architecture

### Layout: single sectioned page, not tabs

No `Tabs` component exists in this codebase (checked `staff-console/src/components/`). Building one
for a single consumer would be scope creep. Instead, each section is an `<h2>` + content block,
directly mirroring `ApplicationDetailView.vue`'s `section.sub-form` pattern (`border-top`,
`padding-top`, vertical `gap`). The page is one scrollable column, `max-width: 900px` (matching
`ApplicationDetailView`'s own `.application-detail` wrapper).

### Edit UX: read-only display + per-section Edit toggle

Each of sections 1, 2, 3, 5 (Profile, Enrollment, Previous School, Medical Info) defaults to a
read-only rendering of its current data. An "Edit" button reveals an inline form scoped to exactly
that section, with its own `Save`/`Cancel` and its own `isSaving`/`errorMessage` refs — independent
per section, not one page-wide form. This is a deliberate choice over either (a) one giant
always-editable form, or (b) `StudentManagementView`'s click-to-edit-one-table-row pattern: unlike a
table row, a profile section has a dozen-plus fields, so "read-only card → single Edit button →
scoped form" keeps the default view scannable while still mapping 1:1 to the section's own
PATCH/PUT endpoint (one save action, one error surface, no risk of one section's half-finished edit
silently getting submitted by another section's Save button).

Sections 4 and 6 (Emergency Contacts, Documents) are lists, not single-record forms, so they keep
their own list-level UX (below).

### Sub-lists reuse `EntityTable`

Emergency contacts render through `EntityTable` (`items`, `columns`, `row-key`, `editing-id` props;
`cell-*`/`actions` slots) with the same inline add-row-above-table + click-to-edit-row pattern
`StudentManagementView.vue` already uses for the student list itself. Documents render through the
same component but read-only (no `editing-id` row-edit — verify/reject are row actions, not edits)
plus a separate "Add document" form above the table (file picker + document-type select).

No new list/table component is introduced.

### Data flow

`StudentProfileView.vue` calls `api.getStudentProfile(accessToken, studentId)` once on mount into a
single `profile` ref typed `StudentProfileDetail`. Every mutation across every section — profile
PATCH, enrollment PATCH, previous-school PUT, emergency-contact create/update/delete, medical-info
PUT, document add/verify — re-calls `getStudentProfile` afterward and replaces `profile.value`
wholesale, exactly matching the `load()`-after-mutation pattern already used in
`StudentManagementView.vue` and `ApplicationDetailView.vue`. No local/optimistic patching of nested
arrays. This is simpler and consistent with the rest of the app, at the cost of one extra GET per
mutation — acceptable for an admin console with single-digit concurrent editors.

### File uploads (documents)

Reuses the exact pattern from `DiaryView.vue`/`CircularsView.vue`: a plain
`<input type="file" @change="onFileChange">`, `files` ref, then on submit
`const uploaded = await api.uploadFile(accessToken, file)` → `uploaded.id` passed as `fileId` into
`api.addStudentDocument(...)`. No new upload component, no multi-file support (one document per add,
matching the one-`documentType`-per-`POST` backend shape).

### Enum-backed selects

`Gender`, `BloodGroup`, `StudentStatus`, `DocumentType` are rendered as `FormField type="select"`
with a hardcoded `options` array per enum (no backend "list enum values" endpoint exists or is
needed — these are small, stable, code-level constants). Defined once as exported consts in
`student-profile.constants.ts` (see Files below) so every section that needs one imports the same
list rather than redefining it. Exact members, per `backend/prisma/schema.prisma`:

- `Gender`: `MALE`, `FEMALE`, `OTHER`
- `BloodGroup`: `A_POS`, `A_NEG`, `B_POS`, `B_NEG`, `AB_POS`, `AB_NEG`, `O_POS`, `O_NEG`, `UNKNOWN`
- `StudentStatus`: `ACTIVE`, `LEFT`, `GRADUATED`, `WITHDRAWN`
- `DocumentType`: `BIRTH_CERTIFICATE`, `B_FORM`, `LEAVING_CERTIFICATE`, `TRANSFER_CERTIFICATE`,
  `PREVIOUS_REPORT_CARD`, `PHOTOGRAPH`, `MEDICAL_CERTIFICATE`, `CNIC`, `DEGREE_CERTIFICATE`, `CV`,
  `OTHER`

`label` for each option is a human-readable form of the value (e.g. `A_POS` → "A+",
`BIRTH_CERTIFICATE` → "Birth Certificate") — exact copy is an implementation-time detail, not a
design decision.

`DocumentVerificationStatus` (`PENDING`/`VERIFIED`/`REJECTED`) is not a select anywhere — it's
display-only (a `StatusPill`, matching the existing `StatusPill.vue` component's use elsewhere in
this app for status badges) plus the Verify/Reject row actions on pending documents.

### Shared-component gap: `FormField.vue` needs `textarea` and `email`

`FormField.vue` (`staff-console/src/components/FormField.vue`) currently supports
`'text' | 'password' | 'date' | 'select' | 'checkbox'` only. New fields need:
- **Multiline** (`textarea`): `academicRemarks`, `reasonForLeaving` (Previous School);
  `allergies`, `medicalConditions`, `specialEducationalNeeds`, `medicationNotes`,
  `emergencyMedicalNotes` (Medical Info); `notes` (Documents); `leavingReason` (Profile).
- **Email** (`email`, for native browser validation UX — the real validation is still the backend's
  `@IsEmail`): `studentEmail` (Profile), `email` (Previous School, Emergency Contact).

Both are added as small, targeted extensions to the shared component (per this codebase's existing
"fix the shared thing you're working through" convention) rather than worked around locally:
- `type` prop union becomes `'text' | 'password' | 'date' | 'email' | 'select' | 'checkbox' | 'textarea'`.
- The `'textarea'` branch renders a `<textarea>` (not `<input>`, since HTML has no
  `<input type="textarea">`), reusing the same `v-bind="$attrs"` / `modelValue` / `@input` wiring as
  the existing `<input>` branch, styled to match (`.form-field textarea` added alongside the existing
  `input, select` style rule).
- `'email'` needs no new branch — it already falls through to `<input :type="type">`, so adding it
  to the TS union is the entire change for that variant.

This is the only pre-existing file this spec modifies outside the new Student-profile files
themselves.

## Files

**New:**
- `staff-console/src/views/StudentProfilePageView.vue` — `AppShell` wrapper (matches
  `ApplicationDetailPageView.vue`)
- `staff-console/src/views/StudentProfileView.vue` — the page itself; likely the largest single file
  in this plan. If it grows unwieldy during implementation, the per-section forms are natural
  extraction points (e.g. a `StudentEmergencyContactsSection.vue`) — not pre-emptively split here,
  per YAGNI, but flagged as the first place to split if needed.
- `staff-console/src/views/StudentProfileView.spec.ts`
- `staff-console/src/lib/student-profile.constants.ts` — `GENDER_OPTIONS`, `BLOOD_GROUP_OPTIONS`,
  `STUDENT_STATUS_OPTIONS`, `DOCUMENT_TYPE_OPTIONS` (each `{ value, label }[]`)

**Modified:**
- `staff-console/src/router/index.ts` — add the `/admin/students/:id` route (same
  `meta.requiresRole`/`title` shape as the existing `/admin/students` route)
- `staff-console/src/views/StudentManagementView.vue` — add a "View Profile" `RouterLink` per row
  (new `actions` slot content, alongside the existing Edit/Delete buttons)
- `staff-console/src/views/StudentManagementView.spec.ts` — cover the new link
- `staff-console/src/components/FormField.vue` — add `'textarea'`/`'email'` per above
- `staff-console/src/components/FormField.spec.ts` — cover the new variants
- `staff-console/src/lib/api.ts` — add types (`StudentProfileDetail`, `AddressPayload`,
  `EmergencyContactDetail`, `StudentDocumentDetail`, etc.) and ~12 methods, one per backend route
  above (`getStudentProfile`, `updateStudentProfile`, `updateStudentCurrentEnrollment`,
  `upsertStudentPreviousSchool`, `createStudentEmergencyContact`, `updateStudentEmergencyContact`,
  `deleteStudentEmergencyContact`, `upsertStudentMedicalInfo`, `addStudentDocument`,
  `verifyStudentDocument` — `listEmergencyContacts`/`listDocuments` are NOT added, since the UI never
  calls them separately per the Data Flow decision above), following the exact
  `fetch` + `authHeaders` + `asJson`/`ApiError` shape every existing method in that file uses.

## Error handling

Each section's own `errorMessage` ref, rendered the same way as every existing view in this
app — `<p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>` — scoped inside
that section so one section's error never displaces another's. `ApiError`/`instanceof Error` message
extraction matches the existing `err instanceof Error ? err.message : 'Could not ...'` idiom used in
every view file read during this design (`StudentManagementView.vue`, `ApplicationDetailView.vue`,
`DiaryView.vue`).

The one page-level failure mode — `GET profile` itself failing (e.g. bad `studentId`) — shows a
single page-level error in place of the sections, matching how `StudentManagementView.vue` and
`ApplicationDetailView.vue` both handle their own top-level `load()` failure.

## Testing

Vitest + `@vue/test-utils`, mirroring `StudentManagementView.spec.ts`'s conventions exactly: `api`
module mocked via `vi.mock('../lib/api', ...)`, a memory `vue-router` instance providing the
`:id` param, Pinia `auth` store seeded with a fake `accessToken`. Cover, per section: initial
read-only render from a mocked `getStudentProfile` response, Edit-toggle reveals the form
pre-filled with current values, Save calls the right `api.*` method with the right payload and
reloads, Cancel discards without calling any mutation endpoint, and one error-path test per section
(mutation rejects → `errorMessage` renders, no reload). Emergency contacts and documents get an
additional add/delete (contacts) and add/verify (documents) case each. The router addition gets one
test on `StudentManagementView.spec.ts` asserting the "View Profile" link's `to` prop. `FormField`'s
two new variants get direct unit coverage in `FormField.spec.ts` (textarea renders/emits, email
`type` attribute passed through).

## Non-goals / explicitly deferred

- Tabs, wizard flows, or any multi-step form — single scrollable page.
- Optimistic UI / local cache patching — always re-fetch the whole profile after a mutation.
- Multi-file document upload in one action.
- A generic reusable "detail page" abstraction across entities (Student/Parent/Teacher/Application)
  — each of this app's existing detail pages (`ApplicationDetailView.vue`) is already its own
  hand-written file; this spec follows that precedent rather than introducing a new abstraction
  Sub-projects 2-4 would then be expected to also adopt.
- Backend changes of any kind — this is a pure frontend consumer of the already-merged Sub-project 1
  API.
