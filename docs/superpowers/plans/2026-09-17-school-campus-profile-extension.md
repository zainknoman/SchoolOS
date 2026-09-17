# School/Campus Profile Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `School` and `Campus` with the identity/branding/leadership/status/location fields
named in the external Prompt 1 architecture review (Section A: School management, Section B: Campus
management), reflected end-to-end through the backend API and the existing staff-console
`SchoolManagementView.vue`/`CampusManagementView.vue` screens.

**Architecture:** Purely additive Prisma migration on the existing `School`/`Campus` models (no
existing field removed or renamed — `address`/`phone`/`email` stay exactly as they are). A new shared
`OrgStatus` enum (`ACTIVE`/`INACTIVE`). Logo reuses the existing `File` model/upload flow already used
for student/staff profile photos. A new *optional, additive* structured `Address` relation (reusing
the `Address` model already used by Student/Staff) sits alongside the existing free-text `address`
string — neither replaces the other; the free-text field remains the table's simple display column,
the structured address is an additional detail section. `Campus.departments` is a plain
`String[]` (Postgres native array) — a lightweight tag list, not a new relational `Department` entity
(a full `Department`/`JobPosition` model was explicitly reviewed and rejected as premature in
`MASTER-PROMPT-TRACKER.md`'s Production-Ready Backlog; this is a deliberately smaller data point that
satisfies "campus departments" without reopening that decision).

Both `SchoolManagementView.vue` and `CampusManagementView.vue` move from inline-row editing (too
cramped for this many fields) to a shared "Edit"/"Add" `AppModal` form with sectioned fields — the Add
modal already exists in both files today; this plan converts Edit to use the same modal instead of the
current inline table-row inputs, and adds the new fields to both.

**Tech Stack:** Same as the rest of this backend/frontend (NestJS + Prisma/Postgres, Vue 3 + TS).

**Spec:** This plan is self-contained; no separate design-spec document — the Architecture section
above and each task's brief carry the full design (matches this codebase's own precedent for
smaller, single-area changes, e.g. the "Teacher Subject/Class Assignment Scoping" fix, which shipped
with no separate spec file per `PROJECT-STATUS.md`).

## Global Constraints

- No existing `School`/`Campus` field is removed, renamed, or changes meaning. `address`/`phone`/
  `email` keep exactly their current behavior on both the backend and both staff-console screens.
- Every new field is optional (nullable or has a sensible default) — creating a `School`/`Campus`
  with only `name` (and `schoolId` for Campus) must keep working exactly as it does today.
- `School.code` is globally unique (`@@unique` on the scalar). `Campus.code` is unique per school
  (`@@unique([schoolId, code])`), not globally — two different schools may reuse the same campus code.
- `Campus.departments` is `String[] @default([])`, not a new relational model.
- Every write path keeps this codebase's existing role gates unchanged: `SchoolController`/
  `CampusController`'s `create`/`update`/`delete` stay `SUPER_ADMIN`-only; `CampusController.list`
  stays `SCHOOL_ADMIN`/`SUPER_ADMIN` (already the case) — this plan does not touch authorization.
- Every write continues to produce exactly one `AuditLog` row per call, same `action`/`entity`/
  `entityId`/`metadata` shape already used (`school.create`/`school.update`/`school.delete`,
  `campus.create`/`campus.update`/`campus.delete`).

---

### Task 1: Prisma schema — `OrgStatus` enum + School/Campus field extensions

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_extend_school_campus_profile/`

**Interfaces:**
- Produces: `OrgStatus` enum, all new `School`/`Campus` scalar fields, `School.logo`/`Campus.logo`
  (`File?` relation), `School.structuredAddress`/`Campus.structuredAddress` (`Address?` relation).
  Consumed by every later task in this plan.

- [ ] **Step 1: Add the `OrgStatus` enum**

In `backend/prisma/schema.prisma`, add near the other enums (e.g. after `PromotionDecision`):

```prisma
enum OrgStatus {
  ACTIVE
  INACTIVE
}
```

- [ ] **Step 2: Extend the `School` model**

Change:

```prisma
model School {
  id        String   @id @default(uuid())
  name      String
  address   String?
  phone     String?
  email     String?
  campuses  Campus[]
  users     User[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

to:

```prisma
model School {
  id                 String    @id @default(uuid())
  name               String
  code               String?   @unique
  registrationNumber String?
  website            String?
  logoFileId         String?
  logo               File?     @relation(fields: [logoFileId], references: [id], onDelete: SetNull)
  principalName      String?
  principalPhone     String?
  principalEmail     String?
  establishedDate    DateTime?
  schoolType         String?
  educationBoard     String?
  status             OrgStatus @default(ACTIVE)
  timezone           String?   @default("Asia/Karachi")
  currency           String?   @default("PKR")
  alternatePhone     String?
  addressId          String?
  structuredAddress  Address?  @relation(fields: [addressId], references: [id], onDelete: SetNull)
  address            String?
  phone              String?
  email              String?
  campuses           Campus[]
  users              User[]
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}
```

- [ ] **Step 3: Extend the `Campus` model**

Change:

```prisma
model Campus {
  id                 String              @id @default(uuid())
  schoolId           String
  school             School              @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  name               String
  address            String?
  phone              String?
  email              String?
  classes            Class[]
  enrollments        Enrollment[]
  holidays           Holiday[]
  teachers           Teacher[]
  staff              Staff[]
  hiringApplications HiringApplication[]
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  @@index([schoolId])
}
```

to:

```prisma
model Campus {
  id                 String              @id @default(uuid())
  schoolId           String
  school             School              @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  name               String
  code               String?
  campusType         String?
  logoFileId         String?
  logo               File?               @relation(fields: [logoFileId], references: [id], onDelete: SetNull)
  principalName      String?
  principalPhone     String?
  principalEmail     String?
  openingDate        DateTime?
  capacity           Int?
  latitude           Float?
  longitude          Float?
  status             OrgStatus           @default(ACTIVE)
  departments        String[]            @default([])
  alternatePhone     String?
  addressId          String?
  structuredAddress  Address?            @relation(fields: [addressId], references: [id], onDelete: SetNull)
  address            String?
  phone              String?
  email              String?
  classes            Class[]
  enrollments        Enrollment[]
  holidays           Holiday[]
  teachers           Teacher[]
  staff              Staff[]
  hiringApplications HiringApplication[]
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  @@index([schoolId])
  @@unique([schoolId, code])
}
```

- [ ] **Step 4: Add back-relations on `File` and `Address`**

On the `File` model, add two lines alongside the other `X[]` back-relations (e.g. near
`studentProfilePhotos`/`staffProfilePhotos`):

```prisma
  schoolLogos            School[]
  campusLogos            Campus[]
```

On the `Address` model, add two lines alongside the other back-relations:

```prisma
  schools                School[]
  campuses               Campus[]
```

- [ ] **Step 5: Generate and apply the migration**

```bash
cd backend
npx prisma migrate dev --name extend_school_campus_profile
npx prisma generate
```

Expected: purely additive (new enum, new nullable/defaulted columns, two new FK columns, one new
composite unique index) — no data loss, no manual SQL edits needed, applies cleanly against the local
Postgres dev database.

- [ ] **Step 6: Verify the build still compiles**

Run: `cd backend && npm run build`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(school-campus): extend School/Campus schema with profile fields"
```

---

### Task 2: School DTOs, service, controller

**Files:**
- Modify: `backend/src/school/dto/create-school.dto.ts`
- Modify: `backend/src/school/dto/update-school.dto.ts`
- Modify: `backend/src/school/school.service.ts`
- Modify: `backend/src/school/school.service.spec.ts`

**Interfaces:**
- Consumes: `OrgStatus` (Task 1, from `@prisma/client`).
- Produces: `SchoolSummary` gains every new field; `SchoolService.create`/`update` accept every new
  field. No controller route changes — `SchoolController` (unchanged) passes its DTOs straight
  through as it already does.

- [ ] **Step 1: Extend both DTOs**

Replace `backend/src/school/dto/create-school.dto.ts`:

```ts
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { OrgStatus } from '@prisma/client';

export class CreateSchoolDto {
  @IsString() @MinLength(1) name!: string;

  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsString() logoFileId?: string;
  @IsOptional() @IsString() principalName?: string;
  @IsOptional() @IsString() principalPhone?: string;
  @IsOptional() @IsEmail() principalEmail?: string;
  @IsOptional() @IsDateString() establishedDate?: string;
  @IsOptional() @IsString() schoolType?: string;
  @IsOptional() @IsString() educationBoard?: string;
  @IsOptional() @IsEnum(OrgStatus) status?: OrgStatus;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() addressId?: string;

  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}
```

Replace `backend/src/school/dto/update-school.dto.ts` the same way, but every field (including
`name`) becomes `@IsOptional()` (matching the existing file's pattern — `name` is optional on update,
required on create):

```ts
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { OrgStatus } from '@prisma/client';

export class UpdateSchoolDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;

  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsString() logoFileId?: string;
  @IsOptional() @IsString() principalName?: string;
  @IsOptional() @IsString() principalPhone?: string;
  @IsOptional() @IsEmail() principalEmail?: string;
  @IsOptional() @IsDateString() establishedDate?: string;
  @IsOptional() @IsString() schoolType?: string;
  @IsOptional() @IsString() educationBoard?: string;
  @IsOptional() @IsEnum(OrgStatus) status?: OrgStatus;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() addressId?: string;

  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
}
```

- [ ] **Step 2: Extend `SchoolService`**

In `backend/src/school/school.service.ts`:

1. Extend the `SchoolSummary` interface with every new field (all `string | null`, except
   `establishedDate: Date | null`, `status: OrgStatus`):

```ts
export interface SchoolSummary {
  id: string;
  name: string;
  code: string | null;
  registrationNumber: string | null;
  website: string | null;
  logoFileId: string | null;
  principalName: string | null;
  principalPhone: string | null;
  principalEmail: string | null;
  establishedDate: Date | null;
  schoolType: string | null;
  educationBoard: string | null;
  status: OrgStatus;
  timezone: string | null;
  currency: string | null;
  alternatePhone: string | null;
  addressId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  campusCount: number;
  studentCount: number;
  staffCount: number;
}
```

Import `OrgStatus` from `@prisma/client`.

2. `withStats`'s parameter type must accept the full raw Prisma `School` row now (simplest: change
   its parameter type to `Omit<SchoolSummary, 'campusCount' | 'studentCount' | 'staffCount'>` instead
   of hand-listing every field again — this also means `create`/`update`'s Prisma calls, which
   already `return` the full row by default, need no `select` changes since Prisma returns every
   scalar column by default).

3. In `create()`, pass every new field through to `this.prisma.school.create({ data: { ... } })`,
   spreading the whole DTO rather than listing 20 fields by hand:

```ts
  async create(dto: CreateSchoolDto, actingUserId: string): Promise<SchoolSummary> {
    const record = await this.prisma.school.create({
      data: {
        ...dto,
        establishedDate: dto.establishedDate ? new Date(dto.establishedDate) : undefined,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'school.create',
        entity: 'School',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.withStats(record);
  }
```

4. In `update()`, keep the existing "only update what's present" spread pattern, but generalize it
   instead of hand-listing 4 fields — build the update payload from every key actually present on
   the DTO:

```ts
  async update(id: string, dto: UpdateSchoolDto, actingUserId: string): Promise<SchoolSummary> {
    const existing = await this.prisma.school.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('School not found');
    }
    const { establishedDate, ...rest } = dto;
    const record = await this.prisma.school.update({
      where: { id },
      data: {
        ...rest,
        ...(establishedDate !== undefined ? { establishedDate: new Date(establishedDate) } : {}),
      },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'school.update',
        entity: 'School',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.withStats(record);
  }
```

Note: `...rest` spreads only keys present on the parsed DTO object — `class-validator`/Nest's
`ValidationPipe` does not add `undefined`-valued keys for fields the client omitted, so this
preserves the existing "only update what's present" contract without hand-listing every field twice.
Verify this assumption holds by checking how `StudentProfileService.updateProfile` (a similar
many-optional-field update) already handles it, and match that convention if it differs from the
above.

- [ ] **Step 3: Update `school.service.spec.ts`**

Read the existing file first. Update every test fixture/mock `School` row to include the new fields
(with `null`/`OrgStatus.ACTIVE`/`[]` defaults as appropriate) so existing assertions on the full
returned object don't break, and add at minimum one new test: `create()` passes every new field
through to `prisma.school.create`, and `update()` with only `{ name: 'X' }` does not touch any new
field (asserts `data` does not contain unrelated keys).

- [ ] **Step 4: Commit**

```bash
git add backend/src/school
git commit -m "feat(school-campus): extend School DTOs/service with profile fields"
```

---

### Task 3: Campus DTOs, service, controller

**Files:**
- Modify: `backend/src/campus/dto/create-campus.dto.ts`
- Modify: `backend/src/campus/dto/update-campus.dto.ts`
- Modify: `backend/src/campus/campus.service.ts`
- Modify: `backend/src/campus/campus.service.spec.ts`

**Interfaces:**
- Mirrors Task 2's shape exactly, for `Campus` instead of `School`, plus `departments: string[]`,
  `capacity: number | null`, `latitude`/`longitude: number | null`.

- [ ] **Step 1: Extend both DTOs**

Replace `backend/src/campus/dto/create-campus.dto.ts`:

```ts
import { IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { OrgStatus } from '@prisma/client';

export class CreateCampusDto {
  @IsString() @MinLength(1) schoolId!: string;
  @IsString() @MinLength(1) name!: string;

  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() campusType?: string;
  @IsOptional() @IsString() logoFileId?: string;
  @IsOptional() @IsString() principalName?: string;
  @IsOptional() @IsString() principalPhone?: string;
  @IsOptional() @IsEmail() principalEmail?: string;
  @IsOptional() @IsDateString() openingDate?: string;
  @IsOptional() @IsInt() capacity?: number;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsEnum(OrgStatus) status?: OrgStatus;
  @IsOptional() @IsArray() @IsString({ each: true }) departments?: string[];
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() addressId?: string;

  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
}
```

Replace `backend/src/campus/dto/update-campus.dto.ts` the same way, `name` becomes optional, `schoolId`
stays absent entirely (already not updatable, per the file's existing comment — keep that comment).

- [ ] **Step 2: Extend `CampusService`**

Same pattern as Task 2: extend `CampusSummary` with every new field, generalize `create()`/`update()`
to spread the DTO rather than hand-listing fields (keep the existing `assertValidReferences` error
wrapping on `create()`, keep `schoolId` excluded from `update()`'s spread since it's not on
`UpdateCampusDto`), keep `toSummary()`'s `WITH_SCHOOL` include and stat-counting logic unchanged
beyond widening its parameter type.

`CampusSummary` additions: `code`, `campusType`, `logoFileId`, `principalName`, `principalPhone`,
`principalEmail`, `openingDate: Date | null`, `capacity: number | null`, `latitude: number | null`,
`longitude: number | null`, `status: OrgStatus`, `departments: string[]`, `alternatePhone`,
`addressId`, plus the pre-existing `address`/`phone`/`email`.

- [ ] **Step 3: Update `campus.service.spec.ts`**

Same approach as Task 2 Step 3 — update fixtures, add a passthrough test and an update-preserves-
unrelated-fields test. Also add one test confirming a second campus in a *different* school may reuse
the same `code` (the uniqueness is per-school, not global) — mock `prisma.campus.create` resolving
successfully for that case (this is a service-level test, not a real DB constraint test; the real
constraint is verified in Task 7's e2e).

- [ ] **Step 4: Commit**

```bash
git add backend/src/campus
git commit -m "feat(school-campus): extend Campus DTOs/service with profile fields"
```

---

### Task 4: staff-console `api.ts` types + client

**Files:**
- Modify: `staff-console/src/lib/api.ts`

**Interfaces:**
- Consumes: nothing new (same `API_BASE_URL`/`authHeaders`/`asJson`/`ApiError` helpers).
- Produces: extended `SchoolSummary`/`CampusSummary` interfaces and extended
  `createSchool`/`updateSchool`/`createCampus`/`updateCampus` payload types — consumed by Tasks 5-6.

- [ ] **Step 1: Read the current file**

Read `staff-console/src/lib/api.ts`'s existing `SchoolSummary`/`CampusSummary` interfaces and
`createSchool`/`updateSchool`/`createCampus`/`updateCampus`/`listSchools`/`listCampuses` methods in
full before editing.

- [ ] **Step 2: Extend the types**

Add an exported type near the other enums-as-unions in this file:

```ts
export type OrgStatus = 'ACTIVE' | 'INACTIVE';
```

Extend `SchoolSummary` with every field Task 2 added to the backend's `SchoolSummary` (same names,
`string | null` for scalars, `string | null` for `establishedDate` since dates cross JSON as ISO
strings on this client, `OrgStatus` for `status`). Extend `CampusSummary` with every field Task 3
added, plus `departments: string[]`.

Extend the `createSchool`/`updateSchool` payload parameter types (currently
`{ name: string; address?: string; phone?: string; email?: string }` and its `Partial<...>`-shaped
update sibling) with every new optional field, matching the backend DTOs' field names exactly.
Do the same for `createCampus`/`updateCampus`.

- [ ] **Step 3: Self-review**

Confirm every new field name matches Task 2/3's DTO field names character-for-character (a typo here
is a silent runtime 400, not a compile error, since these are plain object literals passed to
`JSON.stringify`).

- [ ] **Step 4: Commit**

```bash
git add staff-console/src/lib/api.ts
git commit -m "feat(school-campus): extend api.ts School/Campus types"
```

---

### Task 5: `SchoolManagementView.vue` — modal-based edit + new fields

**Files:**
- Modify: `staff-console/src/views/SchoolManagementView.vue`
- Modify: `staff-console/src/views/SchoolManagementView.spec.ts` (read the existing file's name/path
  first — if it doesn't exist yet, this codebase's convention is one `.spec.ts` per `View.vue`; create
  it following `CampusManagementView.spec.ts`'s or a sibling org-structure view's shape)

**Interfaces:**
- Consumes: `api.listSchools`/`createSchool`/`updateSchool`/`deleteSchool` (Task 4), `EntityTable`,
  `FormField`, `Button`, `AppModal`, `useConfirm` (all pre-existing shared components).
- Also consumes the existing file-upload flow for the logo: read
  `staff-console/src/views/StudentProfileView.vue`'s (or wherever this codebase already uploads a
  profile photo — search for `api.uploadFile` or similar) existing photo-upload pattern first, and
  mirror it exactly for the school logo (upload on file-input change, store the returned `fileId`,
  submit that as `logoFileId`) — do not invent a new upload flow.

- [ ] **Step 1: Read reference files**

Read the current `SchoolManagementView.vue` in full (already read once during planning — re-read to
confirm nothing else has changed), and find this codebase's existing profile-photo/logo upload
pattern (search `staff-console/src/lib/api.ts` for an `uploadFile`-shaped method and find one existing
`.vue` file that calls it from a file `<input>`) to mirror for the logo field.

- [ ] **Step 2: Convert Edit to use `AppModal`, sectioned**

Replace the current inline-row `startEdit`/`editForm`/table-cell-`<input>` pattern with: clicking
"Edit" opens the same kind of `AppModal` the "Add School" flow already uses, pre-filled from the
row's data, covering every field grouped into clear sections (Basic: name/code/status; Contact:
address/phone/alternatePhone/email/website; Leadership: principalName/principalPhone/principalEmail;
Details: registrationNumber/establishedDate/schoolType/educationBoard/timezone/currency; Logo: file
input + preview if `logoFileId` is set). Keep the Add modal and Edit modal sharing the same field
markup (extract a shared internal component or repeat the block — prefer extracting since this is
~15 fields and Add/Edit need identical markup; call it e.g. an inline `<template>` reused via a
`v-if`-toggled single modal fed by either `newSchool`/`editForm`, whichever this file's existing Add/
Edit state shape makes simplest — use your judgment on the cleanest Vue-idiomatic way to avoid
duplicating 15 `FormField`s twice, but do not over-engineer a generic form-builder for one screen).

- [ ] **Step 3: Update the table**

Add `code` and `status` as visible columns (status rendered as a simple badge/text, "Active"/
"Inactive" — this codebase's `StatusPill.vue` may or may not exist yet per the tracked-but-not-yet-
built Sprint Q item; check `staff-console/src/components/` first, use it if present, otherwise a
plain `<span>` with the status text is fine, don't build a new shared component for this one field).
Keep `address`/`phone`/`campusCount`/`studentCount`/`staffCount` columns as they are today.

- [ ] **Step 4: Update/create the spec file**

Cover: the Edit flow now opens a modal (not inline inputs) pre-filled with the row's data; submitting
the Edit modal calls `api.updateSchool` with every changed field; the Add modal's new fields are
present and submitted; an error from either surfaces in the existing error-banner pattern.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/SchoolManagementView.vue staff-console/src/views/SchoolManagementView.spec.ts
git commit -m "feat(school-campus): rework SchoolManagementView with full profile fields"
```

---

### Task 6: `CampusManagementView.vue` — modal-based edit + new fields

**Files:**
- Modify: `staff-console/src/views/CampusManagementView.vue`
- Modify/Create: `staff-console/src/views/CampusManagementView.spec.ts`

**Interfaces:**
- Same shape as Task 5, for Campus. `departments: string[]` needs a simple UI: a comma-separated
  text input that splits/joins on save (do not build a tag-chip component for this one field — match
  this screen's existing simplicity level).

- [ ] **Step 1: Read reference files**

Read the current `CampusManagementView.vue` in full, and Task 5's finished `SchoolManagementView.vue`
(done immediately before this task) to mirror its modal-conversion pattern exactly rather than
inventing a second approach.

- [ ] **Step 2: Convert Edit to use `AppModal`, sectioned**

Same restructuring as Task 5: Basic (name/code/campusType/status), Contact
(address/phone/alternatePhone/email), Leadership (principalName/principalPhone/principalEmail),
Location & Capacity (latitude/longitude/capacity/openingDate), Departments (comma-separated text
input, split on `,` and trim each entry on save, joined with `, ` when populating the edit form from
`item.departments`), Logo (same upload pattern as Task 5).

- [ ] **Step 3: Update the table**

Add `code`, `status`, `campusType` as visible columns alongside the existing `name`/`schoolName`/
`address`/`phone`/`studentCount`/`staffCount`.

- [ ] **Step 4: Update/create the spec file**

Same coverage shape as Task 5's spec, plus one case: the departments comma-separated input round-trips
correctly (typing `"Science, Admin,  IT"` and saving submits `['Science', 'Admin', 'IT']`).

- [ ] **Step 5: Commit**

```bash
git add staff-console/src/views/CampusManagementView.vue staff-console/src/views/CampusManagementView.spec.ts
git commit -m "feat(school-campus): rework CampusManagementView with full profile fields"
```

---

### Task 7: e2e coverage

**Files:**
- Modify: `backend/test/org-structure.e2e-spec.ts` (read it first — this is the existing e2e spec
  covering School/Campus/AcademicSession/Class CRUD per `PROJECT-STATUS.md`'s "Org Structure CRUD"
  section; add to it rather than creating a parallel file)

**Interfaces:**
- Exercises the real HTTP surface end-to-end against the real Postgres test database.

- [ ] **Step 1: Read the existing spec**

Read `backend/test/org-structure.e2e-spec.ts` in full for its existing fixture/login/cleanup
boilerplate.

- [ ] **Step 2: Add test cases**

- Creating a School with every new field populated, reading it back via `GET /schools`, and
  confirming every field round-trips (including `establishedDate` as a date and `status` defaulting
  to `ACTIVE` when omitted).
- Creating two Campuses under two *different* Schools with the same `code` succeeds (per-school
  uniqueness, not global) — assert both create calls return 2xx.
- Creating two Campuses under the *same* School with the same `code` — the second fails (409/400,
  whatever this codebase's existing unique-constraint-to-HTTP-error translation produces; check
  `assertValidReferences`/`assertCreatable`'s existing behavior for a unique-constraint case rather
  than assuming a status code).
- Updating a School with only `{ name: 'New Name' }` leaves every other new field untouched (read the
  row back and assert the previously-set fields are unchanged).
- `Campus.departments` round-trips as an array through create → read → update.

- [ ] **Step 3: Commit**

```bash
git add backend/test/org-structure.e2e-spec.ts
git commit -m "test(school-campus): e2e coverage for extended profile fields"
```

---

## Process for this execution

Per the established convention from the immediately-prior Sprint R work in this same session:
implementer subagents for every task create/update files only (no test runs, no git add/commit)
until every task's files are written; then one full validation pass (backend build/unit/e2e, backend
lint on touched files, staff-console test/type-check/lint) runs once; any errors found get fixed;
then everything squashes into one commit and pushes directly to `origin main`. Task reviewers (static,
read-only, no test execution) still run after every task to catch defects before the final validation
pass, exactly as before.

## Self-Review Notes

- **Spec coverage:** Task 1 covers every schema field named in Prompt 1's School/Campus sections
  except "Campus departments" as a full relational entity (deliberately narrowed to `String[]`, see
  Architecture) and "structured address" replacing the free-text field (deliberately additive, not a
  replacement, see Architecture) — both narrowings are named and justified, not silent.
- **Explicitly out of scope, not part of this plan:** campus operating hours as structured
  per-weekday data (a free-text field was considered but not even added — nothing in Prompt 1's own
  wording gave enough detail to design a concrete schema for it, and no current screen would consume
  it); timezone/currency localization *behavior* (only the fields themselves are added — no part of
  the app actually changes behavior based on them yet, matching this plan's "add the data, don't
  invent unused behavior" scope).
- **Type consistency:** `OrgStatus` is defined once in Prisma (Task 1) and mirrored as a literal
  union in `staff-console/src/lib/api.ts` (Task 4), matching this codebase's established convention
  (see `PromotionDecision` in the Sprint R plan immediately before this one).
