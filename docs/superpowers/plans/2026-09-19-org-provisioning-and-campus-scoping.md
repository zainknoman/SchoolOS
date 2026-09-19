# Org Provisioning & Campus Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix cross-campus teacher leakage on the Section screen, and let School/Campus creation provision principal logins whose data access is scoped to their school or campus.

**Architecture:** Piece A is a small standalone fix (teacher list filter + section campus validation + console dropdown). Piece B adds `User.campusId` / `User.mustChangePassword`, one shared `OrgScopeService` that every existing `schoolId`-scoping site migrates to, transactional principal-login creation inside `SchoolService.create` / `CampusService.create`, an authenticated change-password endpoint, and console UI.

**Tech Stack:** NestJS 11 + Prisma 7 (Postgres) + Jest/supertest (backend, `build/backend`); Vue 3 + Pinia + Vitest (`build/staff-console`).

**Spec:** `docs/superpowers/specs/2026-09-19-org-provisioning-and-campus-scoping-design.md`

## Global Constraints

- No new `Role` enum value. A principal is `role=SCHOOL_ADMIN`, `isPrincipal=true`.
- School-level admin: `schoolId` set, `campusId = null`. Campus principal: `schoolId` and `campusId` set, `campusId`'s campus must belong to `schoolId`.
- Generated temporary passwords are returned once in the create response and never persisted in plain text, logged, or put in `AuditLog.metadata`.
- Duplicate login `identifier` → HTTP 400 via existing `assertCreatable`; the whole School/Campus create rolls back.
- The login block (`admin` / `principal`) is optional; omitting it must behave exactly as today.
- Campus principals cannot create campuses. Academic sessions remain `SUPER_ADMIN`-created.
- Do NOT auto-create `Staff` or `Teacher` rows. No email delivery of credentials.
- Password minimum length 8 (matches existing `ResetPasswordDto`).
- Existing behaviour for `SUPER_ADMIN` (unrestricted) and school-wide `SCHOOL_ADMIN` must not change.
- Backend commands run from `D:\Zain\Projects\SchoolApp\build\backend`; console commands from `D:\Zain\Projects\SchoolApp\build\staff-console`. Branch: `feat/org-provisioning-campus-scoping`.

## File Structure

**Backend — create**
- `src/common/org-scope.service.ts` — `OrgScopeService.resolve(user)` → `OrgScope`; `assertCampusAccess`. The single source of school/campus scoping.
- `src/common/org-scope.module.ts` — `@Global()` module exporting `OrgScopeService`.
- `src/common/org-scope.service.spec.ts`
- `src/common/create-principal-user.ts` — `createPrincipalUser(tx, input)` + `LoginProvisionDto`.
- `src/common/create-principal-user.spec.ts`
- `src/auth/dto/change-password.dto.ts`
- `test/org-provisioning.e2e-spec.ts`
- `prisma/migrations/<timestamp>_add_user_campus_scope/migration.sql` (generated)

**Backend — modify:** `prisma/schema.prisma`, `src/app.module.ts`, `src/teachers/*`, `src/sections/*`, `src/class/*`, `src/campus/*`, `src/school/*`, `src/staff/staff.service.ts`, `src/student/student.service.ts`, `src/teacher/teacher.service.ts`, `src/parent/parent.service.ts`, `src/leave/leave.service.ts`, `src/admissions/applications.service.ts`, `src/hiring/hiring-applications.service.ts`, `src/academic-session/academic-session.service.ts`, `src/promotions/promotions.service.ts`, `src/holidays/holidays.service.ts`, `src/dashboard/dashboard.service.ts`, `src/attendance-risk/attendance-risk.controller.ts`, `src/common/student-access.service.ts`, `src/auth/auth.service.ts`, `src/auth/auth.controller.ts`.

**Console — create:** `src/views/ChangePasswordView.vue`, `src/views/ChangePasswordView.spec.ts`, `src/components/ProvisionLoginFields.vue`, `src/components/CredentialsPanel.vue`.
**Console — modify:** `src/lib/api.ts`, `src/stores/auth.ts`, `src/router/index.ts`, `src/components/AppShell.vue`, `src/views/SectionManagementView.vue` (+ spec), `src/views/SchoolProfileView.vue`, `src/views/CampusProfileView.vue`.

---

# PIECE A — Teacher scoping fix (ships first, standalone)

### Task 1: Teachers list accepts `campusId`

**Files:**
- Modify: `backend/src/teachers/teachers.service.ts:60-72`, `backend/src/teachers/teachers.controller.ts:17-21`
- Test: `backend/src/teachers/teachers.service.spec.ts`

**Interfaces:**
- Produces: `TeachersService.listAll(actingUser: RequestUser, campusId?: string): Promise<TeacherSummary[]>`; `GET /api/v1/teachers?campusId=<id>`.

- [ ] **Step 1: Write the failing tests** — append inside the `describe` in `teachers.service.spec.ts`:

```ts
  it('filters a SUPER_ADMIN teacher list to one campus when campusId is given', async () => {
    prisma.teacher.findMany.mockResolvedValue([{ id: 't-1', name: 'Ms. A' }]);

    await service.listAll({ id: 'super-1', role: 'SUPER_ADMIN' }, 'campus-1');

    expect(prisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { campusId: 'campus-1' } }),
    );
  });

  it('intersects the campusId filter with a SCHOOL_ADMIN school scope', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: 'school-1' });
    prisma.teacher.findMany.mockResolvedValue([]);

    await service.listAll({ id: 'admin-1', role: 'SCHOOL_ADMIN' }, 'campus-9');

    expect(prisma.teacher.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campusId: 'campus-9', campus: { schoolId: 'school-1' } },
      }),
    );
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/teachers/teachers.service.spec.ts`
Expected: FAIL — the `campusId` argument is ignored (`where: undefined` / no `campusId` key).

- [ ] **Step 3: Implement** — replace `listAll` in `teachers.service.ts`:

```ts
  async listAll(actingUser: RequestUser, campusId?: string): Promise<TeacherSummary[]> {
    let where: Prisma.TeacherWhereInput | undefined = campusId ? { campusId } : undefined;
    if (actingUser.role !== 'SUPER_ADMIN') {
      const admin = await this.prisma.user.findUnique({ where: { id: actingUser.id } });
      if (!admin?.schoolId) {
        return [];
      }
      where = { ...where, campus: { schoolId: admin.schoolId } };
    }
    const teachers = await this.prisma.teacher.findMany({ where, orderBy: { name: 'asc' } });
    return teachers.map((t) => ({ id: t.id, name: t.name }));
  }
```

And in `teachers.controller.ts` replace `listAll`:

```ts
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Get()
  listAll(@Req() req: AuthenticatedRequest, @Query('campusId') campusId?: string) {
    return this.teachersService.listAll(req.user, campusId);
  }
```
Add `Query` to the `@nestjs/common` import.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/teachers`
Expected: PASS (all, including the pre-existing tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/teachers
git commit -m "fix(teachers): allow filtering the teacher list by campusId"
```

---

### Task 2: Sections reject a class teacher from another campus

**Files:**
- Modify: `backend/src/sections/sections.service.ts` (create at ~L86, update at ~L120), `backend/src/sections/sections.service.spec.ts`

**Interfaces:**
- Produces: `SectionsService.create/update` throw `BadRequestException('Class teacher must belong to the same campus as the class.')` when the teacher's `campusId` differs from the class's `campusId`.

- [ ] **Step 1: Update the spec harness and add failing tests.** In `sections.service.spec.ts`:

(a) Add `class: { findUnique: jest.Mock };` to the `prisma` type, and in `beforeEach` add `class: { findUnique: jest.fn().mockResolvedValue({ campusId: 'c1' }) },` and change `teacher: { findUnique: jest.fn() }` to `teacher: { findUnique: jest.fn().mockResolvedValue({ campusId: 'c1' }) },`. (Tests that need a different value override with `mockResolvedValue`.)

(b) In the existing update tests, every `prisma.section.findUnique.mockResolvedValue(...)` used for a *successful* update must return an object containing `class: { campusId: 'c1' }` (add that key to those mock values).

(c) Append these tests:

```ts
  it('rejects creating a section whose class teacher belongs to another campus', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ campusId: 'other-campus' });

    await expect(
      service.create({ classId: 'cl1', name: '3A', classTeacherId: 't-other' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.section.create).not.toHaveBeenCalled();
  });

  it('rejects updating a section to a class teacher from another campus', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', class: { campusId: 'c1' } });
    prisma.teacher.findUnique.mockResolvedValue({ campusId: 'other-campus' });

    await expect(
      service.update('sec1', { classTeacherId: 't-other' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.section.update).not.toHaveBeenCalled();
  });

  it('allows clearing the class teacher (null) without a campus check', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', class: { campusId: 'c1' } });
    prisma.section.update.mockResolvedValue({ ...fullRecord, classTeacherId: null, classTeacher: null });

    await service.update('sec1', { classTeacherId: null as unknown as undefined }, 'admin-1');

    expect(prisma.teacher.findUnique).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/sections/sections.service.spec.ts`
Expected: the two rejection tests FAIL (no BadRequest thrown).

- [ ] **Step 3: Implement.** In `sections.service.ts` import `BadRequestException` from `@nestjs/common`, add the helper inside the class, and call it:

```ts
  private async assertTeacherInCampus(classTeacherId: string, campusId: string): Promise<void> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id: classTeacherId },
      select: { campusId: true },
    });
    // A missing teacher is left to the FK handler (P2003 → "Invalid ... reference").
    if (teacher && teacher.campusId !== campusId) {
      throw new BadRequestException('Class teacher must belong to the same campus as the class.');
    }
  }
```

At the top of `create`, before `this.prisma.section.create`:

```ts
    if (dto.classTeacherId) {
      const klass = await this.prisma.class.findUnique({
        where: { id: dto.classId },
        select: { campusId: true },
      });
      if (klass) {
        await this.assertTeacherInCampus(dto.classTeacherId, klass.campusId);
      }
    }
```

In `update`, change the existence lookup to `const existing = await this.prisma.section.findUnique({ where: { id }, include: { class: { select: { campusId: true } } } });` and, after the not-found check:

```ts
    if (dto.classTeacherId) {
      await this.assertTeacherInCampus(dto.classTeacherId, existing.class.campusId);
    }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/sections`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/sections
git commit -m "fix(sections): reject a class teacher from a different campus"
```

---

### Task 3: Console — campus-scoped class-teacher dropdown

**Files:**
- Modify: `staff-console/src/lib/api.ts:1362`, `staff-console/src/views/SectionManagementView.vue`, `staff-console/src/views/SectionManagementView.spec.ts`

**Interfaces:**
- Consumes: `GET /teachers?campusId=` (Task 1); `ClassSummary.campusId` (already exists), `SectionSummary.classId?`.
- Produces: `api.listTeachers(accessToken: string, campusId?: string): Promise<TeacherSummary[]>`.

- [ ] **Step 1: Update tests first** in `SectionManagementView.spec.ts`. In the first test, after `setValue('cl1')` on `add-class`, insert `await flushPromises();` before setting `add-teacher`; add these tests:

```ts
  it('loads only the selected class campus teachers and clears the chosen teacher when the class changes', async () => {
    const wrapper = mount(SectionManagementView);
    await flushPromises();
    await wrapper.find('[data-testid="open-add-form"]').trigger('click');

    await wrapper.find('[data-testid="add-class"]').setValue('cl1');
    await flushPromises();

    expect(api.listTeachers).toHaveBeenCalledWith('token-1', 'c1');
  });

  it('offers no teachers until a class is chosen', async () => {
    const wrapper = mount(SectionManagementView);
    await flushPromises();
    await wrapper.find('[data-testid="open-add-form"]').trigger('click');

    expect(api.listTeachers).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="add-teacher"]').text()).toContain('Choose a class first');
  });
```
Also change the mocked `listSections` row to include `classId: 'cl1'` so edit can resolve the campus.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/views/SectionManagementView.spec.ts`
Expected: FAIL (`listTeachers` still called with only the token, and eagerly on load).

- [ ] **Step 3: Implement.** In `api.ts`:

```ts
  async listTeachers(accessToken: string, campusId?: string): Promise<TeacherSummary[]> {
    const query = campusId ? `?campusId=${encodeURIComponent(campusId)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/teachers${query}`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },
```

In `SectionManagementView.vue` `<script setup>`: import `watch` (`import { ref, watch } from 'vue';`); replace the `teachers` ref with two refs; drop `api.listTeachers` from `load()`; add the loader, watcher and edit hook:

```ts
const addTeachers = ref<TeacherSummary[]>([]);
const editTeachers = ref<TeacherSummary[]>([]);

async function teachersForClass(classId: string | undefined): Promise<TeacherSummary[]> {
  const campusId = classes.value.find((c) => c.id === classId)?.campusId;
  if (!auth.accessToken || !campusId) return [];
  return api.listTeachers(auth.accessToken, campusId);
}

watch(newClassId, async (classId) => {
  newTeacherId.value = '';
  addTeachers.value = await teachersForClass(classId || undefined);
});
```
`load()` becomes:
```ts
    [classes.value, sections.value] = await Promise.all([
      api.listClasses(auth.accessToken),
      api.listSections(auth.accessToken),
    ]);
```
`startEdit` becomes `async` and ends with `editTeachers.value = await teachersForClass(section.classId);`.

Template: the edit `<option v-for="t in teachers" ...>` → `v-for="t in editTeachers"`; the add field's `:options` becomes:
```
:options="newClassId
  ? [{ value: '', label: '— No class teacher —' }, ...addTeachers.map((t) => ({ value: t.id, label: t.name }))]
  : [{ value: '', label: 'Choose a class first' }]"
```
Also reset `addTeachers.value = []` after a successful add (next to `newTeacherId.value = ''`).

- [ ] **Step 4: Run to verify pass, plus type-check and lint**

Run: `npx vitest run src/views/SectionManagementView.spec.ts && npx vue-tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src
git commit -m "fix(console): scope the class-teacher dropdown to the selected class campus"
```

**Piece A checkpoint:** run `npx jest` (backend) and `npx vitest run` (console). Everything green before starting Piece B.

---

# PIECE B — Provisioning and campus scoping

### Task 4: Schema — `User.campusId` and `User.mustChangePassword`

**Files:**
- Modify: `backend/prisma/schema.prisma` (`model User` ~L130, `model Campus` ~L219)
- Create: generated migration

**Interfaces:**
- Produces: Prisma fields `User.campusId String?`, `User.campus Campus?`, `User.mustChangePassword Boolean @default(false)`; `Campus.users User[]`.

- [ ] **Step 1: Edit the schema.** In `model User`, after the `school` relation line add:

```prisma
  campusId            String?
  campus              Campus?             @relation(fields: [campusId], references: [id], onDelete: Restrict)
  mustChangePassword  Boolean             @default(false)
```
and add `@@index([campusId])` next to any existing `@@` lines in `User` (create the line if none). In `model Campus`, after `staff Staff[]` add `users User[]`.

- [ ] **Step 2: Generate the migration**

Run: `npx prisma migrate dev --name add_user_campus_scope`
Expected: a new `prisma/migrations/<timestamp>_add_user_campus_scope/migration.sql` containing `ALTER TABLE "User" ADD COLUMN "campusId" TEXT` and `"mustChangePassword" BOOLEAN NOT NULL DEFAULT false`, an index on `campusId`, and the FK `User_campusId_fkey ... ON DELETE RESTRICT`; Prisma client regenerated.

- [ ] **Step 3: Verify the client compiles**

Run: `npx tsc --noEmit -p tsconfig.json && npx jest`
Expected: PASS (schema change is additive).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma
git commit -m "feat(db): add User.campusId and User.mustChangePassword"
```

---

### Task 5: `OrgScopeService`

**Files:**
- Create: `backend/src/common/org-scope.service.ts`, `backend/src/common/org-scope.module.ts`, `backend/src/common/org-scope.service.spec.ts`
- Modify: `backend/src/app.module.ts` (add `OrgScopeModule` to `imports`, next to `PrismaModule` ~L54)

**Interfaces:**
- Produces:
```ts
export interface OrgScope {
  unrestricted: boolean;   // SUPER_ADMIN
  denied: boolean;         // non-super with no schoolId → fail closed
  schoolId: string | null;
  campusId: string | null;
  campusWhere: Prisma.CampusWhereInput | undefined; // undefined = no restriction
  allows(target: { campusId: string; schoolId: string }): boolean;
}
OrgScopeService.resolve(user: RequestUser): Promise<OrgScope>
OrgScopeService.assertCampusAccess(user: RequestUser, campusId: string): Promise<void>  // ForbiddenException
```
`campusWhere` is exactly `{ schoolId }` for a school-wide admin (so existing spec expectations such as `{ campus: { schoolId: 'school-1' } }` stay identical) and `{ id: campusId, schoolId }` for a campus principal.

- [ ] **Step 1: Write the failing spec** `org-scope.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrgScopeService } from './org-scope.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrgScopeService', () => {
  let service: OrgScopeService;
  let prisma: { user: { findUnique: jest.Mock }; campus: { findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() }, campus: { findUnique: jest.fn() } };
    const moduleRef = await Test.createTestingModule({
      providers: [OrgScopeService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(OrgScopeService);
  });

  it('is unrestricted for SUPER_ADMIN and never queries the user', async () => {
    const scope = await service.resolve({ id: 'u1', role: 'SUPER_ADMIN' });
    expect(scope.unrestricted).toBe(true);
    expect(scope.denied).toBe(false);
    expect(scope.campusWhere).toBeUndefined();
    expect(scope.allows({ campusId: 'c1', schoolId: 's9' })).toBe(true);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('fails closed for a non-super user with no schoolId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', schoolId: null, campusId: null });
    const scope = await service.resolve({ id: 'u1', role: 'SCHOOL_ADMIN' });
    expect(scope.denied).toBe(true);
    expect(scope.allows({ campusId: 'c1', schoolId: 's1' })).toBe(false);
  });

  it('scopes a school-wide admin to { schoolId } and allows any campus of that school', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', schoolId: 's1', campusId: null });
    const scope = await service.resolve({ id: 'u1', role: 'SCHOOL_ADMIN' });
    expect(scope.campusWhere).toEqual({ schoolId: 's1' });
    expect(scope.allows({ campusId: 'cX', schoolId: 's1' })).toBe(true);
    expect(scope.allows({ campusId: 'cX', schoolId: 's2' })).toBe(false);
  });

  it('scopes a campus principal to their own campus only', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', schoolId: 's1', campusId: 'c1' });
    const scope = await service.resolve({ id: 'u1', role: 'SCHOOL_ADMIN' });
    expect(scope.campusWhere).toEqual({ id: 'c1', schoolId: 's1' });
    expect(scope.allows({ campusId: 'c1', schoolId: 's1' })).toBe(true);
    expect(scope.allows({ campusId: 'c2', schoolId: 's1' })).toBe(false);
  });

  it('assertCampusAccess throws Forbidden for a campus outside the scope and for a missing campus', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', schoolId: 's1', campusId: 'c1' });
    prisma.campus.findUnique.mockResolvedValue({ id: 'c2', schoolId: 's1' });
    await expect(service.assertCampusAccess({ id: 'u1', role: 'SCHOOL_ADMIN' }, 'c2')).rejects.toThrow(
      ForbiddenException,
    );
    prisma.campus.findUnique.mockResolvedValue(null);
    await expect(service.assertCampusAccess({ id: 'u1', role: 'SCHOOL_ADMIN' }, 'nope')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('assertCampusAccess passes for SUPER_ADMIN without a lookup', async () => {
    await expect(service.assertCampusAccess({ id: 'u1', role: 'SUPER_ADMIN' }, 'c9')).resolves.toBeUndefined();
    expect(prisma.campus.findUnique).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/common/org-scope.service.spec.ts`
Expected: FAIL — `Cannot find module './org-scope.service'`.

- [ ] **Step 3: Implement** `org-scope.service.ts`:

```ts
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from './student-access.service';

export interface OrgScope {
  unrestricted: boolean;
  denied: boolean;
  schoolId: string | null;
  campusId: string | null;
  campusWhere: Prisma.CampusWhereInput | undefined;
  allows(target: { campusId: string; schoolId: string }): boolean;
}

// Matches no campus — used only so `campusWhere` is never undefined for a denied caller.
const NO_CAMPUS: Prisma.CampusWhereInput = { id: '__no-access__' };

/**
 * The one place that turns "who is asking" into "which campuses may they touch". Every list /
 * ownership check that used to read `user.schoolId` directly goes through here, so a campus-level
 * principal (User.campusId set) is confined to their campus and a school-wide admin
 * (campusId null) to their school. SUPER_ADMIN is unrestricted.
 */
@Injectable()
export class OrgScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: RequestUser): Promise<OrgScope> {
    if (user.role === 'SUPER_ADMIN') {
      return {
        unrestricted: true,
        denied: false,
        schoolId: null,
        campusId: null,
        campusWhere: undefined,
        allows: () => true,
      };
    }
    const account = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!account?.schoolId) {
      return {
        unrestricted: false,
        denied: true,
        schoolId: null,
        campusId: null,
        campusWhere: NO_CAMPUS,
        allows: () => false,
      };
    }
    const schoolId = account.schoolId;
    const campusId = account.campusId ?? null;
    return {
      unrestricted: false,
      denied: false,
      schoolId,
      campusId,
      campusWhere: campusId ? { id: campusId, schoolId } : { schoolId },
      allows: (target) => target.schoolId === schoolId && (campusId === null || target.campusId === campusId),
    };
  }

  async assertCampusAccess(user: RequestUser, campusId: string): Promise<void> {
    const scope = await this.resolve(user);
    if (scope.unrestricted) return;
    const campus = await this.prisma.campus.findUnique({
      where: { id: campusId },
      select: { id: true, schoolId: true },
    });
    if (!campus || !scope.allows({ campusId: campus.id, schoolId: campus.schoolId })) {
      throw new ForbiddenException('You do not have access to this campus');
    }
  }
}
```

`org-scope.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { OrgScopeService } from './org-scope.service';

@Global()
@Module({ providers: [OrgScopeService], exports: [OrgScopeService] })
export class OrgScopeModule {}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/common/org-scope.service.spec.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common backend/src/app.module.ts
git commit -m "feat(scope): add OrgScopeService for school/campus scoping"
```

---

### Task 6: Adopt `OrgScopeService` in list-style services

Every site below has the identical shape `if (role !== 'SUPER_ADMIN') { admin = user.findUnique; if (!admin?.schoolId) return []; where = …schoolId… }`. Each becomes `const scope = await this.orgScope.resolve(actingUser); if (scope.denied) return []; if (scope.campusWhere) { … }`.

**Files (modify service + its spec):** `sections`, `class`, `campus`, `teachers`, `teacher`, `staff`, `student`, `parent`, `leave`, `admissions/applications.service.ts`, `hiring/hiring-applications.service.ts`.

**Interfaces:**
- Consumes: `OrgScopeService.resolve` (Task 5). Each service constructor gains `private readonly orgScope: OrgScopeService` (import from `../common/org-scope.service`). `OrgScopeModule` is global — no module edits.

- [ ] **Step 1: Add a campus-principal test to `sections.service.spec.ts` and `class.service.spec.ts`** (failing first). In each spec's `providers` add `OrgScopeService` (real one; it uses the mocked `PrismaService`). Add to `sections.service.spec.ts`:

```ts
  it('scopes a campus principal to their own campus sections', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'p1', schoolId: 's1', campusId: 'c1' });
    prisma.section.findMany.mockResolvedValue([]);

    await service.listAll({ id: 'p1', role: 'SCHOOL_ADMIN' });

    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { class: { campus: { id: 'c1', schoolId: 's1' } } } }),
    );
  });
```
and the analogue in `class.service.spec.ts` expecting `where: { campus: { id: 'c1', schoolId: 's1' } }` from `list({ id: 'p1', role: 'SCHOOL_ADMIN' })`.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/sections src/class`
Expected: FAIL (`where` still `…{ schoolId: 's1' }` — `campusId` ignored).

- [ ] **Step 3: Replace each site.** Exact replacements (delete the old `admin` lookup and `if (!admin?.schoolId)` block in each):

`sections/sections.service.ts` `listAll` (the `else if (actingUser.role !== 'SUPER_ADMIN')` branch):
```ts
    } else {
      const scope = await this.orgScope.resolve(actingUser);
      if (scope.denied) {
        return [];
      }
      if (scope.campusWhere) {
        where = { class: { campus: scope.campusWhere } };
      }
    }
```

`class/class.service.ts` `list` (same branch):
```ts
    } else {
      const scope = await this.orgScope.resolve(actingUser);
      if (scope.denied) {
        return [];
      }
      if (scope.campusWhere) {
        where = { campus: scope.campusWhere };
      }
    }
```

`campus/campus.service.ts` `list` — replace the whole `let schoolId … findMany` prelude:
```ts
  async list(actingUser: RequestUser): Promise<CampusSummary[]> {
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      // Fail closed: a non-SUPER_ADMIN caller with no schoolId sees no campuses at all.
      return [];
    }
    const records = await this.prisma.campus.findMany({
      where: scope.campusWhere,
      include: WITH_SCHOOL,
      orderBy: { name: 'asc' },
    });
    return Promise.all(records.map((r) => this.toSummary(r)));
  }
```

`teachers/teachers.service.ts` `listAll` (supersedes Task 1's body; keep the signature):
```ts
  async listAll(actingUser: RequestUser, campusId?: string): Promise<TeacherSummary[]> {
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    const where: Prisma.TeacherWhereInput | undefined =
      scope.campusWhere || campusId
        ? { ...(scope.campusWhere ? { campus: scope.campusWhere } : {}), ...(campusId ? { campusId } : {}) }
        : undefined;
    const teachers = await this.prisma.teacher.findMany({ where, orderBy: { name: 'asc' } });
    return teachers.map((t) => ({ id: t.id, name: t.name }));
  }
```

`teacher/teacher.service.ts` `list`:
```ts
  async list(actingUser: RequestUser): Promise<TeacherAdminSummary[]> {
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    const where: Prisma.TeacherWhereInput | undefined = scope.campusWhere ? { campus: scope.campusWhere } : undefined;
    const records = await this.prisma.teacher.findMany({ where, include: WITH_USER, orderBy: { name: 'asc' } });
    return records.map((r) => this.toSummary(r));
  }
```

`staff/staff.service.ts` `list`:
```ts
    let where: Prisma.StaffWhereInput | undefined = employeeType ? { employeeType } : undefined;
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      where = { ...where, campus: scope.campusWhere };
    }
```

`student/student.service.ts` `list`:
```ts
    let where: Prisma.StudentWhereInput | undefined;
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      where = { enrollments: { some: { section: { class: { campus: scope.campusWhere } } } } };
    }
```

`parent/parent.service.ts` `list`:
```ts
    let where: Prisma.ParentProfileWhereInput | undefined;
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      where = {
        children: {
          some: { student: { enrollments: { some: { section: { class: { campus: scope.campusWhere } } } } } },
        },
      };
    }
```

`leave/leave.service.ts` `listAll`:
```ts
    let where: Prisma.LeaveRequestWhereInput | undefined = status ? { status } : undefined;
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      where = {
        ...where,
        student: { enrollments: { some: { section: { class: { campus: scope.campusWhere } } } } },
      };
    }
```

`admissions/applications.service.ts` (after the `let where` declaration):
```ts
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      // AcademicSession has no schoolId of its own — scope via the desired class's campus instead.
      where = { ...where, desiredClass: { campus: scope.campusWhere } };
    }
```

`hiring/hiring-applications.service.ts`:
```ts
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return [];
    }
    if (scope.campusWhere) {
      where = { ...where, campus: scope.campusWhere };
    }
```

`academic-session/academic-session.service.ts` `copyStructure` — replace the `let schoolId … schoolId = admin.schoolId` block and the `...(schoolId ? { campus: { schoolId } } : {})` spread:
```ts
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      throw new BadRequestException('No school is linked to this account');
    }
    …
        where: {
          academicSessionId: sourceSessionId,
          ...(scope.campusWhere ? { campus: scope.campusWhere } : {}),
        },
```

- [ ] **Step 4: Fix every affected spec.** Each spec that constructs one of these services must list `OrgScopeService` in `providers` (real class, backed by the spec's existing mocked `PrismaService`; their `user.findUnique` mocks keep working since `resolve` calls the same method with `{ where: { id } }`). Run each spec, fix providers until green.

Run: `npx jest src/sections src/class src/campus src/teachers src/teacher src/staff src/student src/parent src/leave src/admissions src/hiring src/academic-session`
Expected: PASS, including the two new campus-principal tests.

- [ ] **Step 5: Confirm no list-style site was missed**

Run: `grep -rn "admin?.schoolId\|admin.schoolId" src --include=*.ts | grep -v spec`
Expected: only the sites handled by Tasks 7 and 8 remain (`promotions`, `parent.assertParentInScope`, `staff.getScopedStaff`, `teacher.create`, `holidays`, `dashboard`, `attendance-risk`, `student-access`).

- [ ] **Step 6: Commit**

```bash
git add backend/src
git commit -m "refactor(scope): route list scoping through OrgScopeService (campus-aware)"
```

---

### Task 7: Adopt `OrgScopeService` in point-check services and `StudentAccessService`

**Files:** `backend/src/staff/staff.service.ts`, `backend/src/teacher/teacher.service.ts`, `backend/src/parent/parent.service.ts`, `backend/src/promotions/promotions.service.ts`, `backend/src/common/student-access.service.ts` (+ their specs)

**Interfaces:** Consumes `OrgScope.allows({ campusId, schoolId })`.

- [ ] **Step 1: Add failing tests.** In `common/student-access.service.spec.ts` add (providing `OrgScopeService`, a mocked `prisma.user.findUnique` returning `{ id: 'p1', schoolId: 's1', campusId: 'c1' }`) a case: a `SCHOOL_ADMIN` campus principal calling `assertCanAccessSection` for a section in campus `c2` of the same school → rejects with `ForbiddenException`; and one for a section in `c1` → resolves. In `staff-edit.service.spec.ts` (or `staff.service.spec.ts`) add: campus principal editing staff of another campus of the same school → `ForbiddenException`.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/common/student-access src/staff`
Expected: FAIL (school-level check lets the other campus through).

- [ ] **Step 3: Implement.**

`staff/staff.service.ts` `getScopedStaff` — replace the `if (actingUser.role !== 'SUPER_ADMIN') { … }` block:
```ts
    const scope = await this.orgScope.resolve(actingUser);
    if (!scope.allows({ campusId: staff.campusId, schoolId: staff.campus.schoolId })) {
      throw new ForbiddenException('Cannot access staff outside your own school');
    }
```

`teacher/teacher.service.ts` `create` — replace the `if (actingUser.role !== 'SUPER_ADMIN') { … }` block:
```ts
    const scope = await this.orgScope.resolve(actingUser);
    if (!scope.unrestricted) {
      const campus = await this.prisma.campus.findUnique({ where: { id: dto.campusId } });
      if (!campus || !scope.allows({ campusId: campus.id, schoolId: campus.schoolId })) {
        throw new ForbiddenException('You do not have access to this campus');
      }
    }
```

`parent/parent.service.ts` `assertParentInScope` — replace from `const admin = …` through the `if (!inScope)` check:
```ts
    const scope = await this.orgScope.resolve(actingUser);
    const inScope = !scope.denied
      ? await this.prisma.studentParent.findFirst({
          where: {
            parentProfileId: parentId,
            student: { enrollments: { some: { section: { class: { campus: scope.campusWhere } } } } },
          },
          select: { id: true },
        })
      : null;
    if (!inScope) {
      throw new ForbiddenException('Cannot access a parent outside your own school');
    }
```
(the existing `if (actingUser.role === 'SUPER_ADMIN') return;` above stays.)

`promotions/promotions.service.ts`:
- `assertSectionInOwnSchool`: change the section `select` to `{ class: { select: { campusId: true, campus: { select: { schoolId: true } } } } }`; replace the `admin` lookup + check with
```ts
    const scope = await this.orgScope.resolve(actingUser);
    if (!scope.allows({ campusId: section.class.campusId, schoolId: section.class.campus.schoolId })) {
      throw new ForbiddenException('Cannot access a section outside your own school');
    }
```
- In the `$transaction` body replace `const admin = actingUser.role !== 'SUPER_ADMIN' ? await tx.user.findUnique(...) : null;` with `const scope = await this.orgScope.resolve(actingUser);` and replace the two checks (`!admin?.schoolId || currentEnrollment.section.class.campus.schoolId !== admin.schoolId` and the `targetSection` analogue) with:
```ts
          if (!scope.allows({ campusId: currentEnrollment.section.class.campusId, schoolId: currentEnrollment.section.class.campus.schoolId })) {
```
and
```ts
            if (!scope.allows({ campusId: targetSection.class.campusId, schoolId: targetSection.class.campus.schoolId })) {
```
keeping the existing `ForbiddenException` bodies. Delete the surrounding `if (actingUser.role !== 'SUPER_ADMIN')` wrappers (`allows` is always true for SUPER_ADMIN).

`common/student-access.service.ts`: inject `private readonly orgScope: OrgScopeService` as a third constructor parameter; in `assertCanAccessScope` replace the `SCHOOL_ADMIN`/`ACCOUNTS` case body with:
```ts
        const orgScope = await this.orgScope.resolve(user);
        if (!orgScope.allows({ campusId: scope.campusId, schoolId: scope.schoolId })) {
          throw new ForbiddenException('You do not have access to this resource');
        }
        return;
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest`
Expected: PASS (full backend suite). Fix any spec that constructs `StudentAccessService`/these services without `OrgScopeService` by adding it to `providers`.

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "refactor(scope): campus-aware ownership checks and StudentAccessService"
```

---

### Task 8: Adopt `OrgScopeService` in dashboard, holidays, attendance-risk

**Files:** `backend/src/dashboard/dashboard.service.ts`, `backend/src/holidays/holidays.service.ts`, `backend/src/attendance-risk/attendance-risk.controller.ts` (+ specs)

- [ ] **Step 1: Add a failing test** in `dashboard.service.spec.ts`: a campus principal (`user.findUnique` → `{ id: 'p1', schoolId: 's1', campusId: 'c1', isPrincipal: true }`) calling `getSummary` results in `enrollment.count` being called with a `where` containing `campus: { id: 'c1', schoolId: 's1' }`. Add the analogous check for `holidays` (`campus.findMany` called with `where: { id: 'c1', schoolId: 's1' }`).

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/dashboard src/holidays`
Expected: FAIL.

- [ ] **Step 3: Implement.**

`dashboard.service.ts`: inject `OrgScopeService`; import `type { OrgScope } from '../common/org-scope.service'`. Change every private helper's `schoolId?: string` parameter to `campusWhere?: Prisma.CampusWhereInput` and every `{ campus: { schoolId } }` / `campus: { schoolId }` fragment to `{ campus: campusWhere }` (helpers: `attendancePercentAndAbsent`, `feesCollectedPkrForRange`, `feesOutstandingPkr`, `weeklyTrend`, `feeDefaultersCount`). The conditionals `schoolId ? … : {}` become `campusWhere ? … : {}`. `recentAlerts` takes the scope instead:
```ts
  private async recentAlerts(scope?: OrgScope): Promise<DashboardAlert[]> {
    let userIdFilter: Prisma.NotificationWhereInput | undefined;
    if (scope && !scope.unrestricted && scope.schoolId) {
      const users = await this.prisma.user.findMany({
        where: { schoolId: scope.schoolId, ...(scope.campusId ? { campusId: scope.campusId } : {}) },
        select: { id: true },
      });
      userIdFilter = { userId: { in: users.map((u) => u.id) } };
    }
    …
```
In `getSummary` / `getOperationsSummary` replace the `let schoolId … admin.schoolId` prelude with:
```ts
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return DashboardService.EMPTY_SUMMARY; // (getOperationsSummary: the existing empty literal)
    }
    const campusWhere = scope.campusWhere;
```
and pass `campusWhere` / `scope` to the helpers. `application.count` uses `desiredClass: { campus: campusWhere }`; `leaveRequest.count` and `studentDocument.count` use `student: { enrollments: { some: { campus: campusWhere } } }`. In `getNetworkOverview` pass `{ schoolId: school.id }` where it previously passed `school.id`. In `getPrincipalAcademicsSummary`, keep the `isPrincipal` check, then replace `admin.schoolId` handling with:
```ts
    const scope = await this.orgScope.resolve(actingUser);
    if (scope.denied) {
      return { classHealth: [], examScheduleStatus: [] };
    }
```
and both `campus: { schoolId: admin.schoolId }` fragments with `campus: scope.campusWhere`.

`holidays.service.ts` `resolveAllowedCampusIds`, SCHOOL_ADMIN/ACCOUNTS branch:
```ts
      const scope = await this.orgScope.resolve(actingUser);
      if (scope.denied) {
        return null;
      }
      const campuses = await this.prisma.campus.findMany({ where: scope.campusWhere, select: { id: true } });
      return campuses.map((c) => c.id);
```

`attendance-risk.controller.ts`: inject `OrgScopeService`; replace the `SCHOOL_ADMIN` branch:
```ts
    if (req.user.role === 'SCHOOL_ADMIN') {
      const scope = await this.orgScope.resolve(req.user);
      if (scope.denied) {
        return this.attendanceRiskService.getFlagged([]);
      }
      const sections = await this.prisma.section.findMany({
        where: { class: { campus: scope.campusWhere } },
        select: { id: true },
      });
      return this.attendanceRiskService.getFlagged(sections.map((s) => s.id));
    }
```

- [ ] **Step 4: Run to verify pass and that nothing is left**

Run: `npx jest && grep -rn "admin?.schoolId\|admin.schoolId" src --include=*.ts | grep -v spec`
Expected: jest PASS; the grep prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "refactor(scope): campus-aware dashboard, holidays and attendance-risk"
```

---

### Task 9: Principal write access for classes, sections and campuses

**Files:**
- Modify: `backend/src/class/class.controller.ts`, `backend/src/sections/sections.controller.ts`, `backend/src/campus/campus.controller.ts`, `backend/src/campus/campus.service.ts` (+ specs)

**Interfaces:**
- Consumes: `StudentAccessService.assertCanAccessClass/Section` (campus-aware after Task 7), `OrgScopeService.assertCampusAccess`, `OrgScopeService.resolve`.
- Produces: `POST/PATCH/DELETE /classes` and `/sections` allowed for `SCHOOL_ADMIN` within scope; `POST /campuses` allowed for a school-wide `SCHOOL_ADMIN` for their own school only.

- [ ] **Step 1: Write the failing e2e-style unit tests.** In `campus.service.spec.ts` add (providing `OrgScopeService`):

```ts
  it('rejects a campus principal creating a campus', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'p1', schoolId: 's1', campusId: 'c1' });
    await expect(
      service.create({ schoolId: 's1', name: 'New' }, 'p1', { id: 'p1', role: 'SCHOOL_ADMIN' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a school admin creating a campus in another school', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'a1', schoolId: 's1', campusId: null });
    await expect(
      service.create({ schoolId: 's2', name: 'New' }, 'a1', { id: 'a1', role: 'SCHOOL_ADMIN' }),
    ).rejects.toThrow(ForbiddenException);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/campus`
Expected: FAIL (`create` has no third parameter / no check).

- [ ] **Step 3: Implement.**

`campus.service.ts` — change the signature to `create(dto: CreateCampusDto, actingUserId: string, actingUser?: RequestUser)` and add at its top:
```ts
    if (actingUser && actingUser.role !== 'SUPER_ADMIN') {
      const scope = await this.orgScope.resolve(actingUser);
      if (scope.denied || scope.campusId !== null || scope.schoolId !== dto.schoolId) {
        throw new ForbiddenException('You can only create campuses for your own school');
      }
    }
```
(import `ForbiddenException`). Update existing call sites/specs: `campus.controller.ts` passes `req.user` as the third argument.

`campus.controller.ts`: the class-level `@Roles('SUPER_ADMIN')` stays; add a method-level override on create:
```ts
  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post('campuses')
  create(@Body() dto: CreateCampusDto, @Req() req: AuthenticatedRequest) {
    return this.campusService.create(dto, req.user.id, req.user);
  }
```

`class/class.controller.ts`: inject `StudentAccessService` and `OrgScopeService` (import `OrgScopeService`); change `create` / `update` / `delete` to `@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')` (method-level, overriding the class-level `SUPER_ADMIN`) and add the guards:
```ts
  async create(@Body() dto: CreateClassDto, @Req() req: AuthenticatedRequest) {
    await this.orgScope.assertCampusAccess(req.user, dto.campusId);
    return this.classService.create(dto, req.user.id);
  }

  async update(@Param('id') id: string, @Body() dto: UpdateClassDto, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessClass(req.user, id);
    return this.classService.update(id, dto, req.user.id);
  }

  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessClass(req.user, id);
    await this.classService.delete(id, req.user.id);
  }
```
(keep each method's existing decorator `@Post('classes')`, `@Patch('classes/:id')`, `@Delete('classes/:id')`, adding the `@Roles` line above it). `ClassModule` already provides `StudentAccessService`.

`sections/sections.controller.ts`: change `create`/`update`/`delete` to `@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')` and guard:
```ts
  async create(@Body() dto: CreateSectionDto, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessClass(req.user, dto.classId);
    return this.sectionsService.create(dto, req.user.id);
  }

  async update(@Param('id') id: string, @Body() dto: UpdateSectionDto, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessSection(req.user, id);
    return this.sectionsService.update(id, dto, req.user.id);
  }

  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.studentAccess.assertCanAccessSection(req.user, id);
    await this.sectionsService.delete(id, req.user.id);
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest`
Expected: PASS. (`assertCanAccessClass` for `SUPER_ADMIN` returns immediately, so existing behaviour is unchanged.)

- [ ] **Step 5: Commit**

```bash
git add backend/src
git commit -m "feat(access): let scoped school admins manage classes, sections and campuses"
```

---

### Task 10: `createPrincipalUser` helper and login-provision DTO

**Files:**
- Create: `backend/src/common/create-principal-user.ts`, `backend/src/common/create-principal-user.spec.ts`

**Interfaces:**
- Produces:
```ts
export class LoginProvisionDto { identifier!: string; password?: string }
export interface ProvisionedLogin { identifier: string; temporaryPassword: string | null }
export function createPrincipalUser(
  tx: Prisma.TransactionClient,
  input: { identifier: string; password?: string; schoolId: string; campusId: string | null },
): Promise<ProvisionedLogin>
```
`temporaryPassword` is the generated password when `password` was omitted, else `null` (never echo a caller-supplied password).

- [ ] **Step 1: Write the failing spec:**

```ts
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createPrincipalUser } from './create-principal-user';

describe('createPrincipalUser', () => {
  const makeTx = () => ({ user: { create: jest.fn().mockResolvedValue({ id: 'u1' }) } });

  it('creates a SCHOOL_ADMIN principal who must change their password, and returns a generated password once', async () => {
    const tx = makeTx();
    const result = await createPrincipalUser(tx as never, {
      identifier: 'head@school.test',
      schoolId: 's1',
      campusId: null,
    });

    expect(result.identifier).toBe('head@school.test');
    expect(result.temporaryPassword).toEqual(expect.any(String));
    expect((result.temporaryPassword as string).length).toBeGreaterThanOrEqual(12);
    const data = tx.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      identifier: 'head@school.test',
      role: 'SCHOOL_ADMIN',
      isPrincipal: true,
      mustChangePassword: true,
      schoolId: 's1',
      campusId: null,
    });
    expect(data.passwordHash).not.toContain(result.temporaryPassword);
    expect(await argon2.verify(data.passwordHash, result.temporaryPassword as string)).toBe(true);
  });

  it('uses a caller-supplied password and does not echo it back', async () => {
    const tx = makeTx();
    const result = await createPrincipalUser(tx as never, {
      identifier: 'p@campus.test',
      password: 'Sup3rSecret!',
      schoolId: 's1',
      campusId: 'c1',
    });
    expect(result.temporaryPassword).toBeNull();
    expect(tx.user.create.mock.calls[0][0].data.campusId).toBe('c1');
  });

  it('translates a duplicate identifier into a BadRequestException', async () => {
    const tx = makeTx();
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(
      createPrincipalUser(tx as never, { identifier: 'dup@x.test', schoolId: 's1', campusId: null }),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/common/create-principal-user.spec.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** `create-principal-user.ts`:

```ts
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { assertCreatable } from './prisma-create-guard';

export class LoginProvisionDto {
  @IsString() @MinLength(3) identifier!: string;
  @IsOptional() @IsString() @MinLength(8) password?: string;
}

export interface ProvisionedLogin {
  identifier: string;
  // Only set when the server generated the password; a caller-supplied one is never echoed.
  temporaryPassword: string | null;
}

export interface CreatePrincipalUserInput {
  identifier: string;
  password?: string;
  schoolId: string;
  campusId: string | null;
}

/**
 * The one place a principal login is created — called from SchoolService.create (campusId null →
 * school-wide admin) and CampusService.create (campusId set → campus principal), inside the
 * caller's own transaction so a duplicate identifier rolls the School/Campus back too.
 */
export async function createPrincipalUser(
  tx: Prisma.TransactionClient,
  input: CreatePrincipalUserInput,
): Promise<ProvisionedLogin> {
  const generated = input.password ? null : randomBytes(12).toString('base64url');
  const password = input.password ?? (generated as string);
  const passwordHash = await argon2.hash(password);
  try {
    await tx.user.create({
      data: {
        identifier: input.identifier.trim(),
        passwordHash,
        role: 'SCHOOL_ADMIN',
        isPrincipal: true,
        mustChangePassword: true,
        schoolId: input.schoolId,
        campusId: input.campusId,
      },
    });
  } catch (error) {
    assertCreatable(error, 'This login identifier is already in use.');
  }
  return { identifier: input.identifier.trim(), temporaryPassword: generated };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/common/create-principal-user.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common
git commit -m "feat(provisioning): add createPrincipalUser helper"
```

---

### Task 11: School creation provisions a school-wide admin

**Files:**
- Modify: `backend/src/school/dto/create-school.dto.ts`, `backend/src/school/school.service.ts` (`create`), `backend/src/school/school.service.spec.ts`

**Interfaces:**
- Consumes: `createPrincipalUser`, `LoginProvisionDto`, `ProvisionedLogin` (Task 10).
- Produces: `SchoolService.create(dto, actingUserId): Promise<SchoolSummary & { provisionedLogin?: ProvisionedLogin }>`; `CreateSchoolDto.admin?: LoginProvisionDto`.

- [ ] **Step 1: Write failing tests** in `school.service.spec.ts` (extend the `prisma.$transaction` mock the spec already uses so `tx` exposes `user.create`):

```ts
  it('creates a school-wide admin login in the same transaction and returns the generated password once', async () => {
    // tx.school.create → { id: 'sch1', … }; tx.user.create → { id: 'u1' }
    const result = await service.create({ name: 'Alpha', admin: { identifier: 'admin@alpha.test' } }, 'super-1');

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schoolId: 'sch1', campusId: null, isPrincipal: true, role: 'SCHOOL_ADMIN' }),
      }),
    );
    expect(result.provisionedLogin?.identifier).toBe('admin@alpha.test');
    expect(result.provisionedLogin?.temporaryPassword).toEqual(expect.any(String));
  });

  it('does not put the login block or any password in the school row or the audit metadata', async () => {
    await service.create({ name: 'Alpha', admin: { identifier: 'a@x.test', password: 'Sup3rSecret!' } }, 'super-1');

    expect(tx.school.create.mock.calls[0][0].data).not.toHaveProperty('admin');
    for (const call of tx.auditLog.create.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain('Sup3rSecret!');
    }
  });

  it('creates no user when no admin block is given (existing behaviour)', async () => {
    const result = await service.create({ name: 'Alpha' }, 'super-1');
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(result.provisionedLogin).toBeUndefined();
  });
```
Adapt `tx` to however the spec already builds its transaction client (read the existing `create` tests first; add a `user: { create: jest.fn().mockResolvedValue({ id: 'u1' }) }` member).

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/school`
Expected: FAIL.

- [ ] **Step 3: Implement.** `create-school.dto.ts` — add imports `ValidateNested` from `class-validator`, `Type` from `class-transformer`, `LoginProvisionDto` from `../../common/create-principal-user`, and the field:
```ts
  @IsOptional() @ValidateNested() @Type(() => LoginProvisionDto) admin?: LoginProvisionDto;
```
`school.service.ts` `create`: destructure first so `admin` never reaches Prisma or the audit log:
```ts
  async create(
    dto: CreateSchoolDto,
    actingUserId: string,
  ): Promise<SchoolSummary & { provisionedLogin?: ProvisionedLogin }> {
    const { admin, ...schoolData } = dto;
    let provisionedLogin: ProvisionedLogin | undefined;
    const record = await this.prisma.$transaction(async (tx) => {
      …existing school create, using `...schoolData` instead of `...dto`…
      await tx.auditLog.create({ data: { …, metadata: JSON.stringify(schoolData) } });
      if (admin) {
        provisionedLogin = await createPrincipalUser(tx, {
          identifier: admin.identifier,
          password: admin.password,
          schoolId: created.id,
          campusId: null,
        });
        await tx.auditLog.create({
          data: {
            userId: actingUserId,
            action: 'user.create',
            entity: 'User',
            entityId: created.id,
            metadata: JSON.stringify({ identifier: provisionedLogin.identifier, role: 'SCHOOL_ADMIN', schoolId: created.id }),
          },
        });
      }
      return created;
    });
    const summary = await this.withStats(record);
    return provisionedLogin ? { ...summary, provisionedLogin } : summary;
  }
```
Import `createPrincipalUser`, `type ProvisionedLogin` from `../common/create-principal-user`.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/school && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/school backend/src/common
git commit -m "feat(school): provision a school admin login at school creation"
```

---

### Task 12: Campus creation provisions a campus principal

**Files:**
- Modify: `backend/src/campus/dto/create-campus.dto.ts`, `backend/src/campus/campus.service.ts` (`create`), `backend/src/campus/campus.service.spec.ts`

**Interfaces:**
- Produces: `CreateCampusDto.principal?: LoginProvisionDto`; `CampusService.create` returns `CampusSummary & { provisionedLogin?: ProvisionedLogin }`.

- [ ] **Step 1: Write failing tests** (same `tx` conventions as Task 11):

```ts
  it('creates a campus principal login scoped to the new campus, in the same transaction', async () => {
    const result = await service.create(
      { schoolId: 's1', name: 'North', principal: { identifier: 'north@alpha.test' } },
      'super-1',
    );

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schoolId: 's1', campusId: 'camp1', isPrincipal: true, role: 'SCHOOL_ADMIN' }),
      }),
    );
    expect(result.provisionedLogin?.identifier).toBe('north@alpha.test');
  });

  it('does not put the principal block or a password in the campus row or audit metadata', async () => {
    await service.create(
      { schoolId: 's1', name: 'North', principal: { identifier: 'n@x.test', password: 'Sup3rSecret!' } },
      'super-1',
    );
    expect(tx.campus.create.mock.calls[0][0].data).not.toHaveProperty('principal');
    for (const call of tx.auditLog.create.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain('Sup3rSecret!');
    }
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/campus`
Expected: FAIL.

- [ ] **Step 3: Implement.** `create-campus.dto.ts`: add `ValidateNested`, `Type`, `LoginProvisionDto` imports and `@IsOptional() @ValidateNested() @Type(() => LoginProvisionDto) principal?: LoginProvisionDto;`. `campus.service.ts` `create`: `const { principal, ...campusData } = dto;` use `campusData` in place of `dto` for the create `data` spread and audit `metadata`; after the campus audit log inside the transaction:
```ts
      if (principal) {
        provisionedLogin = await createPrincipalUser(tx, {
          identifier: principal.identifier,
          password: principal.password,
          schoolId: created.schoolId,
          campusId: created.id,
        });
        await tx.auditLog.create({
          data: {
            userId: actingUserId,
            action: 'user.create',
            entity: 'User',
            entityId: created.id,
            metadata: JSON.stringify({ identifier: provisionedLogin.identifier, role: 'SCHOOL_ADMIN', campusId: created.id }),
          },
        });
      }
```
declare `let provisionedLogin: ProvisionedLogin | undefined;` before the transaction and return `{ ...(await this.toSummary(record)), ...(provisionedLogin ? { provisionedLogin } : {}) }`. Update the return type accordingly.

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/campus && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/campus
git commit -m "feat(campus): provision a campus principal login at campus creation"
```

---

### Task 13: `mustChangePassword` on login + authenticated change-password

**Files:**
- Create: `backend/src/auth/dto/change-password.dto.ts`
- Modify: `backend/src/auth/auth.service.ts`, `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.spec.ts`, `backend/test/auth.e2e-spec.ts`

**Interfaces:**
- Produces: `SessionResult.mustChangePassword: boolean`; `AuthService.changePassword(userId: string, currentPassword: string, newPassword: string): Promise<SessionResult>`; `POST /api/v1/auth/change-password` (authenticated, any role) body `{ currentPassword, newPassword }` → a fresh `SessionResult`.

- [ ] **Step 1: Write failing tests** in `auth.service.spec.ts` (follow the file's existing mock/`argon2` conventions):

```ts
  it('reports mustChangePassword on login', async () => {
    // user mock: { …, mustChangePassword: true, isPrincipal: true }
    const session = await service.login('head@school.test', 'Temp1234!x');
    expect(session.mustChangePassword).toBe(true);
  });

  it('changePassword rejects a wrong current password', async () => {
    // user.findUnique → user whose hash is for 'Right1234!'
    await expect(service.changePassword('u1', 'Wrong1234!', 'NewPass123!')).rejects.toThrow(UnauthorizedException);
  });

  it('changePassword rejects reusing the current password', async () => {
    await expect(service.changePassword('u1', 'Right1234!', 'Right1234!')).rejects.toThrow(BadRequestException);
  });

  it('changePassword stores a new hash, clears mustChangePassword, revokes refresh tokens and returns a fresh session', async () => {
    const session = await service.changePassword('u1', 'Right1234!', 'NewPass123!');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ mustChangePassword: false }) }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(session.mustChangePassword).toBe(false);
  });
```
Also update every existing expected session object in `auth.service.spec.ts` / `test/auth.e2e-spec.ts` to include `mustChangePassword: false`.

- [ ] **Step 2: Run to verify failure**

Run: `npx jest src/auth`
Expected: FAIL.

- [ ] **Step 3: Implement.** `change-password.dto.ts`:
```ts
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString() @MinLength(1) currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}
```
`auth.service.ts`: add `mustChangePassword: boolean` to `SessionResult`; `issueSession(userId, role, isPrincipal, mustChangePassword)` returns it; both callers (`login`, `refresh`) pass `user.mustChangePassword`; add:
```ts
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await argon2.verify(user.passwordHash, currentPassword))) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must differ from the current password.');
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return this.issueSession(user.id, user.role, user.isPrincipal, false);
  }
```
`auth.controller.ts` (no `@Public()`, so the global JWT guard applies):
```ts
  @Post('change-password')
  async changePassword(@Req() req: { user: { id: string } }, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }
```
(import `Req` and `ChangePasswordDto`).

- [ ] **Step 4: Run to verify pass**

Run: `npx jest src/auth && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat(auth): mustChangePassword flag and authenticated change-password"
```

---

### Task 14: Console — forced password change

**Files:**
- Create: `staff-console/src/views/ChangePasswordView.vue`, `staff-console/src/views/ChangePasswordView.spec.ts`
- Modify: `staff-console/src/lib/api.ts` (`LoginResponse`, new `changePassword`), `staff-console/src/stores/auth.ts`, `staff-console/src/router/index.ts`

**Interfaces:**
- Consumes: `POST /auth/change-password` (Task 13).
- Produces: `LoginResponse.mustChangePassword: boolean`; `api.changePassword(accessToken, { currentPassword, newPassword }): Promise<LoginResponse>`; store state `mustChangePassword`; route `/change-password` (name `change-password`, `meta: { requiresAuth… }` — no role restriction).

- [ ] **Step 1: Write failing tests.** `stores/auth.spec.ts`: add a case that logging in with `mustChangePassword: true` sets `auth.mustChangePassword === true` and persists it; and that `applySession` after a change-password response clears it. Add router test (or extend the existing router spec if one exists) asserting that an authenticated user with `mustChangePassword` navigating to `/admin/...` is redirected to `/change-password`. `ChangePasswordView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ChangePasswordView from './ChangePasswordView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

const push = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));
vi.mock('../lib/api', () => ({ api: { changePassword: vi.fn() } }));

describe('ChangePasswordView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().accessToken = 'tok';
    push.mockReset();
    vi.mocked(api.changePassword).mockReset();
  });

  it('blocks submit when the new password is shorter than 8 characters or the confirmation differs', async () => {
    const wrapper = mount(ChangePasswordView);
    await wrapper.find('[data-testid="current-password"]').setValue('Temp1234!x');
    await wrapper.find('[data-testid="new-password"]').setValue('short');
    await wrapper.find('[data-testid="confirm-password"]').setValue('short');
    await wrapper.find('form').trigger('submit');
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('changes the password, stores the fresh session and goes home', async () => {
    vi.mocked(api.changePassword).mockResolvedValue({
      accessToken: 'a2', refreshToken: 'r2', role: 'SCHOOL_ADMIN', isPrincipal: true, mustChangePassword: false,
    });
    const wrapper = mount(ChangePasswordView);
    await wrapper.find('[data-testid="current-password"]').setValue('Temp1234!x');
    await wrapper.find('[data-testid="new-password"]').setValue('BrandNew123!');
    await wrapper.find('[data-testid="confirm-password"]').setValue('BrandNew123!');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.changePassword).toHaveBeenCalledWith('tok', { currentPassword: 'Temp1234!x', newPassword: 'BrandNew123!' });
    expect(useAuthStore().mustChangePassword).toBe(false);
    expect(push).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/stores src/views/ChangePasswordView.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.**
- `api.ts`: add `mustChangePassword: boolean` to `LoginResponse`; add
```ts
  async changePassword(
    accessToken: string,
    payload: { currentPassword: string; newPassword: string },
  ): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson<LoginResponse>(res);
  },
```
- `stores/auth.ts`: add `mustChangePassword: boolean` to `PersistedSession`, to state (`persisted?.mustChangePassword ?? false`), and set it in `login`, `_doRefresh`, `logout` (false). Add an action `applySession(session: LoginResponse)` that sets all fields and persists (use it from `login`/`_doRefresh` to remove duplication).
- `ChangePasswordView.vue`: a form with three password inputs (`data-testid` `current-password`, `new-password`, `confirm-password`), client-side check `newPassword.length >= 8 && newPassword === confirm`, submit calls `api.changePassword`, then `auth.applySession(result)` and `router.push(homeRouteForRole(auth.role))` (import `homeRouteForRole` from wherever `LoginView.vue` imports it). Follow `ForgotPasswordView.vue` for layout/labels/i18n conventions; show `errorMessage` in a `role="alert"` paragraph.
- `router/index.ts`: add the route `{ path: '/change-password', name: 'change-password', component: () => import('../views/ChangePasswordView.vue'), meta: { title: 'Change password' } }`, and in the existing `beforeEach` guard, after the authenticated check, add `if (auth.mustChangePassword && to.name !== 'change-password') return { name: 'change-password' };`. Read the existing guard first and place this so unauthenticated users are still sent to login.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run && npx vue-tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src
git commit -m "feat(console): force a password change for provisioned logins"
```

---

### Task 15: Console — create-login section and one-time credentials panel

**Files:**
- Create: `staff-console/src/components/ProvisionLoginFields.vue`, `staff-console/src/components/CredentialsPanel.vue` (+ a spec each)
- Modify: `staff-console/src/lib/api.ts` (`createSchool`, `createCampus`), `staff-console/src/views/SchoolProfileView.vue`, `staff-console/src/views/CampusProfileView.vue` (+ their specs `OrgProfileEdit.spec.ts` / `OrgProfileViews.spec.ts`)

**Interfaces:**
- Consumes: `POST /schools` `admin` block and `POST /campuses` `principal` block; response `provisionedLogin`.
- Produces: `api.createSchool(token, payload & { admin?: { identifier: string; password?: string } }): Promise<{ provisionedLogin?: ProvisionedLogin }>`; `api.createCampus(...)` likewise with `principal`; exported type `ProvisionedLogin { identifier: string; temporaryPassword: string | null }`.

- [ ] **Step 1: Write failing tests.**

`ProvisionLoginFields.spec.ts`: mounting with `v-model` bound to `{ enabled: false, identifier: '', password: '' }` shows only the "Create a login for this principal" checkbox; ticking it reveals an identifier input (`data-testid="login-identifier"`) and an optional password input (`data-testid="login-password"`, placeholder "Leave blank to generate one"), and emits `update:modelValue` on each change.

`CredentialsPanel.spec.ts`: given `{ identifier: 'a@b.test', temporaryPassword: 'abc123' }` it renders both, a copy button (`data-testid="copy-credentials"`) and the text "shown only once"; given `temporaryPassword: null` it renders the identifier and says the password is the one you entered; emits `done` when "Done" is clicked.

In `OrgProfileEdit.spec.ts`: creating a school with the login block ticked calls `api.createSchool` with `admin: { identifier: 'a@x.test' }` (password omitted when blank), and when the response carries `provisionedLogin` the credentials panel is shown and navigation to `/admin/schools` happens only after "Done". Same for campus with `principal`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components src/views/OrgProfileEdit.spec.ts src/views/OrgProfileViews.spec.ts`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement.**
- `api.ts`: export `interface ProvisionedLogin { identifier: string; temporaryPassword: string | null }`; add the optional `admin` / `principal` field to the two payload types and change both return types to `Promise<{ provisionedLogin?: ProvisionedLogin }>`, returning `(await res.json()) as { provisionedLogin?: ProvisionedLogin }` instead of `void`.
- `ProvisionLoginFields.vue`: props `modelValue: { enabled: boolean; identifier: string; password: string }`, `label: string`; emits `update:modelValue`. Checkbox + two `FormField`s (reuse `components/FormField.vue`, type `text` and `password`), identifier hint "Email the principal will sign in with".
- `CredentialsPanel.vue`: props `login: ProvisionedLogin`; copies `"<identifier> / <temporaryPassword>"` via `navigator.clipboard.writeText` (wrap in try/catch, toast on failure using `useToast`); shows the warning "These credentials are shown only once. The principal must change the password at first login."; emits `done`.
- `SchoolProfileView.vue` (create branch of `onSave`, ~L137): add `const provision = reactive({ enabled: false, identifier: '', password: '' });` and `const issuedLogin = ref<ProvisionedLogin | null>(null);`. In create mode, render `<ProvisionLoginFields v-model="provision" label="School admin login" />` as the last field group before the action buttons (view the template first; use the same `v-if="isNew"` convention the Campus view uses at ~L240). In `onSave` create branch:
```ts
      const created = await api.createSchool(auth.accessToken, {
        ...buildPayload(),
        ...(provision.enabled && provision.identifier.trim()
          ? { admin: { identifier: provision.identifier.trim(), ...(provision.password ? { password: provision.password } : {}) } }
          : {}),
      });
      toast.success('School added.');
      if (created.provisionedLogin) {
        issuedLogin.value = created.provisionedLogin;
      } else {
        router.push('/admin/schools');
      }
```
and render `<CredentialsPanel v-if="issuedLogin" :login="issuedLogin" @done="router.push('/admin/schools')" />`.
- `CampusProfileView.vue` (~L145): identical, using the `principal` key, label "Campus principal login", and `router.push('/admin/campuses')`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run && npx vue-tsc --noEmit -p tsconfig.app.json && npm run lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add staff-console/src
git commit -m "feat(console): create principal logins from the school and campus forms"
```

---

### Task 16: Console — let principals reach Classes, Sections and Campuses

**Files:** Modify `staff-console/src/router/index.ts` (routes for Campuses `~L106`, Add Campus `~L112`, Campus Profile `~L118`, Classes `~L130`, Sections `~L136`), `staff-console/src/components/AppShell.vue:77`, plus the corresponding specs.

**Interfaces:** Consumes Task 9 backend permissions. Produces `canManageOrgStructure` true for `SCHOOL_ADMIN` (but School/Academic-session entries stay `SUPER_ADMIN`-only).

- [ ] **Step 1: Write failing tests.** In the router spec (or `AppShell` spec) assert that a `SCHOOL_ADMIN` can resolve `/admin/campuses`, `/admin/classes`, `/admin/sections` and that the nav shows Classes and Sections but not Schools or Academic Sessions; that a `SCHOOL_ADMIN` cannot open `/admin/schools` or `/admin/academic-sessions`. For a campus principal (need a `campusId` on the session) the "Add Campus" entry must not be shown — see Step 3.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/router src/components`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `router/index.ts` change `requiresRole: ['SUPER_ADMIN']` to `['SCHOOL_ADMIN', 'SUPER_ADMIN']` for Campuses, Campus Profile, Classes and Sections only (leave Schools, School Profile, Add School, Academic Sessions, Add Campus as they are, except Add Campus which becomes `['SCHOOL_ADMIN', 'SUPER_ADMIN']`). Campus principals must not see "Add Campus": add `campusId: string | null` to the login response (backend `SessionResult` gains `campusId` — extend `issueSession` and `AuthService.login/refresh` in the same way as `mustChangePassword`, and update Task 13's expected session objects), persist it in the auth store as `campusId`, and in `AppShell.vue` add `const canCreateCampus = computed(() => auth.role === 'SUPER_ADMIN' || (auth.role === 'SCHOOL_ADMIN' && !auth.campusId));` gating the Add-Campus button/nav entry; change line 77 to `const canManageOrgStructure = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');` and gate the Schools and Academic Sessions entries on `auth.role === 'SUPER_ADMIN'` individually (read how `canManageOrgStructure` is used in the template and split accordingly).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run && npx vue-tsc --noEmit -p tsconfig.app.json && npm run lint; cd ../backend && npx jest src/auth`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/auth staff-console/src
git commit -m "feat(console): expose class/section/campus screens to scoped school admins"
```

---

### Task 17: End-to-end provisioning and scoping test

**Files:** Create `backend/test/org-provisioning.e2e-spec.ts` (copy the boot/cleanup skeleton from `test/admissions.e2e-spec.ts`; use the identifier prefix `prov-` and school name `PROV E2E School` for stale-row cleanup, deleting users, campuses and schools created by prior runs in dependency order).

- [ ] **Step 1: Write the test** covering, in order, with a `SUPER_ADMIN` token from the seed:
1. `POST /api/v1/schools` `{ name: 'PROV E2E School', admin: { identifier: 'prov-admin@x.test' } }` → 201, `provisionedLogin.temporaryPassword` is a string.
2. Log in as `prov-admin@x.test` with that password → `mustChangePassword: true`, `isPrincipal: true`.
3. `POST /api/v1/auth/change-password` with the temp password and a new one → 201, fresh session with `mustChangePassword: false`; old temp password no longer logs in.
4. As the school admin: `POST /api/v1/campuses` `{ schoolId, name: 'North', principal: { identifier: 'prov-north@x.test', password: 'NorthPass123!' } }` → 201, `provisionedLogin.temporaryPassword === null`; a second campus `South` with `principal: { identifier: 'prov-south@x.test', password: 'SouthPass123!' }`.
5. As the school admin: `POST /api/v1/campuses` with a different school's id → 403.
6. Log in as `prov-north@x.test`; `GET /api/v1/campuses` returns exactly `[North]`.
7. As the North principal: `POST /api/v1/campuses` → 403; `POST /api/v1/classes` for the South campus → 403; `POST /api/v1/classes` for the North campus (use any existing academic session id from `GET /api/v1/academic-sessions`) → 201; `POST /api/v1/sections` under that class → 201; `GET /api/v1/classes` and `GET /api/v1/sections` return only North rows.
8. Create teachers via `POST /api/v1/admin/teachers` in North and South (as `SUPER_ADMIN`); as the North principal `GET /api/v1/teachers?campusId=<south>` returns `[]`, `GET /api/v1/teachers` returns only the North teacher, and `POST /api/v1/sections` with the South teacher as `classTeacherId` → 400.
9. Duplicate identifier: `POST /api/v1/schools` with `admin.identifier = 'prov-admin@x.test'` → 400 and no `School` row with that new name exists afterwards (rollback).

- [ ] **Step 2: Run to verify it fails, then passes**

Run: `npx jest --config ./test/jest-e2e.json test/org-provisioning.e2e-spec.ts`
Expected: it passes if Tasks 1–16 are correct; any failure is a real defect in those tasks — fix the cause there, not in the test.

- [ ] **Step 3: Run the full backend and console suites**

Run: `npx jest && npm run test:e2e` (backend); `npx vitest run && npx vue-tsc --noEmit -p tsconfig.app.json && npm run lint && npm run build` (console)
Expected: all PASS. Pay attention to `cross-tenant-boundary.e2e-spec.ts` and `sections-access.e2e-spec.ts` — they exercise the code paths Tasks 6–9 changed.

- [ ] **Step 4: Commit**

```bash
git add backend/test
git commit -m "test(e2e): school/campus provisioning and campus-scoped principals"
```

---

### Task 18: Docs

**Files:** Modify `build/PROJECT-STATUS.md` (new dated entry under the Production-Ready phase), `build/README.md` if it documents roles.

- [ ] **Step 1:** Add an entry to `PROJECT-STATUS.md` recording: teacher/section campus fix, `User.campusId` + `mustChangePassword`, `OrgScopeService` as the single scoping mechanism, principal provisioning at School/Campus creation, and the widened `SCHOOL_ADMIN` permissions. State the real verification results from Task 17 Step 3 — paste the actual pass counts, do not paraphrase from memory.
- [ ] **Step 2: Commit**

```bash
git add build/PROJECT-STATUS.md
git commit -m "docs: record org provisioning and campus scoping"
```

---

## Self-Review (spec coverage)

| Spec requirement | Task |
|---|---|
| Piece A: teacher `campusId` filter; section campus validation; console dropdown | 1, 2, 3 |
| `User.campusId`, `mustChangePassword` migration | 4 |
| Shared scope helper; enumerate every `schoolId` site | 5–8 (Task 6 Step 5 and Task 8 Step 4 grep for leftovers) |
| School creation → school-wide admin, generated password once, not in audit | 10, 11 |
| Campus creation → campus principal; campus principal cannot create campuses | 9, 12 |
| Principal write access (found while planning) | 9, 16 |
| Duplicate identifier rolls back; login block optional | 10, 11, 12, 17 |
| Change-password + forced redirect | 13, 14 |
| Console create-login UI + one-time credentials panel | 15 |
| Tests: rollback, password-once, invariant, scoping, e2e | 10–12, 6–8, 17 |
| Invariant `campusId ⇒ matching schoolId` | Enforced structurally: `createPrincipalUser` is only called with `created.schoolId` / `created.id` from the same campus row (Task 12). No path accepts a client-supplied `campusId` for a user. |

**Deviations from the spec, all deliberate:** duplicate identifier returns 400 (existing `assertCreatable` convention) rather than 409; the session also carries `campusId` so the console can hide "Add Campus" from campus principals (Task 16).

**Known risk:** Tasks 6–8 touch ~20 files and rely on existing specs mocking `prisma.user.findUnique`. The real `OrgScopeService` is provided in each spec so those mocks keep working; expect a mechanical round of `providers` fixes.
