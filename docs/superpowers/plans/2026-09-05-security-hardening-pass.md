# Security Hardening Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close five concrete, low-risk backend defects tracked as "not blocking" follow-ups across `build/PROJECT-STATUS.md` (Sprint 7-8, Sprint 5-6, and Org Structure CRUD sections) — a real JWT secret race, an over-broad query-token auth bypass, unbounded/unfiltered file uploads, raw-500s on bad foreign keys, and a data-integrity gap that can leave the app with zero active academic sessions.

**Architecture:** Each task is an isolated bug fix in the existing NestJS backend — no new modules, no schema changes, no client-facing (staff-console/parent-app) changes. Tasks 1-2 touch `auth/`, Task 3 touches `files/`, Task 4 touches the shared `common/prisma-create-guard.ts` plus `campus/`, `class/`, `sections/`, Task 5 touches `academic-session/`. Tasks are independent of each other and can be done in any order; the order below is cheapest-to-verify-first.

**Tech Stack:** NestJS 11, Prisma (SQLite dev), Jest (unit + e2e via supertest), passport-jwt, multer.

**Spec:** `build/PROJECT-STATUS.md` — see the "Sprint 7-8 — Messages + Notifications" follow-ups (JwtModule race), "Sprint 5-6 — Diary + Circulars" follow-ups (file-storage hardening), and "Org Structure CRUD" follow-ups (AcademicSession floor, Campus/Class create 500-vs-400). This plan implements the subset of those follow-ups that are pure code fixes needing no external infrastructure (Postgres/S3/Firebase items are explicitly out of scope — see PROJECT-STATUS.md's Sprint 11-12 section).

## Global Constraints

- All new/changed backend behavior needs a passing unit or e2e test — this codebase has 100% task-level test coverage on every prior sprint (see PROJECT-STATUS.md "Verified:" lines) and follow-up work matches that bar.
- Every write path in this codebase writes an `AuditLog` row — none of these fixes touch that, but don't accidentally break it (run the touched service's full spec file after editing, not just the new test).
- Match existing code style exactly: services throw `NotFoundException`/`BadRequestException` from `@nestjs/common`, org-structure services use the `assertDeletable`/`assertCreatable` shared-helper pattern from `backend/src/common/`, not ad-hoc try/catch bodies.
- Run `cd backend && npm run build` (type-check) and `npm test` after every task — this repo's own convention (see PROJECT-STATUS.md: a prior sprint's arity bug was caught only by `tsc`, not `jest`, because `ts-jest` runs with `isolatedModules: true`).
- Do not touch SQLite→PostgreSQL, JWT secret rotation, S3, Firebase, or Play Store items — those require external infrastructure/accounts and are explicitly deferred (see PROJECT-STATUS.md Sprint 11-12).

---

### Task 1: Fix the JWT access-token secret-load-order race

**Context:** `AppModule` imports `AuthModule` (line 6) *before* it calls `ConfigModule.forRoot()` (line 31). Because ES module imports execute top-to-bottom before a file's own decorator body runs, `AuthModule`'s `JwtModule.register({ secret: process.env.JWT_ACCESS_SECRET ... })` evaluates `process.env.JWT_ACCESS_SECRET` at import time — before `.env` has been loaded into `process.env` by `ConfigModule.forRoot()`. `JwtStrategy` reads the same env var, but in its constructor, which Nest calls later during provider instantiation (after `ConfigModule.forRoot()` has run). Today both fall back to the identical hardcoded default (`'dev-only-change-me-access'`) so this is invisible, but if `JWT_ACCESS_SECRET` in `.env` is ever changed to a real value, tokens get **signed** with the stale fallback and **verified** against the real secret — every login breaks (and a forged token signed with the well-known fallback default would still verify server-side if the mismatch went the other way). Fix: use `JwtModule.registerAsync` with `ConfigService`, which defers evaluation to provider-instantiation time — same lifecycle stage as `JwtStrategy` — so both always agree.

**Files:**
- Modify: `backend/src/auth/auth.module.ts`
- Modify: `backend/src/auth/strategies/jwt.strategy.ts`
- Test: `backend/src/auth/auth.module.spec.ts` (new)

**Interfaces:**
- Produces: `export function jwtModuleFactory(config: ConfigService)` from `auth.module.ts` — a pure function, unit-testable without booting Nest's DI container.

- [ ] **Step 1: Write the failing test**

Create `backend/src/auth/auth.module.spec.ts`:

```typescript
import { ConfigService } from '@nestjs/config';
import { jwtModuleFactory } from './auth.module';
import { ACCESS_TOKEN_TTL } from './auth.constants';

describe('jwtModuleFactory', () => {
  it('reads the access-token secret from ConfigService, not from process.env directly', () => {
    const config = { get: jest.fn().mockReturnValue('secret-from-config') } as unknown as ConfigService;

    const options = jwtModuleFactory(config);

    expect(config.get).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
    expect(options).toEqual({
      secret: 'secret-from-config',
      signOptions: { expiresIn: ACCESS_TOKEN_TTL },
    });
  });

  it('falls back to the dev-only default when JWT_ACCESS_SECRET is unset', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    expect(jwtModuleFactory(config).secret).toBe('dev-only-change-me-access');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/auth/auth.module.spec.ts`
Expected: FAIL — `jwtModuleFactory` is not exported from `./auth.module` yet.

- [ ] **Step 3: Update `auth.module.ts` to export the factory and use `registerAsync`**

Replace the full contents of `backend/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ACCESS_TOKEN_TTL } from './auth.constants';

// Exported so its secret-resolution can be unit-tested without booting the whole Nest DI
// container. Takes a ConfigService (populated from .env by ConfigModule.forRoot() before any
// provider is instantiated) rather than reading `process.env` directly at import time — see the
// registerAsync call below for why that distinction matters here specifically.
export function jwtModuleFactory(config: ConfigService) {
  return {
    secret: config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-only-change-me-access',
    signOptions: { expiresIn: ACCESS_TOKEN_TTL },
  };
}

@Module({
  imports: [
    PassportModule,
    // registerAsync (not register()) is required: AppModule imports AuthModule before it calls
    // ConfigModule.forRoot(), so a plain `JwtModule.register({ secret: process.env.X })` would
    // evaluate `process.env.X` at import time — before .env is loaded — while JwtStrategy (a
    // provider, instantiated later in the DI lifecycle) sees the real value. That mismatch signs
    // tokens with the fallback secret but verifies them against the real one. registerAsync
    // defers evaluation to provider-instantiation time via ConfigService, same as JwtStrategy, so
    // both always agree.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: jwtModuleFactory,
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    // Every route is authenticated + role-checked by default (deny-by-default); only routes
    // explicitly marked with @Public() (e.g. login) skip JWT verification.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
```

- [ ] **Step 4: Update `jwt.strategy.ts` to also read the secret via `ConfigService`**

Replace the full contents of `backend/src/auth/strategies/jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      // Header is tried first; ?access_token= is a fallback so a direct file-download link
      // (which can't set headers) still authenticates.
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-only-change-me-access',
    });
  }

  // Whatever this returns becomes `request.user` — kept to just {id, role}, nothing sensitive.
  validate(payload: JwtPayload) {
    return { id: payload.sub, role: payload.role };
  }
}
```

(Note: Task 2 below replaces the `jwtFromRequest` extractor array again — this step's version is an intermediate state, not final.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/auth/auth.module.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Run the full auth suite + e2e login round-trip to confirm no regression**

Run: `cd backend && npx jest src/auth && npx jest --config test/jest-e2e.json auth.e2e-spec.ts`
Expected: all PASS — `auth.e2e-spec.ts` does a real login (sign) + authenticated request (verify) round-trip through the real `AppModule`, which is exactly the path this bug breaks if the secret ever diverges from the fallback default.

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/auth.module.ts backend/src/auth/strategies/jwt.strategy.ts backend/src/auth/auth.module.spec.ts
git commit -m "fix: resolve JWT access secret via ConfigService, not process.env at import time"
```

---

### Task 2: Scope the `?access_token=` query fallback to the files download route only

**Context:** `JwtStrategy`'s `jwtFromRequest` extractor accepts a bearer token from either the `Authorization` header or an `?access_token=` query parameter, and this applies to **every** route in the app (the strategy has no per-route awareness). The query-parameter fallback exists solely so a plain `<a href>` file-download link — which can't set a custom header — still authenticates (see `files.controller.ts`'s download handler and its e2e test). Accepting it globally means a bearer token can leak via server access logs, browser history, or a `Referer` header on *any* endpoint, not just the one that needs it. Fix: scope the query-parameter extractor to paths under `/api/v1/files/`.

**Files:**
- Modify: `backend/src/auth/strategies/jwt.strategy.ts`
- Test: `backend/src/auth/strategies/jwt.strategy.spec.ts` (new)
- Test: `backend/test/diary-circulars.e2e-spec.ts`

**Interfaces:**
- Produces: `export function extractAccessTokenForFilesRoute(req: Request): string | null` from `jwt.strategy.ts`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/auth/strategies/jwt.strategy.spec.ts`:

```typescript
import type { Request } from 'express';
import { extractAccessTokenForFilesRoute } from './jwt.strategy';

function makeRequest(path: string, accessToken?: string): Request {
  return { path, query: accessToken ? { access_token: accessToken } : {} } as unknown as Request;
}

describe('extractAccessTokenForFilesRoute', () => {
  it('extracts ?access_token= on a files download route', () => {
    expect(extractAccessTokenForFilesRoute(makeRequest('/api/v1/files/abc123', 'tok-1'))).toBe('tok-1');
  });

  it('returns null on a non-files route even when ?access_token= is present', () => {
    expect(extractAccessTokenForFilesRoute(makeRequest('/api/v1/me/children', 'tok-1'))).toBeNull();
  });

  it('returns null on a files route with no ?access_token= present', () => {
    expect(extractAccessTokenForFilesRoute(makeRequest('/api/v1/files/abc123'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/auth/strategies/jwt.strategy.spec.ts`
Expected: FAIL — `extractAccessTokenForFilesRoute` is not exported yet.

- [ ] **Step 3: Update `jwt.strategy.ts`**

Replace the full contents of `backend/src/auth/strategies/jwt.strategy.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

export interface JwtPayload {
  sub: string;
  role: string;
}

// The ?access_token= fallback exists only so a direct file-download link (which can't set an
// Authorization header) still authenticates. Scoped to the files route so a bearer token isn't
// also accepted via query string — and therefore leakable through server access logs, browser
// history, or Referer headers — on every other endpoint too.
export function extractAccessTokenForFilesRoute(req: Request): string | null {
  if (!req.path.startsWith('/api/v1/files/')) {
    return null;
  }
  return ExtractJwt.fromUrlQueryParameter('access_token')(req);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractAccessTokenForFilesRoute,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-only-change-me-access',
    });
  }

  // Whatever this returns becomes `request.user` — kept to just {id, role}, nothing sensitive.
  validate(payload: JwtPayload) {
    return { id: payload.sub, role: payload.role };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/auth/strategies/jwt.strategy.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add an e2e assertion that the query fallback no longer works off the files route**

In `backend/test/diary-circulars.e2e-spec.ts`, find the existing test `'a file attached to a diary entry is downloadable by an entitled parent (header or query-token auth) and forbidden to an unentitled one'` (it already logs in `dc-parent-a@schoolos.edu.pk` as `parentAToken` and asserts the `?access_token=` fallback works on `/api/v1/files/:id`). Add a new test directly after it:

```typescript
  it('the ?access_token= query fallback authenticates the files route but not other routes', async () => {
    const parentAToken = await loginAs('dc-parent-a@schoolos.edu.pk');

    await request(app.getHttpServer())
      .get(`/api/v1/me/children?access_token=${parentAToken}`)
      .expect(401);
  });
```

- [ ] **Step 6: Run the e2e spec to verify it passes**

Run: `cd backend && npx jest --config test/jest-e2e.json diary-circulars.e2e-spec.ts`
Expected: PASS, including the pre-existing "downloadable ... (header or query-token auth)" test (still passes — it only ever queried the files route).

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/strategies/jwt.strategy.ts backend/src/auth/strategies/jwt.strategy.spec.ts backend/test/diary-circulars.e2e-spec.ts
git commit -m "fix: scope the ?access_token= JWT fallback to the files download route only"
```

---

### Task 3: Add an upload size limit and a dangerous-extension filter to `POST /api/v1/files`

**Context:** `FilesController.upload()` uses `FileInterceptor('file', { storage: memoryStorage() })` with no `limits` or `fileFilter` — any authenticated staff member (TEACHER/SCHOOL_ADMIN/SUPER_ADMIN) can upload a file of unbounded size (buffered entirely in memory per `memoryStorage()`) of any type, including an executable. The download path already defends against content-sniffing (forces `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`), so this is about bounding resource usage and blocking file types with no legitimate use as a diary/circular/message attachment — not about re-litigating that existing defense.

**Files:**
- Modify: `backend/src/files/files.controller.ts`
- Test: `backend/test/diary-circulars.e2e-spec.ts`

**Interfaces:**
- Produces: `export const MAX_UPLOAD_BYTES` from `files.controller.ts` (imported by the e2e test to build an oversized buffer without hardcoding the limit twice).

- [ ] **Step 1: Write the failing tests**

In `backend/test/diary-circulars.e2e-spec.ts`, add this import near the top (alongside the existing imports):

```typescript
import { MAX_UPLOAD_BYTES } from '../src/files/files.controller';
```

Add these two tests directly after the existing `'a file attached to a diary entry is downloadable...'` test (after whatever Task 2 added, if done first):

```typescript
  it('rejects a file upload larger than the configured size limit', async () => {
    const teacherToken = await loginAs('dc-teacher@schoolos.edu.pk');
    const oversized = Buffer.alloc(MAX_UPLOAD_BYTES + 1);

    await request(app.getHttpServer())
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', oversized, 'huge.pdf')
      .expect(413);
  });

  it('rejects an upload with a blocked executable extension', async () => {
    const teacherToken = await loginAs('dc-teacher@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', Buffer.from('not really an installer'), 'setup.exe')
      .expect(400);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest --config test/jest-e2e.json diary-circulars.e2e-spec.ts -t "rejects"`
Expected: FAIL — both requests currently succeed with 201 (no limit/filter configured yet), and the import of `MAX_UPLOAD_BYTES` fails to resolve.

- [ ] **Step 3: Update `files.controller.ts`**

Replace the full contents of `backend/src/files/files.controller.ts`:

```typescript
import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import type { Request, Response } from 'express';
import { FilesService } from './files.service';
import { FilesAccessService } from './files-access.service';
import { RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

// 10 MB — generous for a diary/circular/message attachment (a worksheet scan, a PDF, a photo)
// while still bounding per-upload memory/disk usage. No spec value exists for this; chosen as a
// sane MVP default, easy to raise later if a real use case needs it.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// Executable/script extensions have no legitimate use as a diary/circular/message attachment in
// this app; blocked regardless of the client-reported mimetype (which is attacker-controlled).
// Deliberately a blocklist, not an allowlist: staff also attach plain-text worksheets, images,
// PDFs, and office docs, none of which should need enumerating up front.
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.dll', '.scr', '.ps1', '.vbs', '.js', '.jar', '.sh', '.app',
]);

@Controller('api/v1/files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly filesAccess: FilesAccessService,
  ) {}

  @Roles('TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN')
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
      fileFilter: (_req, file, callback) => {
        if (BLOCKED_EXTENSIONS.has(extname(file.originalname).toLowerCase())) {
          callback(new BadRequestException('This file type is not allowed.'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File, @Req() req: AuthenticatedRequest) {
    return this.filesService.upload(file, req.user.id);
  }

  @Get(':id')
  async download(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    await this.filesAccess.assertCanAccessFile(req.user, id);
    const { buffer, originalName, mimeType } = await this.filesService.read(id);
    // Serve as a forced download (not inline) so an attacker-controlled mimetype/filename
    // (e.g. a .html file declared as text/html) can never render as a page on this origin —
    // which matters here because download links carry the caller's JWT via ?access_token=.
    // Strip quotes from the filename to prevent header injection via Content-Disposition.
    const safeName = originalName.replace(/"/g, '');
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    res.send(buffer);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest --config test/jest-e2e.json diary-circulars.e2e-spec.ts`
Expected: PASS — including the pre-existing `.txt`-attachment test (`worksheet.txt` isn't in `BLOCKED_EXTENSIONS`, so it's unaffected) and the pre-existing download tests.

- [ ] **Step 5: Commit**

```bash
git add backend/src/files/files.controller.ts backend/test/diary-circulars.e2e-spec.ts
git commit -m "feat: bound upload size and block executable file types on POST /api/v1/files"
```

---

### Task 4: Translate invalid foreign-key references on create/update into 400s (Campus, Class, Section)

**Context:** `CampusService.create()`, `ClassService.create()`, and `SectionsService.create()`/`.update()` insert rows referencing a parent id (`schoolId`, `campusId`+`academicSessionId`, `classId`+`classTeacherId`) supplied directly by the request body, with no existence check and no `try/catch` around the Prisma call. An invalid id trips a Prisma `P2003` foreign-key-constraint error, which reaches the client as a raw, unhandled 500 instead of a clean 400. The codebase already has exactly this pattern solved for **delete** (`assertDeletable` in `backend/src/common/prisma-delete-guard.ts`, which every org-structure entity's `delete()` already uses) and for **unique-constraint** violations on create (`assertCreatable` in `backend/src/common/prisma-create-guard.ts`, used by Teacher/Parent/Student). This task adds the missing third case: a foreign-key violation *on create/update*.

**Files:**
- Modify: `backend/src/common/prisma-create-guard.ts`
- Test: `backend/src/common/prisma-create-guard.spec.ts`
- Modify: `backend/src/campus/campus.service.ts`
- Test: `backend/src/campus/campus.service.spec.ts`
- Modify: `backend/src/class/class.service.ts`
- Test: `backend/src/class/class.service.spec.ts`
- Modify: `backend/src/sections/sections.service.ts`
- Test: `backend/src/sections/sections.service.spec.ts`

**Interfaces:**
- Produces: `export function assertValidReferences(error: unknown, message: string): never` from `prisma-create-guard.ts` — same shape as the existing `assertDeletable`/`assertCreatable`, translates Prisma's `P2003` code (not `P2002`, which `assertCreatable` already owns) into a `BadRequestException`.

- [ ] **Step 1: Write the failing test for the new shared helper**

Add to `backend/src/common/prisma-create-guard.spec.ts` (below the existing `describe('assertCreatable', ...)` block, same file):

```typescript
import { assertCreatable, assertValidReferences } from './prisma-create-guard';

function makeP2003(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
    code: 'P2003',
    clientVersion: 'test',
  });
}

describe('assertValidReferences', () => {
  it('translates a P2003 foreign-key violation into a BadRequestException with the given message', () => {
    expect(() => assertValidReferences(makeP2003(), 'Invalid school reference.')).toThrow(BadRequestException);
    try {
      assertValidReferences(makeP2003(), 'Invalid school reference.');
    } catch (err) {
      expect((err as BadRequestException).message).toBe('Invalid school reference.');
    }
  });

  it('rethrows any other error unchanged', () => {
    const other = new Error('boom');
    expect(() => assertValidReferences(other, 'x')).toThrow(other);
  });

  it('rethrows a Prisma error with a different code unchanged (e.g. P2002)', () => {
    const unique = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });
    expect(() => assertValidReferences(unique, 'x')).toThrow(unique);
  });
});
```

(Only add the new `import` line and the new `describe` block — the file already imports `BadRequestException` and `Prisma` at the top for the existing `assertCreatable` tests; just widen the existing `import { assertCreatable } from './prisma-create-guard'` line to also import `assertValidReferences`, and don't duplicate the `Prisma`/`BadRequestException` imports.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/common/prisma-create-guard.spec.ts`
Expected: FAIL — `assertValidReferences` is not exported yet.

- [ ] **Step 3: Add `assertValidReferences` to `prisma-create-guard.ts`**

Replace the full contents of `backend/src/common/prisma-create-guard.ts`:

```typescript
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

/**
 * Every org-structure create()/update() that writes a caller-supplied parent id (schoolId,
 * campusId, classTeacherId, ...) calls this from its catch/`.catch()` handler. Translates a
 * Prisma foreign-key-constraint failure (P2003 — the referenced parent row doesn't exist) into a
 * clear 400 instead of letting a raw 500 reach the client. Any other error is rethrown unchanged.
 */
export function assertValidReferences(error: unknown, message: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    throw new BadRequestException(message);
  }
  throw error;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/common/prisma-create-guard.spec.ts`
Expected: PASS

- [ ] **Step 5: Write the failing test for `CampusService.create()`**

Add to `backend/src/campus/campus.service.spec.ts`, inside the existing `describe('CampusService', ...)` block, after the `'creates a campus under a school and audit-logs it'` test:

```typescript
  it('translates a foreign-key violation on create into a BadRequestException (invalid schoolId)', async () => {
    prisma.campus.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.create({ schoolId: 'missing', name: 'x' }, 'admin-1')).rejects.toThrow(BadRequestException);
  });
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd backend && npx jest src/campus/campus.service.spec.ts`
Expected: FAIL — `prisma.campus.create` rejects, but `create()` has no `catch`, so the raw `PrismaClientKnownRequestError` propagates instead of a `BadRequestException`.

- [ ] **Step 7: Update `CampusService.create()`**

In `backend/src/campus/campus.service.ts`, add the import and wrap the create call:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertValidReferences } from '../common/prisma-create-guard';
import { CreateCampusDto } from './dto/create-campus.dto';
import { UpdateCampusDto } from './dto/update-campus.dto';
```

Replace the `create()` method body:

```typescript
  async create(dto: CreateCampusDto, actingUserId: string): Promise<CampusSummary> {
    const record = await this.prisma.campus
      .create({ data: { schoolId: dto.schoolId, name: dto.name }, include: WITH_SCHOOL })
      .catch((error: unknown) => assertValidReferences(error, 'Invalid school reference.'));
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'campus.create',
        entity: 'Campus',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }
```

Leave `list()`, `update()`, and `delete()` untouched (`update()` only ever writes `name`, which has no foreign key).

- [ ] **Step 8: Run test to verify it passes**

Run: `cd backend && npx jest src/campus/campus.service.spec.ts`
Expected: PASS (all tests, including the pre-existing ones)

- [ ] **Step 9: Write the failing test for `ClassService.create()`**

Add to `backend/src/class/class.service.spec.ts`, inside `describe('ClassService', ...)`, after the `'creates a class under a campus + academic session...'` test:

```typescript
  it('translates a foreign-key violation on create into a BadRequestException (invalid campusId/academicSessionId)', async () => {
    prisma.class.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(
      service.create({ campusId: 'missing', academicSessionId: 'as1', name: 'Grade 3' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });
```

- [ ] **Step 10: Run test to verify it fails**

Run: `cd backend && npx jest src/class/class.service.spec.ts`
Expected: FAIL, same shape as Step 6.

- [ ] **Step 11: Update `ClassService.create()`**

In `backend/src/class/class.service.ts`, add the import:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertValidReferences } from '../common/prisma-create-guard';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
```

Replace the `create()` method body:

```typescript
  async create(dto: CreateClassDto, actingUserId: string): Promise<ClassSummary> {
    const record = await this.prisma.class
      .create({
        data: { campusId: dto.campusId, academicSessionId: dto.academicSessionId, name: dto.name },
        include: WITH_PARENTS,
      })
      .catch((error: unknown) => assertValidReferences(error, 'Invalid campus or academic session reference.'));
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'class.create',
        entity: 'Class',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }
```

Leave `list()`, `update()`, and `delete()` untouched (`update()` only ever writes `name`).

- [ ] **Step 12: Run test to verify it passes**

Run: `cd backend && npx jest src/class/class.service.spec.ts`
Expected: PASS

- [ ] **Step 13: Write the failing tests for `SectionsService.create()` and `.update()`**

Add to `backend/src/sections/sections.service.spec.ts`, inside `describe('SectionsService', ...)`:

After the `'creates a section with no class teacher when none is given'` test:

```typescript
  it('translates a foreign-key violation on create into a BadRequestException (invalid classId/classTeacherId)', async () => {
    prisma.section.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(
      service.create({ classId: 'missing', name: '3A' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });
```

After the `'updates a section (classId is not editable, name and classTeacherId are)'` test:

```typescript
  it('translates a foreign-key violation on update into a BadRequestException (invalid classTeacherId)', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', name: '3A', classId: 'cl1' });
    prisma.section.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(
      service.update('sec1', { classTeacherId: 'missing-teacher' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });
```

- [ ] **Step 14: Run tests to verify they fail**

Run: `cd backend && npx jest src/sections/sections.service.spec.ts`
Expected: FAIL, same shape as Step 6, for both new tests.

- [ ] **Step 15: Update `SectionsService.create()` and `.update()`**

In `backend/src/sections/sections.service.ts`, add the import:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertDeletable } from '../common/prisma-delete-guard';
import { assertValidReferences } from '../common/prisma-create-guard';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
```

Replace the `create()` method body:

```typescript
  async create(dto: CreateSectionDto, actingUserId: string): Promise<SectionSummary> {
    const record = await this.prisma.section
      .create({
        data: { classId: dto.classId, name: dto.name, classTeacherId: dto.classTeacherId },
        include: WITH_PARENTS,
      })
      .catch((error: unknown) => assertValidReferences(error, 'Invalid class or class-teacher reference.'));
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'section.create',
        entity: 'Section',
        entityId: record.id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }
```

Replace the `update()` method body:

```typescript
  async update(id: string, dto: UpdateSectionDto, actingUserId: string): Promise<SectionSummary> {
    const existing = await this.prisma.section.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Section not found');
    }
    const record = await this.prisma.section
      .update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.classTeacherId !== undefined ? { classTeacherId: dto.classTeacherId } : {}),
        },
        include: WITH_PARENTS,
      })
      .catch((error: unknown) => assertValidReferences(error, 'Invalid class-teacher reference.'));
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'section.update',
        entity: 'Section',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }
```

- [ ] **Step 16: Run tests to verify they pass**

Run: `cd backend && npx jest src/sections/sections.service.spec.ts`
Expected: PASS (all tests, including pre-existing ones — note `classTeacherId: null` for unassignment still updates cleanly since `null` never trips a `P2003`)

- [ ] **Step 17: Run the full backend unit suite + org-structure e2e to confirm no regression**

Run: `cd backend && npm test && npx jest --config test/jest-e2e.json org-structure.e2e-spec.ts`
Expected: all PASS

- [ ] **Step 18: Commit**

```bash
git add backend/src/common/prisma-create-guard.ts backend/src/common/prisma-create-guard.spec.ts backend/src/campus/campus.service.ts backend/src/campus/campus.service.spec.ts backend/src/class/class.service.ts backend/src/class/class.service.spec.ts backend/src/sections/sections.service.ts backend/src/sections/sections.service.spec.ts
git commit -m "fix: translate invalid foreign-key references into 400s on Campus/Class/Section create+update"
```

---

### Task 5: Prevent the active-AcademicSession count from reaching zero

**Context:** `AcademicSessionService` enforces "at most one active session" (creating/activating one deactivates whichever was previously active, in one transaction — see Sprint 6.5 in PROJECT-STATUS.md), but nothing enforces "at least one." An admin can `PATCH` the currently-active session to `{ isActive: false }` with no replacement, or `DELETE` it outright (if it has no dependent Class/Enrollment rows yet), leaving zero active sessions. `FeeVouchersService` and the Dashboard's `studentsTotal` aggregate both silently assume exactly one active session always exists. Fix: since the "at most one" invariant already holds, "the currently active session" and "the only active session" are the same thing — block any operation that would deactivate or delete it without another taking its place.

**Files:**
- Modify: `backend/src/academic-session/academic-session.service.ts`
- Test: `backend/src/academic-session/academic-session.service.spec.ts`
- Test: `backend/test/org-structure.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing new — uses the existing `AcademicSessionService.update()`/`.delete()` signatures.

- [ ] **Step 1: Write the failing tests**

Add to `backend/src/academic-session/academic-session.service.spec.ts`, inside `describe('AcademicSessionService', ...)`, after the `'activating an existing session excludes itself from the deactivation sweep'` test:

```typescript
  it('refuses to deactivate the only active session', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({ id: 'as1', label: '2026-2027', isActive: true });

    await expect(service.update('as1', { isActive: false }, 'admin-1')).rejects.toThrow(BadRequestException);
    expect(tx.academicSession.update).not.toHaveBeenCalled();
  });

  it('allows an update that leaves an already-inactive session inactive', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({ id: 'as1', label: '2026-2027', isActive: false });
    tx.academicSession.update.mockResolvedValue({
      id: 'as1',
      label: '2026-2027 Renamed',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-06-30'),
      isActive: false,
    });

    await expect(service.update('as1', { label: '2026-2027 Renamed' }, 'admin-1')).resolves.toBeDefined();
  });
```

Add after the `'translates a foreign-key violation on delete into a BadRequestException'` test:

```typescript
  it('refuses to delete the active session', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({ id: 'as1', label: '2026-2027', isActive: true });

    await expect(service.delete('as1', 'admin-1')).rejects.toThrow(BadRequestException);
    expect(prisma.academicSession.delete).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/academic-session/academic-session.service.spec.ts`
Expected: FAIL on the two new "refuses to..." tests (both currently proceed instead of throwing); the "allows an update..." test should already pass (included to lock in the non-regression case).

- [ ] **Step 3: Update `academic-session.service.ts`**

In `backend/src/academic-session/academic-session.service.ts`, update the import:

```typescript
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
```

Replace the `update()` method body:

```typescript
  async update(id: string, dto: UpdateAcademicSessionDto, actingUserId: string): Promise<AcademicSessionSummary> {
    const existing = await this.prisma.academicSession.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Academic session not found');
    }
    if (dto.isActive === false && existing.isActive) {
      throw new BadRequestException(
        'Cannot deactivate the only active academic session — activate a different session instead.',
      );
    }
    const record = await this.prisma.$transaction(async (tx) => {
      if (dto.isActive) {
        await tx.academicSession.updateMany({
          where: { isActive: true, id: { not: id } },
          data: { isActive: false },
        });
      }
      return tx.academicSession.update({
        where: { id },
        data: {
          ...(dto.label !== undefined ? { label: dto.label } : {}),
          ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
          ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actingUserId,
        action: 'academic-session.update',
        entity: 'AcademicSession',
        entityId: id,
        metadata: JSON.stringify(dto),
      },
    });
    return this.toSummary(record);
  }
```

Replace the `delete()` method body:

```typescript
  async delete(id: string, actingUserId: string): Promise<void> {
    const existing = await this.prisma.academicSession.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Academic session not found');
    }
    if (existing.isActive) {
      throw new BadRequestException(
        'Cannot delete the active academic session — activate a different session first.',
      );
    }
    try {
      await this.prisma.academicSession.delete({ where: { id } });
    } catch (error) {
      assertDeletable(error, 'Academic session');
    }
    await this.prisma.auditLog.create({
      data: { userId: actingUserId, action: 'academic-session.delete', entity: 'AcademicSession', entityId: id },
    });
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx jest src/academic-session/academic-session.service.spec.ts`
Expected: PASS (all tests, including pre-existing ones)

- [ ] **Step 5: Add an e2e test**

In `backend/test/org-structure.e2e-spec.ts`, add a new test at the end of the `describe('Org Structure (e2e)', ...)` block (directly after `'creating a second active AcademicSession deactivates the first'`, before the closing `});`):

```typescript
  it('refuses to leave zero active academic sessions, by deactivation or by deletion', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

    const session = await request(app.getHttpServer())
      .post('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'OS Floor Session', startDate: '2028-08-01', endDate: '2029-06-30', isActive: true })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/academic-sessions/${session.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/v1/academic-sessions/${session.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await prisma.academicSession.delete({ where: { id: session.body.id } });
  });
```

- [ ] **Step 6: Run the e2e spec to verify it passes**

Run: `cd backend && npx jest --config test/jest-e2e.json org-structure.e2e-spec.ts`
Expected: PASS (all tests, including the pre-existing ones)

- [ ] **Step 7: Commit**

```bash
git add backend/src/academic-session/academic-session.service.ts backend/src/academic-session/academic-session.service.spec.ts backend/test/org-structure.e2e-spec.ts
git commit -m "fix: prevent the active-AcademicSession count from reaching zero"
```

---

### Final verification (after all 5 tasks)

- [ ] Run the full backend suite: `cd backend && npm run build && npm test`
- [ ] Run the full e2e suite twice in a row (Org Structure CRUD's own follow-up note: some cleanup bugs only show up on a second consecutive run): `cd backend && npx jest --config test/jest-e2e.json && npx jest --config test/jest-e2e.json`
- [ ] Update `build/PROJECT-STATUS.md`: move this work from "Sprint 11-12 — Hardening + Pilot ⏳ PENDING" into a new "✅ DONE" entry, and remove/mark-resolved the five specific follow-up bullets this closes (Sprint 7-8's JwtModule race, Sprint 5-6's upload size/type-filter gap, the `?access_token=` global-scope gap, Org Structure's AcademicSession floor gap, and Org Structure's Campus/Class create 500-vs-400 gap) — the Circular-fan-out/staff-file school-boundary item and the `FeePaymentsService.pay()` stuck-payment item are explicitly *not* closed by this plan and should stay listed.
