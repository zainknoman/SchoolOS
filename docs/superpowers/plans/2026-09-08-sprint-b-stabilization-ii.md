# Sprint B — Stabilization II: Database & Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Prisma datasource off SQLite onto Postgres and close the three remaining Repo-Audit security gaps appropriate-for-dev-only: wide-open CORS, no rate limiting, and the `FeePaymentAllocation`/`Receipt` `onDelete` policy disagreement.

**Architecture:** Four independent backend-only fixes/migrations in the existing NestJS app — no new modules, no client-facing (staff-console/parent-app) changes beyond what's noted as explicitly out of scope below. Task 1 (onDelete fix) runs first because it's a schema/data-integrity fix that should be baked into the schema *before* Task 4 generates the Postgres baseline migration, so Postgres never needs a second follow-up migration for it. Tasks 2 and 3 (CORS, rate limiting) touch only `main.ts`/`app.module.ts` and are independent of 1 and 4. Task 4 (Postgres) is last and highest-risk.

**Tech Stack:** NestJS 11, Prisma 7 (driver-adapter mode — `@prisma/adapter-better-sqlite3` today, `@prisma/adapter-pg` added by this plan), Jest (unit + e2e via supertest), `@nestjs/throttler`.

**Spec:** `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` §4 "Sprint B — Stabilization II: Database & Hardening" (line ~302) and `build/PROJECT-STATUS.md` (the Sprint 11-12 / "onDelete policy disagreement" follow-up notes, and the "PostgreSQL/Docker — not available on this machine" line under "Environment / one-time setup").

## Global Constraints

- All new/changed backend behavior needs a passing unit or e2e test — matches every prior sprint's bar (see `build/PROJECT-STATUS.md` "Verified:" lines).
- Run `cd backend && npm run build` (type-check) and `npm test` after every task — `ts-jest` runs with `isolatedModules: true`, so `tsc` catches type errors `jest` alone won't.
- Match existing code style: services throw `BadRequestException`/`NotFoundException` from `@nestjs/common`; env-driven config uses the `ConfigService`-factory pattern already established in `auth.module.ts`'s `jwtModuleFactory` (never read `process.env` directly inside a Nest provider constructor — see `2026-09-05-security-hardening-pass.md` Task 1 for why).
- **Roadmap item already closed, not re-done here:** "Upload limits — size cap + MIME allowlist on `FileInterceptor`" (Sprint B's 2nd checklist item) already landed in `2026-09-05-security-hardening-pass.md` Task 3 (`MAX_UPLOAD_BYTES = 10MB` + an extension blocklist in `backend/src/files/files.controller.ts`). This plan does not touch `files.controller.ts`; the final verification pass below just confirms its tests still pass.
- **Explicitly out of scope (follow-ups, not blocking):** client-side handling of the new 429/413 responses in staff-console/parent-app (Sprint B's prose mentions this, but it is not one of the five checklist sub-items and is pure UI polish with no security consequence — the server-side behavior this plan ships is correct with or without client handling). Cross-campus staff-access scoping (Repo Audit finding #5) — explicitly deferred per the roadmap's own Sprint B security note, single-campus scale today.
- **Environment note carried into Task 4:** this machine has no Docker and no local Postgres (`build/PROJECT-STATUS.md`, "Environment / one-time setup"). Task 4 is scoped so schema/code changes and migration-SQL generation need no live Postgres connection, and real end-to-end verification happens via a Postgres service container in GitHub Actions CI (which runs on Ubuntu with Docker built in) rather than locally. See Task 4's Step 0 for what this means for local `npm test`/`npm run test:e2e` after Task 4 lands.

---

### Task 1: Resolve the `FeePaymentAllocation` vs `Receipt` `onDelete` policy disagreement

**Context:** `Receipt.feePayment` is `onDelete: Cascade` while its sibling `FeePaymentAllocation.feePayment` is `onDelete: Restrict` (`backend/prisma/schema.prisma:433-452`) — the two children of the same `FeePayment` disagree on delete policy. This project already resolved the identical question once before: `PROJECT-STATUS.md` (Sprint 6.5) changed `Student → Attendance/FeeVoucher/LeaveRequest` from `Cascade` to `Restrict` specifically so a financial/compliance record can never silently disappear via a parent-row delete. `Receipt` is exactly that kind of record (proof a payment was made) — `Cascade` here means deleting a `FeePayment` row silently deletes the receipt that proves it happened. Fix: change `Receipt.feePayment` to `Restrict`, matching `FeePaymentAllocation` and the established project convention. (There is currently no `FeePayment.delete()` code path anywhere in the backend, so this is a schema-integrity fix, not a behavior change any existing test exercises — the new test below is what proves the constraint.)

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_receipt_restrict_on_delete/migration.sql` (generated by the command in Step 3, not hand-written)
- Test: `backend/test/fees.e2e-spec.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this is a constraint-only change, no new exported function.

- [ ] **Step 1: Edit the schema**

In `backend/prisma/schema.prisma`, find the `Receipt` model (around line 446) and change its one relation line:

```prisma
model Receipt {
  id            String     @id @default(uuid())
  feePaymentId  String     @unique
  feePayment    FeePayment @relation(fields: [feePaymentId], references: [id], onDelete: Restrict)
  receiptNumber String     @unique
  createdAt     DateTime   @default(now())
}
```

(Only `onDelete: Cascade` → `onDelete: Restrict` changes; every other line is unchanged from today.)

- [ ] **Step 2: Write the failing e2e test**

In `backend/test/fees.e2e-spec.ts`, find the `describe('Fees (e2e)', ...)` block and add this test at the end of it, before the closing `});`. (It needs a `FeePayment` with a `Receipt` already attached — reuse whatever helper/seed pattern the file already uses to create a paid voucher; if the file has a `payVoucher`/`createPaidFeePayment`-style helper, call that instead of hand-rolling the requests below.)

```typescript
  it('refuses to delete a FeePayment that has a Receipt (financial record, not silently droppable)', async () => {
    const adminToken = await loginAs('fees-accounts@seeds.edu.pk');
    const voucher = await request(app.getHttpServer())
      .post('/api/v1/fees/vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        studentId: seededStudentId,
        academicSessionId: seededSessionId,
        month: '2026-11',
        issueDate: '2026-11-01',
        dueDate: '2026-11-10',
        amount: 500000,
      })
      .expect(201);

    const payment = await prisma.feePayment.create({
      data: { amount: 500000, method: 'cash', status: 'completed' },
    });
    await prisma.feePaymentAllocation.create({
      data: { feePaymentId: payment.id, feeVoucherId: voucher.body.id, amount: 500000 },
    });
    await prisma.receipt.create({
      data: { feePaymentId: payment.id, receiptNumber: `RCPT-ONDELETE-${payment.id.slice(0, 8)}` },
    });

    await expect(prisma.feePayment.delete({ where: { id: payment.id } })).rejects.toThrow();

    // cleanup, in FK-safe order
    await prisma.receipt.delete({ where: { feePaymentId: payment.id } });
    await prisma.feePaymentAllocation.deleteMany({ where: { feePaymentId: payment.id } });
    await prisma.feePayment.delete({ where: { id: payment.id } });
    await prisma.feeVoucher.delete({ where: { id: voucher.body.id } });
  });
```

If `fees.e2e-spec.ts` doesn't already expose `seededStudentId`/`seededSessionId`/`prisma`/`loginAs` at this scope, use whatever names the file's existing tests in the same `describe` block already use for those (copy the pattern from the nearest existing voucher-creation test rather than inventing new variable names).

- [ ] **Step 3: Run test to verify it fails, then generate the migration**

Run: `cd backend && npx jest --config test/jest-e2e.json fees.e2e-spec.ts -t "refuses to delete"`
Expected: FAIL — with today's `Cascade` policy, `prisma.feePayment.delete(...)` succeeds and silently deletes the `Receipt` row too, so the `rejects.toThrow()` assertion fails.

Generate the migration from the edited schema:

```bash
cd backend && npx prisma migrate dev --name receipt_restrict_on_delete
```

Expected: Prisma detects the FK-constraint change on `Receipt` and writes `prisma/migrations/<timestamp>_receipt_restrict_on_delete/migration.sql` (SQLite requires a table-redefinition to change a `FOREIGN KEY ... ON DELETE` clause, so expect a `CREATE TABLE "new_Receipt" ...` / `DROP TABLE "Receipt"` / `ALTER TABLE "new_Receipt" RENAME TO "Receipt"` pattern, same shape as the existing `20260828111313_fee_payment_allocation` migration), applies it to the local dev DB, and regenerates the Prisma Client.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest --config test/jest-e2e.json fees.e2e-spec.ts`
Expected: PASS — including every pre-existing test in the file (the migration only tightens one FK's delete policy; it adds no new required fields).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations backend/test/fees.e2e-spec.ts
git commit -m "fix: make Receipt.feePayment onDelete Restrict, matching FeePaymentAllocation"
```

---

### Task 2: Scope CORS to known client origins

**Context:** `backend/src/main.ts` calls bare `app.enableCors()`, which reflects any request `Origin` back as allowed — any website can make authenticated cross-origin requests against this API from a logged-in staff member's browser (the parent app is a Flutter mobile client, not a browser, so it is not subject to CORS at all — this only matters for staff-console). Fix: allow-list known origins, driven by an env var so staging/prod can set their real origin without a code change, defaulting to the staff-console Vite dev server's origin (`backend/../staff-console/src/lib/api.ts` confirms staff-console talks to `http://localhost:3000` by default; Vite's own default dev port is `5173`, confirmed by `staff-console`'s `vite.config.ts` not overriding `server.port`).

**Files:**
- Create: `backend/src/config/cors.config.ts`
- Test: `backend/src/config/cors.config.spec.ts`
- Modify: `backend/src/main.ts`
- Modify: `backend/.env.example`
- Test: `backend/test/cors.e2e-spec.ts` (new)

**Interfaces:**
- Produces: `export function parseCorsOrigins(raw: string | undefined): string[]` from `cors.config.ts` — pure function, unit-testable without booting Nest.

- [ ] **Step 1: Write the failing unit test**

Create `backend/src/config/cors.config.spec.ts`:

```typescript
import { parseCorsOrigins } from './cors.config';

describe('parseCorsOrigins', () => {
  it('defaults to the staff-console dev origin when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:5173']);
  });

  it('defaults to the staff-console dev origin when set to an empty string', () => {
    expect(parseCorsOrigins('')).toEqual(['http://localhost:5173']);
  });

  it('splits a comma-separated list and trims whitespace', () => {
    expect(parseCorsOrigins('https://staff.example.com, https://staff2.example.com')).toEqual([
      'https://staff.example.com',
      'https://staff2.example.com',
    ]);
  });

  it('drops empty entries from a trailing comma', () => {
    expect(parseCorsOrigins('https://staff.example.com,')).toEqual(['https://staff.example.com']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/config/cors.config.spec.ts`
Expected: FAIL — `./cors.config` does not exist yet.

- [ ] **Step 3: Create `cors.config.ts`**

Create `backend/src/config/cors.config.ts`:

```typescript
// staff-console's Vite dev server default — the only origin that should reach this API without
// explicit operator configuration. Anything beyond dev (staging/prod) must set CORS_ORIGINS.
const DEV_DEFAULT_ORIGINS = ['http://localhost:5173'];

/**
 * Parses the CORS_ORIGINS env var (a comma-separated origin list) into the array shape
 * `app.enableCors({ origin })` expects. Falls back to the staff-console dev origin when unset —
 * the parent app is a Flutter mobile client, not a browser, so it is never subject to CORS and
 * never needs to appear in this list.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') {
    return DEV_DEFAULT_ORIGINS;
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/config/cors.config.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire it into `main.ts`**

Replace the relevant part of `backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { parseCorsOrigins } from './config/cors.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // staff-console (a different origin) calls this API directly and needs CORS; the parent app is
  // a Flutter mobile client, not subject to CORS. Scoped to a known allow-list (env-driven via
  // CORS_ORIGINS) rather than reflecting any Origin, per Sprint B hardening.
  app.enableCors({ origin: parseCorsOrigins(process.env.CORS_ORIGINS) });

  // Enforces every DTO's class-validator decorators (e.g. LoginDto) on every request; without this
  // the decorators are inert and bad input reaches the service layer unchecked.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error('Failed to start Nest application', err);
  process.exit(1);
});
```

- [ ] **Step 6: Document the env var**

In `backend/.env.example`, add a line after the existing `DATABASE_URL` line:

```
CORS_ORIGINS="http://localhost:5173"
```

- [ ] **Step 7: Write the failing e2e test**

Create `backend/test/cors.e2e-spec.ts`. Note this test explicitly calls `app.enableCors(...)` itself in `beforeAll` — e2e tests built via `Test.createTestingModule({ imports: [AppModule] }).createNestApplication()` never execute `main.ts`'s `bootstrap()` function, so this mirrors exactly what production wiring does rather than relying on it:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { parseCorsOrigins } from '../src/config/cors.config';

describe('CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.enableCors({ origin: parseCorsOrigins(process.env.CORS_ORIGINS) });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reflects Access-Control-Allow-Origin for the allowed staff-console dev origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('omits Access-Control-Allow-Origin for a disallowed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
```

- [ ] **Step 8: Run test to verify it fails, then passes**

Run: `cd backend && npx jest --config test/jest-e2e.json cors.e2e-spec.ts`
Expected (before Step 5/6 in `main.ts` — irrelevant here since the e2e test wires CORS itself): actually this test is self-contained and should PASS immediately since it calls `app.enableCors(...)` itself using the already-implemented `parseCorsOrigins`. Run it after Step 4 to confirm: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add backend/src/config/cors.config.ts backend/src/config/cors.config.spec.ts backend/src/main.ts backend/.env.example backend/test/cors.e2e-spec.ts
git commit -m "feat: scope CORS to an env-driven origin allow-list instead of reflecting any Origin"
```

---

### Task 3: Rate limiting on auth and general routes

**Context:** No rate limiting exists anywhere in the backend today — nothing stops a credential-stuffing attempt from hammering `POST /api/v1/auth/login`, or any other route from being hit at an unbounded rate. Fix: add `@nestjs/throttler` as a global guard (general routes) with a stricter per-route override on login. The limits must differ between test and non-test runs: the existing e2e suites call the shared `loginAs()` helper many times per file (often 10+ times within the same Jest run), so a real production-strength login limit (5/min) applied unconditionally would make unrelated, currently-passing e2e suites start failing on 429s that have nothing to do with what they're testing. `process.env.NODE_ENV` is set to `'test'` by Jest itself before any test file's imports run, so gating the *login-route* limit on it (evaluated once at module-import time, same timing category as any other top-level constant) is safe and mirrors the project's existing "outside dev/test" pattern from Sprint A's JWT boot-time fail-fast check. The *dedicated* rate-limit test below deliberately overrides `NODE_ENV` for just that one file before importing `AppModule`, so it alone exercises the real production limit — every other e2e file is unaffected.

**Files:**
- Create: `backend/src/config/throttler.config.ts`
- Test: `backend/src/config/throttler.config.spec.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/src/auth/auth.controller.ts`
- Test: `backend/test/rate-limiting.e2e-spec.ts` (new)

**Interfaces:**
- Produces: `export const AUTH_LOGIN_THROTTLE_LIMIT: number`, `export const GENERAL_THROTTLE_LIMIT: number`, `export const THROTTLE_TTL_MS: number` from `throttler.config.ts`.

- [ ] **Step 1: Install the dependency**

```bash
cd backend && npm install @nestjs/throttler
```

- [ ] **Step 2: Write the failing unit test**

Create `backend/src/config/throttler.config.spec.ts`:

```typescript
describe('throttler.config', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    jest.resetModules();
  });

  it('uses the strict production limits when NODE_ENV is not test', async () => {
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const mod = await import('./throttler.config');
    expect(mod.AUTH_LOGIN_THROTTLE_LIMIT).toBe(5);
    expect(mod.GENERAL_THROTTLE_LIMIT).toBe(100);
  });

  it('uses generous limits under NODE_ENV=test so e2e suites logging in repeatedly are unaffected', async () => {
    process.env.NODE_ENV = 'test';
    jest.resetModules();
    const mod = await import('./throttler.config');
    expect(mod.AUTH_LOGIN_THROTTLE_LIMIT).toBe(1000);
    expect(mod.GENERAL_THROTTLE_LIMIT).toBe(1000);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest src/config/throttler.config.spec.ts`
Expected: FAIL — `./throttler.config` does not exist yet.

- [ ] **Step 4: Create `throttler.config.ts`**

Create `backend/src/config/throttler.config.ts`:

```typescript
// NODE_ENV is set to 'test' by Jest itself before any test file's imports run, so this is safe to
// read at module-import time (unlike the JWT-secret ConfigService race documented in
// auth.module.ts — that race was specifically about .env values not being loaded yet; NODE_ENV
// is always already set by the OS/npm script long before any import runs).
const isTest = process.env.NODE_ENV === 'test';

export const THROTTLE_TTL_MS = 60_000;

// Real production value: 5 login attempts/minute — blunt but effective against credential
// stuffing. Relaxed to 1000 under test so the existing e2e suites (which call the shared
// loginAs() helper many times per file) aren't broken by a limit that has nothing to do with what
// they're testing; backend/test/rate-limiting.e2e-spec.ts is the one file that deliberately
// overrides NODE_ENV to exercise the real limit.
export const AUTH_LOGIN_THROTTLE_LIMIT = isTest ? 1000 : 5;

// Real production value: 100 requests/minute/IP across every other route.
export const GENERAL_THROTTLE_LIMIT = isTest ? 1000 : 100;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx jest src/config/throttler.config.spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Wire the global guard into `app.module.ts`**

In `backend/src/app.module.ts`, add these imports alongside the existing ones:

```typescript
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { GENERAL_THROTTLE_LIMIT, THROTTLE_TTL_MS } from './config/throttler.config';
```

Add `ThrottlerModule.forRoot([{ name: 'default', ttl: THROTTLE_TTL_MS, limit: GENERAL_THROTTLE_LIMIT }])` as the first entry in the `imports` array (before `PrismaModule`), and add a `providers` array (the module currently has none besides `controllers: [AppController]` — add `providers` if it's missing, otherwise add to the existing one):

```typescript
@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: THROTTLE_TTL_MS, limit: GENERAL_THROTTLE_LIMIT }]),
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MeModule,
    TimetableModule,
    AttendanceModule,
    SectionsModule,
    FilesModule,
    SubjectsModule,
    TeachersModule,
    DiaryModule,
    CircularsModule,
    NotificationsModule,
    MessagesModule,
    FeesModule,
    LeaveModule,
    SchoolModule,
    CampusModule,
    AcademicSessionModule,
    ClassModule,
    DashboardModule,
    ParentModule,
    TeacherModule,
    StudentModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

(`AuthModule` already registers `JwtAuthGuard`/`RolesGuard` as its own `APP_GUARD` providers — Nest runs every `APP_GUARD` across the app for every request, so this adds a third guard rather than replacing the existing two.)

- [ ] **Step 7: Add the stricter per-route override on login**

In `backend/src/auth/auth.controller.ts`, replace the full contents:

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from './decorators/public.decorator';
import { AUTH_LOGIN_THROTTLE_LIMIT, THROTTLE_TTL_MS } from '../config/throttler.config';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  // Overrides the app-wide 'default' throttler's limit for this route only — credential-stuffing
  // mitigation needs a much tighter bound than the general per-route rate limit.
  @Throttle({ default: { limit: AUTH_LOGIN_THROTTLE_LIMIT, ttl: THROTTLE_TTL_MS } })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.identifier, dto.password);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }
}
```

- [ ] **Step 8: Run the full backend unit + e2e suites to confirm no regression**

Run: `cd backend && npm run build && npm test && npm run test:e2e`
Expected: all PASS — `THROTTLE_LIMIT`s resolve to 1000 under `NODE_ENV=test` (Jest's default), so no existing suite that logs in repeatedly trips a 429.

- [ ] **Step 9: Write the dedicated rate-limit e2e test**

Create `backend/test/rate-limiting.e2e-spec.ts`. This file sets `NODE_ENV` to something other than `'test'` *before* importing `AppModule`, so `throttler.config.ts`'s module-level constants resolve to the real production limits for this file only — every other e2e file keeps running under Jest's own `NODE_ENV=test` and is unaffected:

```typescript
process.env.NODE_ENV = 'e2e-throttle-check';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Rate limiting (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('throttles repeated login attempts past the configured limit (credential-stuffing mitigation)', async () => {
    const attempts = Array.from({ length: 6 }, () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: 'nonexistent@seeds.edu.pk', password: 'wrong-password' }),
    );
    const responses = await Promise.all(attempts.map((req) => req.then((res) => res.status)));

    // The real limit is 5/minute (throttler.config.ts's AUTH_LOGIN_THROTTLE_LIMIT under a non-test
    // NODE_ENV); the 6th concurrent request should be rejected with 429 regardless of credentials.
    expect(responses.filter((status) => status === 429).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 10: Run the dedicated test**

Run: `cd backend && npx jest --config test/jest-e2e.json rate-limiting.e2e-spec.ts`
Expected: PASS — at least one of the 6 concurrent login attempts gets a 429.

- [ ] **Step 11: Re-run the full e2e suite once more to confirm this new file didn't leak its env override into others**

Run: `cd backend && npm run test:e2e`
Expected: all PASS, including every file that calls `loginAs()` repeatedly (Jest isolates `process.env` mutations per test file by default, so Step 9's `NODE_ENV` override does not leak into other files run in the same `npm run test:e2e` invocation).

- [ ] **Step 12: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/config/throttler.config.ts backend/src/config/throttler.config.spec.ts backend/src/app.module.ts backend/src/auth/auth.controller.ts backend/test/rate-limiting.e2e-spec.ts
git commit -m "feat: add @nestjs/throttler with a stricter per-route limit on login"
```

---

### Task 4: Postgres migration readiness

**Context:** `backend/prisma/schema.prisma`'s datasource is `provider = "sqlite"`, and `PrismaService`/`prisma/seed.ts` both construct `PrismaClient` with the `PrismaBetterSqlite3` driver adapter. Prisma 7's driver-adapter mode ties the schema's `provider` value directly to which SQL dialect the generated client speaks and which adapter package can be paired with it — switching `provider` to `postgresql` means `PrismaBetterSqlite3` no longer works and must be replaced with `@prisma/adapter-pg`, and it means every existing SQLite-dialect migration file under `prisma/migrations/` is now the wrong SQL dialect for the target database. **This machine has no Docker and no local Postgres** (confirmed: `docker --version` → `command not found`; `build/PROJECT-STATUS.md` already flags this). This task is scoped around that constraint:
- `prisma migrate diff --from-empty --to-schema-datamodel` generates SQL by diffing "nothing" against the schema *file*, not against a live database connection — it needs the target `provider` set correctly (to pick the right SQL dialect) but does not need `DATABASE_URL` to point at a reachable server. This is how Step 3 below produces a real Postgres baseline migration with no Postgres instance available locally.
- Real end-to-end verification (does the generated SQL actually apply cleanly to a real Postgres server, do the e2e suites pass against it) cannot happen on this machine. Step 6 adds a `postgres` service container to `.github/workflows/ci.yml`'s backend job — GitHub's `ubuntu-latest` runners have Docker built in, so CI gets a real, disposable Postgres instance without any local installation. That CI run is the actual verification gate for this task, not a local `npm test` run.
- **Consequence for local development after this task merges:** `backend/.env`'s `DATABASE_URL` must point at *some* reachable Postgres instance for `npm run start:dev`/`npm test`/`npm run test:e2e` to work locally at all (SQLite is no longer a valid fallback once `schema.prisma`'s provider is `postgresql`). Options, in order of least setup: a free-tier hosted instance (e.g. Neon, Supabase — either works, this plan takes no position on which), WSL2 + `apt install postgresql`, or the native Windows PostgreSQL installer. This is a real, unavoidable environment change this task causes — flag it to the repo owner before merging, don't silently spring it on the next `git pull`.

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/src/prisma/prisma.service.ts`
- Modify: `backend/prisma/seed.ts`
- Modify: `backend/package.json` (dependency swap)
- Create: `backend/prisma/migrations/<timestamp>_postgres_baseline/migration.sql` (generated, not hand-written)
- Delete: every existing folder under `backend/prisma/migrations/` (SQLite-dialect SQL, superseded by the new baseline — see Step 4)
- Modify: `backend/.env.example`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — `PrismaService`'s public shape (`PrismaClient` methods) is unchanged; only its internal adapter construction changes.

- [ ] **Step 1: Swap the Prisma dependency**

```bash
cd backend && npm uninstall @prisma/adapter-better-sqlite3 && npm install @prisma/adapter-pg pg && npm install -D @types/pg
```

- [ ] **Step 2: Switch the schema provider**

In `backend/prisma/schema.prisma`, replace the header comment and datasource block:

```prisma
// SEEDS Digital Platform — data model (FEAT-001)
// Postgres in every environment as of Sprint B (2026-09-08) — see docs/superpowers/plans/
// 2026-09-08-sprint-b-stabilization-ii.md for the SQLite -> Postgres migration this schema is
// part of. DATABASE_URL must point at a reachable Postgres instance in every environment,
// including local dev (SQLite is no longer a valid fallback).

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Leave every model/enum below the datasource block untouched — Prisma's schema language is provider-agnostic for the constructs this schema uses (no SQLite-only column types were used, per the original header comment this replaces).

- [ ] **Step 3: Generate the Postgres baseline migration (no live database required)**

```bash
cd backend && npx prisma migrate diff --from-empty --to-schema-datamodel=prisma/schema.prisma --script > /tmp/postgres_baseline.sql
```

Expected: a full `CREATE TABLE`/`CREATE INDEX`/`ALTER TABLE ... ADD CONSTRAINT` script covering every model in `schema.prisma`, written in Postgres SQL dialect (e.g. `TIMESTAMP(3)` instead of SQLite's `DATETIME`, `TEXT` PKs unchanged, proper `REFERENCES ... ON DELETE RESTRICT/CASCADE` clauses matching each relation's `onDelete` — including Task 1's `Receipt` fix, since this diffs against the *current* schema file state).

- [ ] **Step 4: Replace the migrations directory**

```bash
cd backend
mkdir -p prisma/migrations/20260908000000_postgres_baseline
mv /tmp/postgres_baseline.sql prisma/migrations/20260908000000_postgres_baseline/migration.sql
git rm -r prisma/migrations/20260827093519_init prisma/migrations/20260827144248_diary_circulars prisma/migrations/20260828090000_diary_entry_author prisma/migrations/20260828095443_enrollment_model prisma/migrations/20260828111313_fee_payment_allocation
```

(List every remaining SQLite-era migration folder under `prisma/migrations/` at the time this step runs — `ls prisma/migrations/` first to get the current full list, since Task 1 added one more folder before this task started. All of them are SQLite dialect and get superseded by the one new Postgres baseline folder; `git rm -r` keeps them recoverable from history if ever needed.)

- [ ] **Step 5: Update `PrismaService` and `seed.ts` to use the Postgres adapter**

Replace the full contents of `backend/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

In `backend/prisma/seed.ts`, replace the adapter construction (the first few lines of `main()`):

```typescript
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });
```

Leave the rest of `seed.ts` (every `prisma.<model>.create(...)` call after this point) untouched — no model/field names changed.

- [ ] **Step 6: Update `.env.example` and add a Postgres service container to CI**

In `backend/.env.example`, replace the `DATABASE_URL` line:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/schoolportal?schema=public"
```

In `.github/workflows/ci.yml`, add a `postgres` service to the `backend` job and point `DATABASE_URL` at it. Replace the `backend` job:

```yaml
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: schoolportal
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/schoolportal?schema=public"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: cp .env.example .env
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      # Backend carries ~672 pre-existing repo-wide Prettier/CRLF errors (see PROJECT-STATUS.md,
      # "Security Hardening Pass"); a full `prettier --write` is its own change, deliberately out of
      # Sprint A's scope. Non-blocking so the rest of this gate is trustworthy from run #1 — flip
      # to blocking once that backlog is cleared. staff-console's lint stays blocking (it is clean).
      - run: npm run lint
        continue-on-error: true
      - run: npm run build
      - run: npm test
      - run: npm run test:e2e
```

(The `env:` block at the job level sets `DATABASE_URL` for every step, overriding whatever `cp .env.example .env` writes to the file — Prisma reads `process.env.DATABASE_URL` first via `env("DATABASE_URL")` in the schema, and GitHub Actions job-level `env:` is exported into every step's process environment, so this takes precedence. Kept the `.env.example` copy step too so `npx prisma generate`/local tooling that expects a `.env` file to exist doesn't break.)

- [ ] **Step 7: Local verification (only if a reachable Postgres instance is available — see this task's Context note)**

If you have a Postgres instance available (local install, WSL, or a free-tier hosted one), point `backend/.env`'s `DATABASE_URL` at it and run:

```bash
cd backend && npx prisma migrate deploy && npx prisma:seed 2>/dev/null; npx tsx prisma/seed.ts
```

Expected: the baseline migration applies cleanly to an empty database, and the seed script completes without error.

If no Postgres instance is available on this machine right now, skip this step — it is **not** a substitute for Step 6's CI verification, which is mandatory before this task is considered done.

- [ ] **Step 8: Push the branch and confirm CI is green**

```bash
git push -u origin <branch-name>
```

Then check the GitHub Actions run for this branch/PR: the `backend` job must show the `postgres` service container starting, `npx prisma migrate deploy` applying the new baseline migration to it, and `npm test`/`npm run test:e2e` passing against it. This is the real verification gate for this task — do not mark this task done from a local run alone.

- [ ] **Step 9: Commit**

```bash
git add backend/prisma/schema.prisma backend/src/prisma/prisma.service.ts backend/prisma/seed.ts backend/package.json backend/package-lock.json backend/prisma/migrations backend/.env.example .github/workflows/ci.yml
git commit -m "feat: migrate Prisma datasource from SQLite to Postgres; add Postgres service to CI"
```

---

### Final verification (after all 4 tasks)

- [ ] Run the full backend suite: `cd backend && npm run build && npm test`
- [ ] Confirm CI is green on the branch (this is the real Postgres-backed verification — see Task 4 Step 8): backend, staff-console, and parent-app jobs all pass.
- [ ] Confirm the pre-existing upload-limit tests (`backend/test/diary-circulars.e2e-spec.ts`'s "rejects a file upload larger than..."/"rejects an upload with a blocked executable extension" tests, from `2026-09-05-security-hardening-pass.md`) still pass — this plan does not touch `files.controller.ts`, so this is a pure regression check confirming Sprint B's "Upload limits" checklist item is genuinely already satisfied.
- [ ] Update `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`'s Implementation Checklist: check Sprint B's box and all five sub-items (including "Upload limits," satisfied by the prior security-hardening-pass, not new work in this plan), noting the merge commit range and date — per [[roadmap-checklist-convention]].
- [ ] Update `build/PROJECT-STATUS.md`: move Sprint B from "next piece of Tier-0 stabilization" prose into a dated `✅ DONE` entry (matching Sprint A's format), and update the "PostgreSQL/Docker — not available on this machine" line under "Environment / one-time setup" to reflect that Postgres is now required for local dev (not merely tracked-but-deferred) and note whichever local-Postgres option was actually chosen (or that it's still open, if this merges before that decision is made).
