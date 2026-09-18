# Sprint O — Admissions/Enrollment Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a staff-entered admissions pipeline (`Applicant` → `Application` →
review → approve/reject) whose approval action transactionally creates a real `Student` +
`Enrollment` (+ `ParentProfile`/`User` if needed), reusing the exact same creation logic
`StudentService.create()` already uses rather than a second parallel path.

**Architecture:** One new `AdmissionsModule` (`backend/src/admissions/`) with two sub-resources
(`Applicant`, `Application`). Before building it, extract `StudentService.create()`'s
student+enrollment(+parent) transaction body into a standalone shared function,
`createStudentWithEnrollment`, so both the existing single-create endpoint and the new admissions
approval endpoint call one creation path, not two. No public/unauthenticated intake surface — every
route is staff-only (`SCHOOL_ADMIN`/`ACCOUNTS`/`SUPER_ADMIN`).

**Tech Stack:** NestJS + Prisma + Postgres (backend); Vue 3 + `@vue/test-utils`/`vitest`
(staff-console).

**Spec:** `build/docs/superpowers/specs/2026-09-13-sprint-o-admissions-design.md`

## Global Constraints

- Staff-entered only — no public application form, no new prospective-parent account type.
- EMI-style fee installments are explicitly out of scope for this sprint.
- Approval is transactional and atomic: either a real `Student`+`Enrollment`(+`ParentProfile`/`User`)
  is created and the `Application` flips to `APPROVED`, or nothing happens.
- `PATCH /applications/:id` never accepts `status: APPROVED`/`REJECTED` directly — those go through
  their own dedicated endpoints only.
- No `TEACHER` or `PARENT` access to any admissions route.

---

### Task 1: Prisma schema — `Applicant`, `Application`

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: a new migration under `backend/prisma/migrations/`

**Interfaces:**
- Produces: the two new models below, plus back-relation fields on `Class`, `AcademicSession`,
  `User`, `Student` — every later task depends on these existing exactly as specified.

- [ ] **Step 1: Add the new models**

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
  status            String          @default("SUBMITTED")
  decisionNotes     String?
  reviewedById      String?
  reviewedBy        User?           @relation(fields: [reviewedById], references: [id])
  createdStudentId  String?         @unique
  createdStudent    Student?        @relation(fields: [createdStudentId], references: [id])
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@index([applicantId])
  @@index([academicSessionId, status])
}
```

Add back-relation fields to the existing models (no other changes):
- `Class`: `applications Application[]`
- `AcademicSession`: `applications Application[]`
- `User`: `reviewedApplications Application[]`
- `Student`: `application Application?`

- [ ] **Step 2: Generate and run the migration**

Run: `cd backend && npx prisma migrate dev --name add-admissions`
Expected: migration applies cleanly, Prisma client regenerates with the two new models.

- [ ] **Step 3: Verify the existing suite still passes**

Run: `cd backend && npm test`
Expected: all green (additive schema change only).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(admissions): add Applicant/Application models"
```

---

### Task 2: Extract `createStudentWithEnrollment` from `StudentService.create()`

**Files:**
- Create: `backend/src/student/create-student-with-enrollment.ts`
- Modify: `backend/src/student/student.service.ts`
- Reference (no changes): `backend/src/student/student.service.spec.ts`,
  `backend/test/people-crud.e2e-spec.ts`

**Interfaces:**
- Consumes: `createParentWithUser` (existing, `backend/src/parent/create-parent-with-user.ts`).
- Produces: `createStudentWithEnrollment(tx: Prisma.TransactionClient, input: {grNumber, name,
  sectionId, parentProfileId?, newParent?}, actingUserId: string): Promise<{studentId: string}>` —
  Task 6 (`AdmissionsService.approve`) calls this exact function, inside its own
  `prisma.$transaction`, the same way `StudentService.create()` does after this refactor.

This is a pure refactor — no behavior change. The TDD cycle here is: confirm the existing tests
pass before touching anything, refactor, confirm they still pass unchanged.

- [ ] **Step 1: Run the existing tests to confirm the starting baseline is green**

Run: `cd backend && npx jest src/student/student.service.spec.ts`
Run: `cd backend && npx jest --config test/jest-e2e.json people-crud.e2e-spec.ts`
Expected: both PASS before any change.

- [ ] **Step 2: Write `create-student-with-enrollment.ts`**

Move the transaction body of `StudentService.create()` (`student.service.ts:75-123` — the
`this.prisma.$transaction(async (tx) => {...})` callback, plus the active-session/section lookups
that precede it) into this new file almost verbatim:

```ts
// backend/src/student/create-student-with-enrollment.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createParentWithUser, type CreateParentInput } from '../parent/create-parent-with-user';

export interface CreateStudentWithEnrollmentInput {
  grNumber: string;
  name: string;
  sectionId: string;
  parentProfileId?: string;
  newParent?: CreateParentInput;
}

/**
 * The one place a Student + Enrollment (+ ParentProfile/User, if a new parent is supplied) are
 * created together — called from StudentService.create() (its own transaction) and from
 * AdmissionsService.approve() (its own transaction), so there is exactly one student-creation
 * code path, not two. Takes a Prisma transaction client, not PrismaService, so the caller controls
 * the transaction boundary — same shape as createParentWithUser.
 */
export async function createStudentWithEnrollment(
  tx: Prisma.TransactionClient,
  input: CreateStudentWithEnrollmentInput,
  actingUserId: string,
): Promise<{ studentId: string }> {
  const hasExisting = input.parentProfileId != null;
  const hasNew = input.newParent != null;
  if (hasExisting === hasNew) {
    throw new BadRequestException('Provide exactly one of parentProfileId or newParent');
  }

  const activeSession = await tx.academicSession.findFirst({ where: { isActive: true } });
  if (!activeSession) {
    throw new BadRequestException('No active academic session — cannot enroll a student');
  }
  const section = await tx.section.findUnique({
    where: { id: input.sectionId },
    select: { id: true, class: { select: { campusId: true } } },
  });
  if (!section) {
    throw new NotFoundException('Section not found');
  }

  const student = await tx.student.create({ data: { grNumber: input.grNumber, name: input.name } });
  await tx.enrollment.create({
    data: {
      studentId: student.id,
      campusId: section.class.campusId,
      sectionId: section.id,
      academicSessionId: activeSession.id,
      startDate: new Date(),
      status: 'ACTIVE',
    },
  });

  let parentProfileId: string;
  if (hasExisting) {
    const parent = await tx.parentProfile.findUnique({ where: { id: input.parentProfileId! } });
    if (!parent) {
      throw new BadRequestException('Parent not found');
    }
    parentProfileId = parent.id;
  } else {
    const newParent = await createParentWithUser(tx, input.newParent!);
    parentProfileId = newParent.id;
    await tx.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'parent.create',
        entity: 'ParentProfile',
        entityId: newParent.id,
        metadata: JSON.stringify({ identifier: input.newParent!.identifier, name: input.newParent!.name }),
      },
    });
  }
  await tx.studentParent.create({ data: { studentId: student.id, parentProfileId } });
  await tx.auditLog.create({
    data: {
      userId: actingUserId,
      action: 'student.create',
      entity: 'Student',
      entityId: student.id,
      metadata: JSON.stringify({ grNumber: input.grNumber, name: input.name, sectionId: input.sectionId }),
    },
  });

  return { studentId: student.id };
}
```

- [ ] **Step 3: Refactor `StudentService.create()` to call it**

```ts
async create(dto: CreateStudentDto, actingUserId: string): Promise<StudentAdminSummary> {
  let studentId: string;
  try {
    ({ studentId } = await this.prisma.$transaction((tx) =>
      createStudentWithEnrollment(
        tx,
        {
          grNumber: dto.grNumber,
          name: dto.name,
          sectionId: dto.sectionId,
          parentProfileId: dto.parentProfileId,
          newParent: dto.newParent,
        },
        actingUserId,
      ),
    ));
  } catch (error) {
    assertCreatable(error, 'This GR number or parent identifier is already in use.');
  }

  const created = await this.prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: WITH_SECTION_AND_PARENTS,
  });
  return this.toSummary(created);
}
```
Add `import { createStudentWithEnrollment } from './create-student-with-enrollment';` to
`student.service.ts`'s imports, and remove the now-unused inline transaction body (and the
`hasExisting`/`hasNew` local checks that moved into the extracted function).

- [ ] **Step 4: Run the tests again to confirm nothing regressed**

Run: `cd backend && npx jest src/student/student.service.spec.ts`
Run: `cd backend && npx jest --config test/jest-e2e.json people-crud.e2e-spec.ts`
Expected: both still PASS, unchanged — this step is the whole point of doing this as its own task
before any new admissions code exists.

- [ ] **Step 5: Commit**

```bash
git add backend/src/student
git commit -m "refactor(student): extract createStudentWithEnrollment for reuse by admissions approval"
```

---

### Task 3: `Applicant` create/list (with duplicate hint)

**Files:**
- Create: `backend/src/admissions/admissions.module.ts`
- Create: `backend/src/admissions/dto/create-applicant.dto.ts`
- Create: `backend/src/admissions/applicants.service.ts`, `backend/src/admissions/applicants.controller.ts`
- Create: `backend/test/admissions.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `ApplicantsService.create/findByPhone`, `POST/GET /api/v1/applicants` — Task 4
  (`ApplicationsService`) reads `Applicant` rows created here by `applicantId`.

- [ ] **Step 1: Write the DTO**

```ts
// backend/src/admissions/dto/create-applicant.dto.ts
import { IsDateString, IsString, MinLength } from 'class-validator';

export class CreateApplicantDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsDateString()
  dateOfBirth!: string;

  @IsString()
  @MinLength(1)
  guardianName!: string;

  @IsString()
  @MinLength(1)
  guardianPhone!: string;
}
```

- [ ] **Step 2: Write `applicants.service.ts`**

```ts
// backend/src/admissions/applicants.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';

export interface ApplicantSummary {
  id: string;
  name: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
}

@Injectable()
export class ApplicantsService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    name: string;
    dateOfBirth: Date;
    guardianName: string;
    guardianPhone: string;
  }): ApplicantSummary {
    return {
      id: record.id,
      name: record.name,
      dateOfBirth: record.dateOfBirth.toISOString().slice(0, 10),
      guardianName: record.guardianName,
      guardianPhone: record.guardianPhone,
    };
  }

  async create(dto: CreateApplicantDto): Promise<{ applicant: ApplicantSummary; possibleDuplicate: ApplicantSummary | null }> {
    const existingMatch = await this.prisma.applicant.findFirst({
      where: { name: dto.name, guardianPhone: dto.guardianPhone },
    });
    const record = await this.prisma.applicant.create({
      data: {
        name: dto.name,
        dateOfBirth: new Date(dto.dateOfBirth),
        guardianName: dto.guardianName,
        guardianPhone: dto.guardianPhone,
      },
    });
    return {
      applicant: this.toSummary(record),
      possibleDuplicate: existingMatch ? this.toSummary(existingMatch) : null,
    };
  }

  async findByPhone(guardianPhone: string): Promise<ApplicantSummary[]> {
    const records = await this.prisma.applicant.findMany({
      where: { guardianPhone },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }
}
```

- [ ] **Step 3: Write `applicants.controller.ts`**

```ts
// backend/src/admissions/applicants.controller.ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApplicantsService } from './applicants.service';
import { CreateApplicantDto } from './dto/create-applicant.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/applicants')
@Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
export class ApplicantsController {
  constructor(private readonly applicantsService: ApplicantsService) {}

  @Post()
  create(@Body() dto: CreateApplicantDto) {
    return this.applicantsService.create(dto);
  }

  @Get()
  findByPhone(@Query('guardianPhone') guardianPhone: string) {
    return this.applicantsService.findByPhone(guardianPhone);
  }
}
```

- [ ] **Step 4: Write `admissions.module.ts` and register it**

```ts
// backend/src/admissions/admissions.module.ts
import { Module } from '@nestjs/common';
import { ApplicantsService } from './applicants.service';
import { ApplicantsController } from './applicants.controller';

@Module({
  providers: [ApplicantsService],
  controllers: [ApplicantsController],
})
export class AdmissionsModule {}
```
In `backend/src/app.module.ts`: import and register `AdmissionsModule` near `GradebookModule` (or
after whatever the latest-registered module is by the time this task runs).

- [ ] **Step 5: Write the e2e spec (new file)**

Mirror `backend/test/holidays-complaints-report-cards.e2e-spec.ts`'s seeding shape (school → campus
→ academic session → class → section → a `SCHOOL_ADMIN` login), identifier prefix `adm-`,
school-name/grNumber prefix `ADM-`/`ADM E2E School`. That reference file's seed stores
`ids.school`/`ids.campus`/`ids.session`/`ids.section` but not the class id — add
`ids.class = klass.id` (`klass` is the local variable its seed already creates the `Class` row
into) since Tasks 4-5 in this plan need it. Also seed a `TEACHER` login (`adm-teacher`) the same way
that reference file schoolos its teacher user, for the role-gating test below.

```ts
describe('Applicants', () => {
  it('creates an applicant and flags a same-name-and-phone match as a possible duplicate', async () => {
    const adminToken = await loginAs('adm-admin');
    const res = await request(app.getHttpServer())
      .post('/api/v1/applicants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567' })
      .expect(201);
    ids.applicant1 = res.body.applicant.id;
    expect(res.body.possibleDuplicate).toBeNull();

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/applicants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567' })
      .expect(201);
    expect(res2.body.possibleDuplicate?.id).toBe(ids.applicant1);
  });

  it('a TEACHER or PARENT cannot create an applicant', async () => {
    const teacherToken = await loginAs('adm-teacher');
    await request(app.getHttpServer())
      .post('/api/v1/applicants')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ name: 'Someone', dateOfBirth: '2020-01-01', guardianName: 'Guardian', guardianPhone: '03000000000' })
      .expect(403);
  });
});
```

- [ ] **Step 6: Run the e2e spec**

Run: `cd backend && npx jest --config test/jest-e2e.json admissions.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/admissions backend/src/app.module.ts backend/test/admissions.e2e-spec.ts
git commit -m "feat(admissions): add Applicant create/list with duplicate hint"
```

---

### Task 4: `Application` create/list/patch (status transitions, no direct approve/reject)

**Files:**
- Create: `backend/src/admissions/dto/create-application.dto.ts`, `backend/src/admissions/dto/update-application.dto.ts`
- Create: `backend/src/admissions/applications.service.ts`, `backend/src/admissions/applications.controller.ts`
- Modify: `backend/src/admissions/admissions.module.ts`
- Modify: `backend/test/admissions.e2e-spec.ts`

**Interfaces:**
- Consumes: `Applicant` rows (Task 3).
- Produces: `ApplicationsService.create/findMany/updateStatus`, `POST/GET/PATCH
  /api/v1/applications` — Task 5 (approve/reject) extends this same service with two more methods
  in the same file.

- [ ] **Step 1: Write the DTOs**

```ts
// backend/src/admissions/dto/create-application.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @MinLength(1)
  applicantId!: string;

  @IsString()
  @MinLength(1)
  desiredClassId!: string;

  @IsString()
  @MinLength(1)
  academicSessionId!: string;
}
```

```ts
// backend/src/admissions/dto/update-application.dto.ts
import { IsIn, IsOptional, IsString } from 'class-validator';

export const NON_TERMINAL_STATUSES = ['UNDER_REVIEW', 'WITHDRAWN'] as const;

export class UpdateApplicationDto {
  @IsOptional()
  @IsIn(NON_TERMINAL_STATUSES)
  status?: (typeof NON_TERMINAL_STATUSES)[number];

  @IsOptional()
  @IsString()
  decisionNotes?: string;
}
```

- [ ] **Step 2: Write `applications.service.ts`**

```ts
// backend/src/admissions/applications.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { CreateApplicationDto } from './dto/create-application.dto';

export interface ApplicationSummary {
  id: string;
  applicantId: string;
  applicantName: string;
  desiredClassId: string;
  academicSessionId: string;
  status: string;
  decisionNotes: string | null;
  reviewedById: string | null;
  createdStudentId: string | null;
}

const TERMINAL_STATUSES = ['APPROVED', 'REJECTED'];
const WITH_APPLICANT = { applicant: { select: { name: true } } } as const;

@Injectable()
export class ApplicationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    applicantId: string;
    applicant: { name: string };
    desiredClassId: string;
    academicSessionId: string;
    status: string;
    decisionNotes: string | null;
    reviewedById: string | null;
    createdStudentId: string | null;
  }): ApplicationSummary {
    return {
      id: record.id,
      applicantId: record.applicantId,
      applicantName: record.applicant.name,
      desiredClassId: record.desiredClassId,
      academicSessionId: record.academicSessionId,
      status: record.status,
      decisionNotes: record.decisionNotes,
      reviewedById: record.reviewedById,
      createdStudentId: record.createdStudentId,
    };
  }

  async create(dto: CreateApplicationDto): Promise<ApplicationSummary> {
    const record = await this.prisma.application.create({
      data: {
        applicantId: dto.applicantId,
        desiredClassId: dto.desiredClassId,
        academicSessionId: dto.academicSessionId,
        status: 'SUBMITTED',
      },
      include: WITH_APPLICANT,
    });
    return this.toSummary(record);
  }

  async findMany(academicSessionId?: string, status?: string): Promise<ApplicationSummary[]> {
    const records = await this.prisma.application.findMany({
      where: {
        ...(academicSessionId ? { academicSessionId } : {}),
        ...(status ? { status } : {}),
      },
      include: WITH_APPLICANT,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  private async getOrThrow(id: string) {
    const existing = await this.prisma.application.findUnique({ where: { id }, include: WITH_APPLICANT });
    if (!existing) {
      throw new NotFoundException('Application not found');
    }
    return existing;
  }

  async updateStatus(id: string, dto: UpdateApplicationDto): Promise<ApplicationSummary> {
    const existing = await this.getOrThrow(id);
    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new BadRequestException(`Application is already ${existing.status.toLowerCase()} and cannot be changed`);
    }
    const record = await this.prisma.application.update({
      where: { id },
      include: WITH_APPLICANT,
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.decisionNotes !== undefined ? { decisionNotes: dto.decisionNotes } : {}),
      },
    });
    return this.toSummary(record);
  }
}
```

- [ ] **Step 3: Write `applications.controller.ts`**

```ts
// backend/src/admissions/applications.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/applications')
@Roles('SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  create(@Body() dto: CreateApplicationDto) {
    return this.applicationsService.create(dto);
  }

  @Get()
  list(@Query('academicSessionId') academicSessionId?: string, @Query('status') status?: string) {
    return this.applicationsService.findMany(academicSessionId, status);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateApplicationDto) {
    return this.applicationsService.updateStatus(id, dto);
  }
}
```
The `UpdateApplicationDto`'s `@IsIn(NON_TERMINAL_STATUSES)` decorator means class-validator itself
rejects `status: 'APPROVED'`/`'REJECTED'` on this route with a 400 — no separate check needed in
the service for that specific rule.

- [ ] **Step 4: Register in `admissions.module.ts`**

Add `ApplicationsService` to `providers` and `ApplicationsController` to `controllers`.

- [ ] **Step 5: Add e2e cases**

```ts
describe('Applications', () => {
  it('creates an application and moves it to UNDER_REVIEW', async () => {
    const adminToken = await loginAs('adm-admin');
    const res = await request(app.getHttpServer())
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId: ids.applicant1, desiredClassId: ids.class, academicSessionId: ids.session })
      .expect(201);
    ids.application1 = res.body.id;
    expect(res.body.status).toBe('SUBMITTED');

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/applications/${ids.application1}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);
    expect(updated.body.status).toBe('UNDER_REVIEW');
  });

  it('rejects a direct status: APPROVED write through PATCH', async () => {
    const adminToken = await loginAs('adm-admin');
    await request(app.getHttpServer())
      .patch(`/api/v1/applications/${ids.application1}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'APPROVED' })
      .expect(400);
  });
});
```
(This file's `beforeAll` needs `ids.class` and `ids.session` from its own seed, mirroring Task 3's
seed shape — reuse the same variable names the reference e2e file's seed already establishes.)

- [ ] **Step 6: Run the e2e spec**

Run: `cd backend && npx jest --config test/jest-e2e.json admissions.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/admissions backend/test/admissions.e2e-spec.ts
git commit -m "feat(admissions): add Application create/list/patch with terminal-state guard"
```

---

### Task 5: Approve / Reject endpoints

**Files:**
- Create: `backend/src/admissions/dto/approve-application.dto.ts`
- Modify: `backend/src/admissions/applications.service.ts` (add `approve`/`reject`)
- Modify: `backend/src/admissions/applications.controller.ts` (add the two routes)
- Modify: `backend/test/admissions.e2e-spec.ts`

**Interfaces:**
- Consumes: `createStudentWithEnrollment` (Task 2); `CreateParentInput` type (existing, from
  `create-parent-with-user.ts`).
- Produces: `POST /api/v1/applications/:id/approve`, `POST /api/v1/applications/:id/reject` — no
  later backend task consumes these; Task 7 (Vue) is the frontend consumer.

- [ ] **Step 1: Write the DTO**

```ts
// backend/src/admissions/dto/approve-application.dto.ts
import { IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateParentDto } from '../../parent/dto/create-parent.dto';

export class ApproveApplicationDto {
  @IsString()
  @MinLength(1)
  grNumber!: string;

  @IsString()
  @MinLength(1)
  sectionId!: string;

  @IsOptional()
  @IsString()
  parentProfileId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateParentDto)
  newParent?: CreateParentDto;
}
```

- [ ] **Step 2: Add `approve`/`reject` to `applications.service.ts`**

```ts
async reject(id: string, decisionNotes: string, reviewedById: string): Promise<ApplicationSummary> {
  const existing = await this.getOrThrow(id);
  if (TERMINAL_STATUSES.includes(existing.status)) {
    throw new BadRequestException(`Application is already ${existing.status.toLowerCase()}`);
  }
  const record = await this.prisma.application.update({
    where: { id },
    include: WITH_APPLICANT,
    data: { status: 'REJECTED', decisionNotes, reviewedById },
  });
  return this.toSummary(record);
}

async approve(id: string, dto: ApproveApplicationDto, reviewedById: string): Promise<ApplicationSummary> {
  const existing = await this.getOrThrow(id);
  if (TERMINAL_STATUSES.includes(existing.status)) {
    throw new BadRequestException(`Application is already ${existing.status.toLowerCase()}`);
  }

  const record = await this.prisma.$transaction(async (tx) => {
    const { studentId } = await createStudentWithEnrollment(
      tx,
      {
        grNumber: dto.grNumber,
        name: existing.applicant.name,
        sectionId: dto.sectionId,
        parentProfileId: dto.parentProfileId,
        newParent: dto.newParent,
      },
      reviewedById,
    );
    return tx.application.update({
      where: { id },
      include: WITH_APPLICANT,
      data: { status: 'APPROVED', reviewedById, createdStudentId: studentId },
    });
  });
  return this.toSummary(record);
}
```
Add `import { createStudentWithEnrollment } from '../student/create-student-with-enrollment';` and
`import { ApproveApplicationDto } from './dto/approve-application.dto';` to this file's imports.
Because `createStudentWithEnrollment` throws `BadRequestException`/`NotFoundException` for a
duplicate `grNumber` or a missing section *inside* the `$transaction` callback, Prisma rolls the
whole transaction back automatically — the `Application` row is never updated in that case, so it
stays at whatever status it was before this call (verified in Step 4's e2e case).

- [ ] **Step 3: Add the two routes to `applications.controller.ts`**

```ts
@Post(':id/reject')
reject(@Param('id') id: string, @Body('decisionNotes') decisionNotes: string, @Req() req: AuthenticatedRequest) {
  return this.applicationsService.reject(id, decisionNotes, req.user.id);
}

@Post(':id/approve')
approve(@Param('id') id: string, @Body() dto: ApproveApplicationDto, @Req() req: AuthenticatedRequest) {
  return this.applicationsService.approve(id, dto, req.user.id);
}
```
Add `Req` to the `@nestjs/common` import, `import type { Request } from 'express';`, an
`AuthenticatedRequest extends Request { user: RequestUser }` interface (mirroring every other
controller in this codebase, e.g. `student.controller.ts`), `import type { RequestUser } from
'../common/student-access.service';`, and `import { ApproveApplicationDto } from
'./dto/approve-application.dto';`.

- [ ] **Step 4: Add e2e cases**

```ts
describe('Approve / Reject', () => {
  it('approves an application with a new parent, creating exactly one Student/Enrollment/ParentProfile/User', async () => {
    const adminToken = await loginAs('adm-admin');
    const res = await request(app.getHttpServer())
      .post(`/api/v1/applications/${ids.application1}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        grNumber: 'ADM-STU-1',
        sectionId: ids.section,
        newParent: { identifier: 'adm-newparent', password: 'CorrectHorseBattery9!', name: 'New Parent', phone: '03001112222' },
      })
      .expect(201);
    expect(res.body.status).toBe('APPROVED');
    expect(res.body.createdStudentId).toBeTruthy();

    const student = await prisma.student.findUnique({ where: { grNumber: 'ADM-STU-1' } });
    expect(student).not.toBeNull();
    const enrollment = await prisma.enrollment.findFirst({ where: { studentId: student!.id } });
    expect(enrollment).not.toBeNull();
  });

  it('rolls back the whole transaction on a duplicate grNumber, leaving Application status unchanged', async () => {
    const adminToken = await loginAs('adm-admin');
    const secondApplication = await request(app.getHttpServer())
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId: ids.applicant1, desiredClassId: ids.class, academicSessionId: ids.session })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/applications/${secondApplication.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'UNDER_REVIEW' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/applications/${secondApplication.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ grNumber: 'ADM-STU-1', sectionId: ids.section, parentProfileId: 'not-a-real-parent-id' })
      .expect(400);

    const stillUnderReview = await request(app.getHttpServer())
      .get(`/api/v1/applications?academicSessionId=${ids.session}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const found = stillUnderReview.body.find((a: { id: string }) => a.id === secondApplication.body.id);
    expect(found.status).toBe('UNDER_REVIEW');
  });

  it('rejects an application; a second reject or an approve afterward is rejected', async () => {
    const adminToken = await loginAs('adm-admin');
    const applicantRes = await request(app.getHttpServer())
      .post('/api/v1/applicants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Reject Me', dateOfBirth: '2020-01-01', guardianName: 'G', guardianPhone: '03009998888' })
      .expect(201);
    const applicationRes = await request(app.getHttpServer())
      .post('/api/v1/applications')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ applicantId: applicantRes.body.applicant.id, desiredClassId: ids.class, academicSessionId: ids.session })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/applications/${applicationRes.body.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decisionNotes: 'No seats available' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/applications/${applicationRes.body.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decisionNotes: 'Trying again' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/applications/${applicationRes.body.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ grNumber: 'ADM-STU-2', sectionId: ids.section, parentProfileId: 'irrelevant' })
      .expect(400);
  });
});
```

- [ ] **Step 5: Run the e2e suite**

Run: `cd backend && npx jest --config test/jest-e2e.json admissions.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npm test && npm run test:e2e`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add backend/src/admissions backend/test/admissions.e2e-spec.ts
git commit -m "feat(admissions): add transactional Approve/Reject endpoints"
```

---

### Task 6: `AdmissionsQueueView.vue` + `ApplicantIntakeView.vue` (staff-console)

**Files:**
- Modify: `staff-console/src/lib/api.ts` (add types + methods)
- Create: `staff-console/src/views/AdmissionsQueueView.vue`, `staff-console/src/views/AdmissionsQueueView.spec.ts`
- Create: `staff-console/src/views/ApplicantIntakeView.vue`, `staff-console/src/views/ApplicantIntakeView.spec.ts`
- Create: `staff-console/src/views/AdmissionsQueuePageView.vue`, `staff-console/src/views/ApplicantIntakePageView.vue`
- Modify: `staff-console/src/router/index.ts`, `staff-console/src/components/AppShell.vue`,
  `staff-console/src/locales/en.json`, `staff-console/src/locales/ur.json`

**Interfaces:**
- Consumes: `api.listAcademicSessions`, `api.listClasses` (existing).
- Produces: `api.createApplicant/listApplicants/createApplication/listApplications` — Task 7's
  `ApplicationDetailView.vue` calls `api.listApplications`'s single-item shape indirectly (it
  receives one application via route param and re-fetches via the same list-shaped data or a
  dedicated lookup — see Task 7).

- [ ] **Step 1: Add API types and methods to `staff-console/src/lib/api.ts`**

```ts
export interface ApplicantSummary {
  id: string;
  name: string;
  dateOfBirth: string;
  guardianName: string;
  guardianPhone: string;
}

export interface ApplicationSummary {
  id: string;
  applicantId: string;
  applicantName: string;
  desiredClassId: string;
  academicSessionId: string;
  status: string;
  decisionNotes: string | null;
  reviewedById: string | null;
  createdStudentId: string | null;
}
```
Add `createApplicant(accessToken, payload): Promise<{ applicant: ApplicantSummary; possibleDuplicate: ApplicantSummary | null }>`,
`listApplicants(accessToken, guardianPhone): Promise<ApplicantSummary[]>`,
`createApplication(accessToken, payload: { applicantId, desiredClassId, academicSessionId })`,
`listApplications(accessToken, params?: { academicSessionId?: string; status?: string })`, mirroring
the existing `listHolidays`/`createHoliday` fetch shape exactly.

- [ ] **Step 2: Write `ApplicantIntakeView.vue`**

A form (name, date of birth, guardian name, guardian phone) → `api.createApplicant` → if the
response's `possibleDuplicate` is non-null, show a dismissible `role="alert"` banner ("A similar
applicant already exists — {name}") without blocking the create (it already happened) → a second
form section (desired class picker, academic session picker) → `api.createApplication` using the
just-created (or duplicate-matched, if staff chose to link to the existing one instead) applicant
id. Follow `HolidaysView.vue`'s general `FormField`/`Button`/error-message conventions for markup
style. Key `data-testid`s: `applicant-name`, `applicant-dob`, `applicant-guardian-name`,
`applicant-guardian-phone`, `applicant-submit`, `duplicate-banner`, `application-class`,
`application-session`, `application-submit`.

- [ ] **Step 3: Write `ApplicantIntakeView.spec.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ApplicantIntakeView from './ApplicantIntakeView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listClasses: vi.fn(),
    listAcademicSessions: vi.fn(),
    createApplicant: vi.fn(),
    createApplication: vi.fn(),
  },
}));

describe('ApplicantIntakeView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listClasses).mockResolvedValue([{ id: 'class-1', name: 'Grade 3', campusName: 'Gulistan-e-Jauhar' }]);
    vi.mocked(api.listAcademicSessions).mockResolvedValue([
      { id: 'sess-1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
  });

  it('creates an applicant, then an application for them, with no duplicate warning', async () => {
    vi.mocked(api.createApplicant).mockResolvedValue({
      applicant: { id: 'app-1', name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567' },
      possibleDuplicate: null,
    });
    vi.mocked(api.createApplication).mockResolvedValue({
      id: 'appl-1', applicantId: 'app-1', applicantName: 'Zainab Ali', desiredClassId: 'class-1',
      academicSessionId: 'sess-1', status: 'SUBMITTED', decisionNotes: null, reviewedById: null,
      createdStudentId: null,
    });

    const wrapper = mount(ApplicantIntakeView);
    await flushPromises();

    await wrapper.find('[data-testid="applicant-name"]').setValue('Zainab Ali');
    await wrapper.find('[data-testid="applicant-dob"]').setValue('2019-04-01');
    await wrapper.find('[data-testid="applicant-guardian-name"]').setValue('Ali Khan');
    await wrapper.find('[data-testid="applicant-guardian-phone"]').setValue('03001234567');
    await wrapper.find('[data-testid="applicant-submit"]').trigger('click');
    await flushPromises();

    expect(api.createApplicant).toHaveBeenCalledWith('token-1', {
      name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567',
    });
    expect(wrapper.find('[data-testid="duplicate-banner"]').exists()).toBe(false);

    await wrapper.find('[data-testid="application-class"]').setValue('class-1');
    await wrapper.find('[data-testid="application-session"]').setValue('sess-1');
    await wrapper.find('[data-testid="application-submit"]').trigger('click');
    await flushPromises();

    expect(api.createApplication).toHaveBeenCalledWith('token-1', {
      applicantId: 'app-1', desiredClassId: 'class-1', academicSessionId: 'sess-1',
    });
  });

  it('shows a duplicate banner when the create response flags a possible match', async () => {
    vi.mocked(api.createApplicant).mockResolvedValue({
      applicant: { id: 'app-2', name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567' },
      possibleDuplicate: { id: 'app-1', name: 'Zainab Ali', dateOfBirth: '2019-04-01', guardianName: 'Ali Khan', guardianPhone: '03001234567' },
    });

    const wrapper = mount(ApplicantIntakeView);
    await flushPromises();
    await wrapper.find('[data-testid="applicant-name"]').setValue('Zainab Ali');
    await wrapper.find('[data-testid="applicant-dob"]').setValue('2019-04-01');
    await wrapper.find('[data-testid="applicant-guardian-name"]').setValue('Ali Khan');
    await wrapper.find('[data-testid="applicant-guardian-phone"]').setValue('03001234567');
    await wrapper.find('[data-testid="applicant-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="duplicate-banner"]').text()).toContain('Zainab Ali');
  });
});
```

- [ ] **Step 4: Run the spec**

Run: `cd staff-console && npx vitest run src/views/ApplicantIntakeView.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write `AdmissionsQueueView.vue`**

An academic-session picker + status-filter select drive `api.listApplications`; an `EntityTable`
lists results using `ApplicationSummary`'s `applicantName` field directly (the backend already
joins and returns it — see Task 4's `WITH_APPLICANT` include — no per-row extra fetch needed). Each
row links to `ApplicationDetailView.vue` (Task 7) via `RouterLink :to="/admin/admissions/{id}"`.

- [ ] **Step 6: Write `AdmissionsQueueView.spec.ts`**

Cover: loads applications for the selected session/status filter; each row links to the correct
detail route; error state on a rejected `listApplications` call.

- [ ] **Step 7: Run the spec**

Run: `cd staff-console && npx vitest run src/views/AdmissionsQueueView.spec.ts`
Expected: PASS.

- [ ] **Step 8: Wire routes, nav, and page wrappers**

Create `AdmissionsQueuePageView.vue` and `ApplicantIntakePageView.vue` as standard
`<AppShell><TheView /></AppShell>` wrappers (no spec, per the established zero-logic-wrapper
convention). Add routes `/admin/admissions` (`meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS',
'SUPER_ADMIN'], title: 'Admissions' }`) and `/admin/admissions/new` (same role gate, title 'New
Applicant') in `staff-console/src/router/index.ts`. Add a `nav-admissions` `RouterLink` to
`AppShell.vue`'s admin nav group, gated by a new `canManageAdmissions` computed
(`auth.role === 'SCHOOL_ADMIN' || auth.role === 'ACCOUNTS' || auth.role === 'SUPER_ADMIN'`). Add
`"admissions": "Admissions"` to `en.json`'s `nav` object and `"admissions": "داخلے"` to `ur.json`'s
(confirm this reads naturally before merging, per this project's existing Urdu-translation bar).

- [ ] **Step 9: Run the full staff-console suite**

Run: `cd staff-console && npx vitest run && npx vue-tsc --noEmit`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add staff-console/src
git commit -m "feat(admissions): add admissions queue and applicant intake screens"
```

---

### Task 7: `ApplicationDetailView.vue` (review, reject, approve)

**Files:**
- Modify: `staff-console/src/lib/api.ts` (add `getApplication`, `updateApplicationStatus`,
  `rejectApplication`, `approveApplication`)
- Create: `staff-console/src/views/ApplicationDetailView.vue`, `staff-console/src/views/ApplicationDetailView.spec.ts`
- Create: `staff-console/src/views/ApplicationDetailPageView.vue`
- Modify: `staff-console/src/router/index.ts`

**Interfaces:**
- Consumes: `ApplicationSummary`/`ApplicantSummary` types (Task 6); the existing
  `useNewParent`/`newParentProfileId`/`newParentIdentifier`/`newParentPassword`/`newParentName`/
  `newParentPhone` toggle pattern from `StudentManagementView.vue:211-228`.
- Produces: nothing consumed elsewhere — this is the final screen in the admissions feature.

- [ ] **Step 1: Add API methods to `staff-console/src/lib/api.ts`**

```ts
getApplication(accessToken, id): Promise<ApplicationSummary>
updateApplicationStatus(accessToken, id, payload: { status?: 'UNDER_REVIEW' | 'WITHDRAWN'; decisionNotes?: string })
rejectApplication(accessToken, id, decisionNotes: string)
approveApplication(accessToken, id, payload: { grNumber: string; sectionId: string; parentProfileId?: string; newParent?: {...} })
```
Add a backend `GET /api/v1/applications/:id` route to `applications.controller.ts`/
`applications.service.ts` first if it doesn't already exist by this point (it wasn't added in Task
4 — that task only added list/create/patch, not get-by-id): `findOne(id)` following the same
`getOrThrow`-then-`toSummary` shape every other method in that service already uses.

- [ ] **Step 2: Write `ApplicationDetailView.vue`**

Reads the route's `:id` param, loads via `api.getApplication`. Shows applicant/desired-class/session
info, current status, `decisionNotes`. Three actions: "Mark Under Review" (`api.updateApplicationStatus`
with `status: 'UNDER_REVIEW'`), a Reject sub-form (`decisionNotes` textarea + submit →
`api.rejectApplication`), and an Approve sub-form — a `grNumber` field, a section picker, and the
exact same existing-vs-new-parent toggle markup as `StudentManagementView.vue:211-228` (same
`data-testid`s: `toggle-new-parent`, `add-parent-select`, `new-parent-identifier`,
`new-parent-password`, `new-parent-name`, `new-parent-phone`) → `api.approveApplication`. On a
rejected approve call (e.g. duplicate `grNumber`), show the backend's real error message via
`role="alert"` rather than a generic one — mirrors `ReportCardsView.vue`'s existing
duplicate-upload error handling.

- [ ] **Step 3: Write `ApplicationDetailView.spec.ts`**

Cover: loads and displays the application; "Mark Under Review" calls `api.updateApplicationStatus`;
reject flow calls `api.rejectApplication` with the entered notes; approve flow with the
new-parent toggle on submits the exactly-one-of parent shape to `api.approveApplication`; a
rejected approve call (e.g. `new Error('This GR number or parent identifier is already in use.')`)
surfaces via `[role="alert"]`.

- [ ] **Step 4: Run the spec**

Run: `cd staff-console && npx vitest run src/views/ApplicationDetailView.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire the route**

Create `ApplicationDetailPageView.vue` (standard wrapper). Add
`/admin/admissions/:id` (`meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'], title:
'Application' }`) to `staff-console/src/router/index.ts`.

- [ ] **Step 6: Run the full staff-console suite**

Run: `cd staff-console && npx vitest run && npx vue-tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add staff-console/src
git commit -m "feat(admissions): add application review/reject/approve screen"
```

---

### Task 8: Full-suite verification and roadmap update

**Files:** `docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md` (roadmap checklist only).

- [ ] **Step 1: Run every suite**

```bash
cd backend && npm test && npm run test:e2e && npm run build
cd ../staff-console && npx vitest run && npx vue-tsc --noEmit && npm run lint
```
Expected: all green, clean build/lint.

- [ ] **Step 2: Update the roadmap doc's Implementation Checklist**

Check off Sprint O's box and sub-items, noting that EMI-style fee installments were split out as an
explicitly deferred, unscheduled backlog item (not part of this sprint), matching the established
format from Sprints A-N.

- [ ] **Step 3: Commit**

```bash
git add docs/Plan-Ideas/PHASE-1/SchoolOS-PostMVP-Roadmap-2026-09-08.md
git commit -m "docs: mark Sprint O complete in the roadmap checklist"
```
