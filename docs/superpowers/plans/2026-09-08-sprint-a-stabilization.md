# Sprint A — Stabilization I: Session, CI, Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close two Tier-0 stabilization gaps confirmed still open in the real code — the refresh-token loop is dead (no `POST /auth/refresh`, so an expired 15-minute access token forces a full re-login) and there is no CI pipeline — without touching any of the 15+ already-shipped feature modules.

**Architecture:** Backend adds one new endpoint (`POST /api/v1/auth/refresh`) that redeems and rotates the existing (already-modeled, currently write-only) `RefreshToken` row, plus a boot-time check that refuses to start with the dev-only JWT fallback secret outside development/test. Both clients get a **transport-layer interceptor** — wrapping `window.fetch` on staff-console and `http.Client` on parent-app — so a 401 triggers one silent refresh-and-retry with zero changes to either client's dozens of existing call sites. A three-job GitHub Actions workflow runs each project's real test suite on every PR.

**Tech Stack:** NestJS 11 + Prisma 7 + SQLite (backend, Jest), Vue 3 + Pinia (staff-console, Vitest), Flutter + Provider (parent-app, `flutter test`), GitHub Actions.

**Spec:** `docs/Plan-Ideas/SchoolOS-PostMVP-Roadmap-2026-09-08.md` §4 "Sprint A — Stabilization I: Session, CI, Data" — the acceptance criteria below are copied verbatim from that section, verified against the actual current code (not assumed) before this plan was written.

## Global Constraints

- No changes to any existing feature module (fees/, messages/, leave/, etc.) — this sprint touches only `auth/`, the two clients' session layers, and CI config.
- Every new backend endpoint must go through the existing `ValidationPipe({ whitelist: true, transform: true })` — use a `class-validator` DTO, matching `LoginDto`'s pattern exactly.
- Refresh tokens remain opaque random tokens hashed with SHA-256 before storage (existing `issueSession` pattern) — they are **not** JWTs; `JWT_REFRESH_SECRET` in `.env.example` is currently unused and stays unused (rotation security comes from single-use + DB revocation, not a signature).
- A session must survive **>15 minutes of active use with zero user-visible interruption** (the access token's TTL) — this is the sprint's Definition of Done from the roadmap and the acceptance bar for the interceptor tasks.
- Client interceptors must **not** modify any of `api.ts`'s ~60 exported functions or `ApiClient`'s ~25 methods — wrap at the transport layer only (`fetch` / `http.Client`).
- CI must run each project's **real** commands from its own `package.json`/`pubspec.yaml` — never hand-rolled equivalents.

---

## Verified current state (read before starting — do not re-derive)

- `backend/src/auth/auth.controller.ts` has only `POST /api/v1/auth/login`. No `/refresh` route exists anywhere in `backend/src/`.
- `backend/src/auth/auth.service.ts`'s private `issueSession()` already creates a `RefreshToken` row (`prisma.refreshToken.create`) on every login — it is written but **never read**. Nothing redeems it.
- `backend/prisma/schema.prisma`'s `RefreshToken` model already has `tokenHash`, `expiresAt`, `revokedAt` — no schema change needed.
- `backend/src/auth/auth.service.spec.ts`'s Prisma mock **already stubs** `refreshToken.findUnique` and `refreshToken.update` (scaffolded ahead of this sprint, never used) — confirms this exact design was anticipated.
- `backend/src/auth/auth.module.ts`'s `jwtModuleFactory` and `backend/src/auth/strategies/jwt.strategy.ts` both independently fall back to the literal string `'dev-only-change-me-access'` when `JWT_ACCESS_SECRET` is unset — no fail-fast exists in either place.
- No `.github/` directory exists anywhere in the repo — zero CI today.
- `staff-console/src/lib/api.ts` (~960 lines) has ~60 exported functions, each calling global `fetch` directly with `authHeaders(accessToken)` — no shared request wrapper, no interceptor.
- `staff-console/src/stores/auth.ts` (Pinia) holds `accessToken`/`refreshToken`/`role`, persisted to `localStorage['schoolos.auth']`. No `refreshSession` action exists.
- `parent-app/lib/src/api/api_client.dart` (~250 lines) takes a `http.Client` via constructor DI (already used by tests via `MockClient`) — a clean seam to wrap.
- `parent-app/lib/src/auth/auth_state.dart` persists `accessToken`/`refreshToken`/`role` to secure storage on login, but only re-loads `accessToken`/`role` in `restoreSession()` — `refreshToken` is written but never read back into memory. No `refreshSession` method exists.
- `parent-app/lib/main.dart` constructs `ApiClient`/`AuthState` as `late final` fields in declaration order (`_api` → `_auth` → `_router`), which this plan's wiring must preserve.

---

## Task 1: Backend — boot-time JWT-secret fail-fast

**Files:**
- Create: `backend/src/auth/jwt-secret.ts`
- Create: `backend/src/auth/jwt-secret.spec.ts`
- Modify: `backend/src/auth/auth.module.ts` (use the new shared resolver instead of its own inline fallback)
- Modify: `backend/src/auth/strategies/jwt.strategy.ts` (same)

**Interfaces:**
- Produces: `resolveAccessTokenSecret(config: ConfigService): string` — throws `Error` if `JWT_ACCESS_SECRET` is unset and `NODE_ENV` (default `'development'` when unset) is anything other than `'development'` or `'test'`; otherwise returns the real secret or the `'dev-only-change-me-access'` fallback.

- [ ] **Step 1: Write the failing test**

Create `backend/src/auth/jwt-secret.spec.ts`:

```typescript
import { ConfigService } from '@nestjs/config';
import { resolveAccessTokenSecret } from './jwt-secret';

describe('resolveAccessTokenSecret', () => {
  it('throws when JWT_ACCESS_SECRET is unset and NODE_ENV is production', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'production' : undefined)),
    } as unknown as ConfigService;

    expect(() => resolveAccessTokenSecret(config)).toThrow(
      /JWT_ACCESS_SECRET must be set/,
    );
  });

  it('does not throw when JWT_ACCESS_SECRET is unset and NODE_ENV is development', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'development' : undefined)),
    } as unknown as ConfigService;

    expect(resolveAccessTokenSecret(config)).toBe('dev-only-change-me-access');
  });

  it('does not throw when JWT_ACCESS_SECRET is unset and NODE_ENV is unset (defaults to development)', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    expect(resolveAccessTokenSecret(config)).toBe('dev-only-change-me-access');
  });

  it('never throws when JWT_ACCESS_SECRET is set, regardless of NODE_ENV', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? 'real-secret' : 'production')),
    } as unknown as ConfigService;
    expect(resolveAccessTokenSecret(config)).toBe('real-secret');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest jwt-secret.spec.ts`
Expected: FAIL — `Cannot find module './jwt-secret'`

- [ ] **Step 3: Write the implementation**

Create `backend/src/auth/jwt-secret.ts`:

```typescript
import { ConfigService } from '@nestjs/config';

const DEV_ONLY_FALLBACK_SECRET = 'dev-only-change-me-access';

// JwtModule.registerAsync's factory (signing) and JwtStrategy (verifying) must resolve to the
// exact same secret, so this lives in one place both import. Refuses to boot with the insecure
// fallback outside development/test — a misconfigured production deploy must fail loudly at
// startup, not silently sign tokens with a publicly-known default.
export function resolveAccessTokenSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_ACCESS_SECRET');
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';

  if (!secret && nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error(
      'JWT_ACCESS_SECRET must be set outside development/test — refusing to boot with the insecure fallback secret.',
    );
  }

  return secret ?? DEV_ONLY_FALLBACK_SECRET;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest jwt-secret.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Wire it into auth.module.ts**

In `backend/src/auth/auth.module.ts`, replace the inline fallback with the shared resolver:

```typescript
import { resolveAccessTokenSecret } from './jwt-secret';

export function jwtModuleFactory(config: ConfigService) {
  return {
    secret: resolveAccessTokenSecret(config),
    signOptions: { expiresIn: ACCESS_TOKEN_TTL },
  };
}
```

(Remove the now-unused inline fallback string from this file. Keep the existing `registerAsync` block and its comment unchanged — that comment explains a separate, still-valid concern about import ordering.)

- [ ] **Step 6: Wire it into jwt.strategy.ts**

In `backend/src/auth/strategies/jwt.strategy.ts`, add the import and replace the constructor's inline fallback:

```typescript
import { resolveAccessTokenSecret } from '../jwt-secret';
```

```typescript
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        extractAccessTokenForDownloadRoutes,
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveAccessTokenSecret(config),
    });
  }
```

- [ ] **Step 7: Run the existing auth suite to confirm nothing broke**

Run: `cd backend && npx jest auth`
Expected: PASS — `auth.module.spec.ts`'s two existing tests must still pass unchanged (its mock `ConfigService.get` returns a fixed value for every key, so `NODE_ENV` reads the same as `JWT_ACCESS_SECRET` in test 1 — `secret` is truthy there so the fail-fast branch is never reached; test 2's mock returns `undefined` for every key, so `NODE_ENV` defaults to `'development'` and no throw occurs). If `jwt.strategy.spec.ts` asserts the literal fallback string directly, it should still pass unchanged for the same reason — if it fails, update its `ConfigService` mock to also return `undefined`/`'development'` for `NODE_ENV`, do not change `resolveAccessTokenSecret`'s behavior to make it pass.

- [ ] **Step 8: Commit**

```bash
git add backend/src/auth/jwt-secret.ts backend/src/auth/jwt-secret.spec.ts backend/src/auth/auth.module.ts backend/src/auth/strategies/jwt.strategy.ts
git commit -m "feat(auth): fail fast at boot if JWT_ACCESS_SECRET is unset outside dev/test"
```

---

## Task 2: Backend — `POST /api/v1/auth/refresh` with rotation-on-use

**Files:**
- Create: `backend/src/auth/dto/refresh.dto.ts`
- Modify: `backend/src/auth/auth.service.ts` (add `refresh()`, reusing private `issueSession()`)
- Modify: `backend/src/auth/auth.controller.ts` (add `POST /refresh`)
- Modify: `backend/src/auth/auth.service.spec.ts` (add unit tests — the Prisma mock already stubs `refreshToken.findUnique`/`update`)

**Interfaces:**
- Consumes: `AuthService.issueSession(userId: string, role: string): Promise<SessionResult>` (existing private method, unchanged signature).
- Produces: `AuthService.refresh(refreshToken: string): Promise<SessionResult>` — throws `UnauthorizedException(GENERIC_AUTH_ERROR)` for an unknown, expired, or already-revoked token; otherwise revokes the presented token and returns a brand-new `{ accessToken, refreshToken, role }` pair via `issueSession`.
- Produces: `POST /api/v1/auth/refresh` (public route) — body `{ refreshToken: string }` → `SessionResult`.

- [ ] **Step 1: Write the failing unit tests**

Append to `backend/src/auth/auth.service.spec.ts` (inside the existing `describe('AuthService', ...)` block, after the last `it(...)`):

```typescript
  describe('refresh', () => {
    const storedToken = {
      id: 'rt-1',
      userId: 'user-1',
      tokenHash: expect.any(String),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null as Date | null,
    };

    it('exchanges a valid, unexpired, unrevoked refresh token for a new session', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(storedToken);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ ...baseUser });
      prisma.refreshToken.create.mockResolvedValue({});

      const result = await service.refresh('some-raw-refresh-token');

      expect(result.accessToken).toBe('signed-access-token');
      expect(typeof result.refreshToken).toBe('string');
      expect(result.role).toBe('PARENT');
      // the presented token is revoked as part of the same exchange (rotation-on-use)
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('rejects an unknown refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.refresh('garbage-token')).rejects.toThrow(GENERIC_AUTH_ERROR);
    });

    it('rejects an expired refresh token', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(GENERIC_AUTH_ERROR);
    });

    it('rejects an already-revoked refresh token (rejects reuse)', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...storedToken,
        revokedAt: new Date(),
      });

      await expect(service.refresh('reused-token')).rejects.toThrow(GENERIC_AUTH_ERROR);
      expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest auth.service.spec.ts`
Expected: FAIL — `service.refresh is not a function`

- [ ] **Step 3: Implement `AuthService.refresh()`**

In `backend/src/auth/auth.service.ts`, add this public method (after `login`, before the private `issueSession`):

```typescript
  async refresh(refreshToken: string): Promise<SessionResult> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    // Rotation-on-use: revoke the presented token immediately, so a replayed copy of it (e.g.
    // from a stolen log or a slow network retry racing a legitimate refresh) is rejected by the
    // check above the next time anyone tries to use it — even though the legitimate caller
    // already received a fresh pair below.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) {
      throw new UnauthorizedException(GENERIC_AUTH_ERROR);
    }

    return this.issueSession(user.id, user.role);
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest auth.service.spec.ts`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 5: Add the DTO**

Create `backend/src/auth/dto/refresh.dto.ts`:

```typescript
import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}
```

- [ ] **Step 6: Add the controller route**

Modify `backend/src/auth/auth.controller.ts` to:

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { Public } from './decorators/public.decorator';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
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

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth/dto/refresh.dto.ts backend/src/auth/auth.service.ts backend/src/auth/auth.controller.ts backend/src/auth/auth.service.spec.ts
git commit -m "feat(auth): add POST /auth/refresh with rotation-on-use"
```

---

## Task 3: Backend — e2e coverage for the refresh flow

**Files:**
- Modify: `backend/test/auth.e2e-spec.ts`

**Interfaces:**
- Consumes: `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh` (both from Task 2, against a real Nest app + real (SQLite) database).

- [ ] **Step 1: Write the failing e2e tests**

Append to `backend/test/auth.e2e-spec.ts`, inside the existing `describe('Auth (e2e)', ...)` block, after the last `it(...)`:

```typescript
  it('exchanges a refresh token for a new access+refresh token pair', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: testIdentifier, password: testPassword })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(loginRes.body.refreshToken);
    expect(res.body.role).toBe('PARENT');
  });

  it('rejects reuse of an already-redeemed refresh token (rotation-on-use)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: testIdentifier, password: testPassword })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(401);
  });

  it('rejects an unknown/garbage refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npm run test:e2e -- auth.e2e-spec.ts`
Expected: FAIL — first new test gets 404 (`/refresh` doesn't exist until Task 2 lands; if Task 2 is already merged, skip straight to Step 3's verification)

- [ ] **Step 3: Run test to verify it passes**

Run: `cd backend && npm run test:e2e -- auth.e2e-spec.ts`
Expected: PASS (all tests). Run it a second time back-to-back (this repo's own convention per `PROJECT-STATUS.md`'s "run e2e twice" note) to confirm no fixture leakage.

- [ ] **Step 4: Commit**

```bash
git add backend/test/auth.e2e-spec.ts
git commit -m "test(auth): add e2e coverage for refresh + rotation-on-reuse"
```

---

## Task 4: Staff-console — `api.refresh()` + `authStore.refreshSession()`

**Files:**
- Modify: `staff-console/src/lib/api.ts` (add `refresh`; export `API_BASE_URL` for Task 5 to reuse)
- Modify: `staff-console/src/stores/auth.ts` (add `refreshSession` action, single-flight)
- Modify: `staff-console/src/stores/auth.spec.ts` (add tests)

**Interfaces:**
- Produces: `api.refresh(refreshToken: string): Promise<LoginResponse>` (same shape as `api.login`).
- Produces: `useAuthStore().refreshSession(): Promise<string | null>` — returns the new access token on success (having already persisted the rotated session), or `null` after calling `logout()` on failure. Concurrent calls share one in-flight request.
- Produces (renamed export): `API_BASE_URL` (was module-private `const`, now `export const`) — Task 5's interceptor imports this instead of duplicating the env lookup.

- [ ] **Step 1: Export `API_BASE_URL`**

In `staff-console/src/lib/api.ts`, change line 1 from:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
```

to:

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
```

- [ ] **Step 2: Add `api.refresh()`**

In `staff-console/src/lib/api.ts`, inside the exported `api` object, add this method immediately after `login`:

```typescript
  async refresh(refreshToken: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    return asJson<LoginResponse>(res);
  },
```

- [ ] **Step 3: Write the failing store tests**

Append to `staff-console/src/stores/auth.spec.ts`. First update the `vi.mock('../lib/api', ...)` at the top of the file to also mock `refresh`:

```typescript
vi.mock('../lib/api', () => ({
  api: { login: vi.fn(), refresh: vi.fn() },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));
```

Then add, inside the existing `describe('auth store', ...)` block:

```typescript
  it('refreshSession() exchanges the stored refresh token for a new session and persists it', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'token-old',
      refreshToken: 'refresh-old',
      role: 'TEACHER',
    });
    vi.mocked(api.refresh).mockResolvedValue({
      accessToken: 'token-new',
      refreshToken: 'refresh-new',
      role: 'TEACHER',
    });

    const store = useAuthStore();
    await store.login('teacher@schoolos.edu.pk', 'ChangeMe123!');

    const newAccessToken = await store.refreshSession();

    expect(newAccessToken).toBe('token-new');
    expect(store.accessToken).toBe('token-new');
    expect(store.refreshToken).toBe('refresh-new');
    expect(JSON.parse(localStorage.getItem('schoolos.auth')!).accessToken).toBe('token-new');
  });

  it('refreshSession() logs out and returns null when the refresh call itself fails', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'token-old',
      refreshToken: 'refresh-old',
      role: 'TEACHER',
    });
    vi.mocked(api.refresh).mockRejectedValue(new ApiError('Invalid credentials', 401));

    const store = useAuthStore();
    await store.login('teacher@schoolos.edu.pk', 'ChangeMe123!');

    const result = await store.refreshSession();

    expect(result).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem('schoolos.auth')).toBeNull();
  });

  it('refreshSession() returns null immediately when there is no refresh token to use', async () => {
    const store = useAuthStore();
    const result = await store.refreshSession();
    expect(result).toBeNull();
    expect(vi.mocked(api.refresh)).not.toHaveBeenCalled();
  });

  it('refreshSession() de-duplicates concurrent calls into a single API request', async () => {
    vi.mocked(api.login).mockResolvedValue({
      accessToken: 'token-old',
      refreshToken: 'refresh-old',
      role: 'TEACHER',
    });
    let resolveRefresh!: (value: { accessToken: string; refreshToken: string; role: string }) => void;
    vi.mocked(api.refresh).mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      }),
    );

    const store = useAuthStore();
    await store.login('teacher@schoolos.edu.pk', 'ChangeMe123!');

    const call1 = store.refreshSession();
    const call2 = store.refreshSession();
    resolveRefresh({ accessToken: 'token-new', refreshToken: 'refresh-new', role: 'TEACHER' });

    const [result1, result2] = await Promise.all([call1, call2]);

    expect(result1).toBe('token-new');
    expect(result2).toBe('token-new');
    expect(vi.mocked(api.refresh)).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/stores/auth.spec.ts`
Expected: FAIL — `store.refreshSession is not a function`

- [ ] **Step 5: Implement `refreshSession()`**

Replace the full contents of `staff-console/src/stores/auth.ts` with:

```typescript
import { defineStore } from 'pinia';
import { api } from '../lib/api';

const STORAGE_KEY = 'schoolos.auth';

// Teacher and Admin/Accounts share this one console, gated by role — not two deployable apps.
export type StaffRole = 'TEACHER' | 'SCHOOL_ADMIN' | 'ACCOUNTS' | 'SUPER_ADMIN';

interface PersistedSession {
  accessToken: string;
  refreshToken: string;
  role: string;
}

function loadPersistedSession(): PersistedSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

// Single-flight guard for concurrent 401s: several in-flight requests can all expire around the
// same moment, and the backend rotates the refresh token on every redemption — a second
// concurrent refresh call would present an already-revoked token and fail. Kept as module-scope
// state (not Pinia state) since it holds a Promise, not serializable session data.
let inFlightRefresh: Promise<string | null> | null = null;

export const useAuthStore = defineStore('auth', {
  state: () => {
    const persisted = loadPersistedSession();
    return {
      accessToken: persisted?.accessToken ?? null,
      refreshToken: persisted?.refreshToken ?? null,
      role: persisted?.role ?? null,
    } as { accessToken: string | null; refreshToken: string | null; role: string | null };
  },

  getters: {
    isAuthenticated: (state) => state.accessToken !== null,
  },

  actions: {
    async login(identifier: string, password: string) {
      // Errors intentionally propagate to the caller (LoginView) unmodified — the API already
      // returns the correct generic message, this store must not add or remove information.
      const session = await api.login(identifier, password);
      this.accessToken = session.accessToken;
      this.refreshToken = session.refreshToken;
      this.role = session.role;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    },

    // Called by the fetch interceptor (Task 5) on a 401. Returns the new access token on
    // success, or null after logging out on failure.
    refreshSession(): Promise<string | null> {
      if (!this.refreshToken) return Promise.resolve(null);
      if (!inFlightRefresh) {
        inFlightRefresh = this._doRefresh().finally(() => {
          inFlightRefresh = null;
        });
      }
      return inFlightRefresh;
    },

    async _doRefresh(): Promise<string | null> {
      try {
        const session = await api.refresh(this.refreshToken as string);
        this.accessToken = session.accessToken;
        this.refreshToken = session.refreshToken;
        this.role = session.role;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
        return session.accessToken;
      } catch {
        this.logout();
        return null;
      }
    },

    logout() {
      this.accessToken = null;
      this.refreshToken = null;
      this.role = null;
      localStorage.removeItem(STORAGE_KEY);
    },
  },
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/stores/auth.spec.ts`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 7: Commit**

```bash
git add staff-console/src/lib/api.ts staff-console/src/stores/auth.ts staff-console/src/stores/auth.spec.ts
git commit -m "feat(staff-console): add api.refresh() and authStore.refreshSession()"
```

---

## Task 5: Staff-console — global fetch interceptor (retry-once-on-401)

**Files:**
- Create: `staff-console/src/lib/fetchInterceptor.ts`
- Create: `staff-console/src/lib/fetchInterceptor.spec.ts`
- Modify: `staff-console/src/main.ts` (install it once, after Pinia is active)

**Interfaces:**
- Consumes: `useAuthStore().refreshSession()` (Task 4), `API_BASE_URL` (Task 4's export from `api.ts`).
- Produces: `installFetchInterceptor(nativeFetch?: typeof fetch): void` — replaces `window.fetch` with a wrapper. Only intercepts requests whose URL starts with `API_BASE_URL` **and** that already carry an `Authorization` header (so `/auth/login` and `/auth/refresh` themselves are never retried — a 401 from either means the credentials/refresh-token really are bad).

- [ ] **Step 1: Write the failing tests**

Create `staff-console/src/lib/fetchInterceptor.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { installFetchInterceptor } from './fetchInterceptor';
import { useAuthStore } from '../stores/auth';

describe('installFetchInterceptor', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    originalFetch = window.fetch;
  });

  afterEach(() => {
    window.fetch = originalFetch;
  });

  it('passes through a successful authenticated request unchanged', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('http://localhost:3000/api/v1/me', {
      headers: { Authorization: 'Bearer old-token' },
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not intercept a request with no Authorization header (e.g. login itself)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('http://localhost:3000/api/v1/auth/login', { method: 'POST' });

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('on a 401, refreshes once and retries with the new token', async () => {
    const authStore = useAuthStore();
    authStore.refreshToken = 'refresh-1';
    vi.spyOn(authStore, 'refreshSession').mockResolvedValue('new-access-token');

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('http://localhost:3000/api/v1/me', {
      headers: { Authorization: 'Bearer expired-token' },
    });

    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const retryHeaders = new Headers(mockFetch.mock.calls[1][1]?.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access-token');
  });

  it('does not retry when refresh fails, and the original 401 is returned', async () => {
    const authStore = useAuthStore();
    vi.spyOn(authStore, 'refreshSession').mockResolvedValue(null);

    const mockFetch = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('http://localhost:3000/api/v1/me', {
      headers: { Authorization: 'Bearer expired-token' },
    });

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not intercept requests to a different origin', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('not found', { status: 401 }));
    installFetchInterceptor(mockFetch);

    const res = await window.fetch('https://example.com/some-other-api', {
      headers: { Authorization: 'Bearer token' },
    });

    expect(res.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/lib/fetchInterceptor.spec.ts`
Expected: FAIL — `Cannot find module './fetchInterceptor'`

- [ ] **Step 3: Implement the interceptor**

Create `staff-console/src/lib/fetchInterceptor.ts`:

```typescript
import { API_BASE_URL } from './api';
import { useAuthStore } from '../stores/auth';

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

// Wraps the global fetch so any 401 from OUR API triggers one silent refresh-and-retry before the
// caller ever sees it — installed once at app bootstrap (main.ts), so none of api.ts's ~60 call
// sites need to change. Only intercepts requests to our own API that already carried a bearer
// token — a 401 from /auth/login or /auth/refresh itself means the credentials/refresh-token
// really are bad, not that the access token expired, and must not retry.
export function installFetchInterceptor(nativeFetch: typeof fetch = window.fetch): void {
  window.fetch = async (input, init) => {
    const url = resolveUrl(input);
    const isOwnApi = url.startsWith(API_BASE_URL);
    const headers = new Headers(init?.headers);
    const hadAuthHeader = headers.has('Authorization');

    const response = await nativeFetch(input, init);

    if (!isOwnApi || !hadAuthHeader || response.status !== 401) {
      return response;
    }

    const authStore = useAuthStore();
    const newAccessToken = await authStore.refreshSession();
    if (!newAccessToken) {
      // refreshSession() has already logged out — let the original 401 propagate so the router
      // guard redirects to /login.
      return response;
    }

    headers.set('Authorization', `Bearer ${newAccessToken}`);
    return nativeFetch(input, { ...init, headers });
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd staff-console && npx vitest run src/lib/fetchInterceptor.spec.ts`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Install it at bootstrap**

Modify `staff-console/src/main.ts` to:

```typescript
import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { applyTheme, loadThemePreference } from './lib/theme'
import { installFetchInterceptor } from './lib/fetchInterceptor'

applyTheme(loadThemePreference())

const app = createApp(App)

app.use(createPinia())
installFetchInterceptor()
app.use(router)

app.mount('#app')
```

(`installFetchInterceptor()` must run after `app.use(createPinia())` — it calls `useAuthStore()` lazily inside the wrapper on the first 401, but Pinia must already be active by then.)

- [ ] **Step 6: Run the full staff-console suite**

Run: `cd staff-console && npm run lint && npm test && npm run build`
Expected: all three clean/passing

- [ ] **Step 7: Commit**

```bash
git add staff-console/src/lib/fetchInterceptor.ts staff-console/src/lib/fetchInterceptor.spec.ts staff-console/src/main.ts
git commit -m "feat(staff-console): retry-once-on-401 fetch interceptor"
```

---

## Task 6: Parent-app — `ApiClient.refresh()` + `AuthState.refreshSession()`

**Files:**
- Modify: `parent-app/lib/src/api/api_client.dart` (add `refresh`)
- Modify: `parent-app/lib/src/auth/auth_state.dart` (track `_refreshToken`, add `refreshSession`)
- Modify: `parent-app/test/auth/auth_state_test.dart` (add tests)

**Interfaces:**
- Produces: `ApiClient.refresh(String refreshToken): Future<LoginResponse>` (same shape/errors as `login`).
- Produces: `AuthState.refreshSession(): Future<String?>` — returns the new access token on success (persisting the rotated session), or `null` after calling `logout()` on failure. Concurrent calls share one in-flight `Future`.

- [ ] **Step 1: Write the failing tests**

Append to `parent-app/test/auth/auth_state_test.dart`, inside `main()`, after the existing tests. First add a helper alongside the existing `okClient()`/`unauthorizedClient()` functions:

```dart
  ApiClient refreshingClient() {
    return ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.url.path == '/api/v1/auth/login') {
          return http.Response(
            jsonEncode({'accessToken': 'access-1', 'refreshToken': 'refresh-1', 'role': 'PARENT'}),
            200,
          );
        }
        if (request.url.path == '/api/v1/auth/refresh') {
          final body = jsonDecode(request.body) as Map<String, dynamic>;
          if (body['refreshToken'] == 'refresh-1') {
            return http.Response(
              jsonEncode({'accessToken': 'access-2', 'refreshToken': 'refresh-2', 'role': 'PARENT'}),
              200,
            );
          }
          return http.Response(jsonEncode({'message': 'Invalid credentials'}), 401);
        }
        return http.Response('not found', 404);
      }),
    );
  }
```

Then add these test cases:

```dart
  test('refreshSession() exchanges the stored refresh token for a new session and persists it', () async {
    final auth = AuthState(api: refreshingClient(), tokenStore: store);
    await auth.login('parent-a@schoolos.edu.pk', 'ChangeMe123!');

    final newAccessToken = await auth.refreshSession();

    expect(newAccessToken, 'access-2');
    expect(auth.accessToken, 'access-2');
    expect(await store.read('accessToken'), 'access-2');
    expect(await store.read('refreshToken'), 'refresh-2');
  });

  test('refreshSession() logs out and returns null when the refresh call itself fails', () async {
    final auth = AuthState(api: refreshingClient(), tokenStore: store);
    await auth.login('parent-a@schoolos.edu.pk', 'ChangeMe123!');
    // Corrupt the stored refresh token so the mock server rejects it.
    await store.write('refreshToken', 'a-token-the-mock-server-does-not-recognize');
    final authWithBadToken = AuthState(api: refreshingClient(), tokenStore: store);
    await authWithBadToken.restoreSession();

    final result = await authWithBadToken.refreshSession();

    expect(result, isNull);
    expect(authWithBadToken.isAuthenticated, isFalse);
    expect(await store.read('accessToken'), isNull);
  });

  test('refreshSession() returns null immediately when there is no refresh token to use', () async {
    final auth = AuthState(api: okClient(), tokenStore: store);
    final result = await auth.refreshSession();
    expect(result, isNull);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/auth/auth_state_test.dart`
Expected: FAIL — `The method 'refreshSession' isn't defined for the type 'AuthState'`

- [ ] **Step 3: Add `ApiClient.refresh()`**

In `parent-app/lib/src/api/api_client.dart`, add this method immediately after `login`:

```dart
  Future<LoginResponse> refresh(String refreshToken) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/auth/refresh'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': refreshToken}),
    );

    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }

    return LoginResponse.fromJson(jsonDecode(res.body) as Map<String, dynamic>);
  }
```

- [ ] **Step 4: Implement `AuthState` changes**

Replace the full contents of `parent-app/lib/src/auth/auth_state.dart` with:

```dart
import 'package:flutter/foundation.dart';
import '../api/api_client.dart';
import 'token_store.dart';

/// Parent app's session state — deliberately mirrors staff-console's Pinia auth store so the two
/// clients behave the same way against the same backend contract.
class AuthState extends ChangeNotifier {
  AuthState({required ApiClient api, required TokenStore tokenStore})
    : _api = api,
      _tokenStore = tokenStore;

  final ApiClient _api;
  final TokenStore _tokenStore;

  String? _accessToken;
  String? _refreshToken;
  String? _role;

  // Single-flight guard for concurrent 401s: several in-flight requests can all expire around the
  // same moment, and the backend rotates the refresh token on every redemption — a second
  // concurrent refresh call would present an already-revoked token and fail.
  Future<String?>? _inFlightRefresh;

  bool get isAuthenticated => _accessToken != null;
  String? get role => _role;
  String? get accessToken => _accessToken;

  /// Called once at app start — restores a session from secure storage so the parent isn't
  /// forced to log in again every time the app opens (FEAT-005 acceptance criteria).
  Future<void> restoreSession() async {
    final accessToken = await _tokenStore.read('accessToken');
    final refreshToken = await _tokenStore.read('refreshToken');
    final role = await _tokenStore.read('role');
    if (accessToken != null && refreshToken != null && role != null) {
      _accessToken = accessToken;
      _refreshToken = refreshToken;
      _role = role;
      notifyListeners();
    }
  }

  Future<void> login(String identifier, String password) async {
    // Errors propagate to the caller (LoginScreen) unmodified — this state layer must not add or
    // remove information from the generic auth error.
    final session = await _api.login(identifier, password);

    _accessToken = session.accessToken;
    _refreshToken = session.refreshToken;
    _role = session.role;

    await _tokenStore.write('accessToken', session.accessToken);
    await _tokenStore.write('refreshToken', session.refreshToken);
    await _tokenStore.write('role', session.role);

    notifyListeners();
  }

  /// Called by [RefreshingHttpClient] on a 401. Returns the new access token on success (having
  /// already persisted the rotated session), or null after logging out on failure.
  Future<String?> refreshSession() {
    return _inFlightRefresh ??= _doRefresh().whenComplete(() {
      _inFlightRefresh = null;
    });
  }

  Future<String?> _doRefresh() async {
    final refreshToken = _refreshToken;
    if (refreshToken == null) return null;

    try {
      final session = await _api.refresh(refreshToken);

      _accessToken = session.accessToken;
      _refreshToken = session.refreshToken;
      _role = session.role;

      await _tokenStore.write('accessToken', session.accessToken);
      await _tokenStore.write('refreshToken', session.refreshToken);
      await _tokenStore.write('role', session.role);

      notifyListeners();
      return session.accessToken;
    } catch (_) {
      await logout();
      return null;
    }
  }

  Future<void> logout() async {
    _accessToken = null;
    _refreshToken = null;
    _role = null;

    await _tokenStore.delete('accessToken');
    await _tokenStore.delete('refreshToken');
    await _tokenStore.delete('role');

    notifyListeners();
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd parent-app && flutter test test/auth/auth_state_test.dart`
Expected: PASS (all tests, including the 3 new ones and every pre-existing one)

- [ ] **Step 6: Commit**

```bash
git add parent-app/lib/src/api/api_client.dart parent-app/lib/src/auth/auth_state.dart parent-app/test/auth/auth_state_test.dart
git commit -m "feat(parent-app): add ApiClient.refresh() and AuthState.refreshSession()"
```

---

## Task 7: Parent-app — `RefreshingHttpClient` (retry-once-on-401)

**Files:**
- Create: `parent-app/lib/src/api/refreshing_http_client.dart`
- Create: `parent-app/test/api/refreshing_http_client_test.dart`
- Modify: `parent-app/lib/main.dart` (wire it into `ApiClient`'s construction)

**Interfaces:**
- Consumes: `AuthState.refreshSession()` (Task 6), via a caller-supplied `Future<String?> Function()` callback — no direct dependency on `AuthState` itself, keeping the class independently testable.
- Produces: `RefreshingHttpClient({required http.Client inner, required Future<String?> Function() onUnauthorized})` — an `http.BaseClient` that retries any already-authenticated request exactly once on a 401.

- [ ] **Step 1: Write the failing tests**

Create `parent-app/test/api/refreshing_http_client_test.dart`:

```dart
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/refreshing_http_client.dart';

void main() {
  test('passes through a successful request unchanged', () async {
    final inner = MockClient((request) async => http.Response('ok', 200));
    final client = RefreshingHttpClient(
      inner: inner,
      onUnauthorized: () async => 'should-not-be-called',
    );

    final res = await client.get(
      Uri.parse('http://test/api/v1/me'),
      headers: {'Authorization': 'Bearer old'},
    );

    expect(res.statusCode, 200);
  });

  test('does not intercept a request with no Authorization header', () async {
    var calls = 0;
    final inner = MockClient((request) async {
      calls++;
      return http.Response('unauthorized', 401);
    });
    final client = RefreshingHttpClient(inner: inner, onUnauthorized: () async => 'new-token');

    final res = await client.get(Uri.parse('http://test/api/v1/auth/login'));

    expect(res.statusCode, 401);
    expect(calls, 1);
  });

  test('on a 401, calls onUnauthorized and retries once with the new token', () async {
    var calls = 0;
    String? lastAuthHeader;
    final inner = MockClient((request) async {
      calls++;
      lastAuthHeader = request.headers['Authorization'];
      if (calls == 1) return http.Response('unauthorized', 401);
      return http.Response('ok', 200);
    });
    final client = RefreshingHttpClient(inner: inner, onUnauthorized: () async => 'new-access-token');

    final res = await client.get(
      Uri.parse('http://test/api/v1/me'),
      headers: {'Authorization': 'Bearer expired'},
    );

    expect(res.statusCode, 200);
    expect(calls, 2);
    expect(lastAuthHeader, 'Bearer new-access-token');
  });

  test('returns the original 401 when onUnauthorized fails to refresh', () async {
    var calls = 0;
    final inner = MockClient((request) async {
      calls++;
      return http.Response('unauthorized', 401);
    });
    final client = RefreshingHttpClient(inner: inner, onUnauthorized: () async => null);

    final res = await client.get(
      Uri.parse('http://test/api/v1/me'),
      headers: {'Authorization': 'Bearer expired'},
    );

    expect(res.statusCode, 401);
    expect(calls, 1);
  });

  test('retries a POST with its body intact', () async {
    var calls = 0;
    final bodiesSeen = <String>[];
    final inner = MockClient((request) async {
      calls++;
      bodiesSeen.add(request.body);
      if (calls == 1) return http.Response('unauthorized', 401);
      return http.Response('ok', 200);
    });
    final client = RefreshingHttpClient(inner: inner, onUnauthorized: () async => 'new-token');

    final res = await client.post(
      Uri.parse('http://test/api/v1/attendance'),
      headers: {'Authorization': 'Bearer expired', 'Content-Type': 'application/json'},
      body: jsonEncode({'studentId': 's1'}),
    );

    expect(res.statusCode, 200);
    expect(calls, 2);
    expect(bodiesSeen[1], jsonEncode({'studentId': 's1'}));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/api/refreshing_http_client_test.dart`
Expected: FAIL — `Target of URI doesn't exist: 'package:parent_app/src/api/refreshing_http_client.dart'`

- [ ] **Step 3: Implement `RefreshingHttpClient`**

Create `parent-app/lib/src/api/refreshing_http_client.dart`:

```dart
import 'package:http/http.dart' as http;

/// Wraps an [http.Client] so any 401 from our own backend triggers one silent refresh-and-retry
/// before the caller ever sees it — mirrors staff-console's fetch interceptor. Wrapping at the
/// http.Client layer (via [http.BaseClient.send], which every convenience method like `get`/`post`
/// funnels through) means none of ApiClient's ~25 existing methods need to change.
class RefreshingHttpClient extends http.BaseClient {
  RefreshingHttpClient({required http.Client inner, required this.onUnauthorized}) : _inner = inner;

  final http.Client _inner;

  /// Called on a 401 from an already-authenticated request. Returns the new access token on
  /// success (expected to have already persisted/rotated the refresh token), or null if refresh
  /// itself failed (the caller is expected to have already logged out in that case).
  final Future<String?> Function() onUnauthorized;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final hadAuthHeader = request.headers.containsKey('Authorization');
    final response = await _inner.send(request);

    if (!hadAuthHeader || response.statusCode != 401) {
      return response;
    }

    final newAccessToken = await onUnauthorized();
    if (newAccessToken == null) {
      return response;
    }

    final retryRequest = await _cloneWithNewToken(request, newAccessToken);
    return _inner.send(retryRequest);
  }

  Future<http.BaseRequest> _cloneWithNewToken(http.BaseRequest original, String newAccessToken) async {
    if (original is! http.Request) {
      throw StateError(
        'RefreshingHttpClient only supports http.Request (produced by BaseClient.get/post/etc.), got ${original.runtimeType}',
      );
    }
    final clone = http.Request(original.method, original.url)
      ..headers.addAll(original.headers)
      ..bodyBytes = original.bodyBytes;
    clone.headers['Authorization'] = 'Bearer $newAccessToken';
    return clone;
  }

  @override
  void close() {
    _inner.close();
    super.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/api/refreshing_http_client_test.dart`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Wire it into `main.dart`**

Modify `parent-app/lib/main.dart` to:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'src/api/api_client.dart';
import 'src/api/refreshing_http_client.dart';
import 'src/auth/auth_state.dart';
import 'src/auth/token_store.dart';
import 'src/router/app_router.dart';
import 'src/theme/app_theme.dart';

// Override at build/run time with --dart-define=API_BASE_URL=http://10.0.2.2:3000 for the Android
// emulator (which can't reach the host's localhost directly), or the LAN IP for a physical device.
const _apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://localhost:3000');

void main() {
  runApp(const ParentApp());
}

class ParentApp extends StatefulWidget {
  const ParentApp({super.key});

  @override
  State<ParentApp> createState() => _ParentAppState();
}

class _ParentAppState extends State<ParentApp> {
  // _api's RefreshingHttpClient closes over `_auth` via a closure that isn't invoked until an
  // actual 401 happens — by then `_auth`'s own (lazy, late-final) initializer below has always
  // already run, since evaluating `_auth`'s initializer is what first triggers `_api`'s.
  late final ApiClient _api = ApiClient(
    baseUrl: _apiBaseUrl,
    client: RefreshingHttpClient(inner: http.Client(), onUnauthorized: () => _auth.refreshSession()),
  );
  late final AuthState _auth = AuthState(api: _api, tokenStore: SecureTokenStore());
  late final GoRouter _router = buildAppRouter(_auth);

  @override
  void initState() {
    super.initState();
    // Fire-and-forget: AuthState.notifyListeners() (via restoreSession) drives the router's
    // refreshListenable, so a restored session reroutes away from /login automatically.
    _auth.restoreSession();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: _api),
        ChangeNotifierProvider<AuthState>.value(value: _auth),
      ],
      child: MaterialApp.router(
        title: 'School OS',
        theme: buildAppTheme(),
        routerConfig: _router,
      ),
    );
  }
}
```

- [ ] **Step 6: Run the full parent-app suite**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: both clean/passing (same 2 pre-existing info lints in `auth_state.dart` are fine if still present; no new errors)

- [ ] **Step 7: Commit**

```bash
git add parent-app/lib/src/api/refreshing_http_client.dart parent-app/test/api/refreshing_http_client_test.dart parent-app/lib/main.dart
git commit -m "feat(parent-app): retry-once-on-401 via RefreshingHttpClient"
```

---

## Task 8: CI pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `backend/package.json` scripts (`lint`, `build`, `test`, `test:e2e`), `staff-console/package.json` scripts (`lint`, `test`, `build`), `parent-app`'s `flutter analyze`/`flutter test` — every command must be one that already works locally (verified in Tasks 1–7's own steps), never a new hand-rolled equivalent.

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
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
      - run: npm run lint
      - run: npm run build
      - run: npm test
      - run: npm run test:e2e

  staff-console:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: staff-console
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
          cache-dependency-path: staff-console/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build

  parent-app:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: parent-app
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.47.1'
          channel: 'stable'
      - run: flutter pub get
      - run: flutter analyze
      - run: flutter test
```

- [ ] **Step 2: Verify each job's commands locally first**

These are the exact same commands already run and verified passing in Tasks 1, 4, 5, 6, and 7's own steps — do not re-run the full suites again here if they already just passed; this step only matters if this task is executed out of order.

- [ ] **Step 3: Push the branch and confirm the workflow actually runs**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run backend/staff-console/parent-app test suites on every PR"
git push -u origin HEAD
```

Then check the Actions tab on GitHub (or `gh run list --limit 1` / `gh run watch` if the `gh` CLI is authenticated) and confirm all three jobs go green. If a job fails **only in CI** (e.g. a Flutter version mismatch, a missing `prisma migrate deploy` step because no `backend/prisma/migrations` directory exists yet), fix the workflow file itself — do not weaken any project's `lint`/`test`/`build` script to make CI pass.

- [ ] **Step 4: Note the manual follow-up**

Branch protection (require the 3 CI jobs to pass before merge) is a GitHub repo **setting**, not a code change — leave a note in this plan's final PR description / in `PROJECT-STATUS.md` (Task 9) that a repo admin should turn it on at Settings → Branches once this workflow has run green at least once (a brand-new required check can't be selected in that UI until it has run).

---

## Task 9: Update `PROJECT-STATUS.md`

**Files:**
- Modify: `PROJECT-STATUS.md` (repo root)

**Interfaces:**
- None — documentation only, following this file's own established per-sprint section format (see the "Sprint 11-12" and "Security Hardening Pass" sections for the template).

- [ ] **Step 1: Run every project's full verification suite one more time, from a clean state**

```bash
cd backend && npm run lint && npm run build && npm test && npm run test:e2e && npm run test:e2e
cd ../staff-console && npm run lint && npm test && npm run build
cd ../parent-app && flutter analyze && flutter test
```

(Backend e2e runs twice back-to-back per this repo's own convention, to catch fixture leakage.) Record the real pass counts from this run — do not estimate them.

- [ ] **Step 2: Insert a new section**

Insert a new `## Sprint A — Stabilization I: Session, CI, Data ✅ DONE` section into `PROJECT-STATUS.md`, placed directly above the existing `## Sprint 11-12 — Hardening + Pilot ⏳ PENDING` section, following the file's established format exactly (see e.g. the "Security Hardening Pass" section immediately above it for the shape: a short intro sentence, `- [x]` bullets naming what was built and why, a "Notable fixes" sub-list only if any surfaced during implementation, a "Verified:" line with the **real** test counts from Step 1, and a "Follow-up" line for anything deliberately deferred — e.g. GitHub branch protection from Task 8 Step 4). Use the real numbers from Step 1's run, not placeholders.

- [ ] **Step 3: Update the "Next step" paragraph**

At the bottom of the file, update the existing "**Next step:**" paragraph to remove Sprint A's refresh-loop/CI items from whatever it currently lists as open (if it lists them — check first, since the current version may not mention them at all) and note Sprint B (Postgres migration, upload/CORS/rate-limit hardening — the roadmap's next sprint) as the logical next piece of Tier-0 stabilization.

- [ ] **Step 4: Commit**

```bash
git add PROJECT-STATUS.md
git commit -m "docs: record Sprint A stabilization in PROJECT-STATUS"
```

---

## Self-Review Notes

- **Spec coverage:** Sprint A's roadmap bullets map 1:1 — "working refresh-token loop with rotation-on-use" → Tasks 2–3; "boot-time fail-fast if JWT secrets are unset outside dev" → Task 1; "CI pipeline... blocks merge on failure" → Task 8 (the "blocks merge" half is the branch-protection setting noted as a manual follow-up, since it isn't a code change); client-side "interceptor: on 401, attempt one silent refresh-and-retry before forcing logout" → Tasks 4–5 (staff-console) and 6–7 (parent-app); "e2e test for refresh-then-retry" and "e2e test for rotation-on-reuse" → Task 3.
- **Type consistency:** `SessionResult` (backend), `LoginResponse` (both clients) all carry the same three fields (`accessToken`, `refreshToken`, `role`) end to end — `AuthService.refresh()` returns `SessionResult` via the same `issueSession()` used by `login()`, so no new shape was introduced anywhere.
- **No placeholders:** every step above shows the actual code to write, not a description of it; every test asserts a concrete behavior verified against the real current files read before this plan was written (see "Verified current state" section).
