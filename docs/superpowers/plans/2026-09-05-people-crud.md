# People CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `SUPER_ADMIN`/`SCHOOL_ADMIN` real Create/Read/Update/Delete for Student, Teacher,
and Parent — today all three exist only via `prisma/seed.ts`. Teacher and Parent each require
creating a `User` login account alongside their profile (the first real account-creation code path
in this codebase); Student creation combines a Student record, its Enrollment, and a Parent link
(existing or newly created) in one transaction, so a Student is never left invisible everywhere.

**Architecture:** Three new NestJS modules (`teacher/`, `parent/`, `student/` — all singular,
distinct from the existing plural `teachers/` picker module which is untouched), each
`@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')`, audit-logged, using the existing `assertDeletable` helper
for delete and a new companion `assertCreatable` helper for duplicate-identifier rejection. A
shared `createParentWithUser(tx, dto)` function (not a service method) does the actual
User+ParentProfile creation inside a given Prisma transaction client — `ParentService.create()`
wraps it in its own transaction; `StudentService.create()` calls it inside its own larger
transaction when the request carries a new-parent payload instead of an existing `parentProfileId`
— so there is exactly one User+ParentProfile creation code path, not two. staff-console gets 3 new
bespoke screens following the Org Structure precedent.

**Tech Stack:** NestJS + Prisma (backend, already in place), `argon2` (already a dependency, used
today only in `prisma/seed.ts` — this plan's Teacher/Parent creation is its first real application
use), Vue 3 Composition API + Vitest (staff-console). No new dependencies, no migration (every
model this plan uses already exists).

**Spec:** `docs/superpowers/specs/2026-09-05-people-crud-design.md`

## Global Constraints

- Every write gets an `AuditLog` row (`action`, `entity`, `entityId`, optional `metadata` as
  `JSON.stringify(...)`, **never including the raw password** — hash it before it reaches
  anything logged), action names follow `entity.verb`.
- Every route in this plan is `@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')` — day-to-day operational
  data, not `SUPER_ADMIN`-only like Org Structure.
- Route paths use the existing `@Controller('api/v1')` + per-method path convention, namespaced
  under `/admin/` (`/api/v1/admin/teachers`, `/api/v1/admin/parents`, `/api/v1/admin/students`) so
  none of them collide with the existing read-only `/api/v1/teachers` or `/api/v1/sections` picker
  routes, which stay untouched.
- Passwords are hashed with `argon2.hash(...)` (already imported this way in
  `backend/src/auth/auth.service.ts` and `prisma/seed.ts`: `import * as argon2 from 'argon2'`)
  before ever reaching Prisma — never store or log a raw password.
- `identifier`/role are not updatable on an existing Teacher/Parent account — that's effectively
  "create a different account." `update()` covers name/phone/password-reset only.
- A Student's `Enrollment` is not editable via this plan's `update()` — no re-enrollment/transfer
  workflow exists yet (a known, separately-tracked future gap per `PROJECT-STATUS.md`). Student
  `update()` covers `name`/`grNumber` only.
- Every `DELETE` handler uses the existing `assertDeletable` helper
  (`backend/src/common/prisma-delete-guard.ts`) to translate a Prisma P2003 into a 400.
- Every `POST` that creates a `User` uses the new `assertCreatable` helper (Task 1) to translate a
  Prisma P2002 (duplicate `identifier`) into a clean 400.
- `backend/tsconfig.json` has `isolatedModules: true` — `npx jest` does NOT catch cross-file
  TypeScript errors; only `npx tsc --noEmit -p .` does. A prior feature in this same codebase had
  exactly this bug slip through `npx jest`.
- Delete confirmation in the UI uses the browser's native `window.confirm(...)`, matching every Org
  Structure screen (not a bespoke modal — see that plan's Global Constraints for the reasoning,
  unchanged here).

---

### Task 1: Backend — shared `assertCreatable` helper

**Files:**
- Create: `backend/src/common/prisma-create-guard.ts`
- Create: `backend/src/common/prisma-create-guard.spec.ts`

**Interfaces:**
- Produces: `assertCreatable(error: unknown, message: string): never` — every Teacher/Parent/
  Student create path in this plan calls this from its `catch` block when the create involves a
  `User.identifier` unique constraint.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/common/prisma-create-guard.spec.ts
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertCreatable } from './prisma-create-guard';

function makeP2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

describe('assertCreatable', () => {
  it('translates a P2002 unique-constraint violation into a BadRequestException with the given message', () => {
    expect(() => assertCreatable(makeP2002(), 'This identifier is already in use.')).toThrow(
      BadRequestException,
    );
    try {
      assertCreatable(makeP2002(), 'This identifier is already in use.');
    } catch (err) {
      expect((err as BadRequestException).message).toBe('This identifier is already in use.');
    }
  });

  it('rethrows any other error unchanged', () => {
    const other = new Error('boom');
    expect(() => assertCreatable(other, 'x')).toThrow(other);
  });

  it('rethrows a Prisma error with a different code unchanged', () => {
    const notFound = new Prisma.PrismaClientKnownRequestError('Record not found', {
      code: 'P2025',
      clientVersion: 'test',
    });
    expect(() => assertCreatable(notFound, 'x')).toThrow(notFound);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest prisma-create-guard.spec.ts`
Expected: FAIL — cannot find module `./prisma-create-guard`.

- [ ] **Step 3: Implement `assertCreatable`**

```ts
// backend/src/common/prisma-create-guard.ts
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Every People-CRUD create() that provisions a User calls this from its catch block. Translates
 * a Prisma unique-constraint failure (P2002 — e.g. a duplicate User.identifier) into a clear 400
 * instead of letting a raw 500 reach the client. Any other error is rethrown unchanged.
 */
export function assertCreatable(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new BadRequestException(message);
  }
  throw error;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest prisma-create-guard.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full backend suite and tsc**

Run: `cd backend && npx jest && npx tsc --noEmit -p .`
Expected: PASS, zero tsc errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/common/prisma-create-guard.ts backend/src/common/prisma-create-guard.spec.ts
git commit -m "$(cat <<'EOF'
Add shared assertCreatable helper for duplicate-identifier rejection

Companion to assertDeletable (Org Structure CRUD) — every People-CRUD
create() that provisions a User calls this to translate a Prisma
P2002 (duplicate identifier) into a clean 400 instead of a raw 500.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCiQSXc5fWtUYgGYiwKVgu
EOF
)"
```

---

### Task 2: Backend — Parent module (User + ParentProfile)

**Files:**
- Create: `backend/src/parent/dto/create-parent.dto.ts`
- Create: `backend/src/parent/dto/update-parent.dto.ts`
- Create: `backend/src/parent/create-parent-with-user.ts`
- Create: `backend/src/parent/create-parent-with-user.spec.ts`
- Create: `backend/src/parent/parent.service.ts`
- Create: `backend/src/parent/parent.service.spec.ts`
- Create: `backend/src/parent/parent.controller.ts`
- Create: `backend/src/parent/parent.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `createParentWithUser(tx: Prisma.TransactionClient, dto: { identifier: string;
  password: string; name: string; phone?: string }): Promise<{ id: string; identifier: string;
  name: string; phone: string | null }>` — a plain exported function (not a class method), so
  Task 4 (Student) can call it inside its own `$transaction` without going through
  `ParentService`'s own separate transaction. `ParentSummary = { id: string; identifier: string;
  name: string; phone: string | null; childrenCount: number }`,
  `ParentService.create(dto, actingUserId): Promise<ParentSummary>`,
  `ParentService.list(): Promise<ParentSummary[]>`,
  `ParentService.update(id, dto, actingUserId): Promise<ParentSummary>`,
  `ParentService.delete(id, actingUserId): Promise<void>`.
- Consumes: `assertDeletable` (`backend/src/common/prisma-delete-guard.ts`), `assertCreatable`
  (Task 1).

- [ ] **Step 1: Write the failing test for `createParentWithUser`**

```ts
// backend/src/parent/create-parent-with-user.spec.ts
import * as argon2 from 'argon2';
import { createParentWithUser } from './create-parent-with-user';

jest.mock('argon2', () => ({ hash: jest.fn() }));

describe('createParentWithUser', () => {
  it('hashes the password, creates a User with role PARENT, then a linked ParentProfile', async () => {
    jest.mocked(argon2.hash).mockResolvedValue('hashed-password' as never);
    const tx = {
      user: { create: jest.fn().mockResolvedValue({ id: 'u1', identifier: 'parent-x@seeds.edu.pk' }) },
      parentProfile: {
        create: jest.fn().mockResolvedValue({ id: 'p1', name: 'New Parent', phone: '0300-1234567' }),
      },
    };

    const result = await createParentWithUser(tx as never, {
      identifier: 'parent-x@seeds.edu.pk',
      password: 'ChangeMe123!',
      name: 'New Parent',
      phone: '0300-1234567',
    });

    expect(argon2.hash).toHaveBeenCalledWith('ChangeMe123!');
    expect(tx.user.create).toHaveBeenCalledWith({
      data: { identifier: 'parent-x@seeds.edu.pk', passwordHash: 'hashed-password', role: 'PARENT' },
    });
    expect(tx.parentProfile.create).toHaveBeenCalledWith({
      data: { userId: 'u1', name: 'New Parent', phone: '0300-1234567' },
    });
    expect(result).toEqual({ id: 'p1', identifier: 'parent-x@seeds.edu.pk', name: 'New Parent', phone: '0300-1234567' });
  });

  it('creates a ParentProfile with no phone when none is given', async () => {
    jest.mocked(argon2.hash).mockResolvedValue('hashed-password' as never);
    const tx = {
      user: { create: jest.fn().mockResolvedValue({ id: 'u2', identifier: 'parent-y@seeds.edu.pk' }) },
      parentProfile: { create: jest.fn().mockResolvedValue({ id: 'p2', name: 'Another Parent', phone: null }) },
    };

    await createParentWithUser(tx as never, {
      identifier: 'parent-y@seeds.edu.pk',
      password: 'ChangeMe123!',
      name: 'Another Parent',
    });

    expect(tx.parentProfile.create).toHaveBeenCalledWith({
      data: { userId: 'u2', name: 'Another Parent', phone: undefined },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest create-parent-with-user.spec.ts`
Expected: FAIL — cannot find module `./create-parent-with-user`.

- [ ] **Step 3: Implement `createParentWithUser`**

```ts
// backend/src/parent/create-parent-with-user.ts
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';

export interface CreateParentInput {
  identifier: string;
  password: string;
  name: string;
  phone?: string;
}

export interface CreatedParent {
  id: string;
  identifier: string;
  name: string;
  phone: string | null;
}

/**
 * The one place a Parent's User + ParentProfile are created together — called both from
 * ParentService.create() (its own top-level transaction) and from StudentService.create() (when
 * a request carries a new-parent payload instead of an existing parentProfileId, inside that
 * larger transaction) — so there is exactly one User+ParentProfile creation code path, not two.
 * Takes a Prisma transaction client, not PrismaService, so the caller controls the transaction
 * boundary.
 */
export async function createParentWithUser(
  tx: Prisma.TransactionClient,
  dto: CreateParentInput,
): Promise<CreatedParent> {
  const passwordHash = await argon2.hash(dto.password);
  const user = await tx.user.create({
    data: { identifier: dto.identifier, passwordHash, role: 'PARENT' },
  });
  const parentProfile = await tx.parentProfile.create({
    data: { userId: user.id, name: dto.name, phone: dto.phone },
  });
  return { id: parentProfile.id, identifier: user.identifier, name: parentProfile.name, phone: parentProfile.phone };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npx jest create-parent-with-user.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing test for `ParentService`**

```ts
// backend/src/parent/parent.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ParentService } from './parent.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('argon2', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

describe('ParentService', () => {
  let service: ParentService;
  let tx: { user: { create: jest.Mock }; parentProfile: { create: jest.Mock } };
  let prisma: {
    parentProfile: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { update: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      user: { create: jest.fn() },
      parentProfile: { create: jest.fn() },
    };
    prisma = {
      parentProfile: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      user: { update: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ParentService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ParentService);
  });

  it('creates a Parent (User + ParentProfile) and audit-logs it without leaking the password', async () => {
    tx.user.create.mockResolvedValue({ id: 'u1', identifier: 'parent-x@seeds.edu.pk' });
    tx.parentProfile.create.mockResolvedValue({ id: 'p1', name: 'New Parent', phone: null });

    const result = await service.create(
      { identifier: 'parent-x@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Parent' },
      'admin-1',
    );

    expect(result).toEqual({ id: 'p1', identifier: 'parent-x@seeds.edu.pk', name: 'New Parent', phone: null, childrenCount: 0 });
    const auditCall = prisma.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe('parent.create');
    expect(auditCall.data.entityId).toBe('p1');
    expect(JSON.stringify(auditCall.data)).not.toContain('ChangeMe123!');
  });

  it('translates a duplicate identifier into a BadRequestException', async () => {
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(
      service.create({ identifier: 'dupe@seeds.edu.pk', password: 'ChangeMe123!', name: 'X' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists parents with their linked-children count', async () => {
    prisma.parentProfile.findMany.mockResolvedValue([
      { id: 'p1', name: 'New Parent', phone: null, user: { identifier: 'parent-x@seeds.edu.pk' }, _count: { children: 2 } },
    ]);

    expect(await service.list()).toEqual([
      { id: 'p1', identifier: 'parent-x@seeds.edu.pk', name: 'New Parent', phone: null, childrenCount: 2 },
    ]);
  });

  it('updates name/phone without touching the password', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    prisma.parentProfile.update.mockResolvedValue({
      id: 'p1', name: 'Renamed', phone: '0300-9999999', user: { identifier: 'parent-x@seeds.edu.pk' }, _count: { children: 0 },
    });

    const result = await service.update('p1', { name: 'Renamed', phone: '0300-9999999' }, 'admin-1');

    expect(result.name).toBe('Renamed');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates the password (hashed) when one is given', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    prisma.parentProfile.update.mockResolvedValue({
      id: 'p1', name: 'New Parent', phone: null, user: { identifier: 'parent-x@seeds.edu.pk' }, _count: { children: 0 },
    });

    await service.update('p1', { password: 'NewPass123!' }, 'admin-1');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordHash: 'hashed-password' } });
  });

  it('throws NotFoundException updating a parent that does not exist', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes a parent (ParentProfile then User) and audit-logs it', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    prisma.parentProfile.delete.mockResolvedValue({ id: 'p1' });
    prisma.user.delete.mockResolvedValue({ id: 'u1' });

    await service.delete('p1', 'admin-1');

    expect(prisma.parentProfile.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'parent.delete', entityId: 'p1' }) }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    prisma.parentProfile.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('p1', 'admin-1')).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && npx jest parent.service.spec.ts`
Expected: FAIL — cannot find module `./parent.service`.

- [ ] **Step 7: Implement the DTOs**

```ts
// backend/src/parent/dto/create-parent.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateParentDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
```

```ts
// backend/src/parent/dto/update-parent.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

// identifier is deliberately not updatable — see this plan's Global Constraints.
export class UpdateParentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
```

- [ ] **Step 8: Implement `ParentService`**

```ts
// backend/src/parent/parent.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertCreatable } from '../common/prisma-create-guard';
import { createParentWithUser } from './create-parent-with-user';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';

export interface ParentSummary {
  id: string;
  identifier: string;
  name: string;
  phone: string | null;
  childrenCount: number;
}

const WITH_USER_AND_COUNT = { user: { select: { identifier: true } }, _count: { select: { children: true } } } as const;

@Injectable()
export class ParentService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    name: string;
    phone: string | null;
    user: { identifier: string };
    _count: { children: number };
  }): ParentSummary {
    return {
      id: record.id,
      identifier: record.user.identifier,
      name: record.name,
      phone: record.phone,
      childrenCount: record._count.children,
    };
  }

  async create(dto: CreateParentDto, actingUserId: string): Promise<ParentSummary> {
    let created;
    try {
      created = await this.prisma.$transaction((tx) => createParentWithUser(tx, dto));
    } catch (error) {
      assertCreatable(error, 'This identifier is already in use.');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'parent.create',
        entity: 'ParentProfile',
        entityId: created.id,
        metadata: JSON.stringify({ identifier: dto.identifier, name: dto.name }),
      },
    });
    return { id: created.id, identifier: created.identifier, name: created.name, phone: created.phone, childrenCount: 0 };
  }

  async list(): Promise<ParentSummary[]> {
    const records = await this.prisma.parentProfile.findMany({
      include: WITH_USER_AND_COUNT,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateParentDto, actingUserId: string): Promise<ParentSummary> {
    const existing = await this.prisma.parentProfile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Parent not found');
    }
    if (dto.password !== undefined) {
      const passwordHash = await argon2.hash(dto.password);
      await this.prisma.user.update({ where: { id: existing.userId }, data: { passwordHash } });
    }
    const record = await this.prisma.parentProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
      include: WITH_USER_AND_COUNT,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'parent.update',
        entity: 'ParentProfile',
        entityId: id,
        metadata: JSON.stringify({ name: dto.name, phone: dto.phone, passwordChanged: dto.password !== undefined }),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.parentProfile.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Parent not found');
    }
    try {
      await this.prisma.parentProfile.delete({ where: { id } });
      await this.prisma.user.delete({ where: { id: existing.userId } });
    } catch (error) {
      assertDeletable(error, 'Parent');
    }
    await this.prisma.auditLog.create({
      data: { userId: actingUserId, action: 'parent.delete', entity: 'ParentProfile', entityId: id },
    });
  }
}
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `cd backend && npx jest parent.service.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 10: Implement `ParentController` and `ParentModule`, wire into `app.module.ts`**

```ts
// backend/src/parent/parent.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ParentService } from './parent.service';
import { CreateParentDto } from './dto/create-parent.dto';
import { UpdateParentDto } from './dto/update-parent.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/parents')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @Post()
  create(@Body() dto: CreateParentDto, @Req() req: AuthenticatedRequest) {
    return this.parentService.create(dto, req.user.id);
  }

  @Get()
  list() {
    return this.parentService.list();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateParentDto, @Req() req: AuthenticatedRequest) {
    return this.parentService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.parentService.delete(id, req.user.id);
  }
}
```

```ts
// backend/src/parent/parent.module.ts
import { Module } from '@nestjs/common';
import { ParentService } from './parent.service';
import { ParentController } from './parent.controller';

@Module({
  providers: [ParentService],
  controllers: [ParentController],
  exports: [ParentService],
})
export class ParentModule {}
```

In `backend/src/app.module.ts`, add the import:

```ts
import { ParentModule } from './parent/parent.module';
```

And register it in the `imports` array, appended after `DashboardModule` (the current last entry
— Org Structure CRUD's final module):

```ts
    DashboardModule,
    ParentModule,
```

- [ ] **Step 11: Run the full backend suite and tsc**

Run: `cd backend && npx jest && npx tsc --noEmit -p .`
Expected: PASS, all suites; zero tsc errors.

- [ ] **Step 12: Commit**

```bash
git add backend/src/parent backend/src/app.module.ts
git commit -m "$(cat <<'EOF'
Add Parent module (User + ParentProfile CRUD)

createParentWithUser() is a standalone function, not a service
method, specifically so Student creation (Task 4) can call the exact
same User+ParentProfile creation logic from inside its own
transaction — one code path, not two.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCiQSXc5fWtUYgGYiwKVgu
EOF
)"
```

---

### Task 3: Backend — Teacher module (User + Teacher)

**Files:**
- Create: `backend/src/teacher/dto/create-teacher.dto.ts`
- Create: `backend/src/teacher/dto/update-teacher.dto.ts`
- Create: `backend/src/teacher/teacher.service.ts`
- Create: `backend/src/teacher/teacher.service.spec.ts`
- Create: `backend/src/teacher/teacher.controller.ts`
- Create: `backend/src/teacher/teacher.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `TeacherAdminSummary = { id: string; identifier: string; name: string }`,
  `TeacherService.create(dto, actingUserId): Promise<TeacherAdminSummary>`,
  `TeacherService.list(): Promise<TeacherAdminSummary[]>`,
  `TeacherService.update(id, dto, actingUserId): Promise<TeacherAdminSummary>`,
  `TeacherService.delete(id, actingUserId): Promise<void>`.
  This is a NEW, separate module from the existing `backend/src/teachers/` (plural) module — that
  one keeps its own `TeacherSummary = { id, name }` read-only shape for the Timetable/Section
  pickers, untouched by this task.
- Consumes: `assertDeletable`, `assertCreatable` (Task 1).

- [ ] **Step 1: Write the failing unit test**

```ts
// backend/src/teacher/teacher.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TeacherService } from './teacher.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('argon2', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

describe('TeacherService', () => {
  let service: TeacherService;
  let tx: { user: { create: jest.Mock }; teacher: { create: jest.Mock } };
  let prisma: {
    teacher: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { update: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = { user: { create: jest.fn() }, teacher: { create: jest.fn() } };
    prisma = {
      teacher: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      user: { update: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [TeacherService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TeacherService);
  });

  it('creates a Teacher (User + Teacher) and audit-logs it without leaking the password', async () => {
    tx.user.create.mockResolvedValue({ id: 'u1', identifier: 'teacher-x@seeds.edu.pk' });
    tx.teacher.create.mockResolvedValue({ id: 't1', name: 'New Teacher' });

    const result = await service.create(
      { identifier: 'teacher-x@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Teacher' },
      'admin-1',
    );

    expect(result).toEqual({ id: 't1', identifier: 'teacher-x@seeds.edu.pk', name: 'New Teacher' });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: { identifier: 'teacher-x@seeds.edu.pk', passwordHash: 'hashed-password', role: 'TEACHER' },
    });
    expect(tx.teacher.create).toHaveBeenCalledWith({ data: { userId: 'u1', name: 'New Teacher' } });
    const auditCall = prisma.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe('teacher.create');
    expect(JSON.stringify(auditCall.data)).not.toContain('ChangeMe123!');
  });

  it('translates a duplicate identifier into a BadRequestException', async () => {
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(
      service.create({ identifier: 'dupe@seeds.edu.pk', password: 'ChangeMe123!', name: 'X' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists teachers with their login identifier', async () => {
    prisma.teacher.findMany.mockResolvedValue([
      { id: 't1', name: 'New Teacher', user: { identifier: 'teacher-x@seeds.edu.pk' } },
    ]);

    expect(await service.list()).toEqual([{ id: 't1', identifier: 'teacher-x@seeds.edu.pk', name: 'New Teacher' }]);
  });

  it('updates the name without touching the password', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
    prisma.teacher.update.mockResolvedValue({ id: 't1', name: 'Renamed', user: { identifier: 'teacher-x@seeds.edu.pk' } });

    const result = await service.update('t1', { name: 'Renamed' }, 'admin-1');

    expect(result.name).toBe('Renamed');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates the password (hashed) when one is given', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
    prisma.teacher.update.mockResolvedValue({ id: 't1', name: 'New Teacher', user: { identifier: 'teacher-x@seeds.edu.pk' } });

    await service.update('t1', { password: 'NewPass123!' }, 'admin-1');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordHash: 'hashed-password' } });
  });

  it('throws NotFoundException updating a teacher that does not exist', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes a teacher (Teacher then User) and audit-logs it', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
    prisma.teacher.delete.mockResolvedValue({ id: 't1' });
    prisma.user.delete.mockResolvedValue({ id: 'u1' });

    await service.delete('t1', 'admin-1');

    expect(prisma.teacher.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'teacher.delete', entityId: 't1' }) }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException (e.g. Attendance.markedById still references this teacher)', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
    prisma.teacher.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('t1', 'admin-1')).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest teacher.service.spec.ts`
Expected: FAIL — cannot find module `./teacher.service`.

- [ ] **Step 3: Implement the DTOs**

```ts
// backend/src/teacher/dto/create-teacher.dto.ts
import { IsString, MinLength } from 'class-validator';

export class CreateTeacherDto {
  @IsString()
  @MinLength(1)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  name!: string;
}
```

```ts
// backend/src/teacher/dto/update-teacher.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

// identifier is deliberately not updatable — see this plan's Global Constraints.
export class UpdateTeacherDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
```

- [ ] **Step 4: Implement `TeacherService`**

```ts
// backend/src/teacher/teacher.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertCreatable } from '../common/prisma-create-guard';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

export interface TeacherAdminSummary {
  id: string;
  identifier: string;
  name: string;
}

const WITH_USER = { user: { select: { identifier: true } } } as const;

@Injectable()
export class TeacherService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: { id: string; name: string; user: { identifier: string } }): TeacherAdminSummary {
    return { id: record.id, identifier: record.user.identifier, name: record.name };
  }

  async create(dto: CreateTeacherDto, actingUserId: string): Promise<TeacherAdminSummary> {
    let created: { id: string; name: string; identifier: string };
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const passwordHash = await argon2.hash(dto.password);
        const user = await tx.user.create({
          data: { identifier: dto.identifier, passwordHash, role: 'TEACHER' },
        });
        const teacher = await tx.teacher.create({ data: { userId: user.id, name: dto.name } });
        return { id: teacher.id, name: teacher.name, identifier: user.identifier };
      });
    } catch (error) {
      assertCreatable(error, 'This identifier is already in use.');
    }
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'teacher.create',
        entity: 'Teacher',
        entityId: created.id,
        metadata: JSON.stringify({ identifier: dto.identifier, name: dto.name }),
      },
    });
    return created;
  }

  async list(): Promise<TeacherAdminSummary[]> {
    const records = await this.prisma.teacher.findMany({ include: WITH_USER, orderBy: { name: 'asc' } });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateTeacherDto, actingUserId: string): Promise<TeacherAdminSummary> {
    const existing = await this.prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Teacher not found');
    }
    if (dto.password !== undefined) {
      const passwordHash = await argon2.hash(dto.password);
      await this.prisma.user.update({ where: { id: existing.userId }, data: { passwordHash } });
    }
    const record = await this.prisma.teacher.update({
      where: { id },
      data: { ...(dto.name !== undefined ? { name: dto.name } : {}) },
      include: WITH_USER,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'teacher.update',
        entity: 'Teacher',
        entityId: id,
        metadata: JSON.stringify({ name: dto.name, passwordChanged: dto.password !== undefined }),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Teacher not found');
    }
    try {
      await this.prisma.teacher.delete({ where: { id } });
      await this.prisma.user.delete({ where: { id: existing.userId } });
    } catch (error) {
      assertDeletable(error, 'Teacher');
    }
    await this.prisma.auditLog.create({
      data: { userId: actingUserId, action: 'teacher.delete', entity: 'Teacher', entityId: id },
    });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx jest teacher.service.spec.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Implement `TeacherController` and `TeacherModule`, wire into `app.module.ts`**

```ts
// backend/src/teacher/teacher.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TeacherService } from './teacher.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/teachers')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class TeacherController {
  constructor(private readonly teacherService: TeacherService) {}

  @Post()
  create(@Body() dto: CreateTeacherDto, @Req() req: AuthenticatedRequest) {
    return this.teacherService.create(dto, req.user.id);
  }

  @Get()
  list() {
    return this.teacherService.list();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTeacherDto, @Req() req: AuthenticatedRequest) {
    return this.teacherService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.teacherService.delete(id, req.user.id);
  }
}
```

```ts
// backend/src/teacher/teacher.module.ts
import { Module } from '@nestjs/common';
import { TeacherService } from './teacher.service';
import { TeacherController } from './teacher.controller';

@Module({
  providers: [TeacherService],
  controllers: [TeacherController],
})
export class TeacherModule {}
```

In `backend/src/app.module.ts`, add the import:

```ts
import { TeacherModule } from './teacher/teacher.module';
```

And register it after `ParentModule`:

```ts
    ParentModule,
    TeacherModule,
```

- [ ] **Step 7: Run the full backend suite and tsc**

Run: `cd backend && npx jest && npx tsc --noEmit -p .`
Expected: PASS, all suites; zero tsc errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/teacher backend/src/app.module.ts
git commit -m "$(cat <<'EOF'
Add Teacher module (User + Teacher CRUD)

A new backend/src/teacher/ (singular) module, distinct from the
existing read-only backend/src/teachers/ (plural) picker module used
by Timetable/Section, which is untouched.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCiQSXc5fWtUYgGYiwKVgu
EOF
)"
```

---

### Task 4: Backend — Student module (Student + Enrollment + Parent link)

**Files:**
- Create: `backend/src/student/dto/create-student.dto.ts`
- Create: `backend/src/student/dto/update-student.dto.ts`
- Create: `backend/src/student/student.service.ts`
- Create: `backend/src/student/student.service.spec.ts`
- Create: `backend/src/student/student.controller.ts`
- Create: `backend/src/student/student.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `createParentWithUser` (Task 2, `backend/src/parent/create-parent-with-user.ts`),
  `assertDeletable`, `assertCreatable` (Task 1).
- Produces: `StudentAdminSummary = { id: string; grNumber: string; name: string; sectionName:
  string | null; className: string | null; campusName: string | null; parentNames: string[] }`,
  `StudentService.create(dto, actingUserId): Promise<StudentAdminSummary>`,
  `StudentService.list(): Promise<StudentAdminSummary[]>`,
  `StudentService.update(id, dto, actingUserId): Promise<StudentAdminSummary>`,
  `StudentService.delete(id, actingUserId): Promise<void>`.

- [ ] **Step 1: Write the failing unit test**

```ts
// backend/src/student/student.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StudentService } from './student.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('argon2', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

describe('StudentService', () => {
  let service: StudentService;
  let tx: {
    student: { create: jest.Mock };
    enrollment: { create: jest.Mock };
    studentParent: { create: jest.Mock };
    user: { create: jest.Mock };
    parentProfile: { create: jest.Mock };
  };
  let prisma: {
    academicSession: { findFirst: jest.Mock };
    section: { findUnique: jest.Mock };
    student: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const activeSession = { id: 'as1', isActive: true };
  const sectionRow = { id: 'sec1', classId: 'cl1', class: { campusId: 'c1' } };

  beforeEach(async () => {
    tx = {
      student: { create: jest.fn() },
      enrollment: { create: jest.fn() },
      studentParent: { create: jest.fn() },
      user: { create: jest.fn() },
      parentProfile: { create: jest.fn() },
    };
    prisma = {
      academicSession: { findFirst: jest.fn().mockResolvedValue(activeSession) },
      section: { findUnique: jest.fn().mockResolvedValue(sectionRow) },
      student: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [StudentService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(StudentService);
  });

  it('rejects when neither parentProfileId nor newParent is given, without touching the database', async () => {
    await expect(
      service.create({ grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when both parentProfileId and newParent are given', async () => {
    await expect(
      service.create(
        {
          grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1',
          parentProfileId: 'p1',
          newParent: { identifier: 'x@seeds.edu.pk', password: 'ChangeMe123!', name: 'X' },
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the section does not exist', async () => {
    prisma.section.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ grNumber: 'GR-2001', name: 'New Student', sectionId: 'missing', parentProfileId: 'p1' }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when there is no active academic session', async () => {
    prisma.academicSession.findFirst.mockResolvedValue(null);

    await expect(
      service.create({ grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1', parentProfileId: 'p1' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a Student + Enrollment (campusId derived from the section) linked to an existing parent, in one transaction', async () => {
    tx.student.create.mockResolvedValue({ id: 's1', grNumber: 'GR-2001', name: 'New Student' });

    await service.create({ grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1', parentProfileId: 'p1' }, 'admin-1');

    expect(tx.student.create).toHaveBeenCalledWith({ data: { grNumber: 'GR-2001', name: 'New Student' } });
    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: 's1',
        campusId: 'c1',
        sectionId: 'sec1',
        academicSessionId: 'as1',
        status: 'ACTIVE',
      }),
    });
    expect(tx.studentParent.create).toHaveBeenCalledWith({ data: { studentId: 's1', parentProfileId: 'p1' } });
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'student.create', entityId: 's1' }) }),
    );
  });

  it('creates a Student linked to a brand-new parent, via the same createParentWithUser logic, inside the same transaction', async () => {
    tx.student.create.mockResolvedValue({ id: 's2', grNumber: 'GR-2002', name: 'Another Student' });
    tx.user.create.mockResolvedValue({ id: 'u1', identifier: 'new-parent@seeds.edu.pk' });
    tx.parentProfile.create.mockResolvedValue({ id: 'p-new', name: 'New Parent', phone: null });

    await service.create(
      {
        grNumber: 'GR-2002', name: 'Another Student', sectionId: 'sec1',
        newParent: { identifier: 'new-parent@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Parent' },
      },
      'admin-1',
    );

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ identifier: 'new-parent@seeds.edu.pk', role: 'PARENT' }) }),
    );
    expect(tx.studentParent.create).toHaveBeenCalledWith({ data: { studentId: 's2', parentProfileId: 'p-new' } });
  });

  it('translates a duplicate GR number or parent identifier into a BadRequestException', async () => {
    tx.student.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(
      service.create({ grNumber: 'GR-1001', name: 'Dupe', sectionId: 'sec1', parentProfileId: 'p1' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists students with their current section chain and linked parent names', async () => {
    prisma.student.findMany.mockResolvedValue([
      {
        id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample',
        enrollments: [{ section: { name: '3A', class: { name: 'Grade 3', campus: { name: 'Gulistan-e-Jauhar' } } } }],
        parents: [{ parentProfile: { name: 'Parent A' } }, { parentProfile: { name: 'Parent B' } }],
      },
    ]);

    expect(await service.list()).toEqual([
      {
        id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample',
        sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar',
        parentNames: ['Parent A', 'Parent B'],
      },
    ]);
  });

  it('lists a student with no active enrollment using null section fields', async () => {
    prisma.student.findMany.mockResolvedValue([
      { id: 's2', grNumber: 'GR-1002', name: 'No Section', enrollments: [], parents: [] },
    ]);

    const [result] = await service.list();
    expect(result.sectionName).toBeNull();
    expect(result.parentNames).toEqual([]);
  });

  it('updates only name/grNumber (no enrollment/parent changes)', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 's1' });
    prisma.student.update.mockResolvedValue({
      id: 's1', grNumber: 'GR-1001', name: 'Renamed',
      enrollments: [], parents: [],
    });

    const result = await service.update('s1', { name: 'Renamed' }, 'admin-1');

    expect(result.name).toBe('Renamed');
    expect(prisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: { name: 'Renamed' } }),
    );
  });

  it('throws NotFoundException updating a student that does not exist', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes a student and audit-logs it', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 's1' });
    prisma.student.delete.mockResolvedValue({ id: 's1' });

    await service.delete('s1', 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'student.delete', entityId: 's1' }) }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException (e.g. real Attendance/FeeVoucher/LeaveRequest history exists)', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 's1' });
    prisma.student.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('s1', 'admin-1')).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npx jest student.service.spec.ts`
Expected: FAIL — cannot find module `./student.service`.

- [ ] **Step 3: Implement the DTOs**

```ts
// backend/src/student/dto/create-student.dto.ts
import { IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateParentDto } from '../../parent/dto/create-parent.dto';

// Exactly one of parentProfileId / newParent must be provided — enforced in the service, not
// here, matching FeeVouchersService.issue's existing "exactly one of studentIds or sectionId"
// precedent (a cross-field rule, awkward to express as a single class-validator decorator).
export class CreateStudentDto {
  @IsString()
  @MinLength(1)
  grNumber!: string;

  @IsString()
  @MinLength(1)
  name!: string;

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

```ts
// backend/src/student/dto/update-student.dto.ts
import { IsOptional, IsString, MinLength } from 'class-validator';

// No enrollment/parent-link changes here — no re-enrollment/transfer workflow exists yet, see
// this plan's Global Constraints.
export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  grNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
```

- [ ] **Step 4: Implement `StudentService`**

```ts
// backend/src/student/student.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertCreatable } from '../common/prisma-create-guard';
import { createParentWithUser } from '../parent/create-parent-with-user';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

export interface StudentAdminSummary {
  id: string;
  grNumber: string;
  name: string;
  sectionName: string | null;
  className: string | null;
  campusName: string | null;
  parentNames: string[];
}

const WITH_SECTION_AND_PARENTS = {
  enrollments: {
    where: { status: 'ACTIVE' as const },
    orderBy: { startDate: 'desc' as const },
    take: 1,
    include: { section: { include: { class: { include: { campus: true } } } } },
  },
  parents: { include: { parentProfile: { select: { name: true } } } },
};

@Injectable()
export class StudentService {
  constructor(private readonly prisma: PrismaService) {}

  private toSummary(record: {
    id: string;
    grNumber: string;
    name: string;
    enrollments: Array<{ section: { name: string; class: { name: string; campus: { name: string } } } }>;
    parents: Array<{ parentProfile: { name: string } }>;
  }): StudentAdminSummary {
    const enrollment = record.enrollments[0];
    return {
      id: record.id,
      grNumber: record.grNumber,
      name: record.name,
      sectionName: enrollment?.section.name ?? null,
      className: enrollment?.section.class.name ?? null,
      campusName: enrollment?.section.class.campus.name ?? null,
      parentNames: record.parents.map((p) => p.parentProfile.name),
    };
  }

  async create(dto: CreateStudentDto, actingUserId: string): Promise<StudentAdminSummary> {
    const hasExisting = dto.parentProfileId !== undefined;
    const hasNew = dto.newParent !== undefined;
    if (hasExisting === hasNew) {
      // Both true (both given) or both false (neither given) are the two invalid states.
      throw new BadRequestException('Provide exactly one of parentProfileId or newParent');
    }

    const activeSession = await this.prisma.academicSession.findFirst({ where: { isActive: true } });
    if (!activeSession) {
      throw new BadRequestException('No active academic session — cannot enroll a student');
    }
    const section = await this.prisma.section.findUnique({
      where: { id: dto.sectionId },
      select: { id: true, class: { select: { campusId: true } } },
    });
    if (!section) {
      throw new NotFoundException('Section not found');
    }

    let studentId: string;
    try {
      studentId = await this.prisma.$transaction(async (tx) => {
        const student = await tx.student.create({ data: { grNumber: dto.grNumber, name: dto.name } });
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
        const parentProfileId = dto.parentProfileId ?? (await createParentWithUser(tx, dto.newParent!)).id;
        await tx.studentParent.create({ data: { studentId: student.id, parentProfileId } });
        return student.id;
      });
    } catch (error) {
      assertCreatable(error, 'This GR number or parent identifier is already in use.');
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.create',
        entity: 'Student',
        entityId: studentId,
        metadata: JSON.stringify({ grNumber: dto.grNumber, name: dto.name, sectionId: dto.sectionId }),
      },
    });
    const created = await this.prisma.student.findUniqueOrThrow({
      where: { id: studentId },
      include: WITH_SECTION_AND_PARENTS,
    });
    return this.toSummary(created);
  }

  async list(): Promise<StudentAdminSummary[]> {
    const records = await this.prisma.student.findMany({
      include: WITH_SECTION_AND_PARENTS,
      orderBy: { name: 'asc' },
    });
    return records.map((r) => this.toSummary(r));
  }

  async update(id: string, dto: UpdateStudentDto, actingUserId: string): Promise<StudentAdminSummary> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }
    const record = await this.prisma.student.update({
      where: { id },
      data: {
        ...(dto.grNumber !== undefined ? { grNumber: dto.grNumber } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
      },
      include: WITH_SECTION_AND_PARENTS,
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'student.update',
        entity: 'Student',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }

  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Student not found');
    }
    try {
      await this.prisma.student.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Student');
    }
    await this.prisma.auditLog.create({
      data: { userId: actingUserId, action: 'student.delete', entity: 'Student', entityId: id },
    });
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd backend && npx jest student.service.spec.ts`
Expected: PASS (13 tests).

- [ ] **Step 6: Implement `StudentController` and `StudentModule`, wire into `app.module.ts`**

```ts
// backend/src/student/student.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { StudentService } from './student.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import type { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/admin/students')
@Roles('SCHOOL_ADMIN', 'SUPER_ADMIN')
export class StudentController {
  constructor(private readonly studentService: StudentService) {}

  @Post()
  create(@Body() dto: CreateStudentDto, @Req() req: AuthenticatedRequest) {
    return this.studentService.create(dto, req.user.id);
  }

  @Get()
  list() {
    return this.studentService.list();
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @Req() req: AuthenticatedRequest) {
    return this.studentService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.studentService.delete(id, req.user.id);
  }
}
```

```ts
// backend/src/student/student.module.ts
import { Module } from '@nestjs/common';
import { StudentService } from './student.service';
import { StudentController } from './student.controller';

@Module({
  providers: [StudentService],
  controllers: [StudentController],
})
export class StudentModule {}
```

In `backend/src/app.module.ts`, add the import:

```ts
import { StudentModule } from './student/student.module';
```

And register it after `TeacherModule`:

```ts
    TeacherModule,
    StudentModule,
```

- [ ] **Step 7: Run the full backend suite and tsc**

Run: `cd backend && npx jest && npx tsc --noEmit -p .`
Expected: PASS, all suites; zero tsc errors.

- [ ] **Step 8: Commit**

```bash
git add backend/src/student backend/src/app.module.ts
git commit -m "$(cat <<'EOF'
Add Student module (Student + Enrollment + Parent link, one transaction)

Enrollment's campusId is always derived server-side from the chosen
section's class.campus.id — never a separately client-supplied field
— so it's impossible to create an Enrollment whose campusId doesn't
match its own sectionId. academicSessionId is resolved from the
currently-active session, matching FeeVouchersService.issue's
existing precedent. Reuses Parent's createParentWithUser() for the
inline-new-parent branch rather than duplicating that logic.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCiQSXc5fWtUYgGYiwKVgu
EOF
)"
```

---

### Task 5: Backend — e2e tests for People CRUD

**Files:**
- Create: `backend/test/people-crud.e2e-spec.ts`

**Interfaces:**
- Consumes: routes from Tasks 2-4 (`/api/v1/admin/parents`, `/api/v1/admin/teachers`,
  `/api/v1/admin/students`, all `POST`/`GET`/`PATCH`/`DELETE`).

Unit tests (Tasks 2-4) already cover each service's business logic against a mocked Prisma. This
e2e spec's job is what unit tests can't verify: the real `SCHOOL_ADMIN`+`SUPER_ADMIN`-only
authorization boundary over HTTP, a real duplicate-identifier rejection against the real database,
and — the one genuinely new integration risk this feature introduces — a real login-account
actually being usable end-to-end (create a Teacher via the API, then log in as that exact account).

- [ ] **Step 1: Write the e2e spec**

```ts
// backend/test/people-crud.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('People CRUD (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'CorrectHorseBattery9!';
  const ids: Record<string, string> = {};

  async function loginAs(identifier: string, pw = password) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier, password: pw })
      .expect(201);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    // Self-healing: a crashed prior run can leave a stale pc-* Teacher blocked by a real
    // Attendance row it marked (Attendance.markedById has no onDelete — it blocks, same as
    // Attendance.student's explicit Restrict) — that block would otherwise make the broad
    // user.deleteMany below fail silently (wrapped in .catch) and leak every pc-* user, exactly
    // the class of bug this feature's own Task 1 fix (elsewhere) closed for two unrelated specs.
    const staleTeacherUsers = await prisma.user.findMany({
      where: { identifier: { startsWith: 'pc-' }, role: 'TEACHER' },
      select: { teacher: { select: { id: true } } },
    });
    for (const u of staleTeacherUsers) {
      if (u.teacher) {
        await prisma.attendance.deleteMany({ where: { markedById: u.teacher.id } }).catch(() => undefined);
      }
    }
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'pc-' } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'PC-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({ where: { name: 'PC E2E School' } });
    for (const s of stale) {
      await prisma.school.delete({ where: { id: s.id } }).catch(() => undefined);
    }

    const passwordHash = await argon2.hash(password);
    const schoolAdminUser = await prisma.user.create({
      data: { identifier: 'pc-school-admin@seeds.edu.pk', passwordHash, role: 'SCHOOL_ADMIN' },
    });
    const parentUser = await prisma.user.create({
      data: { identifier: 'pc-non-admin-parent@seeds.edu.pk', passwordHash, role: 'PARENT' },
    });

    const school = await prisma.school.create({ data: { name: 'PC E2E School' } });
    const campus = await prisma.campus.create({ data: { schoolId: school.id, name: 'Main' } });
    const session = await prisma.academicSession.create({
      data: { label: 'PC', startDate: new Date(), endDate: new Date(), isActive: true },
    });
    const klass = await prisma.class.create({
      data: { campusId: campus.id, academicSessionId: session.id, name: 'PC Grade' },
    });
    const section = await prisma.section.create({ data: { classId: klass.id, name: 'PC-A' } });

    Object.assign(ids, { school: school.id, section: section.id, schoolAdmin: schoolAdminUser.id, parent: parentUser.id });
  });

  afterAll(async () => {
    if (ids.teacher) {
      await prisma.attendance.deleteMany({ where: { markedById: ids.teacher } }).catch(() => undefined);
      await prisma.teacher.delete({ where: { id: ids.teacher } }).catch(() => undefined);
    }
    if (ids.student) await prisma.student.delete({ where: { id: ids.student } }).catch(() => undefined);
    if (ids.parentProfile) await prisma.parentProfile.delete({ where: { id: ids.parentProfile } }).catch(() => undefined);
    await prisma.school.delete({ where: { id: ids.school } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'pc-' } } })
      .catch(() => undefined);
    await app.close();
  });

  it('a PARENT (not SCHOOL_ADMIN/SUPER_ADMIN) is blocked from every write route in this plan', async () => {
    const parentToken = await loginAs('pc-non-admin-parent@seeds.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ identifier: 'blocked@seeds.edu.pk', password, name: 'Blocked' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/admin/parents')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ identifier: 'blocked2@seeds.edu.pk', password, name: 'Blocked' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ grNumber: 'PC-BLOCKED', name: 'Blocked', sectionId: ids.section, parentProfileId: 'x' })
      .expect(403);
  });

  it('a SCHOOL_ADMIN can create a Teacher, and that Teacher can immediately log in with the password just set', async () => {
    const adminToken = await loginAs('pc-school-admin@seeds.edu.pk');

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ identifier: 'pc-new-teacher@seeds.edu.pk', password: 'BrandNewPass1!', name: 'PC Teacher' })
      .expect(201);
    ids.teacher = res.body.id;
    expect(res.body).toEqual({ id: ids.teacher, identifier: 'pc-new-teacher@seeds.edu.pk', name: 'PC Teacher' });

    await loginAs('pc-new-teacher@seeds.edu.pk', 'BrandNewPass1!');
  });

  it('creating a Teacher with an identifier already in use is rejected with a 400, not a 500', async () => {
    const adminToken = await loginAs('pc-school-admin@seeds.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ identifier: 'pc-new-teacher@seeds.edu.pk', password: 'AnotherPass1!', name: 'Duplicate' })
      .expect(400);
  });

  it('deleting a Teacher who has marked attendance is blocked with a 400, real DB constraint', async () => {
    const adminToken = await loginAs('pc-school-admin@seeds.edu.pk');

    const parentRes = await request(app.getHttpServer())
      .post('/api/v1/admin/parents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ identifier: 'pc-new-parent@seeds.edu.pk', password: 'ParentPass1!', name: 'PC Parent' })
      .expect(201);
    ids.parentProfile = parentRes.body.id;

    const studentRes = await request(app.getHttpServer())
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ grNumber: 'PC-1001', name: 'PC Student', sectionId: ids.section, parentProfileId: ids.parentProfile })
      .expect(201);
    ids.student = studentRes.body.id;
    expect(studentRes.body.sectionName).toBe('PC-A');
    expect(studentRes.body.parentNames).toEqual(['PC Parent']);

    await prisma.attendance.create({
      data: { studentId: ids.student, date: new Date(), status: 'PRESENT', markedById: ids.teacher },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/teachers/${ids.teacher}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    await prisma.attendance.deleteMany({ where: { markedById: ids.teacher } });
  });

  it('creating a Student with a brand-new parent works end to end, and that parent can log in', async () => {
    const adminToken = await loginAs('pc-school-admin@seeds.edu.pk');

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        grNumber: 'PC-1002',
        name: 'PC Student Two',
        sectionId: ids.section,
        newParent: { identifier: 'pc-inline-parent@seeds.edu.pk', password: 'InlineParent1!', name: 'Inline Parent' },
      })
      .expect(201);

    expect(res.body.parentNames).toEqual(['Inline Parent']);
    await loginAs('pc-inline-parent@seeds.edu.pk', 'InlineParent1!');

    await request(app.getHttpServer())
      .delete(`/api/v1/admin/students/${res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `cd backend && npx jest --config ./test/jest-e2e.json people-crud.e2e-spec.ts`
Expected: PASS (6 tests). If the local dev server is also running against the same `dev.db`, stop
it first — SQLite lock contention causes spurious timeouts (a tracked, pre-existing issue, not
something to fix in this plan).

- [ ] **Step 3: Commit**

```bash
git add backend/test/people-crud.e2e-spec.ts
git commit -m "$(cat <<'EOF'
Add e2e coverage for People CRUD's authorization boundary and the
real Teacher-deletion-blocked-by-Attendance flow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCiQSXc5fWtUYgGYiwKVgu
EOF
)"
```

---

### Task 6: staff-console — `api.ts` additions

**Files:**
- Modify: `staff-console/src/lib/api.ts`

**Interfaces:**
- Produces: `TeacherAdminSummary`, `ParentSummary`, `StudentAdminSummary`,
  `NewParentInput = { identifier: string; password: string; name: string; phone?: string }` types.
  `api.listAdminTeachers/createTeacher/updateTeacher/deleteTeacher`,
  `api.listAdminParents/createParent/updateParent/deleteParent`,
  `api.listAdminStudents/createStudent/updateStudent/deleteStudent`.
- Consumes: backend routes from Tasks 2-4. Every create/update/delete method returns
  `Promise<void>` except create, which returns the created summary (needed so
  `StudentManagementView`'s create flow can show the result inline without a full reload —
  every other create method in this plan still returns `Promise<void>`, matching the existing
  `createTimetableEntry`/`createFeeStructure` convention, since only Student's create response is
  actually consumed by its caller).

- [ ] **Step 1: Add the types**

In `staff-console/src/lib/api.ts`, add near the other summary interfaces (after the Org Structure
CRUD types added in the previous feature):

```ts
export interface TeacherAdminSummary {
  id: string;
  identifier: string;
  name: string;
}

export interface ParentSummary {
  id: string;
  identifier: string;
  name: string;
  phone: string | null;
  childrenCount: number;
}

export interface NewParentInput {
  identifier: string;
  password: string;
  name: string;
  phone?: string;
}

export interface StudentAdminSummary {
  id: string;
  grNumber: string;
  name: string;
  sectionName: string | null;
  className: string | null;
  campusName: string | null;
  parentNames: string[];
}
```

- [ ] **Step 2: Add the client methods**

Inside the `api` object, add after the last Org Structure CRUD method (`dashboardSummary`):

```ts
  async listAdminTeachers(accessToken: string): Promise<TeacherAdminSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/teachers`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createTeacher(
    accessToken: string,
    payload: { identifier: string; password: string; name: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateTeacher(
    accessToken: string,
    id: string,
    payload: { name?: string; password?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/teachers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteTeacher(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/teachers/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listAdminParents(accessToken: string): Promise<ParentSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createParent(accessToken: string, payload: NewParentInput): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async updateParent(
    accessToken: string,
    id: string,
    payload: { name?: string; phone?: string; password?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteParent(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/parents/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listAdminStudents(accessToken: string): Promise<StudentAdminSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async createStudent(
    accessToken: string,
    payload: { grNumber: string; name: string; sectionId: string; parentProfileId?: string; newParent?: NewParentInput },
  ): Promise<StudentAdminSummary> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    return asJson(res);
  },

  async updateStudent(
    accessToken: string,
    id: string,
    payload: { grNumber?: string; name?: string },
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async deleteStudent(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/admin/students/${id}`, {
      method: 'DELETE',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },
```

- [ ] **Step 3: Type-check**

Run: `cd staff-console && npm run build`
Expected: PASS (type-check + build clean).

- [ ] **Step 4: Commit**

```bash
git add staff-console/src/lib/api.ts
git commit -m "$(cat <<'EOF'
Add People CRUD endpoints to the staff-console API client

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCiQSXc5fWtUYgGYiwKVgu
EOF
)"
```

---

### Task 7: staff-console — Teacher management screen

**Files:**
- Create: `staff-console/src/views/TeacherManagementView.vue`
- Create: `staff-console/src/views/TeacherManagementView.spec.ts`
- Create: `staff-console/src/views/TeacherManagementPageView.vue`
- Modify: `staff-console/src/router/index.ts`
- Modify: `staff-console/src/components/AppShell.vue`

**Interfaces:**
- Consumes: `api.listAdminTeachers`, `api.createTeacher`, `api.updateTeacher`,
  `api.deleteTeacher` (Task 6).

Same table + inline-add-form + inline-edit-row + `window.confirm`-delete pattern as every Org
Structure screen (see `SchoolManagementView.vue` for the exact precedent this follows). The one
difference: the edit-row's password field is optional and empty by default (leaving it blank
means "don't change the password" — the update payload only includes `password` when the field
is non-empty).

- [ ] **Step 1: Write the failing component spec**

```ts
// staff-console/src/views/TeacherManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import TeacherManagementView from './TeacherManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listAdminTeachers: vi.fn(),
    createTeacher: vi.fn(),
    updateTeacher: vi.fn(),
    deleteTeacher: vi.fn(),
  },
}));

describe('TeacherManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listAdminTeachers).mockResolvedValue([
      { id: 't1', identifier: 'teacher-x@seeds.edu.pk', name: 'Existing Teacher' },
    ]);
  });

  it('lists teachers and creates a new one with an identifier and password', async () => {
    vi.mocked(api.createTeacher).mockResolvedValue(undefined);

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('teacher-x@seeds.edu.pk');

    await wrapper.find('[data-testid="add-identifier"]').setValue('new-teacher@seeds.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('New Teacher');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createTeacher).toHaveBeenCalledWith('token-1', {
      identifier: 'new-teacher@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Teacher',
    });
  });

  it('edits the name without changing the password when the password field is left blank', async () => {
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-t1"]').trigger('click');
    expect(wrapper.find('[data-testid="edit-identifier-t1"]').exists()).toBe(false);
    await wrapper.find('[data-testid="edit-name-t1"]').setValue('Renamed Teacher');
    await wrapper.find('[data-testid="save-t1"]').trigger('click');
    await flushPromises();

    expect(api.updateTeacher).toHaveBeenCalledWith('token-1', 't1', { name: 'Renamed Teacher' });
  });

  it('includes the new password in the update payload when the password field is filled in', async () => {
    vi.mocked(api.updateTeacher).mockResolvedValue(undefined);

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-t1"]').trigger('click');
    await wrapper.find('[data-testid="edit-password-t1"]').setValue('BrandNewPass1!');
    await wrapper.find('[data-testid="save-t1"]').trigger('click');
    await flushPromises();

    expect(api.updateTeacher).toHaveBeenCalledWith('token-1', 't1', {
      name: 'Existing Teacher', password: 'BrandNewPass1!',
    });
  });

  it('deletes a teacher after confirmation', async () => {
    vi.mocked(api.deleteTeacher).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();

    expect(api.deleteTeacher).toHaveBeenCalledWith('token-1', 't1');
  });

  it('shows the backend error when delete is blocked (e.g. the teacher has marked attendance)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.deleteTeacher).mockRejectedValue(new Error('Cannot delete this Teacher: other records still reference it.'));

    const wrapper = mount(TeacherManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-t1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Teacher');
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd staff-console && npx vitest run TeacherManagementView.spec.ts`
Expected: FAIL — cannot resolve `./TeacherManagementView.vue`.

- [ ] **Step 3: Implement `TeacherManagementView.vue`**

```vue
<!-- staff-console/src/views/TeacherManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type TeacherAdminSummary } from '../lib/api';

const auth = useAuthStore();

const teachers = ref<TeacherAdminSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newIdentifier = ref('');
const newPassword = ref('');
const newName = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editPassword = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    teachers.value = await api.listAdminTeachers(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load teachers.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newIdentifier.value.trim() || !newPassword.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createTeacher(auth.accessToken, {
      identifier: newIdentifier.value.trim(),
      password: newPassword.value,
      name: newName.value.trim(),
    });
    newIdentifier.value = '';
    newPassword.value = '';
    newName.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this teacher.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(teacher: TeacherAdminSummary) {
  editingId.value = teacher.id;
  editName.value = teacher.name;
  editPassword.value = '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateTeacher(auth.accessToken, id, {
      name: editName.value.trim(),
      ...(editPassword.value ? { password: editPassword.value } : {}),
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this teacher.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!window.confirm('Delete this teacher? This cannot be undone.')) return;
  errorMessage.value = null;
  try {
    await api.deleteTeacher(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this teacher.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Teachers</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <table class="entity-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Login</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="t in teachers" :key="t.id">
          <template v-if="editingId === t.id">
            <td><input :data-testid="`edit-name-${t.id}`" v-model="editName" type="text" /></td>
            <td>
              {{ t.identifier }}
              <input
                :data-testid="`edit-password-${t.id}`"
                v-model="editPassword"
                type="password"
                placeholder="New password (leave blank to keep)"
              />
            </td>
            <td class="actions-col">
              <button type="button" :data-testid="`save-${t.id}`" @click="onSaveEdit(t.id)">Save</button>
              <button type="button" class="secondary" @click="cancelEdit">Cancel</button>
            </td>
          </template>
          <template v-else>
            <td>{{ t.name }}</td>
            <td>{{ t.identifier }}</td>
            <td class="actions-col">
              <button type="button" :data-testid="`edit-${t.id}`" @click="startEdit(t)">Edit</button>
              <button type="button" class="secondary" :data-testid="`delete-${t.id}`" @click="onDelete(t.id)">
                Delete
              </button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <div class="inline-form">
      <input data-testid="add-identifier" v-model="newIdentifier" type="text" placeholder="Login email" />
      <input data-testid="add-password" v-model="newPassword" type="password" placeholder="Initial password" />
      <input data-testid="add-name" v-model="newName" type="text" placeholder="Full name" />
      <button type="button" data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 900px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.entity-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}
.entity-table th,
.entity-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.actions-col {
  width: 1%;
  white-space: nowrap;
  display: flex;
  gap: var(--space-2);
}
.inline-form {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.inline-form input {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
button.secondary {
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd staff-console && npx vitest run TeacherManagementView.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: `TeacherManagementPageView.vue`, route, and nav**

```vue
<!-- staff-console/src/views/TeacherManagementPageView.vue -->
<script setup lang="ts">
import AppShell from '../components/AppShell.vue';
import TeacherManagementView from './TeacherManagementView.vue';
</script>

<template>
  <AppShell>
    <TeacherManagementView />
  </AppShell>
</template>
```

In `staff-console/src/router/index.ts`, add after the `/admin/sections` route entry (Org Structure
CRUD's last route):

```ts
    {
      path: '/admin/teachers',
      name: 'admin-teachers',
      component: () => import('../views/TeacherManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'] },
    },
```

In `staff-console/src/components/AppShell.vue`, find the existing inert placeholder:

```html
          <a data-testid="nav-teachers" href="#"><Icon name="chalkboard" />Teachers</a>
```

Replace with:

```html
          <RouterLink v-if="canManagePeople" data-testid="nav-teachers" to="/admin/teachers"><Icon name="chalkboard" />Teachers</RouterLink>
```

Add the new `canManagePeople` computed next to `canManageOrgStructure`:

```ts
const canManagePeople = computed(() => auth.role === 'SCHOOL_ADMIN' || auth.role === 'SUPER_ADMIN');
```

- [ ] **Step 6: Build and lint**

Run: `cd staff-console && npm run build`
Expected: PASS (type-check + build clean).

- [ ] **Step 7: Commit**

```bash
git add staff-console/src/views/TeacherManagementView.vue staff-console/src/views/TeacherManagementView.spec.ts staff-console/src/views/TeacherManagementPageView.vue staff-console/src/router/index.ts staff-console/src/components/AppShell.vue
git commit -m "$(cat <<'EOF'
Add staff-console Teacher management screen (/admin/teachers)

Replaces the long-inert "Teachers" nav placeholder with a real,
SCHOOL_ADMIN+SUPER_ADMIN-gated route.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCiQSXc5fWtUYgGYiwKVgu
EOF
)"
```

---

### Task 8: staff-console — Parent management screen

**Files:**
- Create: `staff-console/src/views/ParentManagementView.vue`
- Create: `staff-console/src/views/ParentManagementView.spec.ts`
- Create: `staff-console/src/views/ParentManagementPageView.vue`
- Modify: `staff-console/src/router/index.ts`
- Modify: `staff-console/src/components/AppShell.vue`

**Interfaces:**
- Consumes: `api.listAdminParents`, `api.createParent`, `api.updateParent`, `api.deleteParent`
  (Task 6).
- Produces: nothing new consumed elsewhere — `StudentManagementView` (Task 9) has its own inline
  new-parent fields, it does not import anything from this view (per the spec's decision, the
  *backend* create-logic is shared via `createParentWithUser`; the two client-side forms are
  separate small pieces of UI, not a shared component, matching Org Structure's own precedent of
  not extracting a shared CRUD component across screens).

Same pattern as Task 7, with a `phone` field and a `childrenCount` read-only column instead of a
password-in-the-list-row concern.

- [ ] **Step 1: Write the failing component spec**

```ts
// staff-console/src/views/ParentManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ParentManagementView from './ParentManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listAdminParents: vi.fn(),
    createParent: vi.fn(),
    updateParent: vi.fn(),
    deleteParent: vi.fn(),
  },
}));

describe('ParentManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listAdminParents).mockResolvedValue([
      { id: 'p1', identifier: 'parent-x@seeds.edu.pk', name: 'Existing Parent', phone: '0300-1111111', childrenCount: 2 },
    ]);
  });

  it('lists parents (with their linked-children count) and creates a new one', async () => {
    vi.mocked(api.createParent).mockResolvedValue(undefined);

    const wrapper = mount(ParentManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('parent-x@seeds.edu.pk');
    expect(wrapper.text()).toContain('2');

    await wrapper.find('[data-testid="add-identifier"]').setValue('new-parent@seeds.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('New Parent');
    await wrapper.find('[data-testid="add-phone"]').setValue('0300-2222222');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createParent).toHaveBeenCalledWith('token-1', {
      identifier: 'new-parent@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Parent', phone: '0300-2222222',
    });
  });

  it('creates a parent with no phone when the field is left blank', async () => {
    vi.mocked(api.createParent).mockResolvedValue(undefined);

    const wrapper = mount(ParentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="add-identifier"]').setValue('new-parent@seeds.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('New Parent');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createParent).toHaveBeenCalledWith('token-1', {
      identifier: 'new-parent@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Parent', phone: undefined,
    });
  });

  it('edits name/phone without changing the password when the password field is left blank', async () => {
    vi.mocked(api.updateParent).mockResolvedValue(undefined);

    const wrapper = mount(ParentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-p1"]').trigger('click');
    await wrapper.find('[data-testid="edit-name-p1"]').setValue('Renamed Parent');
    await wrapper.find('[data-testid="save-p1"]').trigger('click');
    await flushPromises();

    expect(api.updateParent).toHaveBeenCalledWith('token-1', 'p1', { name: 'Renamed Parent', phone: '0300-1111111' });
  });

  it('deletes a parent after confirmation', async () => {
    vi.mocked(api.deleteParent).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(ParentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-p1"]').trigger('click');
    await flushPromises();

    expect(api.deleteParent).toHaveBeenCalledWith('token-1', 'p1');
  });

  it('shows the backend error when create fails on a duplicate identifier', async () => {
    vi.mocked(api.createParent).mockRejectedValue(new Error('This identifier is already in use.'));

    const wrapper = mount(ParentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="add-identifier"]').setValue('dupe@seeds.edu.pk');
    await wrapper.find('[data-testid="add-password"]').setValue('ChangeMe123!');
    await wrapper.find('[data-testid="add-name"]').setValue('Dupe');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('already in use');
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd staff-console && npx vitest run ParentManagementView.spec.ts`
Expected: FAIL — cannot resolve `./ParentManagementView.vue`.

- [ ] **Step 3: Implement `ParentManagementView.vue`**

```vue
<!-- staff-console/src/views/ParentManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ParentSummary } from '../lib/api';

const auth = useAuthStore();

const parents = ref<ParentSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newIdentifier = ref('');
const newPassword = ref('');
const newName = ref('');
const newPhone = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editName = ref('');
const editPhone = ref('');
const editPassword = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    parents.value = await api.listAdminParents(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load parents.';
  }
}
load();

async function onAdd() {
  if (!auth.accessToken || !newIdentifier.value.trim() || !newPassword.value || !newName.value.trim()) return;
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createParent(auth.accessToken, {
      identifier: newIdentifier.value.trim(),
      password: newPassword.value,
      name: newName.value.trim(),
      phone: newPhone.value.trim() || undefined,
    });
    newIdentifier.value = '';
    newPassword.value = '';
    newName.value = '';
    newPhone.value = '';
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this parent.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(parent: ParentSummary) {
  editingId.value = parent.id;
  editName.value = parent.name;
  editPhone.value = parent.phone ?? '';
  editPassword.value = '';
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateParent(auth.accessToken, id, {
      name: editName.value.trim(),
      phone: editPhone.value.trim() || undefined,
      ...(editPassword.value ? { password: editPassword.value } : {}),
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this parent.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!window.confirm('Delete this parent? This cannot be undone.')) return;
  errorMessage.value = null;
  try {
    await api.deleteParent(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this parent.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Parents</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <table class="entity-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Login</th>
          <th>Phone</th>
          <th>Children</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="p in parents" :key="p.id">
          <template v-if="editingId === p.id">
            <td><input :data-testid="`edit-name-${p.id}`" v-model="editName" type="text" /></td>
            <td>{{ p.identifier }}</td>
            <td><input :data-testid="`edit-phone-${p.id}`" v-model="editPhone" type="text" /></td>
            <td>{{ p.childrenCount }}</td>
            <td class="actions-col">
              <input
                :data-testid="`edit-password-${p.id}`"
                v-model="editPassword"
                type="password"
                placeholder="New password"
              />
              <button type="button" :data-testid="`save-${p.id}`" @click="onSaveEdit(p.id)">Save</button>
              <button type="button" class="secondary" @click="cancelEdit">Cancel</button>
            </td>
          </template>
          <template v-else>
            <td>{{ p.name }}</td>
            <td>{{ p.identifier }}</td>
            <td>{{ p.phone ?? '—' }}</td>
            <td>{{ p.childrenCount }}</td>
            <td class="actions-col">
              <button type="button" :data-testid="`edit-${p.id}`" @click="startEdit(p)">Edit</button>
              <button type="button" class="secondary" :data-testid="`delete-${p.id}`" @click="onDelete(p.id)">
                Delete
              </button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <div class="inline-form">
      <input data-testid="add-identifier" v-model="newIdentifier" type="text" placeholder="Login email" />
      <input data-testid="add-password" v-model="newPassword" type="password" placeholder="Initial password" />
      <input data-testid="add-name" v-model="newName" type="text" placeholder="Full name" />
      <input data-testid="add-phone" v-model="newPhone" type="text" placeholder="Phone (optional)" />
      <button type="button" data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add</button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 960px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.entity-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}
.entity-table th,
.entity-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.actions-col {
  width: 1%;
  white-space: nowrap;
  display: flex;
  gap: var(--space-2);
}
.inline-form {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.inline-form input {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
}
button.secondary {
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd staff-console && npx vitest run ParentManagementView.spec.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: `ParentManagementPageView.vue`, route, and nav**

```vue
<!-- staff-console/src/views/ParentManagementPageView.vue -->
<script setup lang="ts">
import AppShell from '../components/AppShell.vue';
import ParentManagementView from './ParentManagementView.vue';
</script>

<template>
  <AppShell>
    <ParentManagementView />
  </AppShell>
</template>
```

In `staff-console/src/router/index.ts`, add after the `/admin/teachers` route entry:

```ts
    {
      path: '/admin/parents',
      name: 'admin-parents',
      component: () => import('../views/ParentManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'] },
    },
```

In `staff-console/src/components/AppShell.vue`, find the existing inert placeholder:

```html
          <a data-testid="nav-parents" href="#"><Icon name="user-circle" />Parents</a>
```

Replace with:

```html
          <RouterLink v-if="canManagePeople" data-testid="nav-parents" to="/admin/parents"><Icon name="user-circle" />Parents</RouterLink>
```

- [ ] **Step 6: Build and lint**

Run: `cd staff-console && npm run build`
Expected: PASS (type-check + build clean).

- [ ] **Step 7: Commit**

```bash
git add staff-console/src/views/ParentManagementView.vue staff-console/src/views/ParentManagementView.spec.ts staff-console/src/views/ParentManagementPageView.vue staff-console/src/router/index.ts staff-console/src/components/AppShell.vue
git commit -m "$(cat <<'EOF'
Add staff-console Parent management screen (/admin/parents)

Replaces the long-inert "Parents" nav placeholder with a real,
SCHOOL_ADMIN+SUPER_ADMIN-gated route.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCiQSXc5fWtUYgGYiwKVgu
EOF
)"
```

---

### Task 9: staff-console — Student management screen

**Files:**
- Create: `staff-console/src/views/StudentManagementView.vue`
- Create: `staff-console/src/views/StudentManagementView.spec.ts`
- Create: `staff-console/src/views/StudentManagementPageView.vue`
- Modify: `staff-console/src/router/index.ts`
- Modify: `staff-console/src/components/AppShell.vue`

**Interfaces:**
- Consumes: `api.listSections` (already exists), `api.listAdminParents`, `api.listAdminStudents`,
  `api.createStudent`, `api.updateStudent`, `api.deleteStudent` (Task 6).

The most involved screen in this plan — the create form has a section picker and a
parent-linking control that toggles between "pick an existing parent" (a `<select>` populated
from `api.listAdminParents`, matching this codebase's existing plain-`<select>`-picker convention
— no typeahead/autocomplete component exists anywhere in this app, this doesn't introduce one) and
"+ New Parent" (the same identifier/password/name/phone fields `ParentManagementView`'s own create
form uses, as plain fields in this form — not an imported/shared component, per this plan's Global
Constraints and the Org Structure precedent of not extracting shared CRUD components).

- [ ] **Step 1: Write the failing component spec**

```ts
// staff-console/src/views/StudentManagementView.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import StudentManagementView from './StudentManagementView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listSections: vi.fn(),
    listAdminParents: vi.fn(),
    listAdminStudents: vi.fn(),
    createStudent: vi.fn(),
    updateStudent: vi.fn(),
    deleteStudent: vi.fn(),
  },
}));

describe('StudentManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    Object.values(api).forEach((fn) => vi.mocked(fn).mockReset());
    vi.mocked(api.listSections).mockResolvedValue([
      { id: 'sec1', name: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar' },
    ]);
    vi.mocked(api.listAdminParents).mockResolvedValue([
      { id: 'p1', identifier: 'parent-x@seeds.edu.pk', name: 'Existing Parent', phone: null, childrenCount: 1 },
    ]);
    vi.mocked(api.listAdminStudents).mockResolvedValue([
      {
        id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample',
        sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar',
        parentNames: ['Existing Parent'],
      },
    ]);
  });

  it('lists students with their section and parent names', async () => {
    const wrapper = mount(StudentManagementView);
    await flushPromises();

    expect(wrapper.text()).toContain('Eshaal Sample');
    expect(wrapper.text()).toContain('3A');
    expect(wrapper.text()).toContain('Existing Parent');
  });

  it('creates a student linked to an existing parent (the default mode)', async () => {
    vi.mocked(api.createStudent).mockResolvedValue({
      id: 's2', grNumber: 'GR-2001', name: 'New Student',
      sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar',
      parentNames: ['Existing Parent'],
    });

    const wrapper = mount(StudentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="add-gr-number"]').setValue('GR-2001');
    await wrapper.find('[data-testid="add-name"]').setValue('New Student');
    await wrapper.find('[data-testid="add-section"]').setValue('sec1');
    await wrapper.find('[data-testid="add-parent-select"]').setValue('p1');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStudent).toHaveBeenCalledWith('token-1', {
      grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1', parentProfileId: 'p1',
    });
  });

  it('creates a student with a brand-new parent when the "+ New Parent" toggle is on', async () => {
    vi.mocked(api.createStudent).mockResolvedValue({
      id: 's3', grNumber: 'GR-2002', name: 'Another Student',
      sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar',
      parentNames: ['Inline Parent'],
    });

    const wrapper = mount(StudentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="add-gr-number"]').setValue('GR-2002');
    await wrapper.find('[data-testid="add-name"]').setValue('Another Student');
    await wrapper.find('[data-testid="add-section"]').setValue('sec1');
    await wrapper.find('[data-testid="toggle-new-parent"]').setValue(true);
    await flushPromises();
    expect(wrapper.find('[data-testid="add-parent-select"]').exists()).toBe(false);
    await wrapper.find('[data-testid="new-parent-identifier"]').setValue('inline-parent@seeds.edu.pk');
    await wrapper.find('[data-testid="new-parent-password"]').setValue('InlinePass1!');
    await wrapper.find('[data-testid="new-parent-name"]').setValue('Inline Parent');
    await wrapper.find('[data-testid="add-submit"]').trigger('click');
    await flushPromises();

    expect(api.createStudent).toHaveBeenCalledWith('token-1', {
      grNumber: 'GR-2002', name: 'Another Student', sectionId: 'sec1',
      newParent: { identifier: 'inline-parent@seeds.edu.pk', password: 'InlinePass1!', name: 'Inline Parent', phone: undefined },
    });
  });

  it('edits only name/grNumber', async () => {
    vi.mocked(api.updateStudent).mockResolvedValue(undefined);

    const wrapper = mount(StudentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="edit-s1"]').trigger('click');
    await wrapper.find('[data-testid="edit-name-s1"]').setValue('Renamed Student');
    await wrapper.find('[data-testid="save-s1"]').trigger('click');
    await flushPromises();

    expect(api.updateStudent).toHaveBeenCalledWith('token-1', 's1', { grNumber: 'GR-1001', name: 'Renamed Student' });
  });

  it('deletes a student after confirmation', async () => {
    vi.mocked(api.deleteStudent).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const wrapper = mount(StudentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();

    expect(api.deleteStudent).toHaveBeenCalledWith('token-1', 's1');
  });

  it('shows the backend error when delete is blocked by real attendance/fee/leave history', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(api.deleteStudent).mockRejectedValue(new Error('Cannot delete this Student: other records still reference it.'));

    const wrapper = mount(StudentManagementView);
    await flushPromises();

    await wrapper.find('[data-testid="delete-s1"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('Cannot delete this Student');
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd staff-console && npx vitest run StudentManagementView.spec.ts`
Expected: FAIL — cannot resolve `./StudentManagementView.vue`.

- [ ] **Step 3: Implement `StudentManagementView.vue`**

```vue
<!-- staff-console/src/views/StudentManagementView.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type SectionSummary, type ParentSummary, type StudentAdminSummary } from '../lib/api';

const auth = useAuthStore();

const sections = ref<SectionSummary[]>([]);
const parents = ref<ParentSummary[]>([]);
const students = ref<StudentAdminSummary[]>([]);
const errorMessage = ref<string | null>(null);

const newGrNumber = ref('');
const newName = ref('');
const newSectionId = ref('');
const useNewParent = ref(false);
const newParentProfileId = ref('');
const newParentIdentifier = ref('');
const newParentPassword = ref('');
const newParentName = ref('');
const newParentPhone = ref('');
const isSaving = ref(false);

const editingId = ref<string | null>(null);
const editGrNumber = ref('');
const editName = ref('');

async function load() {
  if (!auth.accessToken) return;
  try {
    [sections.value, parents.value, students.value] = await Promise.all([
      api.listSections(auth.accessToken),
      api.listAdminParents(auth.accessToken),
      api.listAdminStudents(auth.accessToken),
    ]);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load students.';
  }
}
load();

function resetAddForm() {
  newGrNumber.value = '';
  newName.value = '';
  newSectionId.value = '';
  useNewParent.value = false;
  newParentProfileId.value = '';
  newParentIdentifier.value = '';
  newParentPassword.value = '';
  newParentName.value = '';
  newParentPhone.value = '';
}

async function onAdd() {
  if (!auth.accessToken || !newGrNumber.value.trim() || !newName.value.trim() || !newSectionId.value) return;
  if (useNewParent.value) {
    if (!newParentIdentifier.value.trim() || !newParentPassword.value || !newParentName.value.trim()) return;
  } else if (!newParentProfileId.value) {
    return;
  }
  errorMessage.value = null;
  isSaving.value = true;
  try {
    await api.createStudent(auth.accessToken, {
      grNumber: newGrNumber.value.trim(),
      name: newName.value.trim(),
      sectionId: newSectionId.value,
      ...(useNewParent.value
        ? {
            newParent: {
              identifier: newParentIdentifier.value.trim(),
              password: newParentPassword.value,
              name: newParentName.value.trim(),
              phone: newParentPhone.value.trim() || undefined,
            },
          }
        : { parentProfileId: newParentProfileId.value }),
    });
    resetAddForm();
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not create this student.';
  } finally {
    isSaving.value = false;
  }
}

function startEdit(student: StudentAdminSummary) {
  editingId.value = student.id;
  editGrNumber.value = student.grNumber;
  editName.value = student.name;
}

function cancelEdit() {
  editingId.value = null;
}

async function onSaveEdit(id: string) {
  if (!auth.accessToken || !editGrNumber.value.trim() || !editName.value.trim()) return;
  errorMessage.value = null;
  try {
    await api.updateStudent(auth.accessToken, id, {
      grNumber: editGrNumber.value.trim(),
      name: editName.value.trim(),
    });
    editingId.value = null;
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not update this student.';
  }
}

async function onDelete(id: string) {
  if (!auth.accessToken) return;
  if (!window.confirm('Delete this student? This cannot be undone.')) return;
  errorMessage.value = null;
  try {
    await api.deleteStudent(auth.accessToken, id);
    await load();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not delete this student.';
  }
}
</script>

<template>
  <div class="org-entity">
    <h1>Students</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <table class="entity-table">
      <thead>
        <tr>
          <th>GR Number</th>
          <th>Name</th>
          <th>Section</th>
          <th>Parents</th>
          <th class="actions-col"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="s in students" :key="s.id">
          <template v-if="editingId === s.id">
            <td><input :data-testid="`edit-gr-${s.id}`" v-model="editGrNumber" type="text" /></td>
            <td><input :data-testid="`edit-name-${s.id}`" v-model="editName" type="text" /></td>
            <td>{{ s.sectionName ?? '—' }}</td>
            <td>{{ s.parentNames.join(', ') || '—' }}</td>
            <td class="actions-col">
              <button type="button" :data-testid="`save-${s.id}`" @click="onSaveEdit(s.id)">Save</button>
              <button type="button" class="secondary" @click="cancelEdit">Cancel</button>
            </td>
          </template>
          <template v-else>
            <td>{{ s.grNumber }}</td>
            <td>{{ s.name }}</td>
            <td>{{ s.sectionName ?? '—' }}</td>
            <td>{{ s.parentNames.join(', ') || '—' }}</td>
            <td class="actions-col">
              <button type="button" :data-testid="`edit-${s.id}`" @click="startEdit(s)">Edit</button>
              <button type="button" class="secondary" :data-testid="`delete-${s.id}`" @click="onDelete(s.id)">
                Delete
              </button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <div class="add-form">
      <div class="inline-form">
        <input data-testid="add-gr-number" v-model="newGrNumber" type="text" placeholder="GR number" />
        <input data-testid="add-name" v-model="newName" type="text" placeholder="Full name" />
        <select data-testid="add-section" v-model="newSectionId">
          <option value="" disabled>Choose a section</option>
          <option v-for="sec in sections" :key="sec.id" :value="sec.id">
            {{ sec.className }} {{ sec.name }} ({{ sec.campusName }})
          </option>
        </select>
      </div>

      <label class="checkbox-row">
        <input data-testid="toggle-new-parent" v-model="useNewParent" type="checkbox" />
        + New Parent (instead of picking an existing one)
      </label>

      <div v-if="!useNewParent" class="inline-form">
        <select data-testid="add-parent-select" v-model="newParentProfileId">
          <option value="" disabled>Choose a parent</option>
          <option v-for="p in parents" :key="p.id" :value="p.id">{{ p.name }} ({{ p.identifier }})</option>
        </select>
      </div>
      <div v-else class="inline-form">
        <input data-testid="new-parent-identifier" v-model="newParentIdentifier" type="text" placeholder="Parent login email" />
        <input data-testid="new-parent-password" v-model="newParentPassword" type="password" placeholder="Initial password" />
        <input data-testid="new-parent-name" v-model="newParentName" type="text" placeholder="Parent full name" />
        <input data-testid="new-parent-phone" v-model="newParentPhone" type="text" placeholder="Phone (optional)" />
      </div>

      <button type="button" data-testid="add-submit" :disabled="isSaving" @click="onAdd">Add Student</button>
    </div>
  </div>
</template>

<style scoped>
.org-entity {
  max-width: 1100px;
}
.error {
  color: var(--color-destructive);
  margin-bottom: var(--space-3);
}
.entity-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: var(--space-4);
}
.entity-table th,
.entity-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}
.actions-col {
  width: 1%;
  white-space: nowrap;
  display: flex;
  gap: var(--space-2);
}
.add-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
.inline-form {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.inline-form input,
.inline-form select {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
.checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: var(--font-size-sm);
}
button {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 600;
  cursor: pointer;
  align-self: flex-start;
}
button.secondary {
  background: transparent;
  color: var(--color-destructive);
  border: 1px solid var(--color-destructive);
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `cd staff-console && npx vitest run StudentManagementView.spec.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: `StudentManagementPageView.vue`, route, and nav**

```vue
<!-- staff-console/src/views/StudentManagementPageView.vue -->
<script setup lang="ts">
import AppShell from '../components/AppShell.vue';
import StudentManagementView from './StudentManagementView.vue';
</script>

<template>
  <AppShell>
    <StudentManagementView />
  </AppShell>
</template>
```

In `staff-console/src/router/index.ts`, add after the `/admin/parents` route entry:

```ts
    {
      path: '/admin/students',
      name: 'admin-students',
      component: () => import('../views/StudentManagementPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'SUPER_ADMIN'] },
    },
```

In `staff-console/src/components/AppShell.vue`, find the existing inert placeholder:

```html
          <a data-testid="nav-students" href="#"><Icon name="users" />Students</a>
```

Replace with:

```html
          <RouterLink v-if="canManagePeople" data-testid="nav-students" to="/admin/students"><Icon name="users" />Students</RouterLink>
```

- [ ] **Step 6: Build and lint**

Run: `cd staff-console && npm run build`
Expected: PASS (type-check + build clean).

- [ ] **Step 7: Add nav-gating test coverage in the same task, not bolted on later**

Per the lesson from Org Structure CRUD's final review (nav-gating tests for its 5 links were
missing until the very last batch's fix round), add coverage for all 3 of this plan's new links
in the same task that adds the last of them. In `staff-console/src/components/AppShell.spec.ts`:
add `/admin/teachers`, `/admin/parents`, `/admin/students` to the `makeRouter()` fixture (if
Tasks 7-8 haven't already — check first, since this step runs after all three nav links exist),
and add assertions mirroring the existing `canManageOrgStructure` link tests: `nav-teachers`/
`nav-parents`/`nav-students` exist for `SUPER_ADMIN` and `SCHOOL_ADMIN`, and do NOT exist for
`ACCOUNTS`/`TEACHER`.

Run: `cd staff-console && npx vitest run AppShell.spec.ts`
Expected: PASS, including the new assertions.

- [ ] **Step 8: Run the full staff-console suite**

Run: `cd staff-console && npm test`
Expected: PASS, all files.

- [ ] **Step 9: Commit**

```bash
git add staff-console/src/views/StudentManagementView.vue staff-console/src/views/StudentManagementView.spec.ts staff-console/src/views/StudentManagementPageView.vue staff-console/src/router/index.ts staff-console/src/components/AppShell.vue staff-console/src/components/AppShell.spec.ts
git commit -m "$(cat <<'EOF'
Add staff-console Student management screen (/admin/students)

Replaces the long-inert "Students" nav placeholder with a real,
SCHOOL_ADMIN+SUPER_ADMIN-gated route. Also adds nav-gating test
coverage for all three People CRUD links in this same task, rather
than leaving that gap for a final review to catch (as happened with
Org Structure CRUD's five links).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HCiQSXc5fWtUYgGYiwKVgu
EOF
)"
```

---

## Self-Review Notes (for the plan author, not a task)

- Spec coverage: Teacher/Parent CRUD with combined User+profile creation (Tasks 3, 2), Student
  CRUD with combined Student+Enrollment+Parent-link creation including the inline-new-parent
  branch (Task 4), `SCHOOL_ADMIN`+`SUPER_ADMIN` role scope (every controller), admin-set passwords
  (every create/update DTO), server-derived `campusId`/`academicSessionId` (Task 4), reused
  `createParentWithUser` rather than a duplicate code path (Tasks 2 and 4), authorization + real
  delete-blocked-by-Attendance e2e coverage (Task 5), all 3 staff-console screens with the
  nav-gating tests folded into the plan itself this time (Task 9 Step 7) instead of deferred to a
  final review — every section of the spec has a task.
- No placeholders: every step has real, complete code.
- Type consistency checked: `TeacherAdminSummary`/`ParentSummary`/`StudentAdminSummary`/
  `NewParentInput` field names match exactly across the backend services (Tasks 2-4), the e2e spec
  (Task 5), `staff-console/src/lib/api.ts` (Task 6), and the three consuming views (Tasks 7-9).
  `createParentWithUser`'s signature (`tx: Prisma.TransactionClient, dto: CreateParentInput`) is
  used identically by `ParentService.create()` (Task 2) and `StudentService.create()` (Task 4).
- Deviations from Org Structure CRUD's own precedent, made and recorded here rather than repeated
  per task: `TeacherService`/`ParentService`/`StudentService` all live in new singular-named
  modules (`teacher/`, `parent/`, `student/`) distinct from any existing plural read-only picker
  modules (`teachers/`, `sections/`) — this plan's routes are namespaced under `/admin/` on the
  backend specifically to avoid any collision, a naming concern Org Structure's 5 entities never
  had (none of them had a pre-existing plural sibling module).

