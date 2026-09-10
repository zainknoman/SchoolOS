# Sprint F — Push Notifications, Both Clients (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A published circular, sent message, or published diary entry reaches a parent as a real
device push notification, not just an in-app badge that only updates on next open — on both
clients, with a foreground-resume polling stopgap that works even before a real Firebase project
exists.

**Architecture:** The backend already has the abstraction this sprint needs, built ahead of
schedule during Sprint 7-8: `NotificationsService.notify()` (`backend/src/notifications/notifications.service.ts`)
already writes the in-app `Notification` row AND calls a swappable `PushAdapter.send()` on every
diary/circular/message write path — today wired to a `LoggingPushAdapter` no-op. This sprint does
**not** rebuild that dispatch layer (the roadmap's proposed `NotificationDispatchService` is
`NotificationsService`, already built and already the call site diary/circulars/messages use). The
real work is: (1) a `FcmPushAdapter` behind the existing `PUSH_ADAPTER` token, selected by an
env-config resolver that mirrors `backend/src/fees/gateways/gateway-config.ts`'s
config-present-or-absent pattern; (2) a `POST /me/device-tokens` registration endpoint against the
already-existing `DeviceToken` Prisma model; (3) the Flutter side — `firebase_messaging`
integration, a foreground-resume polling stopgap, and tap-to-deep-link reusing `HomeShell`'s
existing in-app-notification navigation logic.

**Tech Stack:** NestJS/Prisma/Postgres (backend), `firebase-admin` (backend FCM sending), Vue/staff-console
(not touched this sprint — Sprint F is scoped to diary/circular/message events, which the parent app
consumes; the staff console has no push surface named in the roadmap for this sprint), Flutter/Dart
(parent-app), `firebase_core`/`firebase_messaging` (Flutter FCM).

**Spec:** `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`, Sprint F section (§4, "Sprint
F — Push Notifications, Both Clients (Phase 3)") and its row in §5's Technical Implementation Detail
table.

## Global Constraints

- No real Firebase project exists yet — same shape as Sprint E's EasyPaisa gap: build the adapter
  to the real FCM Admin SDK contract, verified with unit tests and a mocked sender, but the
  live-device push path (Definition of Done: "triggers a real push notification on a
  physical/emulated Android device") cannot be verified in this dev environment (no Android
  emulator, no Windows Flutter desktop toolchain — confirmed in Sprint C prep). Flag this exactly
  as Sprint E flagged its unverified sandbox, not as a blocker to shipping the rest.
- FCM server credentials must never be committed — `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`
  go in `.env.example` as empty placeholders only, real values in a real deployment's env, never in
  `.env` (which is gitignored but still shouldn't hold secrets for a project with no real Firebase
  account).
- Do not introduce `dart:io` anywhere in `parent-app/lib` — the codebase currently has zero
  `dart:io` imports specifically because `flutter run -d chrome` (web target) is the only locally
  previewable target in this dev environment; `dart:io`'s `Platform` class fails to compile for
  web. Use `defaultTargetPlatform`/`kIsWeb` from `package:flutter/foundation.dart` instead.
- Mirror existing adapter patterns exactly: `PaymentGatewayAdapterFactoryImpl` +
  `gateway-config.ts`'s `resolve*Config(config) → T | undefined`, absent-config-falls-back,
  partial-config-outside-dev/test-throws convention. Do not invent a new config-resolution shape.
- CI (`.github/workflows/ci.yml`) runs `flutter analyze`/`flutter test` for parent-app only — never
  `flutter build apk`. Do not add the `com.google.gms.google-services` Gradle plugin or a real
  `google-services.json`/`GoogleService-Info.plist` — Flutter's `firebase_options.dart` (Dart-level
  config, no native plugin needed) is sufficient for `firebase_core`/`firebase_messaging` and keeps
  local `flutter run -d chrome` and CI both working with only a placeholder config.

---

## File Structure

**Backend (`backend/`):**
- `src/notifications/fcm-config.ts` (new) — `resolveFirebaseConfig(ConfigService) → FirebaseAdminConfig | undefined`, mirrors `gateway-config.ts`.
- `src/notifications/fcm-sender.ts` (new) — `FcmSender` interface + `AdminFcmSender` (wraps `firebase-admin`'s `Messaging.sendEachForMulticast`), kept separate from the adapter so the adapter is unit-testable without mocking the `firebase-admin` module.
- `src/notifications/fcm-push.adapter.ts` (new) — `FcmPushAdapter implements PushAdapter`: looks up the user's `DeviceToken` rows, sends via `FcmSender`, deletes rows FCM reports as unregistered.
- `src/notifications/notifications.module.ts` (modify) — swap the flat `useClass: LoggingPushAdapter` provider for a `useFactory` that picks `FcmPushAdapter` when Firebase config is present, `LoggingPushAdapter` otherwise.
- `src/me/dto/register-device-token.dto.ts` (new) — validated request body for the registration endpoint.
- `src/me/me.service.ts` (modify) — add `registerDeviceToken(userId, token, platform)`.
- `src/me/me.controller.ts` (modify) — add `POST device-tokens`.
- `.env.example` (modify) — document `FIREBASE_PROJECT_ID`/`FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY`.
- `package.json` (modify) — add `firebase-admin` dependency.

**Parent app (`parent-app/`):**
- `lib/src/notifications/push_token_provider.dart` (new) — `PushTokenProvider` interface, `FirebaseMessagingTokenProvider` (real, guarded), `NoopPushTokenProvider` (web/test/unsupported-platform fallback).
- `lib/src/notifications/notification_target.dart` (new) — `NotificationTarget` + pure `notificationTargetFromMessage(RemoteMessage)` mapper (unit-testable without any Firebase init).
- `lib/src/notifications/device_token_registrar.dart` (new) — `DeviceTokenRegistrar`: gets a token from its `PushTokenProvider`, registers it via `ApiClient`, best-effort/never-throws.
- `lib/firebase_options.dart` (new) — placeholder `DefaultFirebaseOptions`, clearly marked as a stub pending a real `flutterfire configure` run.
- `lib/src/api/api_client.dart` (modify) — add `registerDeviceToken()`.
- `lib/main.dart` (modify) — construct and provide a real `DeviceTokenRegistrar`.
- `lib/src/screens/home_shell.dart` (modify) — `WidgetsBindingObserver` foreground-resume stopgap; call the registrar after login; subscribe to tapped-notification targets and reuse the existing in-app-notification navigation logic for them.
- `test/test_harness.dart` (modify) — accept an optional `DeviceTokenRegistrar` override (default: `NoopPushTokenProvider`-backed), so existing tests are unaffected.
- New/modified test files matching each of the above (see tasks).

---

### Task 1: Backend — `POST /me/device-tokens` registration endpoint

**Files:**
- Create: `backend/src/me/dto/register-device-token.dto.ts`
- Modify: `backend/src/me/me.service.ts`
- Modify: `backend/src/me/me.controller.ts`
- Test: `backend/src/me/me.service.spec.ts`
- Test: `backend/test/me.e2e-spec.ts`

**Interfaces:**
- Produces: `MeService.registerDeviceToken(userId: string, token: string, platform: string): Promise<void>` — later tasks (Task 3's `FcmPushAdapter`) read the `DeviceToken` rows this writes, but do so directly via Prisma, not through this method.
- Produces: `RegisterDeviceTokenDto { token: string; platform: 'android' | 'ios' }`.

- [ ] **Step 1: Write the failing unit test for `MeService.registerDeviceToken`**

Add to `backend/src/me/me.service.spec.ts` (extends the existing `prisma` mock object in that
file's `beforeEach` — add a `deviceToken: { upsert: jest.fn() }` key alongside the existing
`parentProfile` key):

```typescript
describe('registerDeviceToken', () => {
  it('upserts by token, reassigning userId/platform if the token now belongs to a different user', async () => {
    prisma.deviceToken.upsert.mockResolvedValue({});

    await service.registerDeviceToken('user-1', 'fcm-token-abc', 'android');

    expect(prisma.deviceToken.upsert).toHaveBeenCalledWith({
      where: { token: 'fcm-token-abc' },
      create: { userId: 'user-1', token: 'fcm-token-abc', platform: 'android' },
      update: { userId: 'user-1', platform: 'android' },
    });
  });
});
```

Also update the `prisma` typed mock declaration at the top of the file to add the new key:

```typescript
  let prisma: {
    parentProfile: { findUnique: jest.Mock };
    deviceToken: { upsert: jest.Mock };
  };
```

and in `beforeEach`:

```typescript
    prisma = {
      parentProfile: { findUnique: jest.fn() },
      deviceToken: { upsert: jest.fn() },
    };
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/me/me.service.spec.ts -t registerDeviceToken`
Expected: FAIL — `service.registerDeviceToken is not a function`.

- [ ] **Step 3: Implement `MeService.registerDeviceToken`**

Edit `backend/src/me/me.service.ts` — add this method to the `MeService` class (after
`getChildrenForUser`):

```typescript
  /**
   * Upsert by token (not userId+token) — a device token is unique per install, and if the same
   * device logs out and a different user logs back in on it, the token must move to the new
   * user, not create a stale duplicate row still pointing at the old one.
   */
  async registerDeviceToken(userId: string, token: string, platform: string): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/me/me.service.spec.ts -t registerDeviceToken`
Expected: PASS

- [ ] **Step 5: Write the DTO**

Create `backend/src/me/dto/register-device-token.dto.ts`:

```typescript
import { IsIn, IsString, MinLength } from 'class-validator';

export const DEVICE_TOKEN_PLATFORMS = ['android', 'ios'] as const;

export class RegisterDeviceTokenDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsIn(DEVICE_TOKEN_PLATFORMS)
  platform!: (typeof DEVICE_TOKEN_PLATFORMS)[number];
}
```

- [ ] **Step 6: Wire the controller endpoint**

Edit `backend/src/me/me.controller.ts` — add the `Body`/`Post` imports and the new route:

```typescript
import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { MeService } from './me.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller('api/v1/me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  me(@Req() req: AuthenticatedRequest) {
    return { id: req.user.id, role: req.user.role };
  }

  @Get('children')
  children(@Req() req: AuthenticatedRequest) {
    return this.meService.getChildrenForUser(req.user.id);
  }

  @Post('device-tokens')
  registerDeviceToken(@Body() dto: RegisterDeviceTokenDto, @Req() req: AuthenticatedRequest) {
    return this.meService.registerDeviceToken(req.user.id, dto.token, dto.platform);
  }
}
```

- [ ] **Step 7: Write the failing e2e test**

Add to `backend/test/me.e2e-spec.ts`, inside the existing `describe('Me / children (e2e)', ...)`
block, after the existing two `it(...)` cases (uses the same `loginAs`/`prisma`/`ids` fixtures
already set up in that file's `beforeAll`):

```typescript
  it('registers a device token for the authenticated user, upserting on repeat calls', async () => {
    const tokenA = await loginAs('me2e-parent-a@seeds.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/me/device-tokens')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ token: 'me2e-fcm-token-1', platform: 'android' })
      .expect(201);

    const stored = await prisma.deviceToken.findUnique({ where: { token: 'me2e-fcm-token-1' } });
    expect(stored?.platform).toBe('android');

    // Same token registers again (e.g. app restart) — must not create a duplicate row.
    await request(app.getHttpServer())
      .post('/api/v1/me/device-tokens')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ token: 'me2e-fcm-token-1', platform: 'android' })
      .expect(201);

    const count = await prisma.deviceToken.count({ where: { token: 'me2e-fcm-token-1' } });
    expect(count).toBe(1);

    await prisma.deviceToken.deleteMany({ where: { token: 'me2e-fcm-token-1' } });
  });

  it('rejects an invalid platform value', async () => {
    const tokenA = await loginAs('me2e-parent-a@seeds.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/me/device-tokens')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ token: 'me2e-fcm-token-2', platform: 'windows-phone' })
      .expect(400);
  });

  it('rejects the request entirely with no token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/me/device-tokens')
      .send({ token: 'x', platform: 'android' })
      .expect(401);
  });
```

Also add cleanup to the existing `afterAll` in the same file, right before `await app.close();`:

```typescript
    await prisma.deviceToken
      .deleteMany({ where: { token: { in: ['me2e-fcm-token-1', 'me2e-fcm-token-2'] } } })
      .catch(() => undefined);
```

- [ ] **Step 8: Run e2e tests to verify they pass**

Run: `cd backend && npx jest --config test/jest-e2e.json me.e2e-spec.ts`
Expected: PASS (all 5 cases in the file — the 2 pre-existing plus the 3 new ones).

- [ ] **Step 9: Commit**

```bash
git add backend/src/me backend/test/me.e2e-spec.ts
git commit -m "feat(backend): add POST /me/device-tokens registration endpoint"
```

---

### Task 2: Backend — Firebase config resolver

**Files:**
- Create: `backend/src/notifications/fcm-config.ts`
- Test: `backend/src/notifications/fcm-config.spec.ts`

**Interfaces:**
- Produces: `FirebaseAdminConfig { projectId: string; clientEmail: string; privateKey: string }` and `resolveFirebaseConfig(config: ConfigService): FirebaseAdminConfig | undefined` — consumed by Task 4's `NotificationsModule` factory.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/notifications/fcm-config.spec.ts` (mirrors
`backend/src/fees/gateways/gateway-config.spec.ts`'s style — a `fakeConfig` helper over a plain
`ConfigService`-shaped object):

```typescript
import { ConfigService } from '@nestjs/config';
import { resolveFirebaseConfig } from './fcm-config';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('resolveFirebaseConfig', () => {
  it('returns undefined when nothing is set', () => {
    expect(resolveFirebaseConfig(fakeConfig({ NODE_ENV: 'test' }))).toBeUndefined();
  });

  it('returns a full config when all three vars are set, unescaping literal \\n in the private key', () => {
    const result = resolveFirebaseConfig(
      fakeConfig({
        NODE_ENV: 'production',
        FIREBASE_PROJECT_ID: 'schoolportal-prod',
        FIREBASE_CLIENT_EMAIL: 'fcm@schoolportal-prod.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      }),
    );

    expect(result).toEqual({
      projectId: 'schoolportal-prod',
      clientEmail: 'fcm@schoolportal-prod.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    });
  });

  it('returns undefined for a partial config inside development/test', () => {
    expect(
      resolveFirebaseConfig(
        fakeConfig({ NODE_ENV: 'development', FIREBASE_PROJECT_ID: 'schoolportal-prod' }),
      ),
    ).toBeUndefined();
  });

  it('throws for a partial config outside development/test', () => {
    expect(() =>
      resolveFirebaseConfig(
        fakeConfig({ NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'schoolportal-prod' }),
      ),
    ).toThrow(/Incomplete Firebase configuration/);
  });

  it('treats an unset NODE_ENV as development (matches resolveAccessTokenSecret)', () => {
    expect(
      resolveFirebaseConfig(fakeConfig({ FIREBASE_PROJECT_ID: 'schoolportal-prod' })),
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest src/notifications/fcm-config.spec.ts`
Expected: FAIL — `Cannot find module './fcm-config'`.

- [ ] **Step 3: Implement `fcm-config.ts`**

Create `backend/src/notifications/fcm-config.ts`:

```typescript
import { ConfigService } from '@nestjs/config';

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

function isDevOrTest(config: ConfigService): boolean {
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  return nodeEnv === 'development' || nodeEnv === 'test';
}

/**
 * Same all-or-nothing shape as resolveJazzCashConfig/resolveEasyPaisaConfig
 * (backend/src/fees/gateways/gateway-config.ts): unset entirely means "no real Firebase project
 * yet" and falls back to the logging no-op adapter; a partial config outside dev/test is treated
 * as a real misconfiguration and fails loudly at boot.
 *
 * FIREBASE_PRIVATE_KEY arrives from most secret managers / .env files with literal `\n`
 * sequences (real newlines don't survive a single-line env var) — unescape them here so the PEM
 * key `firebase-admin`'s credential.cert() receives is well-formed.
 */
export function resolveFirebaseConfig(config: ConfigService): FirebaseAdminConfig | undefined {
  const projectId = config.get<string>('FIREBASE_PROJECT_ID');
  const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
  const privateKeyRaw = config.get<string>('FIREBASE_PRIVATE_KEY');
  const values = [projectId, clientEmail, privateKeyRaw];
  const presentCount = values.filter((v) => !!v).length;

  if (presentCount === 0) return undefined;
  if (presentCount < values.length && !isDevOrTest(config)) {
    throw new Error(
      'Incomplete Firebase configuration — FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY must all be set together, or all left unset to disable push notifications.',
    );
  }
  if (presentCount < values.length) return undefined;

  return {
    projectId: projectId!,
    clientEmail: clientEmail!,
    privateKey: privateKeyRaw!.replace(/\\n/g, '\n'),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest src/notifications/fcm-config.spec.ts`
Expected: PASS (5 cases)

- [ ] **Step 5: Commit**

```bash
git add backend/src/notifications/fcm-config.ts backend/src/notifications/fcm-config.spec.ts
git commit -m "feat(backend): add resolveFirebaseConfig, mirroring the payment gateway config pattern"
```

---

### Task 3: Backend — `FcmSender` + `FcmPushAdapter`

**Files:**
- Create: `backend/src/notifications/fcm-sender.ts`
- Create: `backend/src/notifications/fcm-push.adapter.ts`
- Test: `backend/src/notifications/fcm-push.adapter.spec.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: `PushAdapter` (from `./push-adapter.ts`, existing — `send(userId, payload): Promise<void>`), `FirebaseAdminConfig` (Task 2), `PrismaService` (existing, `this.prisma.deviceToken.findMany`/`deleteMany`).
- Produces: `FcmSender { sendEachForMulticast(tokens: string[], payload: PushPayload): Promise<FcmSendResult> }`, `AdminFcmSender implements FcmSender`, `FcmPushAdapter implements PushAdapter` — consumed by Task 4's module wiring.

- [ ] **Step 1: Add the `firebase-admin` dependency**

Edit `backend/package.json` — add to `"dependencies"` (alphabetical, after `"dotenv"`):

```json
    "dotenv": "^17.4.2",
    "firebase-admin": "^13.0.0",
    "multer": "^2.2.0",
```

Run: `cd backend && npm install`
Expected: `firebase-admin` and its transitive deps appear in `package-lock.json`; `npm install` exits 0.

- [ ] **Step 2: Define the `FcmSender` interface and its real implementation**

Create `backend/src/notifications/fcm-sender.ts`:

```typescript
import * as admin from 'firebase-admin';
import { FirebaseAdminConfig } from './fcm-config';
import { PushPayload } from './push-adapter';

export interface FcmSendResponse {
  success: boolean;
  /** Set when success is false — used to detect a token FCM will never accept again. */
  errorCode?: string;
}

export interface FcmSendResult {
  responses: FcmSendResponse[];
}

/**
 * Thin seam over the firebase-admin SDK — FcmPushAdapter depends on this interface, not on
 * firebase-admin directly, so its tests supply a fake sender instead of mocking the whole SDK
 * module.
 */
export interface FcmSender {
  sendEachForMulticast(tokens: string[], payload: PushPayload): Promise<FcmSendResult>;
}

/**
 * Each real FcmPushAdapter instance gets its own named admin app (rather than the SDK default) so
 * that constructing more than one in a process — e.g. across NestJS's hot-reload in dev, or in a
 * test that builds several — never collides with "app already exists" from admin.initializeApp().
 */
let appCounter = 0;

export class AdminFcmSender implements FcmSender {
  private readonly app: admin.app.App;

  constructor(config: FirebaseAdminConfig) {
    this.app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey,
        }),
      },
      `fcm-push-adapter-${appCounter++}`,
    );
  }

  async sendEachForMulticast(tokens: string[], payload: PushPayload): Promise<FcmSendResult> {
    const response = await this.app.messaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });
    return {
      responses: response.responses.map((r) => ({
        success: r.success,
        errorCode: r.error?.code,
      })),
    };
  }
}
```

- [ ] **Step 3: Write the failing adapter tests**

Create `backend/src/notifications/fcm-push.adapter.spec.ts`:

```typescript
import { FcmPushAdapter } from './fcm-push.adapter';
import { FcmSender, FcmSendResult } from './fcm-sender';

describe('FcmPushAdapter', () => {
  function fakePrisma(tokens: { token: string }[]) {
    return {
      deviceToken: {
        findMany: jest.fn().mockResolvedValue(tokens),
        deleteMany: jest.fn().mockResolvedValue({ count: tokens.length }),
      },
    };
  }

  it('does nothing when the user has no registered devices', async () => {
    const prisma = fakePrisma([]);
    const sender: FcmSender = { sendEachForMulticast: jest.fn() };
    const adapter = new FcmPushAdapter(sender, prisma as never);

    await adapter.send('user-1', { title: 'T', body: 'B' });

    expect(prisma.deviceToken.findMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(sender.sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('sends to every registered token for the user', async () => {
    const prisma = fakePrisma([{ token: 'tok-a' }, { token: 'tok-b' }]);
    const result: FcmSendResult = { responses: [{ success: true }, { success: true }] };
    const sender: FcmSender = { sendEachForMulticast: jest.fn().mockResolvedValue(result) };
    const adapter = new FcmPushAdapter(sender, prisma as never);

    await adapter.send('user-1', { title: 'New circular', body: 'PTM in September', data: { type: 'circular' } });

    expect(sender.sendEachForMulticast).toHaveBeenCalledWith(
      ['tok-a', 'tok-b'],
      { title: 'New circular', body: 'PTM in September', data: { type: 'circular' } },
    );
    expect(prisma.deviceToken.deleteMany).not.toHaveBeenCalled();
  });

  it('deletes a token FCM reports as unregistered, keeps a token that merely failed transiently', async () => {
    const prisma = fakePrisma([{ token: 'tok-dead' }, { token: 'tok-flaky' }]);
    const result: FcmSendResult = {
      responses: [
        { success: false, errorCode: 'messaging/registration-token-not-registered' },
        { success: false, errorCode: 'messaging/internal-error' },
      ],
    };
    const sender: FcmSender = { sendEachForMulticast: jest.fn().mockResolvedValue(result) };
    const adapter = new FcmPushAdapter(sender, prisma as never);

    await adapter.send('user-1', { title: 'T', body: 'B' });

    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['tok-dead'] } },
    });
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd backend && npx jest src/notifications/fcm-push.adapter.spec.ts`
Expected: FAIL — `Cannot find module './fcm-push.adapter'`.

- [ ] **Step 5: Implement `FcmPushAdapter`**

Create `backend/src/notifications/fcm-push.adapter.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PushAdapter, PushPayload } from './push-adapter';
import { FcmSender } from './fcm-sender';

const UNREGISTERED_ERROR_CODE = 'messaging/registration-token-not-registered';

/**
 * Real push delivery, behind the same PushAdapter interface LoggingPushAdapter already
 * implements — swapping this in is a one-line change in NotificationsModule (see fcm-config.ts's
 * resolveFirebaseConfig for how the swap is decided), matching the StorageAdapter/PaymentGateway
 * pattern used elsewhere in this codebase.
 */
@Injectable()
export class FcmPushAdapter implements PushAdapter {
  constructor(
    private readonly sender: FcmSender,
    private readonly prisma: PrismaService,
  ) {}

  async send(userId: string, payload: PushPayload): Promise<void> {
    const devices = await this.prisma.deviceToken.findMany({ where: { userId } });
    if (devices.length === 0) return;

    const result = await this.sender.sendEachForMulticast(
      devices.map((d) => d.token),
      payload,
    );

    const deadTokens = devices
      .filter((_, i) => result.responses[i]?.errorCode === UNREGISTERED_ERROR_CODE)
      .map((d) => d.token);

    if (deadTokens.length > 0) {
      await this.prisma.deviceToken.deleteMany({ where: { token: { in: deadTokens } } });
    }
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npx jest src/notifications/fcm-push.adapter.spec.ts`
Expected: PASS (3 cases)

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/notifications/fcm-sender.ts backend/src/notifications/fcm-push.adapter.ts backend/src/notifications/fcm-push.adapter.spec.ts
git commit -m "feat(backend): add FcmSender/FcmPushAdapter, the real push implementation behind PushAdapter"
```

---

### Task 4: Backend — wire the adapter selection + env docs

**Files:**
- Modify: `backend/src/notifications/notifications.module.ts`
- Modify: `backend/.env.example`
- Test: (covered by Task 1/2/3's suites plus a manual boot check below — this task is pure wiring, no new logic to unit test)

**Interfaces:**
- Consumes: `resolveFirebaseConfig` (Task 2), `AdminFcmSender`/`FcmPushAdapter` (Task 3).

- [ ] **Step 1: Rewrite the module's provider**

Edit `backend/src/notifications/notifications.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PUSH_ADAPTER } from './push-adapter';
import { LoggingPushAdapter } from './logging-push.adapter';
import { FcmPushAdapter } from './fcm-push.adapter';
import { AdminFcmSender } from './fcm-sender';
import { resolveFirebaseConfig } from './fcm-config';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [
    NotificationsService,
    {
      provide: PUSH_ADAPTER,
      useFactory: (config: ConfigService, prisma: PrismaService) => {
        const firebaseConfig = resolveFirebaseConfig(config);
        if (!firebaseConfig) return new LoggingPushAdapter();
        return new FcmPushAdapter(new AdminFcmSender(firebaseConfig), prisma);
      },
      inject: [ConfigService, PrismaService],
    },
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

(`ConfigService` and `PrismaService` are both globally available — `ConfigModule.forRoot({
isGlobal: true })` in `app.module.ts` and `@Global()` on `PrismaModule` — so no new imports array
entry is needed here, matching how `PaymentGatewayAdapterFactoryImpl` already injects
`ConfigService` without `FeesModule` importing `ConfigModule` explicitly.)

- [ ] **Step 2: Document the new env vars**

Edit `backend/.env.example` — append after the existing `PAYMENT_STUB_WEBHOOK_SECRET` line:

```
# Push notifications (FCM) — leave all three unset to disable (falls back to a logging no-op
# adapter in every environment, not just development/test — there is no "stub that fakes success"
# for push the way there is for payments, since nothing consumes a push confirmation). Setting
# only some of these is a startup error outside development/test. FIREBASE_PRIVATE_KEY should
# contain literal \n sequences (not real newlines) exactly as most secret managers store it.
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
```

- [ ] **Step 3: Verify nothing else broke**

Run: `cd backend && npx jest src/notifications` (runs `notifications.service.spec.ts`,
`logging-push.adapter.spec.ts`, `fcm-config.spec.ts`, `fcm-push.adapter.spec.ts` together)
Expected: PASS, all suites.

Run: `cd backend && npm run build`
Expected: exits 0 — confirms the factory wiring type-checks.

Run: `cd backend && npx jest --config test/jest-e2e.json`
Expected: full e2e suite still passes (local `.env` has no `FIREBASE_*` vars set, so every existing
test still exercises `LoggingPushAdapter`, unchanged behavior).

- [ ] **Step 4: Commit**

```bash
git add backend/src/notifications/notifications.module.ts backend/.env.example
git commit -m "feat(backend): select FcmPushAdapter when Firebase is configured, else keep the logging no-op"
```

---

### Task 5: Flutter — `ApiClient.registerDeviceToken()`

**Files:**
- Modify: `parent-app/lib/src/api/api_client.dart`
- Test: Create `parent-app/test/api/api_client_device_token_test.dart`

**Interfaces:**
- Produces: `ApiClient.registerDeviceToken(String accessToken, String token, String platform): Future<void>` — consumed by Task 7's `DeviceTokenRegistrar`.

- [ ] **Step 1: Write the failing test**

Create `parent-app/test/api/api_client_device_token_test.dart`:

```dart
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';

void main() {
  test('registerDeviceToken posts the token and platform with auth header', () async {
    Map<String, dynamic>? sentBody;
    String? sentAuth;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        sentBody = jsonDecode(request.body) as Map<String, dynamic>;
        sentAuth = request.headers['Authorization'];
        return http.Response('', 201);
      }),
    );

    await api.registerDeviceToken('tok-access', 'fcm-abc', 'android');

    expect(sentBody, {'token': 'fcm-abc', 'platform': 'android'});
    expect(sentAuth, 'Bearer tok-access');
  });

  test('registerDeviceToken throws ApiException on a non-2xx response', () async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        return http.Response(jsonEncode({'message': 'Bad platform'}), 400);
      }),
    );

    expect(
      () => api.registerDeviceToken('tok-access', 'fcm-abc', 'windows-phone'),
      throwsA(isA<ApiException>()),
    );
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/api/api_client_device_token_test.dart`
Expected: FAIL — `The method 'registerDeviceToken' isn't defined for the class 'ApiClient'`.

- [ ] **Step 3: Implement the method**

Edit `parent-app/lib/src/api/api_client.dart` — add after the existing `markAllNotificationsRead`
method:

```dart
  Future<void> registerDeviceToken(String accessToken, String token, String platform) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/me/device-tokens'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({'token': token, 'platform': platform}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd parent-app && flutter test test/api/api_client_device_token_test.dart`
Expected: PASS (2 cases)

- [ ] **Step 5: Commit**

```bash
git add parent-app/lib/src/api/api_client.dart parent-app/test/api/api_client_device_token_test.dart
git commit -m "feat(parent-app): add ApiClient.registerDeviceToken"
```

---

### Task 6: Flutter — `NotificationTarget` mapper (pure, no Firebase init needed)

**Files:**
- Create: `parent-app/lib/src/notifications/notification_target.dart`
- Test: Create `parent-app/test/notifications/notification_target_test.dart`
- Modify: `parent-app/pubspec.yaml`

**Interfaces:**
- Produces: `NotificationTarget { type: String; entityRef: String? }`, `notificationTargetFromMessage(RemoteMessage): NotificationTarget?` — consumed by Task 8's `FirebaseMessagingTokenProvider` and Task 9's `HomeShell` wiring.

- [ ] **Step 1: Add the Firebase packages to `pubspec.yaml`**

Edit `parent-app/pubspec.yaml` — add to `dependencies:` (after `shared_preferences`):

```yaml
  shared_preferences: ^2.5.5
  firebase_core: ^3.8.0
  firebase_messaging: ^15.1.6
```

Run: `cd parent-app && flutter pub get`
Expected: exits 0, `pubspec.lock` updates.

- [ ] **Step 2: Write the failing test**

Create `parent-app/test/notifications/notification_target_test.dart`:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:parent_app/src/notifications/notification_target.dart';

void main() {
  test('maps a circular push message to its NotificationTarget', () {
    final message = RemoteMessage(data: {'type': 'circular', 'entityRef': 'c1'});

    final target = notificationTargetFromMessage(message);

    expect(target, isNotNull);
    expect(target!.type, 'circular');
    expect(target.entityRef, 'c1');
  });

  test('treats an empty entityRef the same as absent (matches the backend sending "")', () {
    final message = RemoteMessage(data: {'type': 'diary', 'entityRef': ''});

    final target = notificationTargetFromMessage(message);

    expect(target!.entityRef, isNull);
  });

  test('returns null for a message with no type in its data payload', () {
    final message = RemoteMessage(data: {});

    expect(notificationTargetFromMessage(message), isNull);
  });
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd parent-app && flutter test test/notifications/notification_target_test.dart`
Expected: FAIL — `Error: Not found: 'package:parent_app/src/notifications/notification_target.dart'`.

- [ ] **Step 4: Implement the mapper**

Create `parent-app/lib/src/notifications/notification_target.dart`:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';

/// Same (type, entityRef) shape HomeShell already uses for in-app notification taps
/// (NotificationsSheet's onOpenType) — this lets a push-notification tap reuse that exact
/// navigation logic instead of a second, parallel one.
class NotificationTarget {
  const NotificationTarget({required this.type, this.entityRef});

  final String type;
  final String? entityRef;
}

/// Maps an FCM [RemoteMessage]'s data payload to a [NotificationTarget]. The payload shape comes
/// from the backend's NotificationsService.notify() (backend/src/notifications/notifications.service.ts):
/// `data: { type: input.type, entityRef: input.entityRef ?? '' }`.
NotificationTarget? notificationTargetFromMessage(RemoteMessage message) {
  final type = message.data['type'] as String?;
  if (type == null || type.isEmpty) return null;
  final rawEntityRef = message.data['entityRef'] as String?;
  final entityRef = (rawEntityRef == null || rawEntityRef.isEmpty) ? null : rawEntityRef;
  return NotificationTarget(type: type, entityRef: entityRef);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd parent-app && flutter test test/notifications/notification_target_test.dart`
Expected: PASS (3 cases)

- [ ] **Step 6: Commit**

```bash
git add parent-app/pubspec.yaml parent-app/pubspec.lock parent-app/lib/src/notifications/notification_target.dart parent-app/test/notifications/notification_target_test.dart
git commit -m "feat(parent-app): add firebase_messaging/firebase_core deps and the push-message-to-target mapper"
```

---

### Task 7: Flutter — `PushTokenProvider` + `DeviceTokenRegistrar` + `firebase_options.dart` placeholder

**Files:**
- Create: `parent-app/lib/src/notifications/push_token_provider.dart`
- Create: `parent-app/lib/src/notifications/device_token_registrar.dart`
- Create: `parent-app/lib/firebase_options.dart`
- Test: Create `parent-app/test/notifications/device_token_registrar_test.dart`

**Interfaces:**
- Consumes: `NotificationTarget`/`notificationTargetFromMessage` (Task 6), `ApiClient.registerDeviceToken` (Task 5).
- Produces: `PushTokenProvider` (abstract: `Future<String?> getToken()`, `Stream<NotificationTarget> get onNotificationTapped`), `FirebaseMessagingTokenProvider`, `NoopPushTokenProvider`, `DeviceTokenRegistrar.registerIfPossible(String accessToken): Future<void>` — consumed by Task 8's `main.dart`/`test_harness.dart`/`home_shell.dart` wiring.

- [ ] **Step 1: Write the failing test for `DeviceTokenRegistrar`**

Create `parent-app/test/notifications/device_token_registrar_test.dart`:

```dart
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/notifications/device_token_registrar.dart';
import 'package:parent_app/src/notifications/notification_target.dart';
import 'package:parent_app/src/notifications/push_token_provider.dart';

class _FakeTokenProvider implements PushTokenProvider {
  _FakeTokenProvider(this._token);
  final String? _token;

  @override
  Future<String?> getToken() async => _token;

  @override
  Stream<NotificationTarget> get onNotificationTapped => const Stream.empty();
}

void main() {
  test('registers the token against /me/device-tokens when a token is available', () async {
    Map<String, dynamic>? sentBody;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        sentBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response('', 201);
      }),
    );
    final registrar = DeviceTokenRegistrar(api: api, tokenProvider: _FakeTokenProvider('fcm-xyz'));

    await registrar.registerIfPossible('access-tok');

    expect(sentBody, isNotNull);
    expect(sentBody!['token'], 'fcm-xyz');
    // The registrar runs under flutter_test's default target platform, which is Android unless a
    // test overrides debugDefaultTargetPlatformOverride — see home_shell_test.dart for the case
    // that matters in practice.
    expect(sentBody!['platform'], 'android');
  });

  test('makes no API call when the token provider has no token yet', () async {
    var called = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        called = true;
        return http.Response('', 201);
      }),
    );
    final registrar = DeviceTokenRegistrar(api: api, tokenProvider: _FakeTokenProvider(null));

    await registrar.registerIfPossible('access-tok');

    expect(called, isFalse);
  });

  test('a registration failure is swallowed, not rethrown (best-effort convenience only)', () async {
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async => http.Response('server error', 500)),
    );
    final registrar = DeviceTokenRegistrar(api: api, tokenProvider: _FakeTokenProvider('fcm-xyz'));

    await expectLater(registrar.registerIfPossible('access-tok'), completes);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/notifications/device_token_registrar_test.dart`
Expected: FAIL — cannot find `package:parent_app/src/notifications/device_token_registrar.dart` (and `push_token_provider.dart`).

- [ ] **Step 3: Implement `PushTokenProvider`**

Create `parent-app/lib/src/notifications/push_token_provider.dart`:

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import '../../firebase_options.dart';
import 'notification_target.dart';

/// Seam between HomeShell/DeviceTokenRegistrar and the real firebase_messaging plugin — lets
/// tests and the (currently placeholder-only) web target substitute a no-op implementation
/// instead of touching real platform channels.
abstract class PushTokenProvider {
  Future<String?> getToken();
  Stream<NotificationTarget> get onNotificationTapped;
}

/// Real implementation. Firebase.initializeApp() is guarded: this project has no real Firebase
/// project yet (see firebase_options.dart), so initialization is expected to fail today — that
/// failure (and any MissingPluginException from running under `flutter test`, which has no real
/// platform channels) degrades to "no push for this session" rather than crashing the app. The
/// foreground-resume polling stopgap (HomeShell's WidgetsBindingObserver) is what keeps the app
/// useful in the meantime.
class FirebaseMessagingTokenProvider implements PushTokenProvider {
  bool _initialized = false;

  Future<bool> _ensureInitialized() async {
    if (_initialized) return true;
    try {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      _initialized = true;
      return true;
    } catch (_) {
      return false;
    }
  }

  @override
  Future<String?> getToken() async {
    if (!await _ensureInitialized()) return null;
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }

  @override
  Stream<NotificationTarget> get onNotificationTapped => FirebaseMessaging.onMessageOpenedApp
      .map(notificationTargetFromMessage)
      .where((target) => target != null)
      .cast<NotificationTarget>();
}

/// Used wherever push isn't meaningful: widget tests (test_harness.dart) and any future web
/// build (FCM web push needs a service worker + VAPID key, out of this sprint's scope — the
/// roadmap's Definition of Done targets "a physical/emulated Android device").
class NoopPushTokenProvider implements PushTokenProvider {
  @override
  Future<String?> getToken() async => null;

  @override
  Stream<NotificationTarget> get onNotificationTapped => const Stream.empty();
}
```

- [ ] **Step 4: Implement the placeholder `firebase_options.dart`**

Create `parent-app/lib/firebase_options.dart`:

```dart
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// PLACEHOLDER — hand-written stub, not generated by `flutterfire configure`. No real Firebase
/// project exists for SchoolPortal yet (tracked in build/PROJECT-STATUS.md's Sprint F section).
/// These values are syntactically valid `FirebaseOptions` but will fail authentication against
/// Google's servers — which FirebaseMessagingTokenProvider (lib/src/notifications/push_token_provider.dart)
/// already treats as "push unavailable this session" and degrades gracefully from. Replace this
/// entire file by running `flutterfire configure` once a real Firebase project is created; do not
/// hand-edit these values to "make it work" — a project ID that doesn't exist will never succeed.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) return web;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for this platform.',
        );
    }
  }

  static const web = FirebaseOptions(
    apiKey: 'placeholder-web-api-key',
    appId: '1:000000000000:web:0000000000000000000000',
    messagingSenderId: '000000000000',
    projectId: 'schoolportal-placeholder',
  );

  static const android = FirebaseOptions(
    apiKey: 'placeholder-android-api-key',
    appId: '1:000000000000:android:0000000000000000000000',
    messagingSenderId: '000000000000',
    projectId: 'schoolportal-placeholder',
  );

  static const ios = FirebaseOptions(
    apiKey: 'placeholder-ios-api-key',
    appId: '1:000000000000:ios:0000000000000000000000',
    messagingSenderId: '000000000000',
    projectId: 'schoolportal-placeholder',
    iosBundleId: 'pk.edu.seeds.parent_app',
  );
}
```

- [ ] **Step 5: Implement `DeviceTokenRegistrar`**

Create `parent-app/lib/src/notifications/device_token_registrar.dart`:

```dart
import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform, kIsWeb;
import '../api/api_client.dart';
import 'push_token_provider.dart';

/// Best-effort device-token registration — deliberately never throws past registerIfPossible, so
/// a parent with no FCM token yet (no real Firebase project configured, an unsupported platform,
/// a registration-endpoint hiccup) just gets no push notifications; it must never block or break
/// the screen that calls it.
class DeviceTokenRegistrar {
  DeviceTokenRegistrar({required this.api, required this.tokenProvider});

  final ApiClient api;
  final PushTokenProvider tokenProvider;

  /// No dart:io Platform — this codebase deliberately avoids dart:io so `flutter run -d chrome`
  /// (the only locally-previewable target in this dev environment) keeps compiling.
  /// defaultTargetPlatform defaults to TargetPlatform.android under flutter_test unless a test
  /// overrides debugDefaultTargetPlatformOverride, which is what makes this registrar exercisable
  /// in a widget test without any platform-channel mocking.
  String? _currentPlatformName() {
    if (kIsWeb) return null;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return 'android';
      case TargetPlatform.iOS:
        return 'ios';
      default:
        return null;
    }
  }

  Future<void> registerIfPossible(String accessToken) async {
    final platform = _currentPlatformName();
    if (platform == null) return;

    final token = await tokenProvider.getToken();
    if (token == null) return;

    try {
      await api.registerDeviceToken(accessToken, token, platform);
    } on ApiException catch (_) {
      // Convenience registration only — never surface this failure to the user.
    }
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd parent-app && flutter test test/notifications/device_token_registrar_test.dart`
Expected: PASS (3 cases)

- [ ] **Step 7: Run the full test suite and analyzer to confirm nothing else broke**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: analyzer clean, all existing + new tests pass.

- [ ] **Step 8: Commit**

```bash
git add parent-app/lib/src/notifications/push_token_provider.dart parent-app/lib/src/notifications/device_token_registrar.dart parent-app/lib/firebase_options.dart parent-app/test/notifications/device_token_registrar_test.dart
git commit -m "feat(parent-app): add PushTokenProvider/DeviceTokenRegistrar and a placeholder firebase_options.dart"
```

---

### Task 8: Flutter — wire registration into app startup

**Files:**
- Modify: `parent-app/lib/main.dart`
- Modify: `parent-app/test/test_harness.dart`

**Interfaces:**
- Consumes: `DeviceTokenRegistrar`, `FirebaseMessagingTokenProvider`, `NoopPushTokenProvider` (Task 7).
- Produces: a `DeviceTokenRegistrar` available via `Provider<DeviceTokenRegistrar>` in both the real app tree and the test harness — consumed by Task 9's `HomeShell`.

- [ ] **Step 1: Provide a real registrar in `main.dart`**

Edit `parent-app/lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'src/api/api_client.dart';
import 'src/api/refreshing_http_client.dart';
import 'src/auth/auth_state.dart';
import 'src/auth/token_store.dart';
import 'src/notifications/device_token_registrar.dart';
import 'src/notifications/push_token_provider.dart';
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
  late final DeviceTokenRegistrar _deviceTokenRegistrar = DeviceTokenRegistrar(
    api: _api,
    tokenProvider: FirebaseMessagingTokenProvider(),
  );
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
        Provider<DeviceTokenRegistrar>.value(value: _deviceTokenRegistrar),
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

- [ ] **Step 2: Provide a no-op registrar (overridable) in the test harness**

Edit `parent-app/test/test_harness.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/auth/auth_state.dart';
import 'package:parent_app/src/auth/token_store.dart';
import 'package:parent_app/src/notifications/device_token_registrar.dart';
import 'package:parent_app/src/notifications/push_token_provider.dart';
import 'package:parent_app/src/router/app_router.dart';
import 'package:parent_app/src/theme/app_theme.dart';

/// Builds the same provider/router tree as `ParentApp` (lib/main.dart), but with an injected
/// [ApiClient] and [TokenStore] instead of a real network client and platform secure storage —
/// neither of which is available in the widget-test environment. Also seeds an empty
/// `shared_preferences` mock store, since FEAT-014's offline cache (`DataCache`) reads/writes
/// it on every screen and would otherwise hang on the unmocked platform channel.
///
/// [deviceTokenRegistrar] defaults to a Noop-backed one so existing tests are unaffected; pass a
/// real one (built with a fake PushTokenProvider) only in the tests that specifically exercise
/// device-token registration or push-tap navigation.
Widget buildTestApp({
  required ApiClient api,
  TokenStore? tokenStore,
  DeviceTokenRegistrar? deviceTokenRegistrar,
}) {
  SharedPreferences.setMockInitialValues({});
  final auth = AuthState(api: api, tokenStore: tokenStore ?? InMemoryTokenStore());
  final router = buildAppRouter(auth);
  final registrar =
      deviceTokenRegistrar ?? DeviceTokenRegistrar(api: api, tokenProvider: NoopPushTokenProvider());

  return MultiProvider(
    providers: [
      Provider<ApiClient>.value(value: api),
      ChangeNotifierProvider<AuthState>.value(value: auth),
      Provider<DeviceTokenRegistrar>.value(value: registrar),
    ],
    child: MaterialApp.router(theme: buildAppTheme(), routerConfig: router),
  );
}
```

- [ ] **Step 3: Run the full test suite to confirm the harness change alone doesn't break anything**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: analyzer clean, all existing tests still pass (no test yet reads `DeviceTokenRegistrar`
from context, so this step only proves the plumbing compiles and doesn't regress anything).

- [ ] **Step 4: Commit**

```bash
git add parent-app/lib/main.dart parent-app/test/test_harness.dart
git commit -m "feat(parent-app): provide DeviceTokenRegistrar through the app and test-harness widget trees"
```

---

### Task 9: Flutter — `HomeShell`: register on login, foreground-resume polling stopgap, push-tap deep link

**Files:**
- Modify: `parent-app/lib/src/screens/home_shell.dart`
- Test: Modify `parent-app/test/screens/home_shell_test.dart`

**Interfaces:**
- Consumes: `DeviceTokenRegistrar` (Task 7/8, read via `context.read<DeviceTokenRegistrar>()`), `NotificationTarget` (Task 6).

- [ ] **Step 1: Write the failing tests**

Add to `parent-app/test/screens/home_shell_test.dart` — add these imports at the top of the file
(alongside the existing ones):

```dart
import 'package:parent_app/src/notifications/device_token_registrar.dart';
import 'package:parent_app/src/notifications/notification_target.dart';
import 'package:parent_app/src/notifications/push_token_provider.dart';
```

Add this fake provider near the top of the file, after the imports:

```dart
class _FakePushTokenProvider implements PushTokenProvider {
  _FakePushTokenProvider({String? token, Stream<NotificationTarget>? taps})
      : _token = token,
        _taps = taps ?? const Stream.empty();
  final String? _token;
  final Stream<NotificationTarget> _taps;

  @override
  Future<String?> getToken() async => _token;

  @override
  Stream<NotificationTarget> get onNotificationTapped => _taps;
}
```

Add these three new `testWidgets` cases inside `void main() { ... }`, after the existing
`'the Notifications tab shows a badge for unread circulars'` case:

```dart
  testWidgets('registers a device token with the backend once logged in', (tester) async {
    Uri? registeredUri;
    Map<String, dynamic>? registeredBody;
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT'}), 200);
      }
      if (request.url.path == '/api/v1/me/children') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/me/device-tokens') {
        registeredUri = request.url;
        registeredBody = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response('', 201);
      }
      return http.Response('not found', 404);
    });
    final api = ApiClient(baseUrl: 'http://test', client: client);
    final registrar = DeviceTokenRegistrar(
      api: api,
      tokenProvider: _FakePushTokenProvider(token: 'fcm-token-1'),
    );

    await tester.pumpWidget(buildTestApp(api: api, deviceTokenRegistrar: registrar));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('identifierField')), 'parent-a@seeds.edu.pk');
    await tester.enterText(find.byKey(const Key('passwordField')), 'ChangeMe123!');
    await tester.tap(find.byKey(const Key('submitButton')));
    await tester.pumpAndSettle();

    expect(registeredUri?.path, '/api/v1/me/device-tokens');
    expect(registeredBody?['token'], 'fcm-token-1');
  });

  testWidgets('re-fetches notification/circular counts when the app resumes from background', (tester) async {
    var notificationsFetchCount = 0;
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT'}), 200);
      }
      if (request.url.path == '/api/v1/me/children') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/circulars') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/notifications' && request.method == 'GET') {
        notificationsFetchCount++;
        return http.Response(jsonEncode([]), 200);
      }
      return http.Response('not found', 404);
    });
    final api = ApiClient(baseUrl: 'http://test', client: client);
    await tester.pumpWidget(buildTestApp(api: api));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('identifierField')), 'parent-a@seeds.edu.pk');
    await tester.enterText(find.byKey(const Key('passwordField')), 'ChangeMe123!');
    await tester.tap(find.byKey(const Key('submitButton')));
    await tester.pumpAndSettle();

    final countAfterLogin = notificationsFetchCount;
    expect(countAfterLogin, greaterThan(0));

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();

    expect(notificationsFetchCount, greaterThan(countAfterLogin));
  });

  testWidgets('tapping a push notification navigates the same way as tapping its in-app counterpart', (tester) async {
    final tapController = StreamController<NotificationTarget>();
    final client = MockClient((request) async {
      if (request.url.path == '/api/v1/auth/login') {
        return http.Response(jsonEncode({'accessToken': 'a1', 'refreshToken': 'r1', 'role': 'PARENT'}), 200);
      }
      if (request.url.path == '/api/v1/me/children') {
        return http.Response(
          jsonEncode([
            {
              'id': 's1',
              'name': 'Eshaal',
              'grNumber': 'GR-1001',
              'campus': 'Gulistan-e-Jauhar',
              'class': 'Grade 3',
              'section': '3A',
            },
          ]),
          200,
        );
      }
      if (request.url.path == '/api/v1/circulars') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/notifications' && request.method == 'GET') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/students/s1/timetable') {
        return http.Response(jsonEncode([]), 200);
      }
      if (request.url.path == '/api/v1/students/s1/diary') {
        return http.Response(
          jsonEncode([
            {
              'id': 'd1',
              'date': '2026-08-29',
              'dueDate': null,
              'subject': 'Math',
              'text': 'Complete exercise 4.',
              'attachments': [],
            },
          ]),
          200,
        );
      }
      if (request.url.path == '/api/v1/students/s1/attendance') {
        return http.Response(
          jsonEncode({
            'days': [],
            'summary': {'present': 0, 'absent': 0, 'late': 0, 'holiday': 0, 'leave': 0, 'attendancePercentage': 0},
          }),
          200,
        );
      }
      return http.Response('not found', 404);
    });
    final api = ApiClient(baseUrl: 'http://test', client: client);
    final registrar = DeviceTokenRegistrar(
      api: api,
      tokenProvider: _FakePushTokenProvider(taps: tapController.stream),
    );

    await tester.pumpWidget(buildTestApp(api: api, deviceTokenRegistrar: registrar));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('identifierField')), 'parent-a@seeds.edu.pk');
    await tester.enterText(find.byKey(const Key('passwordField')), 'ChangeMe123!');
    await tester.tap(find.byKey(const Key('submitButton')));
    await tester.pumpAndSettle();

    tapController.add(const NotificationTarget(type: 'diary', entityRef: 'd1'));
    await tester.pumpAndSettle();

    // Same destination as HomeShell's existing in-app notification handling for type: 'diary' —
    // lands on the Calendar tab's Diary sub-tab.
    expect(find.text('Complete exercise 4.'), findsOneWidget);

    await tapController.close();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd parent-app && flutter test test/screens/home_shell_test.dart`
Expected: FAIL — the device-token-registration test sees no `/api/v1/me/device-tokens` call; the
resume test sees no second `/api/v1/notifications` fetch; the push-tap test times out/never
navigates (nothing in `HomeShell` consumes `onNotificationTapped` yet).

- [ ] **Step 3: Implement the `HomeShell` changes**

Edit `parent-app/lib/src/screens/home_shell.dart` — replace the full file with:

```dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/auth_state.dart';
import '../notifications/device_token_registrar.dart';
import '../notifications/notification_target.dart';
import 'calendar_tab.dart';
import 'circulars_tab.dart';
import 'fees_tab.dart';
import 'home_tab.dart';
import 'messages_tab.dart';
import 'more_tab.dart';
import 'notifications_sheet.dart';

/// Authenticated shell: multi-child switcher up top, bottom nav below (Home / Calendar /
/// Notifications / Messages / Fees / More — per the MVP plan). Every tab is a placeholder;
/// FEAT-006 onward fill these in against the same /api/v1 endpoints the staff console uses.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialTab = 0});

  final int initialTab;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> with WidgetsBindingObserver {
  late int _tabIndex = widget.initialTab;
  List<ChildSummary> _children = [];
  String? _activeChildId;
  bool _isLoading = true;
  String? _loadError;
  List<CircularSummary> _circulars = [];
  int _unreadCirculars = 0;
  int _unreadNotifications = 0;
  StreamSubscription<NotificationTarget>? _pushTapSubscription;

  /// Which CalendarTab sub-tab (0 = Timetable, 1 = Attendance, 2 = Diary) should be shown next
  /// time the Calendar tab is built. Set to 2 (Diary) when the user taps a `type: 'diary'`
  /// notification so they land on the actual content the notification was about, rather than
  /// always landing on Timetable. Reset to 0 whenever the user manually navigates to Calendar
  /// via the bottom nav, so a stale "open on Diary" doesn't stick around on later manual visits.
  int _calendarInitialSubTab = 0;

  /// Which conversation MessagesTab should open straight to, set when the user taps a
  /// `type: 'message'` notification's entityRef. Reset to null on manual bottom-nav navigation
  /// to Messages, same reasoning as _calendarInitialSubTab above.
  String? _messagesInitialConversationId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadChildren();
    _loadCirculars();
    _loadNotificationCount();
    _registerDeviceToken();
    _listenForPushTaps();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pushTapSubscription?.cancel();
    super.dispose();
  }

  /// Interim stopgap (ships independently of full FCM, per the roadmap's Sprint F note): a
  /// backgrounded app that gets resumed re-fetches the counts a real push would have kept fresh,
  /// so a parent who missed a push (or on a build where push isn't configured yet) still sees an
  /// accurate badge within moments of reopening the app rather than only on a cold start.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadNotificationCount();
      _loadCirculars();
    }
  }

  Future<void> _registerDeviceToken() async {
    final auth = context.read<AuthState>();
    final token = auth.accessToken;
    if (token == null) return;
    await context.read<DeviceTokenRegistrar>().registerIfPossible(token);
  }

  void _listenForPushTaps() {
    final registrar = context.read<DeviceTokenRegistrar>();
    _pushTapSubscription = registrar.tokenProvider.onNotificationTapped.listen((target) {
      if (!mounted) return;
      _navigateForNotificationType(target.type, target.entityRef);
    });
  }

  /// Shared by both the in-app NotificationsSheet (a tapped row) and a tapped push notification
  /// (_listenForPushTaps) — one navigation mapping for "a notification of this type was opened",
  /// regardless of which surface it came from.
  void _navigateForNotificationType(String type, String? entityRef) {
    setState(() {
      if (type == 'diary') {
        _tabIndex = 1;
        _calendarInitialSubTab = 2;
      }
      if (type == 'circular') _tabIndex = 2;
      if (type == 'message') {
        _tabIndex = 3;
        _messagesInitialConversationId = entityRef;
      }
    });
  }

  Future<void> _loadCirculars() async {
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    final token = auth.accessToken;
    if (token == null) return;
    try {
      final circulars = await api.circulars(token);
      if (mounted) {
        setState(() {
          _circulars = circulars;
          _unreadCirculars = circulars.where((c) => c.readAt == null).length;
        });
      }
    } on ApiException {
      // The Home tab's announcements and the Notifications badge are conveniences, not the
      // critical path — the Notifications tab itself will surface the real error if opened.
    }
  }

  Future<void> _loadNotificationCount() async {
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    final token = auth.accessToken;
    if (token == null) return;
    try {
      final notifications = await api.notifications(token);
      if (mounted) {
        setState(() => _unreadNotifications = notifications.where((n) => n.readAt == null).length);
      }
    } on ApiException {
      // Convenience badge only — a failed fetch just shows zero, doesn't block the rest of the shell.
    }
  }

  Future<void> _openNotifications() async {
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    final token = auth.accessToken;
    if (token == null) return;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => SizedBox(
        height: MediaQuery.of(context).size.height * 0.6,
        child: NotificationsSheet(
          accessToken: token,
          api: api,
          onOpenType: (type, entityRef) {
            Navigator.of(context).pop();
            _navigateForNotificationType(type, entityRef);
          },
        ),
      ),
    );
    await _loadNotificationCount();
  }

  Future<void> _loadChildren() async {
    final auth = context.read<AuthState>();
    final api = context.read<ApiClient>();
    final token = auth.accessToken;
    if (token == null) return;

    try {
      final children = await api.meChildren(token);
      setState(() {
        _children = children;
        _activeChildId = children.isNotEmpty ? children.first.id : null;
        _isLoading = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _loadError = e.message;
        _isLoading = false;
      });
    }
  }

  ChildSummary? get _activeChild =>
      _children.where((c) => c.id == _activeChildId).cast<ChildSummary?>().firstOrNull;

  void _onLogout() => context.read<AuthState>().logout();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: _buildChildSwitcher(),
        actions: [
          IconButton(
            key: const Key('notificationsButton'),
            icon: _unreadNotifications > 0
                ? Badge(label: Text('$_unreadNotifications'), child: const Icon(Icons.notifications_none))
                : const Icon(Icons.notifications_none),
            tooltip: 'Notifications',
            onPressed: _openNotifications,
          ),
          IconButton(
            key: const Key('logoutButton'),
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: _onLogout,
          ),
        ],
      ),
      body: _buildBody(),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (i) => setState(() {
          _tabIndex = i;
          // Manual bottom-nav navigation to Calendar/Messages should behave as before (Timetable
          // first / the list first) unless the previous action was specifically a notification tap.
          if (i == 1) _calendarInitialSubTab = 0;
          if (i == 3) _messagesInitialConversationId = null;
        }),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          const NavigationDestination(icon: Icon(Icons.calendar_month_outlined), label: 'Calendar'),
          NavigationDestination(
            icon: _unreadCirculars > 0
                ? Badge(label: Text('$_unreadCirculars'), child: const Icon(Icons.notifications_none))
                : const Icon(Icons.notifications_none),
            label: 'Notifications',
          ),
          const NavigationDestination(icon: Icon(Icons.chat_bubble_outline), label: 'Messages'),
          const NavigationDestination(icon: Icon(Icons.receipt_long_outlined), label: 'Fees'),
          const NavigationDestination(icon: Icon(Icons.more_horiz), label: 'More'),
        ],
      ),
    );
  }

  Widget _buildChildSwitcher() {
    if (_isLoading) return const Text('School OS');
    if (_loadError != null) return const Text('School OS');
    if (_children.isEmpty) return const Text('School OS');

    return DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        key: const Key('childSwitcher'),
        value: _activeChildId,
        items: _children
            .map(
              (c) => DropdownMenuItem(
                value: c.id,
                child: Text('${c.name} — ${c.schoolClass} ${c.section}'),
              ),
            )
            .toList(),
        onChanged: (id) => setState(() => _activeChildId = id),
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_loadError != null) return Center(child: Text(_loadError!));
    if (_children.isEmpty) {
      return const Center(child: Text('No children are linked to this account yet.'));
    }

    final child = _activeChild;
    if (child == null) {
      return const Center(child: Text('No children are linked to this account yet.'));
    }

    if (_tabIndex == 0) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return HomeTab(
        // Keyed on the child id so switching the active child re-fetches this tab's attendance
        // stat instead of silently keeping the previous child's data on screen.
        key: ValueKey(child.id),
        studentId: child.id,
        childName: child.name,
        childClass: '${child.schoolClass} ${child.section}',
        accessToken: auth.accessToken!,
        api: api,
        circulars: _circulars,
        onOpenTimetable: () => setState(() => _tabIndex = 1),
        onSeeAllAnnouncements: () => setState(() => _tabIndex = 2),
        onOpenFees: () => setState(() => _tabIndex = 4),
      );
    }

    if (_tabIndex == 1) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return CalendarTab(
        // Keyed on the child id AND the requested initial sub-tab: DefaultTabController caches
        // its controller state per-element, so without a key change tied to
        // _calendarInitialSubTab, Flutter would reuse the existing CalendarTab element on a
        // second open and silently ignore the new initialIndex (e.g. tapping a diary
        // notification a second time wouldn't re-open on Diary). This also still recreates the
        // tab (and its three sub-tabs) when the active child changes, as before.
        key: ValueKey('${child.id}_$_calendarInitialSubTab'),
        studentId: child.id,
        accessToken: auth.accessToken!,
        api: api,
        initialSubTab: _calendarInitialSubTab,
      );
    }

    if (_tabIndex == 2) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return CircularsTab(
        accessToken: auth.accessToken!,
        api: api,
        onUnreadChanged: (count) => setState(() => _unreadCirculars = count),
      );
    }

    if (_tabIndex == 3) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return MessagesTab(
        // Keyed on the requested conversation id so a fresh notification tap (or a change from
        // one conversation to another) forces a new element — same reasoning as CalendarTab's
        // key above: without this, Flutter would reuse the existing MessagesTab element and
        // silently ignore the new initialConversationId.
        key: ValueKey('messages_${_messagesInitialConversationId ?? 'list'}'),
        accessToken: auth.accessToken!,
        api: api,
        children: _children,
        initialConversationId: _messagesInitialConversationId,
      );
    }

    if (_tabIndex == 4) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return FeesTab(
        key: ValueKey(child.id),
        studentId: child.id,
        accessToken: auth.accessToken!,
        api: api,
      );
    }

    if (_tabIndex == 5) {
      return MoreTab(
        accessToken: context.read<AuthState>().accessToken!,
        api: context.read<ApiClient>(),
        children: _children,
      );
    }

    final labels = ['Home', 'Calendar', 'Notifications', 'Messages', 'Fees', 'More'];
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          '${labels[_tabIndex]} for ${child.name}\n\n'
          'Messages/fees land here in future sprints — this screen confirms login, multi-child '
          'switching, and role-gated routing are wired end to end.',
          textAlign: TextAlign.center,
        ),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd parent-app && flutter test test/screens/home_shell_test.dart`
Expected: PASS — all pre-existing cases in this file plus the 3 new ones from Step 1.

- [ ] **Step 5: Run the full suite + analyzer**

Run: `cd parent-app && flutter analyze && flutter test`
Expected: analyzer clean, full suite green.

- [ ] **Step 6: Commit**

```bash
git add parent-app/lib/src/screens/home_shell.dart parent-app/test/screens/home_shell_test.dart
git commit -m "feat(parent-app): register device token on login, resume-polling stopgap, push-tap deep link"
```

---

### Task 10: Docs — update the roadmap checklist and `PROJECT-STATUS.md`

**Files:**
- Modify: `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`
- Modify: `build/PROJECT-STATUS.md`

Per [[roadmap-checklist-convention]] — the roadmap's own Implementation Checklist and
`PROJECT-STATUS.md` are both updated whenever a sprint ships (verified, not just merged), not just
one of the two.

- [ ] **Step 1: Check Sprint F's box and sub-items in the roadmap**

Edit `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md` — replace the Sprint F block
(currently at line 74) with (fill in the actual merge commit range once Task 1-9 are committed and
merged — do not leave a placeholder in the final edit):

```markdown
- [x] **Sprint F — Push Notifications, Both Clients (Phase 3)** — merged to `main` <DATE>
      (`<START_SHA>..<END_SHA>`)
  - [x] `NotificationDispatchService` (backend, consumed by diary/circulars/messages write paths)
    — already existed as `NotificationsService` (built ahead of schedule in Sprint 7-8); this
    sprint added the real `FcmPushAdapter` behind its existing `PushAdapter` seam, selected
    automatically when `FIREBASE_PROJECT_ID`/`CLIENT_EMAIL`/`PRIVATE_KEY` are configured, falling
    back to the existing `LoggingPushAdapter` otherwise (same pattern as JazzCash/EasyPaisa's
    stub fallback in Sprint E).
  - [x] FCM integration on Flutter (`firebase_messaging`/`firebase_core`) — added to
    `pubspec.yaml`; `PushTokenProvider`/`DeviceTokenRegistrar` wired into `HomeShell`, with
    graceful degradation to no-push (not a crash) since no real Firebase project exists yet
    (`lib/firebase_options.dart` is a placeholder — see PROJECT-STATUS.md for what replacing it
    requires). **Not verified against a real Firebase project or a physical/emulated Android
    device** — no Android emulator/Windows Flutter toolchain in this dev environment (same
    constraint noted in Sprint C prep), and no real Firebase project exists; blocked on Firebase
    project creation, not an engineering gap. Mirrors Sprint E's "not verified against a live
    sandbox" JazzCash/EasyPaisa precedent.
  - [x] `POST /me/device-tokens` registration endpoint — new, e2e-tested, upserts by token so a
    device moving between accounts (logout/login) doesn't leave a stale mapping.
  - [x] Interim foreground-resume polling stopgap — shipped independently of live FCM
    verification, per the roadmap's own note that it "can ship independently of full FCM";
    `HomeShell` re-fetches notification/circular counts on `AppLifecycleState.resumed`.
  - Plan: `docs/superpowers/plans/2026-09-11-sprint-f-push-notifications.md`. Verified: backend
    <N> unit + <N> e2e tests, parent-app `flutter analyze`/`flutter test` clean — <N> new
    unit/widget test cases across `fcm-config`, `FcmPushAdapter`, `MeService`/`me.e2e-spec`,
    `ApiClient.registerDeviceToken`, `notification_target`, `DeviceTokenRegistrar`, and
    `HomeShell`'s registration/resume-polling/push-tap behavior.
```

- [ ] **Step 2: Add the Sprint F section to `PROJECT-STATUS.md`**

Edit `build/PROJECT-STATUS.md` — insert a new `## Sprint F — Push Notifications, Both Clients
(Phase 3) ✅ DONE` section between the existing `## Sprint E — Payment Gateway & Local Rails (Phase
2) ✅ DONE` section and `## Sprint 11-12 — Hardening + Pilot ⏳ PENDING`, following the same prose
structure (goal, what shipped, what's verified, what's explicitly not verified and why) already
used in the Sprint E section immediately above it. Include, at minimum: the `NotificationsService`
pre-existence finding (so a future reader doesn't re-propose building a "NotificationDispatchService"
from scratch), the FCM-adapter-selection mechanism, the `/me/device-tokens` endpoint, the
foreground-resume stopgap, and the explicit "no real Firebase project / no Android emulator in this
dev environment, so live push delivery is unverified" caveat with a pointer to what unblocks it
(create a real Firebase project, run `flutterfire configure` to replace `lib/firebase_options.dart`,
set the three `FIREBASE_*` env vars in a real deployment).

- [ ] **Step 3: Commit**

```bash
git add docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md PROJECT-STATUS.md
git commit -m "docs: mark Sprint F done in the roadmap checklist and PROJECT-STATUS.md"
```

---

## Self-Review Notes (for whoever executes this plan)

- **Spec coverage:** All four Sprint F bullet items from the roadmap (`NotificationDispatchService`
  → Tasks 3-4; FCM on Flutter → Tasks 6-9; `POST /me/device-tokens` → Task 1; foreground-resume
  polling stopgap → Task 9) are covered, plus the roadmap's "Security" note (FCM server key never
  committed → Task 4's `.env.example`-only documentation) and its "Testing" note (automated
  token-registration test at minimum → Tasks 1/5/7/9's test coverage; manual device-matrix testing
  is explicitly out of reach in this dev environment and flagged as such, not silently skipped).
- **Known gap, deliberately scoped out:** `getInitialMessage()` (a cold-start deep link when the
  app was fully terminated, not just backgrounded) is not wired — only `onMessageOpenedApp`
  (background-to-foreground tap) is. This still satisfies the roadmap's Definition of Done
  ("triggers a real push notification... within a few seconds") and the more common tap case;
  note it as a follow-up in Task 10's `PROJECT-STATUS.md` write-up rather than silently omitting
  it from the record.
- Run each task's tests in order — later tasks' widget tests (Task 9) depend on Task 7/8's
  `DeviceTokenRegistrar` plumbing existing first.

---

## Execution Handoff

Two execution options:

**1. Subagent-Driven (recommended)** — a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using `executing-plans`, batch execution
with checkpoints.
