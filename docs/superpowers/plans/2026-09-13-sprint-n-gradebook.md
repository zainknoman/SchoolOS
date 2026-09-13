# Sprint N — Structured Gradebook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured gradebook (terms, per-class weighted assessment categories, assessments,
marks) so report cards can show a calculated grade from real entered marks, while the existing
PDF-upload report-card path keeps working untouched as a fallback.

**Architecture:** One new `GradebookModule` (`backend/src/gradebook/`) following this codebase's
one-module-per-bounded-context convention, with four sub-resources (`Term`, `AssessmentCategory`,
`Assessment`, `Mark`) each getting their own controller/service pair. Marks-entry authorization
reuses `StudentAccessService` via one new sibling method, `assertCanAccessClass`. Grades are always
computed on read from `Mark` rows, never stored. Frontend: two new admin config screens (Terms,
Assessment Categories), one new teacher marks-entry screen, and an extension (not a rewrite) of the
existing report-card screens on both clients to show structured grades when present, PDF list
otherwise.

**Tech Stack:** NestJS + Prisma + Postgres (backend); Vue 3 + `@vue/test-utils`/`vitest`
(staff-console); Flutter + `flutter_test` (parent-app).

**Spec:** `build/docs/superpowers/specs/2026-09-13-sprint-n-gradebook-design.md`

## Global Constraints

- PDF report cards (`report-cards` module) are **not modified** — structured grades are additive,
  shown alongside/instead of the PDF list only in the UI, never replacing the underlying model.
- Assessment-category weighting is **per-class, shared across every subject in that class** — not
  per-subject (locked decision).
- The final grade is **always computed on read, never stored** as a column.
- Marks-entry authorization uses the same campus-wide teacher scope as every other module
  (`StudentAccessService`) — no new "assigned teacher" concept.
- `AssessmentCategory` weights for a given `(classId, termId)` must sum to exactly 100% before any
  `Assessment`/`Mark` can be created against them.
- Marks are stored as `Float`; the computed final percentage is rounded to one decimal place only
  at the API response layer, never in storage.

---

### Task 1: Prisma schema — `Term`, `AssessmentCategory`, `Assessment`, `Mark`

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: a new migration under `backend/prisma/migrations/` (via `prisma migrate dev`)

**Interfaces:**
- Produces: the four new models below, plus back-relation fields on `AcademicSession`, `Class`,
  `Subject`, `Student`, `User` — every later task in this plan depends on these existing exactly as
  specified here.

- [ ] **Step 1: Add the new models to `schema.prisma`**

```prisma
model Term {
  id                String              @id @default(uuid())
  academicSessionId String
  academicSession   AcademicSession     @relation(fields: [academicSessionId], references: [id], onDelete: Cascade)
  label             String
  order             Int
  startDate         DateTime
  endDate           DateTime
  assessmentCategories AssessmentCategory[]
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt

  @@unique([academicSessionId, label])
  @@index([academicSessionId])
}

model AssessmentCategory {
  id            String       @id @default(uuid())
  classId       String
  class         Class        @relation(fields: [classId], references: [id], onDelete: Cascade)
  termId        String
  term          Term         @relation(fields: [termId], references: [id], onDelete: Cascade)
  name          String
  weightPercent Float
  assessments   Assessment[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@unique([classId, termId, name])
  @@index([classId, termId])
}

model Assessment {
  id                   String             @id @default(uuid())
  assessmentCategoryId String
  assessmentCategory   AssessmentCategory @relation(fields: [assessmentCategoryId], references: [id], onDelete: Cascade)
  subjectId            String
  subject              Subject            @relation(fields: [subjectId], references: [id], onDelete: Restrict)
  label                String
  maxMarks             Float
  marks                Mark[]
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  @@index([assessmentCategoryId])
  @@index([subjectId])
}

model Mark {
  id            String     @id @default(uuid())
  assessmentId  String
  assessment    Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  studentId     String
  student       Student    @relation(fields: [studentId], references: [id], onDelete: Cascade)
  obtainedMarks Float
  enteredById   String
  enteredBy     User       @relation(fields: [enteredById], references: [id])
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  @@unique([assessmentId, studentId])
  @@index([studentId])
}
```

Then add these back-relation fields to the existing models (do not otherwise modify them):
- `AcademicSession`: `terms Term[]`
- `Class`: `assessmentCategories AssessmentCategory[]`
- `Subject`: `assessments Assessment[]`
- `Student`: `marks Mark[]`
- `User`: `marksEntered Mark[]`

- [ ] **Step 2: Generate and run the migration**

Run: `cd backend && npx prisma migrate dev --name add-gradebook`
Expected: migration file created under `backend/prisma/migrations/`, applies cleanly against the
local dev database, `npx prisma generate` runs as part of the same command and regenerates the
Prisma client with the four new models.

- [ ] **Step 3: Verify the existing suite still passes**

Run: `cd backend && npm test`
Expected: all existing unit tests green (a schema-only additive change should not break anything).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat(gradebook): add Term/AssessmentCategory/Assessment/Mark models"
```

---

### Task 2: `StudentAccessService.assertCanAccessClass`

**Files:**
- Modify: `backend/src/common/student-access.service.ts`
- Modify: `backend/src/common/student-access.service.spec.ts`

**Interfaces:**
- Consumes: `Class` model (`campusId` direct field, `campus.schoolId` via relation).
- Produces: `assertCanAccessClass(user: RequestUser, classId: string): Promise<void>` — Task 5/6
  (`AssessmentsController`) inject `StudentAccessService` and call this method exactly like
  `assertCanAccessSection` is called elsewhere.

- [ ] **Step 1: Write the failing unit tests**

Add to `backend/src/common/student-access.service.spec.ts`, extending the existing `prisma` mock
object's type and value with `class: { findUnique: jest.Mock }`:

```ts
// add to the `prisma` object literal and its type declaration:
class: { findUnique: jest.fn() },
```

```ts
describe('assertCanAccessClass', () => {
  it('allows SUPER_ADMIN without any lookup', async () => {
    await expect(
      service.assertCanAccessClass({ id: 'u1', role: 'SUPER_ADMIN' }, 'class-1'),
    ).resolves.toBeUndefined();
    expect(prisma.class.findUnique).not.toHaveBeenCalled();
  });

  it('denies access when the class does not exist', async () => {
    prisma.class.findUnique.mockResolvedValue(null);

    await expect(
      service.assertCanAccessClass({ id: 'admin-1', role: 'SCHOOL_ADMIN' }, 'missing-class'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a TEACHER to access a class in their own campus, denies a different campus', async () => {
    prisma.class.findUnique.mockResolvedValue({
      campusId: 'campus-1',
      campus: { schoolId: 'school-1' },
    });
    prisma.teacher.findUnique.mockResolvedValue({ userId: 'teacher-1', campusId: 'campus-1' });

    await expect(
      service.assertCanAccessClass({ id: 'teacher-1', role: 'TEACHER' }, 'class-1'),
    ).resolves.toBeUndefined();

    prisma.teacher.findUnique.mockResolvedValue({ userId: 'teacher-2', campusId: 'campus-2' });
    await expect(
      service.assertCanAccessClass({ id: 'teacher-2', role: 'TEACHER' }, 'class-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a SCHOOL_ADMIN in the same school, denies a different school', async () => {
    prisma.class.findUnique.mockResolvedValue({
      campusId: 'campus-1',
      campus: { schoolId: 'school-1' },
    });
    prisma.user.findUnique.mockResolvedValue({ schoolId: 'school-1' });

    await expect(
      service.assertCanAccessClass({ id: 'admin-1', role: 'SCHOOL_ADMIN' }, 'class-1'),
    ).resolves.toBeUndefined();

    prisma.user.findUnique.mockResolvedValue({ schoolId: 'school-2' });
    await expect(
      service.assertCanAccessClass({ id: 'admin-2', role: 'SCHOOL_ADMIN' }, 'class-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd backend && npx jest src/common/student-access.service.spec.ts`
Expected: FAIL — `service.assertCanAccessClass is not a function`.

- [ ] **Step 3: Implement `assertCanAccessClass`**

In `backend/src/common/student-access.service.ts`, add a public method mirroring
`assertCanAccessSection` exactly, and a matching private resolver:

```ts
async assertCanAccessClass(user: RequestUser, classId: string): Promise<void> {
  switch (user.role) {
    case 'SUPER_ADMIN':
      return;
    case 'SCHOOL_ADMIN':
    case 'ACCOUNTS':
    case 'TEACHER': {
      const scope = await this.resolveClassScope(classId);
      await this.assertCanAccessScope(user, scope);
      return;
    }
    default:
      throw new ForbiddenException('You do not have access to this resource');
  }
}

private async resolveClassScope(classId: string): Promise<AccessScope | null> {
  const klass = await this.prisma.class.findUnique({
    where: { id: classId },
    include: { campus: { select: { schoolId: true } } },
  });
  return klass ? { campusId: klass.campusId, schoolId: klass.campus.schoolId } : null;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd backend && npx jest src/common/student-access.service.spec.ts`
Expected: PASS, all cases including the pre-existing ones.

- [ ] **Step 5: Commit**

```bash
git add backend/src/common/student-access.service.ts backend/src/common/student-access.service.spec.ts
git commit -m "feat(gradebook): add StudentAccessService.assertCanAccessClass"
```

---

### Task 3: `Term` CRUD

**Files:**
- Create: `backend/src/gradebook/gradebook.module.ts`
- Create: `backend/src/gradebook/dto/create-term.dto.ts`, `backend/src/gradebook/dto/update-term.dto.ts`
- Create: `backend/src/gradebook/terms.service.ts`, `backend/src/gradebook/terms.controller.ts`
- Create: `backend/test/gradebook.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `Term` model (Task 1).
- Produces: `TermsService` (`create`, `findMany(academicSessionId)`, `update`, `delete`) and
  `GET/POST/PATCH/DELETE /api/v1/terms` — Tasks 4-7 don't call this directly, but the e2e file
  created here is extended (not replaced) by every later backend task.

- [ ] **Step 1: Write the DTOs**

```ts
// backend/src/gradebook/dto/create-term.dto.ts
import { IsDateString, IsInt, IsString, MinLength } from 'class-validator';

export class CreateTermDto {
  @IsString()
  @MinLength(1)
  academicSessionId!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsInt()
  order!: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
```

```ts
// backend/src/gradebook/dto/update-term.dto.ts
import { IsDateString, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTermDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
```

- [ ] **Step 2: Write `terms.service.ts`**

```ts
// backend/src/gradebook/terms.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertCreatable } from '../common/prisma-create-guard';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';

export interface TermSummary {
  id: string;
  academicSessionId: string;
  label: string;
  order: number;
  startDate: string;
  endDate: string;
}

@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    academicSessionId: string;
    label: string;
    order: number;
    startDate: Date;
    endDate: Date;
  }): TermSummary {
    return {
      id: record.id,
      academicSessionId: record.academicSessionId,
      label: record.label,
      order: record.order,
      startDate: record.startDate.toISOString().slice(0, 10),
      endDate: record.endDate.toISOString().slice(0, 10),
    };
  }

  async create(dto: CreateTermDto): Promise<TermSummary> {
    let record;
    try {
      record = await this.prisma.term.create({
        data: {
          academicSessionId: dto.academicSessionId,
          label: dto.label,
          order: dto.order,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
        },
      });
    } catch (error) {
      assertCreatable(error, 'A term with this label already exists for this academic session.');
    }
    return this.toSummary(record);
  }

  async findMany(academicSessionId: string): Promise<TermSummary[]> {
    const records = await this.prisma.term.findMany({
      where: { academicSessionId },
      orderBy: { order: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateTermDto): Promise<TermSummary> {
    const existing = await this.prisma.term.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Term not found');
    }
    const record = await this.prisma.term.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.order !== undefined ? { order: dto.order } : {}),
        ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
        ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.term.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Term not found');
    }
    try {
      await this.prisma.term.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Term');
    }
  }
}
```

- [ ] **Step 3: Write `terms.controller.ts`**

```ts
// backend/src/gradebook/terms.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { TermsService } from './terms.service';
import { CreateTermDto } from './dto/create-term.dto';
import { UpdateTermDto } from './dto/update-term.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/terms')
export class TermsController {
  constructor(private readonly termsService: TermsService) {}

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateTermDto) {
    return this.termsService.create(dto);
  }

  // No StudentAccessService check — terms are not per-student PII, same reasoning as Holiday's
  // read scope (any authenticated role, including PARENT/TEACHER, can read the term list).
  @Get()
  list(@Query('academicSessionId') academicSessionId: string) {
    return this.termsService.findMany(academicSessionId);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTermDto) {
    return this.termsService.update(id, dto);
  }

  @Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.termsService.delete(id);
  }
}
```

- [ ] **Step 4: Write `gradebook.module.ts` and register it**

```ts
// backend/src/gradebook/gradebook.module.ts
import { Module } from '@nestjs/common';
import { TermsService } from './terms.service';
import { TermsController } from './terms.controller';
import { StudentAccessService } from '../common/student-access.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

@Module({
  providers: [TermsService, StudentAccessService, EnrollmentService],
  controllers: [TermsController],
})
export class GradebookModule {}
```

In `backend/src/app.module.ts`: add `import { GradebookModule } from './gradebook/gradebook.module';`
near the other feature-module imports, and add `GradebookModule` to the `imports:` array (after
`AttendanceRiskModule`).

- [ ] **Step 5: Write the e2e spec (new file)**

Follow `backend/test/holidays-complaints-report-cards.e2e-spec.ts`'s exact seeding shape (school →
campus → academic session → class → section → a `SCHOOL_ADMIN` and a `TEACHER` login) — read that
file in full before writing this one so the `beforeAll` seed block matches its style exactly
(cleanup-by-prefix, `argon2.hash`, `loginAs` helper). Use an identifier prefix like `gb-` and a
`grNumber`/school-name prefix like `GB-`/`GB E2E School` to keep this suite's fixtures isolated from
every other e2e file's. In addition to that reference file's shape, this seed also needs (later
tasks in this plan depend on all of these existing by the time their tests run):
```ts
const subject = await prisma.subject.create({ data: { name: 'GB Math' } });
const student = await prisma.student.create({ data: { grNumber: 'GB-1001', name: 'GB Student' } });
await prisma.enrollment.create({
  data: {
    studentId: student.id,
    campusId: campus.id,
    sectionId: section.id,
    academicSessionId: session.id,
    startDate: new Date(),
    status: 'ACTIVE',
  },
});
ids.subject = subject.id;
ids.student = student.id;
ids.class = klass.id;
```
(`klass`/`campus`/`session`/`section` are the variables the reference file's own seed already
creates — reuse them, don't recreate.)

```ts
// backend/test/gradebook.e2e-spec.ts (Terms section — more describe blocks added in later tasks)
describe('Terms', () => {
  it('SCHOOL_ADMIN creates a term and it appears in the session\'s list', async () => {
    const adminToken = await loginAs('gb-admin');
    const res = await request(app.getHttpServer())
      .post('/api/v1/terms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicSessionId: ids.session, label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' })
      .expect(201);
    ids.term1 = res.body.id;

    const list = await request(app.getHttpServer())
      .get(`/api/v1/terms?academicSessionId=${ids.session}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.map((t: { label: string }) => t.label)).toContain('Term 1');
  });

  it('a TEACHER can read terms but cannot create one', async () => {
    const teacherToken = await loginAs('gb-teacher');
    await request(app.getHttpServer())
      .get(`/api/v1/terms?academicSessionId=${ids.session}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/terms')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ academicSessionId: ids.session, label: 'Term 2', order: 2, startDate: '2027-01-05', endDate: '2027-06-30' })
      .expect(403);
  });
});
```

- [ ] **Step 6: Run the new e2e spec**

Run: `cd backend && npx jest --config test/jest-e2e.json gradebook.e2e-spec.ts`
Expected: PASS (confirm the exact e2e Jest config path/command by checking `package.json`'s
`test:e2e` script before running, matching whatever the other e2e files use).

- [ ] **Step 7: Commit**

```bash
git add backend/src/gradebook backend/src/app.module.ts backend/test/gradebook.e2e-spec.ts
git commit -m "feat(gradebook): add Term CRUD"
```

---

### Task 4: `AssessmentCategory` CRUD + 100%-weight validation

**Files:**
- Create: `backend/src/gradebook/dto/create-assessment-category.dto.ts`,
  `backend/src/gradebook/dto/update-assessment-category.dto.ts`
- Create: `backend/src/gradebook/assessment-categories.service.ts`,
  `backend/src/gradebook/assessment-categories.controller.ts`
- Modify: `backend/src/gradebook/gradebook.module.ts` (register the new service/controller)
- Modify: `backend/test/gradebook.e2e-spec.ts` (add a new `describe('Assessment Categories', ...)`)

**Interfaces:**
- Consumes: `Term` rows created in Task 3's tests (same seeded `ids.term1`).
- Produces: `AssessmentCategoriesService.create/findMany/update/delete`, `GET/POST/PATCH/DELETE
  /api/v1/assessment-categories` — Task 5 (`AssessmentsService`) independently queries the
  `AssessmentCategory` table by id to resolve `classId` (its own `classIdForCategory` method, not a
  call into this service) for the `assertCanAccessClass` check.

- [ ] **Step 1: Write the DTOs**

```ts
// backend/src/gradebook/dto/create-assessment-category.dto.ts
import { IsNumber, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateAssessmentCategoryDto {
  @IsString()
  @MinLength(1)
  classId!: string;

  @IsString()
  @MinLength(1)
  termId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent!: number;
}
```

```ts
// backend/src/gradebook/dto/update-assessment-category.dto.ts
import { IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class UpdateAssessmentCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number;
}
```

- [ ] **Step 2: Write `assessment-categories.service.ts`**

```ts
// backend/src/gradebook/assessment-categories.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertCreatable } from '../common/prisma-create-guard';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateAssessmentCategoryDto } from './dto/create-assessment-category.dto';
import { UpdateAssessmentCategoryDto } from './dto/update-assessment-category.dto';

export interface AssessmentCategorySummary {
  id: string;
  classId: string;
  termId: string;
  name: string;
  weightPercent: number;
}

export interface AssessmentCategoryWithWarning extends AssessmentCategorySummary {
  weightTotalWarning: string | null;
}

@Injectable()
export class AssessmentCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    classId: string;
    termId: string;
    name: string;
    weightPercent: number;
  }): AssessmentCategorySummary {
    return {
      id: record.id,
      classId: record.classId,
      termId: record.termId,
      name: record.name,
      weightPercent: record.weightPercent,
    };
  }

  private async weightWarning(classId: string, termId: string): Promise<string | null> {
    const siblings = await this.prisma.assessmentCategory.findMany({
      where: { classId, termId },
      select: { weightPercent: true },
    });
    const total = siblings.reduce((sum, s) => sum + s.weightPercent, 0);
    return total === 100
      ? null
      : `Category weights for this class/term total ${total}%, not 100% — grades will be understated or overstated until this is corrected.`;
  }

  async create(dto: CreateAssessmentCategoryDto): Promise<AssessmentCategoryWithWarning> {
    let record;
    try {
      record = await this.prisma.assessmentCategory.create({
        data: {
          classId: dto.classId,
          termId: dto.termId,
          name: dto.name,
          weightPercent: dto.weightPercent,
        },
      });
    } catch (error) {
      assertCreatable(error, 'A category with this name already exists for this class and term.');
    }
    const weightTotalWarning = await this.weightWarning(record.classId, record.termId);
    return { ...this.toSummary(record), weightTotalWarning };
  }

  async findMany(classId: string, termId: string): Promise<AssessmentCategorySummary[]> {
    const records = await this.prisma.assessmentCategory.findMany({
      where: { classId, termId },
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateAssessmentCategoryDto): Promise<AssessmentCategoryWithWarning> {
    const existing = await this.prisma.assessmentCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assessment category not found');
    }
    const record = await this.prisma.assessmentCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.weightPercent !== undefined ? { weightPercent: dto.weightPercent } : {}),
      },
    });
    const weightTotalWarning = await this.weightWarning(record.classId, record.termId);
    return { ...this.toSummary(record), weightTotalWarning };
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.assessmentCategory.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assessment category not found');
    }
    try {
      await this.prisma.assessmentCategory.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Assessment category');
    }
  }
}
```

- [ ] **Step 3: Write `assessment-categories.controller.ts`**

```ts
// backend/src/gradebook/assessment-categories.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { AssessmentCategoriesService } from './assessment-categories.service';
import { CreateAssessmentCategoryDto } from './dto/create-assessment-category.dto';
import { UpdateAssessmentCategoryDto } from './dto/update-assessment-category.dto';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('api/v1/assessment-categories')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class AssessmentCategoriesController {
  constructor(private readonly service: AssessmentCategoriesService) {}

  @Post()
  create(@Body() dto: CreateAssessmentCategoryDto) {
    return this.service.create(dto);
  }

  @Get()
  list(@Query('classId') classId: string, @Query('termId') termId: string) {
    return this.service.findMany(classId, termId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAssessmentCategoryDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.service.delete(id);
  }
}
```

- [ ] **Step 4: Register in `gradebook.module.ts`**

Add `AssessmentCategoriesService` to `providers` and `AssessmentCategoriesController` to
`controllers` in `backend/src/gradebook/gradebook.module.ts`.

- [ ] **Step 5: Add e2e cases**

```ts
describe('Assessment Categories', () => {
  it('flags a non-100% weight total but still creates the category', async () => {
    const adminToken = await loginAs('gb-admin');
    const res = await request(app.getHttpServer())
      .post('/api/v1/assessment-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ classId: ids.class, termId: ids.term1, name: 'Quizzes', weightPercent: 30 })
      .expect(201);
    ids.categoryQuizzes = res.body.id;
    expect(res.body.weightTotalWarning).toContain('30%');

    const res2 = await request(app.getHttpServer())
      .post('/api/v1/assessment-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ classId: ids.class, termId: ids.term1, name: 'Final Exam', weightPercent: 70 })
      .expect(201);
    ids.categoryFinal = res2.body.id;
    expect(res2.body.weightTotalWarning).toBeNull();
  });

  it('a TEACHER cannot create an assessment category (admin-only)', async () => {
    const teacherToken = await loginAs('gb-teacher');
    await request(app.getHttpServer())
      .post('/api/v1/assessment-categories')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ classId: ids.class, termId: ids.term1, name: 'Midterm', weightPercent: 10 })
      .expect(403);
  });
});
```

- [ ] **Step 6: Run the e2e suite**

Run: `cd backend && npx jest --config test/jest-e2e.json gradebook.e2e-spec.ts`
Expected: PASS, including Task 3's cases.

- [ ] **Step 7: Commit**

```bash
git add backend/src/gradebook backend/test/gradebook.e2e-spec.ts
git commit -m "feat(gradebook): add AssessmentCategory CRUD with weight-total warning"
```

---

### Task 5: `Assessment` CRUD (class-scoped)

**Files:**
- Create: `backend/src/gradebook/dto/create-assessment.dto.ts`, `backend/src/gradebook/dto/update-assessment.dto.ts`
- Create: `backend/src/gradebook/assessments.service.ts`, `backend/src/gradebook/assessments.controller.ts`
- Modify: `backend/src/gradebook/gradebook.module.ts`
- Modify: `backend/test/gradebook.e2e-spec.ts`

**Interfaces:**
- Consumes: the `AssessmentCategory` table (Task 4's schema — queried directly, not through
  `AssessmentCategoriesService`); `StudentAccessService.assertCanAccessClass` (Task 2).
- Produces: `AssessmentsService.create/findMany/update/delete`, `GET/POST/PATCH/DELETE
  /api/v1/assessments` — Task 6 (bulk marks) looks up an `Assessment`'s `maxMarks` and
  `assessmentCategory.classId` the same way this controller does.

- [ ] **Step 1: Write the DTOs**

```ts
// backend/src/gradebook/dto/create-assessment.dto.ts
import { IsNumber, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateAssessmentDto {
  @IsString()
  @MinLength(1)
  assessmentCategoryId!: string;

  @IsString()
  @MinLength(1)
  subjectId!: string;

  @IsString()
  @MinLength(1)
  label!: string;

  @IsNumber()
  @IsPositive()
  maxMarks!: number;
}
```

```ts
// backend/src/gradebook/dto/update-assessment.dto.ts
import { IsNumber, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class UpdateAssessmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  maxMarks?: number;
}
```

- [ ] **Step 2: Write `assessments.service.ts`**

```ts
// backend/src/gradebook/assessments.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';

export interface AssessmentSummary {
  id: string;
  assessmentCategoryId: string;
  subjectId: string;
  label: string;
  maxMarks: number;
}

@Injectable()
export class AssessmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    assessmentCategoryId: string;
    subjectId: string;
    label: string;
    maxMarks: number;
  }): AssessmentSummary {
    return {
      id: record.id,
      assessmentCategoryId: record.assessmentCategoryId,
      subjectId: record.subjectId,
      label: record.label,
      maxMarks: record.maxMarks,
    };
  }

  /** Resolves the owning class id — used by the controller to run assertCanAccessClass. */
  async classIdForCategory(assessmentCategoryId: string): Promise<string> {
    const category = await this.prisma.assessmentCategory.findUnique({
      where: { id: assessmentCategoryId },
      select: { classId: true },
    });
    if (!category) {
      throw new NotFoundException('Assessment category not found');
    }
    return category.classId;
  }

  async classIdForAssessment(assessmentId: string): Promise<string> {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      select: { assessmentCategory: { select: { classId: true } } },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    return assessment.assessmentCategory.classId;
  }

  async create(dto: CreateAssessmentDto): Promise<AssessmentSummary> {
    const record = await this.prisma.assessment.create({
      data: {
        assessmentCategoryId: dto.assessmentCategoryId,
        subjectId: dto.subjectId,
        label: dto.label,
        maxMarks: dto.maxMarks,
      },
    });
    return this.toSummary(record);
  }

  async findMany(assessmentCategoryId: string): Promise<AssessmentSummary[]> {
    const records = await this.prisma.assessment.findMany({
      where: { assessmentCategoryId },
      orderBy: { label: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateAssessmentDto): Promise<AssessmentSummary> {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assessment not found');
    }
    const record = await this.prisma.assessment.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.maxMarks !== undefined ? { maxMarks: dto.maxMarks } : {}),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.assessment.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Assessment not found');
    }
    try {
      await this.prisma.assessment.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Assessment');
    }
  }
}
```

- [ ] **Step 3: Write `assessments.controller.ts`**

```ts
// backend/src/gradebook/assessments.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { StudentAccessService, type RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/assessments')
@Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
export class AssessmentsController {
  constructor(
    private readonly assessmentsService: AssessmentsService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Post()
  async create(@Body() dto: CreateAssessmentDto, @Req() req: AuthenticatedRequest) {
    const classId = await this.assessmentsService.classIdForCategory(dto.assessmentCategoryId);
    await this.studentAccess.assertCanAccessClass(req.user, classId);
    return this.assessmentsService.create(dto);
  }

  @Get()
  list(@Query('assessmentCategoryId') assessmentCategoryId: string) {
    return this.assessmentsService.findMany(assessmentCategoryId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAssessmentDto, @Req() req: AuthenticatedRequest) {
    const classId = await this.assessmentsService.classIdForAssessment(id);
    await this.studentAccess.assertCanAccessClass(req.user, classId);
    return this.assessmentsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const classId = await this.assessmentsService.classIdForAssessment(id);
    await this.studentAccess.assertCanAccessClass(req.user, classId);
    await this.assessmentsService.delete(id);
  }
}
```

- [ ] **Step 4: Register in `gradebook.module.ts`**

Add `AssessmentsService` to `providers` and `AssessmentsController` to `controllers`.

- [ ] **Step 5: Add e2e cases**

```ts
describe('Assessments', () => {
  it('a TEACHER in the class\'s campus creates an assessment; a different-campus TEACHER cannot', async () => {
    const teacherToken = await loginAs('gb-teacher');
    const res = await request(app.getHttpServer())
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ assessmentCategoryId: ids.categoryQuizzes, subjectId: ids.subject, label: 'Quiz 1', maxMarks: 20 })
      .expect(201);
    ids.assessmentQuiz1 = res.body.id;

    const otherCampusTeacherToken = await loginAs('gb-teacher-other');
    await request(app.getHttpServer())
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${otherCampusTeacherToken}`)
      .send({ assessmentCategoryId: ids.categoryQuizzes, subjectId: ids.subject, label: 'Quiz 2', maxMarks: 20 })
      .expect(403);
  });
});
```
Add this to the file's `beforeAll` block, alongside the primary campus/teacher seed (after
`ids.section` is created):
```ts
const otherCampus = await prisma.campus.create({ data: { schoolId: school.id, name: 'HCR Other' } });
const otherCampusUser = await prisma.user.create({
  data: { identifier: 'gb-teacher-other', passwordHash, role: 'TEACHER' },
});
await prisma.teacher.create({
  data: { userId: otherCampusUser.id, name: 'Other Campus Teacher', campusId: otherCampus.id },
});
ids.otherCampus = otherCampus.id;
```

- [ ] **Step 6: Run the e2e suite**

Run: `cd backend && npx jest --config test/jest-e2e.json gradebook.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/gradebook backend/test/gradebook.e2e-spec.ts
git commit -m "feat(gradebook): add Assessment CRUD, class-scoped"
```

---

### Task 6: Bulk marks entry endpoint

**Files:**
- Create: `backend/src/gradebook/dto/bulk-marks.dto.ts`
- Modify: `backend/src/gradebook/assessments.service.ts` (add `saveMarksBulk`)
- Modify: `backend/src/gradebook/assessments.controller.ts` (add the route)
- Modify: `backend/test/gradebook.e2e-spec.ts`

**Interfaces:**
- Consumes: `SectionsService.getStudents`'s query shape (`backend/src/sections/sections.service.ts:51-58`),
  widened from one section to every section under a class.
- Produces: `POST /api/v1/assessments/:id/marks` — Task 7 (`GET /students/:id/grades`) reads the
  `Mark` rows this endpoint writes.

- [ ] **Step 1: Write the DTO**

```ts
// backend/src/gradebook/dto/bulk-marks.dto.ts
import { ArrayMinSize, IsArray, IsNumber, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MarkEntryDto {
  @IsString()
  @MinLength(1)
  studentId!: string;

  @IsNumber()
  @Min(0)
  obtainedMarks!: number;
}

export class BulkMarksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => MarkEntryDto)
  marks!: MarkEntryDto[];
}
```

- [ ] **Step 2: Add `saveMarksBulk` to `assessments.service.ts`**

```ts
async saveMarksBulk(assessmentId: string, dto: BulkMarksDto, enteredById: string) {
  const assessment = await this.prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { maxMarks: true, assessmentCategory: { select: { classId: true } } },
  });
  if (!assessment) {
    throw new NotFoundException('Assessment not found');
  }

  for (const mark of dto.marks) {
    if (mark.obtainedMarks > assessment.maxMarks) {
      throw new BadRequestException(
        `Student ${mark.studentId}: obtained marks (${mark.obtainedMarks}) exceed the maximum (${assessment.maxMarks}) for this assessment`,
      );
    }
  }

  const enrolled = await this.prisma.enrollment.findMany({
    where: { status: 'ACTIVE', section: { classId: assessment.assessmentCategory.classId } },
    select: { studentId: true },
  });
  const enrolledIds = new Set(enrolled.map((e) => e.studentId));
  for (const mark of dto.marks) {
    if (!enrolledIds.has(mark.studentId)) {
      throw new BadRequestException(`Student ${mark.studentId} is not enrolled in this assessment's class`);
    }
  }

  const records = await this.prisma.$transaction(async (tx) => {
    const results: Awaited<ReturnType<typeof tx.mark.upsert>>[] = [];
    for (const mark of dto.marks) {
      const record = await tx.mark.upsert({
        where: { assessmentId_studentId: { assessmentId, studentId: mark.studentId } },
        create: { assessmentId, studentId: mark.studentId, obtainedMarks: mark.obtainedMarks, enteredById },
        update: { obtainedMarks: mark.obtainedMarks, enteredById },
      });
      results.push(record);
    }
    await tx.auditLog.create({
      data: {
        userId: enteredById,
        action: 'gradebook.marks-bulk',
        entity: 'Assessment',
        entityId: assessmentId,
        metadata: JSON.stringify({ count: dto.marks.length, studentIds: dto.marks.map((m) => m.studentId) }),
      },
    });
    return results;
  });

  return records.map((r) => ({
    id: r.id,
    assessmentId: r.assessmentId,
    studentId: r.studentId,
    obtainedMarks: r.obtainedMarks,
  }));
}
```
Add `BadRequestException` to the existing `@nestjs/common` import line at the top of the file.

- [ ] **Step 3: Add the route to `assessments.controller.ts`**

```ts
@Post(':id/marks')
async saveMarks(@Param('id') id: string, @Body() dto: BulkMarksDto, @Req() req: AuthenticatedRequest) {
  const classId = await this.assessmentsService.classIdForAssessment(id);
  await this.studentAccess.assertCanAccessClass(req.user, classId);
  return this.assessmentsService.saveMarksBulk(id, dto, req.user.id);
}
```
(Add `import { BulkMarksDto } from './dto/bulk-marks.dto';` to the controller's imports.)

- [ ] **Step 4: Add e2e cases**

```ts
describe('Bulk marks', () => {
  it('saves marks for the enrolled students in one transaction', async () => {
    const teacherToken = await loginAs('gb-teacher');
    const res = await request(app.getHttpServer())
      .post(`/api/v1/assessments/${ids.assessmentQuiz1}/marks`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ marks: [{ studentId: ids.student, obtainedMarks: 18 }] })
      .expect(201);
    expect(res.body[0]).toMatchObject({ studentId: ids.student, obtainedMarks: 18 });
  });

  it('rejects obtainedMarks greater than the assessment\'s maxMarks', async () => {
    const teacherToken = await loginAs('gb-teacher');
    await request(app.getHttpServer())
      .post(`/api/v1/assessments/${ids.assessmentQuiz1}/marks`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ marks: [{ studentId: ids.student, obtainedMarks: 999 }] })
      .expect(400);
  });

  it('rejects a studentId not enrolled in the assessment\'s class', async () => {
    const teacherToken = await loginAs('gb-teacher');
    await request(app.getHttpServer())
      .post(`/api/v1/assessments/${ids.assessmentQuiz1}/marks`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ marks: [{ studentId: 'not-a-real-student-id', obtainedMarks: 10 }] })
      .expect(400);
  });
});
```

- [ ] **Step 5: Run the e2e suite**

Run: `cd backend && npx jest --config test/jest-e2e.json gradebook.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/gradebook backend/test/gradebook.e2e-spec.ts
git commit -m "feat(gradebook): add bulk marks-entry endpoint"
```

---

### Task 7: `GET /students/:id/grades` computation endpoint

**Files:**
- Create: `backend/src/gradebook/grades.service.ts`, `backend/src/gradebook/grades.controller.ts`
- Modify: `backend/src/gradebook/gradebook.module.ts`
- Modify: `backend/test/gradebook.e2e-spec.ts`

**Interfaces:**
- Consumes: `StudentAccessService.assertCanAccessStudent` (existing); `Mark`/`Assessment`/
  `AssessmentCategory` rows from Tasks 4-6.
- Produces: `GET /api/v1/students/:id/grades?termId=` returning
  `{ subjectId: string; subjectName: string; categories: { name: string; weightPercent: number; obtainedPercent: number }[]; finalPercent: number }[]`
  — Task 10 (report-card integration on both clients) is the consumer.

- [ ] **Step 1: Write `grades.service.ts`**

```ts
// backend/src/gradebook/grades.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SubjectGrade {
  subjectId: string;
  subjectName: string;
  categories: { name: string; weightPercent: number; obtainedPercent: number }[];
  finalPercent: number;
}

@Injectable()
export class GradesService {
  constructor(private readonly prisma: PrismaService) {}

  async forStudent(studentId: string, termId: string): Promise<SubjectGrade[]> {
    const categories = await this.prisma.assessmentCategory.findMany({
      where: { termId },
      include: {
        assessments: {
          include: {
            subject: { select: { id: true, name: true } },
            marks: { where: { studentId }, select: { obtainedMarks: true } },
          },
        },
      },
    });

    const bySubject = new Map<string, SubjectGrade>();
    for (const category of categories) {
      const bySubjectInCategory = new Map<string, { obtained: number; max: number; subjectName: string }>();
      for (const assessment of category.assessments) {
        const entry = bySubjectInCategory.get(assessment.subjectId) ?? {
          obtained: 0,
          max: 0,
          subjectName: assessment.subject.name,
        };
        entry.max += assessment.maxMarks;
        entry.obtained += assessment.marks[0]?.obtainedMarks ?? 0;
        bySubjectInCategory.set(assessment.subjectId, entry);
      }

      for (const [subjectId, { obtained, max, subjectName }] of bySubjectInCategory) {
        const obtainedPercent = max > 0 ? (obtained / max) * 100 : 0;
        const grade = bySubject.get(subjectId) ?? { subjectId, subjectName, categories: [], finalPercent: 0 };
        grade.categories.push({ name: category.name, weightPercent: category.weightPercent, obtainedPercent });
        grade.finalPercent += (category.weightPercent / 100) * obtainedPercent;
        bySubject.set(subjectId, grade);
      }
    }

    return [...bySubject.values()].map((g) => ({
      ...g,
      finalPercent: Math.round(g.finalPercent * 10) / 10,
      categories: g.categories.map((c) => ({ ...c, obtainedPercent: Math.round(c.obtainedPercent * 10) / 10 })),
    }));
  }
}
```

- [ ] **Step 2: Write `grades.controller.ts`**

```ts
// backend/src/gradebook/grades.controller.ts
import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { GradesService } from './grades.service';
import { StudentAccessService, type RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/students')
export class GradesController {
  constructor(
    private readonly gradesService: GradesService,
    private readonly studentAccess: StudentAccessService,
  ) {}

  @Get(':id/grades')
  async forStudent(
    @Param('id') studentId: string,
    @Query('termId') termId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.studentAccess.assertCanAccessStudent(req.user, studentId);
    return this.gradesService.forStudent(studentId, termId);
  }
}
```

- [ ] **Step 3: Register in `gradebook.module.ts`**

Add `GradesService` to `providers` and `GradesController` to `controllers`.

- [ ] **Step 4: Add e2e cases**

```ts
describe('Grades computation', () => {
  it('computes a weighted final percentage across two categories, with an ungraded category contributing 0', async () => {
    const teacherToken = await loginAs('gb-teacher');
    // Quiz 1: 18/20 already saved in Task 6's test (Quizzes category, 30% weight).
    // Add a Final Exam assessment (Final Exam category, 70% weight) but never enter marks for it —
    // this is the spec's "zero entered marks contributes 0, not null" case, not merely "no assessment
    // exists yet".
    const assessmentRes = await request(app.getHttpServer())
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ assessmentCategoryId: ids.categoryFinal, subjectId: ids.subject, label: 'Final Exam', maxMarks: 100 })
      .expect(201);
    ids.assessmentFinal = assessmentRes.body.id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.student}/grades?termId=${ids.term1}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const subjectGrade = res.body.find((g: { subjectId: string }) => g.subjectId === ids.subject);
    expect(subjectGrade.categories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Quizzes', obtainedPercent: 90 }),
        expect.objectContaining({ name: 'Final Exam', obtainedPercent: 0 }),
      ]),
    );
    // (30% weight × 90% obtained) + (70% weight × 0% obtained, ungraded) = 27
    expect(subjectGrade.finalPercent).toBe(27);
  });

  it('a parent can read their own child\'s grades, not another parent\'s child', async () => {
    const parentToken = await loginAs('gb-parent');
    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.student}/grades?termId=${ids.term1}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    const otherParentToken = await loginAs('gb-other-parent');
    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.student}/grades?termId=${ids.term1}`)
      .set('Authorization', `Bearer ${otherParentToken}`)
      .expect(403);
  });
});
```
Add this to the file's `beforeAll` block, after `ids.student` is created:
```ts
const parentUser = await prisma.user.create({
  data: { identifier: 'gb-parent', passwordHash, role: 'PARENT' },
});
const parentProfile = await prisma.parentProfile.create({
  data: { userId: parentUser.id, name: 'GB Parent' },
});
await prisma.studentParent.create({ data: { studentId: ids.student, parentProfileId: parentProfile.id } });

const otherStudent = await prisma.student.create({ data: { grNumber: 'GB-OTHER-1', name: 'Other Student' } });
const otherParentUser = await prisma.user.create({
  data: { identifier: 'gb-other-parent', passwordHash, role: 'PARENT' },
});
const otherParentProfile = await prisma.parentProfile.create({
  data: { userId: otherParentUser.id, name: 'GB Other Parent' },
});
await prisma.studentParent.create({
  data: { studentId: otherStudent.id, parentProfileId: otherParentProfile.id },
});
```

- [ ] **Step 5: Run the e2e suite**

Run: `cd backend && npx jest --config test/jest-e2e.json gradebook.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npm test && npm run test:e2e`
Expected: all green, no regressions.

- [ ] **Step 7: Commit**

```bash
git add backend/src/gradebook backend/test/gradebook.e2e-spec.ts
git commit -m "feat(gradebook): add weighted grade computation endpoint"
```

---

### Task 8: Terms + Assessment Categories admin screens (staff-console)

**Files:**
- Modify: `staff-console/src/lib/api.ts` (add types + methods)
- Create: `staff-console/src/views/TermsManagementView.vue`, `staff-console/src/views/TermsManagementView.spec.ts`
- Create: `staff-console/src/views/AssessmentCategoriesView.vue`, `staff-console/src/views/AssessmentCategoriesView.spec.ts`
- Create: `staff-console/src/views/TermsManagementPageView.vue`, `staff-console/src/views/AssessmentCategoriesPageView.vue`
- Modify: `staff-console/src/router/index.ts`, `staff-console/src/components/AppShell.vue`,
  `staff-console/src/locales/en.json`, `staff-console/src/locales/ur.json`

**Interfaces:**
- Consumes: `api.listAcademicSessions`, `api.listClasses` (existing).
- Produces: `api.listTerms/createTerm/updateTerm/deleteTerm`,
  `api.listAssessmentCategories/createAssessmentCategory/updateAssessmentCategory/deleteAssessmentCategory` —
  Task 9's `MarksEntryView.vue` calls `api.listAssessmentCategories` and `api.listTerms` too.

- [ ] **Step 1: Add API types and methods to `staff-console/src/lib/api.ts`**

```ts
export interface TermSummary {
  id: string;
  academicSessionId: string;
  label: string;
  order: number;
  startDate: string;
  endDate: string;
}

export interface AssessmentCategorySummary {
  id: string;
  classId: string;
  termId: string;
  name: string;
  weightPercent: number;
  weightTotalWarning?: string | null;
}
```
Add these methods to the `api` object, following the exact `fetch`/`authHeaders`/`asJson` shape
every other method in this file already uses (mirror `listHolidays`/`createHoliday`/
`updateHoliday`/`deleteHoliday` exactly, changing only the URL and payload shape):
`listTerms(accessToken, academicSessionId)`, `createTerm(accessToken, payload)`,
`updateTerm(accessToken, id, payload)`, `deleteTerm(accessToken, id)`,
`listAssessmentCategories(accessToken, classId, termId)`, `createAssessmentCategory(accessToken, payload)`,
`updateAssessmentCategory(accessToken, id, payload)`, `deleteAssessmentCategory(accessToken, id)`.

- [ ] **Step 2: Write `TermsManagementView.vue`**

Mirror `staff-console/src/views/HolidaysView.vue`'s exact structure (an `EntityTable`, an
`AppModal`-based add form, `FormField`s for `label`/`order`/`startDate`/`endDate`, an
`academicSessionId` select at the top driving which terms load) — read that file once more
immediately before writing this one so the markup/testid conventions match exactly
(`open-add-form`, `add-{field}`, `edit-{id}`, `edit-{field}-{id}`, `save-{id}`, `delete-{id}`).

- [ ] **Step 3: Write `TermsManagementView.spec.ts`**

Mirror `staff-console/src/views/HolidaysView.spec.ts` (Task 1 of the Sprint M plan, or the version
already in the tree by the time this task runs) — same CRUD test shape: list, create, edit, delete
with confirm, error state.

- [ ] **Step 4: Run the spec**

Run: `cd staff-console && npx vitest run src/views/TermsManagementView.spec.ts`
Expected: PASS.

- [ ] **Step 5: Write `AssessmentCategoriesView.vue`**

A class picker + term picker (two `FormField` selects) drive which categories load
(`api.listAssessmentCategories`); an `EntityTable` lists them with an inline `weightTotalWarning`
banner (`role="alert"`, non-blocking) when the create/update response carries one; add/edit/delete
follow the same pattern as `HolidaysView.vue`.

- [ ] **Step 6: Write `AssessmentCategoriesView.spec.ts`**

Cover: loads categories once both class and term are picked; creates a category and shows the
warning banner when the response's `weightTotalWarning` is non-null; does not show a banner when
it's `null`; edit and delete follow the established pattern; error state on a rejected call.

- [ ] **Step 7: Run the spec**

Run: `cd staff-console && npx vitest run src/views/AssessmentCategoriesView.spec.ts`
Expected: PASS.

- [ ] **Step 8: Wire routes, nav, and page wrappers**

Create `TermsManagementPageView.vue` and `AssessmentCategoriesPageView.vue` as the standard
`<AppShell><TheView /></AppShell>` wrapper (per every other `*PageView.vue` in this codebase — no
spec for these, matching the established zero-logic-wrapper convention confirmed in Sprint M).
Add two routes in `staff-console/src/router/index.ts` near the other admin routes:
`/admin/terms` (`meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'], title: 'Terms' }`) and
`/admin/assessment-categories` (same role gate, title `'Assessment Categories'`). Add two
`RouterLink`s to `AppShell.vue`'s admin nav group (near `nav-holidays`, `AppShell.vue:469`), gated
by new `canManageGradebook` computed (`auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN'`,
mirroring `canManageHolidays` at line 81), with `data-testid="nav-terms"`/`data-testid="nav-assessment-categories"`.
Add `"terms": "Terms"` and `"assessmentCategories": "Assessment Categories"` to the `nav` object in
both `staff-console/src/locales/en.json` and `staff-console/src/locales/ur.json` (Urdu:
`"شرائط"`/`"جانچ کے زمرے"` — confirm these read naturally with a native/fluent Urdu speaker before
merging, matching this project's existing bar for its Urdu translations).

- [ ] **Step 9: Run the full staff-console suite**

Run: `cd staff-console && npx vitest run && npx vue-tsc --noEmit`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add staff-console/src
git commit -m "feat(gradebook): add Terms and Assessment Categories admin screens"
```

---

### Task 9: Marks-entry screen (staff-console, teacher-facing)

**Files:**
- Modify: `staff-console/src/lib/api.ts` (add assessment/marks types + methods)
- Create: `staff-console/src/views/MarksEntryView.vue`, `staff-console/src/views/MarksEntryView.spec.ts`
- Create: `staff-console/src/views/MarksEntryPageView.vue`
- Modify: `staff-console/src/router/index.ts`, `staff-console/src/components/AppShell.vue`,
  `staff-console/src/locales/en.json`, `staff-console/src/locales/ur.json`

**Interfaces:**
- Consumes: `api.listSections`, `api.sectionStudents` (existing, from `AttendanceView.vue`'s
  pattern); `api.listAssessmentCategories`, `api.listTerms` (Task 8).
- Produces: `api.listAssessments(accessToken, assessmentCategoryId)`,
  `api.createAssessment(accessToken, payload)`,
  `api.saveMarksBulk(accessToken, assessmentId, marks)` — no later task consumes these.

- [ ] **Step 1: Add API types and methods to `staff-console/src/lib/api.ts`**

```ts
export interface AssessmentSummary {
  id: string;
  assessmentCategoryId: string;
  subjectId: string;
  label: string;
  maxMarks: number;
}
```
Add `listAssessments(accessToken, assessmentCategoryId)`,
`createAssessment(accessToken, payload: { assessmentCategoryId, subjectId, label, maxMarks })`,
`saveMarksBulk(accessToken, assessmentId, payload: { marks: { studentId: string; obtainedMarks: number }[] })`
posting to `/api/v1/assessments/${assessmentId}/marks` — mirror `markAttendanceBulk`'s exact
`fetch`/error-handling shape.

- [ ] **Step 2: Write `MarksEntryView.vue`**

Mirror `staff-console/src/views/AttendanceView.vue`'s exact structure (`ref`s for `sections`,
`selectedSectionId`, `students`; a `marks` record keyed by `studentId`; `onSectionChange` loads
`sectionStudents`; a picker cascade of class→term→category→assessment feeding the roster load; one
numeric input per student row bound to `marks[student.id]`; `onSave` calls `api.saveMarksBulk`) —
read `AttendanceView.vue` in full immediately before writing this one so the loading/error/testid
conventions match exactly. Key `data-testid`s: `select-section`, `select-term`, `select-category`,
`select-assessment`, `marks-input-{studentId}`, `save-marks`.

- [ ] **Step 3: Write `MarksEntryView.spec.ts`**

Mirror `staff-console/src/views/AttendanceView.spec.ts`'s structure: loads sections → selecting a
section loads students → selecting term/category/assessment loads the assessment's `maxMarks` →
entering marks and saving calls `api.saveMarksBulk` with the right payload shape → an error (e.g.
"obtained marks exceed maximum") surfaces via `[role="alert"]`.

- [ ] **Step 4: Run the spec**

Run: `cd staff-console && npx vitest run src/views/MarksEntryView.spec.ts`
Expected: PASS.

- [ ] **Step 5: Wire the route, nav link, and translations**

Create `MarksEntryPageView.vue` (standard wrapper, no spec). Add `/teacher/gradebook` in
`staff-console/src/router/index.ts` (`meta: { requiresRole: ['TEACHER'], title: 'Gradebook' }`).
Add `<RouterLink data-testid="nav-gradebook" to="/teacher/gradebook"><Icon name="grid" />{{
t('nav.gradebook') }}</RouterLink>` inside the `isTeacher` block in `AppShell.vue`
(`AppShell.vue:422-428`, alongside `nav-report-cards`). Add `"gradebook": "Gradebook"` to `en.json`'s
`nav` object and `"gradebook": "گریڈ بک"` to `ur.json`'s.

- [ ] **Step 6: Run the full staff-console suite**

Run: `cd staff-console && npx vitest run && npx vue-tsc --noEmit`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add staff-console/src
git commit -m "feat(gradebook): add teacher marks-entry screen"
```

---

### Task 10: Report-card integration (structured grades, PDF fallback)

**Files:**
- Modify: `staff-console/src/lib/api.ts` (add `getStudentGrades`)
- Modify: `staff-console/src/views/ReportCardsView.vue`, `staff-console/src/views/ReportCardsView.spec.ts`
- Modify: `staff-console/src/views/TeacherReportCardsView.vue`, `staff-console/src/views/TeacherReportCardsView.spec.ts`
- Modify: `parent-app/lib/src/screens/report_cards_screen.dart`
- Modify: `parent-app/lib/src/api/api_client.dart`, `parent-app/lib/src/api/models.dart`
- Modify (or create, if Sprint M hasn't landed yet): `parent-app/test/screens/report_cards_screen_test.dart`

**Interfaces:**
- Consumes: `GET /api/v1/students/:id/grades?termId=` (Task 7).
- Produces: nothing consumed elsewhere — this is the final consumer in the gradebook feature.

- [ ] **Step 1: Add `getStudentGrades` to `staff-console/src/lib/api.ts`**

```ts
export interface SubjectGrade {
  subjectId: string;
  subjectName: string;
  categories: { name: string; weightPercent: number; obtainedPercent: number }[];
  finalPercent: number;
}
```
Add `getStudentGrades(accessToken, studentId, termId): Promise<SubjectGrade[]>` calling
`GET /api/v1/students/${studentId}/grades?termId=${termId}`, mirroring `listReportCards`'s exact
shape.

- [ ] **Step 2: Extend `ReportCardsView.vue`**

Add a term picker (`api.listTerms`, scoped to the selected academic session) next to the existing
session picker. When a term is picked and `api.getStudentGrades` returns a non-empty array, render
a per-subject table (subject name, each category's weight/obtained%, final %) above the existing
PDF list; when it returns empty (no categories configured for that student's class/term yet), show
only the existing PDF list exactly as today — no behavior change for schools that haven't adopted
structured grading.

- [ ] **Step 3: Add a test case to `ReportCardsView.spec.ts`**

```ts
it('shows a structured grade table when the school has adopted the gradebook for this class/term', async () => {
  vi.mocked(api.listReportCards).mockResolvedValue([]);
  vi.mocked(api.listTerms).mockResolvedValue([
    { id: 'term-1', academicSessionId: 'sess-1', label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' },
  ]);
  vi.mocked(api.getStudentGrades).mockResolvedValue([
    { subjectId: 'sub-1', subjectName: 'Math', categories: [{ name: 'Quizzes', weightPercent: 30, obtainedPercent: 90 }], finalPercent: 27 },
  ]);

  const wrapper = mount(ReportCardsView);
  await flushPromises();
  await wrapper.find('[data-testid="select-student"]').setValue('s1');
  await wrapper.find('[data-testid="select-session"]').setValue('sess-1');
  await wrapper.find('[data-testid="select-term"]').setValue('term-1');
  await flushPromises();

  expect(wrapper.text()).toContain('Math');
  expect(wrapper.text()).toContain('27%');
});

it('falls back to the PDF list when no structured grades exist for this term', async () => {
  vi.mocked(api.listReportCards).mockResolvedValue([
    { id: 'rc1', studentId: 's1', academicSessionId: 'sess-1', fileId: 'f1', createdAt: '2026-06-01T00:00:00.000Z' },
  ]);
  vi.mocked(api.listTerms).mockResolvedValue([
    { id: 'term-1', academicSessionId: 'sess-1', label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' },
  ]);
  vi.mocked(api.getStudentGrades).mockResolvedValue([]);

  const wrapper = mount(ReportCardsView);
  await flushPromises();
  await wrapper.find('[data-testid="select-student"]').setValue('s1');
  await wrapper.find('[data-testid="select-session"]').setValue('sess-1');
  await wrapper.find('[data-testid="select-term"]').setValue('term-1');
  await flushPromises();

  expect(wrapper.find('[data-testid="download-rc1"]').exists()).toBe(true);
});
```
(Add `listTerms: vi.fn()` and `getStudentGrades: vi.fn()` to the file's existing mock factory and
`beforeEach` resets first.)

- [ ] **Step 4: Repeat Steps 2-3 for `TeacherReportCardsView.vue`/`.spec.ts`**

Same extension, same fallback behavior, same two new test cases — this view has its own separate
student/section-scoped data loading (per `TeacherReportCardsView.spec.ts`'s existing
`listSections`/`sectionStudents` mocks), so the term picker and grade table are added to this file
independently, not shared via a common component in this sprint.

- [ ] **Step 5: Run both specs**

Run: `cd staff-console && npx vitest run src/views/ReportCardsView.spec.ts src/views/TeacherReportCardsView.spec.ts`
Expected: PASS.

- [ ] **Step 6: Extend `parent-app`'s `ApiClient` and models**

In `parent-app/lib/src/api/models.dart`, add:
```dart
class SubjectGrade {
  const SubjectGrade({
    required this.subjectId,
    required this.subjectName,
    required this.categories,
    required this.finalPercent,
  });

  final String subjectId;
  final String subjectName;
  final List<GradeCategory> categories;
  final double finalPercent;

  factory SubjectGrade.fromJson(Map<String, dynamic> json) => SubjectGrade(
    subjectId: json['subjectId'] as String,
    subjectName: json['subjectName'] as String,
    categories: (json['categories'] as List<dynamic>)
        .map((e) => GradeCategory.fromJson(e as Map<String, dynamic>))
        .toList(),
    finalPercent: (json['finalPercent'] as num).toDouble(),
  );
}

class GradeCategory {
  const GradeCategory({required this.name, required this.weightPercent, required this.obtainedPercent});

  final String name;
  final double weightPercent;
  final double obtainedPercent;

  factory GradeCategory.fromJson(Map<String, dynamic> json) => GradeCategory(
    name: json['name'] as String,
    weightPercent: (json['weightPercent'] as num).toDouble(),
    obtainedPercent: (json['obtainedPercent'] as num).toDouble(),
  );
}
```
In `parent-app/lib/src/api/api_client.dart`, add (near `reportCards`):
```dart
Future<List<SubjectGrade>> studentGrades(String accessToken, String studentId, String termId) async {
  final list = await _get(
    '/api/v1/students/$studentId/grades?termId=${Uri.encodeQueryComponent(termId)}',
    accessToken,
  ) as List<dynamic>;
  return list.map((e) => SubjectGrade.fromJson(e as Map<String, dynamic>)).toList();
}
```

- [ ] **Step 7: Extend `report_cards_screen.dart`**

Add a `_grades` state list loaded alongside `_reportCards` (best-effort — a failure loading grades
should not block the existing PDF list, matching `AdminHomeView.vue`'s established
"non-critical, swallow and continue" precedent for a secondary data source). When `_grades` is
non-empty, render a per-subject `Card` (subject name, final percent) above the existing report-card
list; when empty, the screen behaves exactly as it does today.

- [ ] **Step 8: Add widget test cases**

```dart
testWidgets('shows a structured grade card when the gradebook has data for this child', (tester) async {
  final api = ApiClient(
    baseUrl: 'http://test',
    client: MockClient((request) async {
      if (request.url.path == '/api/v1/report-cards') return http.Response(jsonEncode(<dynamic>[]), 200);
      if (request.url.path.contains('/grades')) {
        return http.Response(
          jsonEncode([
            {
              'subjectId': 'sub-1',
              'subjectName': 'Math',
              'categories': [
                {'name': 'Quizzes', 'weightPercent': 30, 'obtainedPercent': 90},
              ],
              'finalPercent': 27,
            },
          ]),
          200,
        );
      }
      return http.Response('not found', 404);
    }),
  );

  await tester.pumpWidget(
    MaterialApp(home: ReportCardsScreen(accessToken: 'tok', api: api, children: const [_child])),
  );
  await tester.pumpAndSettle();

  expect(find.text('Math'), findsOneWidget);
  expect(find.textContaining('27%'), findsOneWidget);
});
```
(Add this to `parent-app/test/screens/report_cards_screen_test.dart` — the file created in Sprint
M's Task 8 if that sprint has already landed, or created fresh here per Sprint M's own template if
not; either way, add `_child`'s existing const fixture rather than redefining it.)

- [ ] **Step 9: Run the parent-app suite**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add staff-console/src parent-app/lib parent-app/test
git commit -m "feat(gradebook): integrate structured grades into report-card screens, PDF fallback preserved"
```

---

### Task 11: Full-suite verification and roadmap update

**Files:** `docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` (roadmap checklist only).

- [ ] **Step 1: Run every suite**

```bash
cd backend && npm test && npm run test:e2e && npm run build
cd ../staff-console && npx vitest run && npx vue-tsc --noEmit && npm run lint
cd ../parent-app && flutter analyze && flutter test
```
Expected: all green, clean build/lint.

- [ ] **Step 2: Update the roadmap doc's Implementation Checklist**

Check off Sprint N's box and sub-items in
`docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`, noting the merge commit range
and date, matching the established format from Sprints A-M.

- [ ] **Step 3: Commit**

```bash
git add docs/Plan-Ideas/PHASE-1/SchoolPortal-PostMVP-Roadmap-2026-09-08.md
git commit -m "docs: mark Sprint N complete in the roadmap checklist"
```
