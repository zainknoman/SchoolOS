# Sprint H — Communication Depth: WhatsApp, SMS, Digest Bundling (Phase 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach parents on the channel they actually check (WhatsApp/SMS, not just in-app/push),
and stop overwhelming them with individual pings by adding an opt-in digest mode — the
Pakistan-specific gap the competitor research names as unmatched by any of the ten global leaders
reviewed.

**Reconciliation with the roadmap doc, found during planning, not assumed:** the roadmap's Sprint H
section names `NotificationDispatchService` as the abstraction to extend. That class doesn't exist
under that name — `NotificationsService` (`backend/src/notifications/notifications.service.ts`) is
the actual single dispatch point every diary/circular/message write path already calls through
(confirmed present since Sprint 7-8, extended with real push in Sprint F). This sprint extends
`NotificationsService`, not a rename.

**Architecture:** `NotificationsService.notify()` currently always calls one injected `PUSH_ADAPTER`.
This sprint makes it channel-aware: it looks up the target user's `notificationChannel` preference
and calls the matching adapter from a small registry, instead of a single injected adapter.
`WhatsAppAdapter`/`SmsAdapter` implement the *same* `PushAdapter` interface Sprint F's `FcmPushAdapter`
already implements (`send(userId, payload): Promise<void>`) — no new adapter interface, per the
roadmap's own "interchangeable delivery channels off one dispatch point" instruction. Each is backed
by a thin sender seam (`WhatsAppSender`/`SmsSender`, mirroring `AdminFcmSender`) and a
`resolveWhatsAppConfig`/`resolveSmsConfig` pair mirroring `resolveFirebaseConfig`'s exact shape:
unset entirely → falls back to the existing channel-agnostic `LoggingPushAdapter`; partial config
outside dev/test → fails loudly at boot. Digest bundling reuses the existing `Notification` table
(adds one nullable `dispatchedAt` column) rather than a new queue table — a digest-enabled user's
`notify()` call still writes the row immediately (so in-app "Notifications" list is unaffected) but
skips the immediate `send()`; a new `@Cron` job (`DigestDispatchJob`) periodically bundles each
digest-enabled user's undispatched rows into one `send()` call and stamps them dispatched. This is
the same "no job runner exists yet, don't solve it twice" gap Sprint E's PROPOSED-architecture note
flagged — `@nestjs/schedule`'s `@Cron` (already a project dependency after Sprint E's evaluation, or
added fresh here if not) is the job runner for both Sprint E's future needs and this one.

**Tech Stack:** NestJS backend (all-new work) + a one-field settings addition on each client
(channel dropdown + digest checkbox) — no new client architecture.

**Spec:** `docs/Plan-Ideas/SchoolPortal-PostMVP-Roadmap-2026-09-08.md`, Sprint H section (§4, "Sprint
H — Communication Depth: WhatsApp, SMS, Digest Bundling (Phase 4)").

## Global Constraints

- **WhatsApp/SMS only resolve a destination for the `PARENT` role in this sprint.** Verified against
  the current schema before assuming otherwise: `ParentProfile.phone` (`prisma/schema.prisma`) is the
  *only* phone-number field anywhere on `User`/`TeacherProfile`/`AdminProfile`. A non-parent user with
  `notificationChannel` set to `WHATSAPP`/`SMS` has no number to send to — `WhatsAppAdapter`/`SmsAdapter`
  treat "no resolvable phone number" as a no-op (matching `FcmPushAdapter`'s existing "no DeviceToken
  rows → no-op" precedent), not an error. The settings UI only offers the WhatsApp/SMS options to
  parent accounts.
- **No real WhatsApp Business/SMS gateway credentials exist in this environment**, matching Sprint
  E's JazzCash/EasyPaisa and Sprint F's Firebase precedent exactly — both adapters are built to their
  providers' real API contracts but **not verified against a live sandbox**. `resolveWhatsAppConfig`/
  `resolveSmsConfig` unset entirely (the expected state here) falls back to `LoggingPushAdapter`, so
  nothing regresses; this is a documented, not silent, gap.
- **Digest bundling changes `notify()`'s side effect, not its return contract or the in-app
  `Notification` row.** A digest-enabled user still sees the notification immediately in the
  `NotificationsSheet`/bottom-nav badge (unchanged `Notification` write) — only the push/WhatsApp/SMS
  *send* is deferred and bundled. Don't couple digest mode to in-app visibility.
- **Reuse `@nestjs/schedule`'s `@Cron` if it's already a dependency; add it fresh (same pattern as
  every other `@nestjs/*` module already in this codebase) if it isn't** — check `backend/package.json`
  in Task 3 Step 1 before assuming either way.
- No new state-management pattern on either client — a channel dropdown + checkbox reads/writes
  through the same `ApiClient`/staff-console API-client pattern every other settings-style call uses.

---

## File Structure

- `backend/prisma/schema.prisma` (modify) — `NotificationChannel` enum; `User.notificationChannel`
  + `User.digestEnabled`; `Notification.dispatchedAt`.
- `backend/prisma/migrations/*` (new, via `prisma migrate dev`).
- `backend/src/notifications/whatsapp-sender.ts` (new) — thin seam over the WhatsApp Business Cloud
  API (`POST https://graph.facebook.com/v.../messages`), mirroring `fcm-sender.ts`'s shape.
- `backend/src/notifications/whatsapp-config.ts` (new) — `resolveWhatsAppConfig`, mirrors
  `fcm-config.ts`.
- `backend/src/notifications/whatsapp.adapter.ts` (new) — `WhatsAppAdapter implements PushAdapter`.
- `backend/src/notifications/sms-sender.ts` (new) — thin seam over a generic HTTP SMS gateway (field
  names left `// TODO: confirm` against the actual chosen Pakistani provider, mirroring Sprint E's
  EasyPaisa precedent for an unconfirmed field list).
- `backend/src/notifications/sms-config.ts` (new) — `resolveSmsConfig`, mirrors `fcm-config.ts`.
- `backend/src/notifications/sms.adapter.ts` (new) — `SmsAdapter implements PushAdapter`.
- `backend/src/notifications/channel-registry.ts` (new) — maps `NotificationChannel` → the right
  `PushAdapter` instance; used by `NotificationsService` instead of a single injected adapter.
- `backend/src/notifications/notifications.service.ts` (modify) — channel-aware `notify()`; skip
  immediate send + leave `dispatchedAt: null` when the target user has `digestEnabled`.
- `backend/src/notifications/digest-dispatch.job.ts` (new) — `@Cron` job, bundles + dispatches.
- `backend/src/notifications/notifications.module.ts` (modify) — register the two new adapters +
  the registry + the cron job; add `ScheduleModule.forRoot()` if not already present at the app root.
- `backend/src/me/dto/update-notification-preferences.dto.ts` (new).
- `backend/src/me/me.controller.ts` (modify) — `PATCH /api/v1/me/notification-preferences`.
- `backend/src/me/me.service.ts` (modify) — `updateNotificationPreferences`.
- Test files: one unit-test file per new adapter/config/registry/job; e2e coverage for the new PATCH
  endpoint and a digest-window integration test (multiple `notify()` calls bundled into one send).
- `staff-console/src/views/...` — N/A this sprint (WhatsApp/SMS is parent-only per the Global
  Constraints above; staff already only use in-app + push).
- `parent-app/lib/src/screens/more_tab.dart` (modify) — add a "Notifications" settings section
  (channel dropdown: Push/WhatsApp/SMS; digest checkbox) below the existing Appearance card, calling
  the new endpoint via `ApiClient`.
- `parent-app/lib/src/api/api_client.dart` (modify) — `updateNotificationPreferences()`.

---

### Task 1: Schema — `NotificationChannel`, per-user preferences, `dispatchedAt`

**Files:**
- Modify: `backend/prisma/schema.prisma`
- New: migration

- [ ] **Step 1:** Add to `schema.prisma`:
  ```prisma
  enum NotificationChannel {
    PUSH
    WHATSAPP
    SMS
  }
  ```
  On `model User`: `notificationChannel NotificationChannel @default(PUSH)` and
  `digestEnabled Boolean @default(false)`.
  On `model Notification`: `dispatchedAt DateTime?`.
- [ ] **Step 2:** Run `npx prisma migrate dev --name notification_channel_preferences` (additive
  only — every new field has a default/is nullable, so no backfill migration is needed).
- [ ] **Step 3:** Run `npm run build` to confirm the generated Prisma client compiles against
  existing call sites (it will — nothing consumes these fields yet).
- [ ] **Step 4: Commit**
  ```bash
  git add backend/prisma/schema.prisma backend/prisma/migrations
  git commit -m "feat(backend): add NotificationChannel, per-user channel/digest preferences, Notification.dispatchedAt"
  ```

---

### Task 2: `WhatsAppAdapter` and `SmsAdapter` behind `PushAdapter`

**Files:**
- New: `backend/src/notifications/whatsapp-sender.ts`, `whatsapp-config.ts`, `whatsapp.adapter.ts`
- New: `backend/src/notifications/sms-sender.ts`, `sms-config.ts`, `sms.adapter.ts`
- Test: one unit-test file per adapter + config resolver (4 new files), following
  `fcm-push.adapter.spec.ts`/`fcm-config.spec.ts`'s existing structure as the pattern to copy.

**Interfaces:**
- Produces: `WhatsAppAdapter implements PushAdapter`, `SmsAdapter implements PushAdapter` — both
  resolve the target user's `ParentProfile.phone` via Prisma before sending; no-op (not throw) when
  the user has no linked `ParentProfile` or no `phone` on file.
- `resolveWhatsAppConfig(config): WhatsAppConfig | undefined`, `resolveSmsConfig(config): SmsConfig |
  undefined` — same all-or-nothing + dev/test-carve-out contract as `resolveFirebaseConfig`.

- [ ] **Step 1:** Write failing unit tests for `resolveWhatsAppConfig`/`resolveSmsConfig` (unset →
  `undefined`; fully set → the config object; partial outside dev/test → throws; partial inside
  dev/test → `undefined`) — copy `fcm-config.spec.ts` structure, swap env var names
  (`WHATSAPP_BUSINESS_PHONE_ID`/`WHATSAPP_ACCESS_TOKEN`; `SMS_GATEWAY_API_KEY`/`SMS_GATEWAY_SENDER_ID`
  — confirm exact field names against whichever gateway is actually contracted before this task
  starts; treat as `// TODO: confirm` until then, matching Sprint E's EasyPaisa precedent).
- [ ] **Step 2:** Implement both config resolvers. Run tests, confirm pass.
- [ ] **Step 3:** Write failing unit tests for `WhatsAppAdapter`/`SmsAdapter`: sends via the injected
  sender when the user has a `ParentProfile.phone`; no-ops (sender never called) when the user has no
  `ParentProfile` or a null `phone`. Mock `PrismaService` and the sender interface.
- [ ] **Step 4:** Implement `WhatsAppSender`/`SmsSender` (thin `fetch`/HTTP-client wrappers over each
  provider's send-message endpoint) and the two adapters consuming them + `PrismaService.parentProfile
  .findUnique({ where: { userId } })` (verify the actual relation name/shape in `schema.prisma`
  before writing this query — `ParentProfile` may be keyed by its own id with a `User` back-relation
  rather than a direct `userId` FK; check `model ParentProfile` before assuming).
- [ ] **Step 5:** Run the full new test file set, confirm pass. Run `npm run build`.
- [ ] **Step 6: Commit**
  ```bash
  git add backend/src/notifications
  git commit -m "feat(backend): add WhatsAppAdapter/SmsAdapter behind the existing PushAdapter interface"
  ```

---

### Task 3: Channel-aware dispatch in `NotificationsService`

**Files:**
- New: `backend/src/notifications/channel-registry.ts`
- Modify: `backend/src/notifications/notifications.service.ts`, `notifications.module.ts`
- Test: modify `notifications.service.spec.ts`

**Interfaces:**
- Produces: a registry (`Map<NotificationChannel, PushAdapter>` behind a small typed wrapper, or a
  factory function `resolveAdapterFor(channel, adapters)`) — consumed by `NotificationsService`.
- Changes: `NotificationsService.notify()` now reads `input.userId`'s `notificationChannel` (a
  `PrismaService.user.findUnique` lookup) before sending, and checks `digestEnabled` to decide
  whether to send immediately or leave `dispatchedAt: null`.

- [ ] **Step 1:** Write failing tests for `notify()`: (a) a user with `notificationChannel: WHATSAPP`
  and `digestEnabled: false` causes the WhatsApp adapter (not push) to receive the `send()` call; (b)
  a user with `digestEnabled: true` causes **no** adapter `send()` call and the created `Notification`
  row has `dispatchedAt: null`; (c) the existing default-push, non-digest behavior from Sprint F is
  unchanged (regression coverage).
- [ ] **Step 2:** Implement the registry + the `notify()` changes. Keep the existing "adapter failure
  must never fail the write" try/catch behavior unchanged around whichever adapter gets picked.
- [ ] **Step 3:** Update `notifications.module.ts` to provide `WHATSAPP_ADAPTER`/`SMS_ADAPTER` tokens
  (same factory-with-config-fallback shape as the existing `PUSH_ADAPTER` provider) and inject the
  registry into `NotificationsService`.
- [ ] **Step 4:** Run `notifications.service.spec.ts`, confirm pass. Run the full backend unit suite
  to catch any other spec that constructs `NotificationsService` directly and now needs the extra
  providers mocked (check `notifications.controller.spec.ts` and anywhere else that imports the
  service in isolation).
- [ ] **Step 5: Commit**
  ```bash
  git add backend/src/notifications
  git commit -m "feat(backend): make NotificationsService.notify() channel-aware, skip immediate send for digest users"
  ```

---

### Task 4: `DigestDispatchJob`

**Files:**
- New: `backend/src/notifications/digest-dispatch.job.ts`
- Modify: `backend/src/notifications/notifications.module.ts` (register the job provider); root
  `AppModule` if `ScheduleModule.forRoot()` isn't already registered anywhere.
- Test: `digest-dispatch.job.spec.ts` (new)

**Interfaces:**
- Produces: `DigestDispatchJob.run()` — `@Cron('*/15 * * * *')` (confirm the actual interval isn't
  specified more precisely elsewhere in the roadmap; 15 minutes is a reasonable default, make it a
  named constant so it's a one-line change later, not a magic string).

- [ ] **Step 1:** Write a failing integration-style test: seed two undispatched `Notification` rows
  for the same digest-enabled user (different `type`s), run `job.run()`, assert exactly one adapter
  `send()` call with a body that mentions both, and both rows now have `dispatchedAt` set. A second
  test: a non-digest user's rows (already dispatched immediately by `notify()`) are untouched by the
  job (query excludes rows with `dispatchedAt` already set, which is every non-digest row).
- [ ] **Step 2:** Implement `DigestDispatchJob`: query `Notification.findMany({ where: { dispatchedAt:
  null, user: { digestEnabled: true } } })`, group by `userId`, build one bundled title/body per user
  (e.g. "You have 3 new updates: …"), resolve that user's channel adapter via the same registry Task 3
  built, call `send()` once per user, then `updateMany` the included row ids' `dispatchedAt`.
- [ ] **Step 3:** Wire `ScheduleModule.forRoot()` into `AppModule` if not already present (check first
  — Sprint E's PROPOSED note flagged this gap but may not have been resolved yet).
- [ ] **Step 4:** Run the new test file, confirm pass. Run the full backend suite.
- [ ] **Step 5: Commit**
  ```bash
  git add backend/src/notifications backend/src/app.module.ts
  git commit -m "feat(backend): add DigestDispatchJob bundling undispatched notifications per digest-enabled user"
  ```

---

### Task 5: `PATCH /api/v1/me/notification-preferences`

**Files:**
- New: `backend/src/me/dto/update-notification-preferences.dto.ts`
- Modify: `backend/src/me/me.controller.ts`, `backend/src/me/me.service.ts`
- Test: modify `me.e2e-spec.ts` (mirror the existing `POST /me/device-tokens` e2e case — including
  Sprint F's own catch: confirm this test app's `beforeAll` still wires `ValidationPipe`, don't
  reintroduce that inert-validation gap).

**Interfaces:**
- Produces: `PATCH /api/v1/me/notification-preferences` — body `{ channel: NotificationChannel,
  digestEnabled: boolean }`, both optional (partial update), auth-scoped to the calling user only.

- [ ] **Step 1:** Write failing e2e tests: valid update persists both fields; invalid `channel` value
  rejected by `@IsIn` (proving `ValidationPipe` is actually active in the test app, not just assumed);
  a parent user setting `channel: WHATSAPP` with no `ParentProfile.phone` on file still succeeds (the
  no-op behavior lives in the adapter, not the preference write).
- [ ] **Step 2:** Implement the DTO (`@IsIn(['PUSH','WHATSAPP','SMS']) @IsOptional() channel?`;
  `@IsBoolean() @IsOptional() digestEnabled?`), controller method, and
  `MeService.updateNotificationPreferences(userId, dto)` (a `prisma.user.update` with only the
  provided fields).
- [ ] **Step 3:** Run the e2e suite, confirm pass.
- [ ] **Step 4: Commit**
  ```bash
  git add backend/src/me
  git commit -m "feat(backend): add PATCH /me/notification-preferences"
  ```

---

### Task 6: Parent-app settings UI

**Files:**
- Modify: `parent-app/lib/src/api/api_client.dart`, `parent-app/lib/src/screens/more_tab.dart`
- Test: modify `parent-app/test/screens/more_tab_test.dart`

**Interfaces:**
- Produces: `ApiClient.updateNotificationPreferences({String? channel, bool? digestEnabled})`.

- [ ] **Step 1:** Write a failing widget test: a new "Notifications" card in `MoreTab` (below
  Appearance) with a channel dropdown (Push/WhatsApp/SMS) and a digest checkbox; changing either
  calls the API with the right body.
- [ ] **Step 2:** Add `ApiClient.updateNotificationPreferences`, following the exact shape of an
  existing simple-PATCH `ApiClient` method (e.g. whichever leave/fees method already does a bodied
  PATCH/POST — copy its error handling, don't reinvent it).
- [ ] **Step 3:** Add the card to `MoreTab`, wired the same way the existing Appearance
  `DropdownButton` is (local state seeded from whatever `MoreTab` is passed — check whether current
  preferences need to be fetched on mount or passed in from `HomeShell`, matching how `activeChildId`
  is already threaded).
- [ ] **Step 4:** Run `flutter test test/screens/more_tab_test.dart`, confirm pass. Run
  `flutter analyze && flutter test` (full suite) to confirm nothing else regressed.
- [ ] **Step 5: Commit**
  ```bash
  git add parent-app/lib/src/api/api_client.dart parent-app/lib/src/screens/more_tab.dart parent-app/test/screens/more_tab_test.dart
  git commit -m "feat(parent-app): add channel/digest notification preferences to More"
  ```

---

## Definition of Done (from the roadmap)

- A test circular reaches a WhatsApp number and an SMS number (or, absent real sandbox credentials
  in this environment, reaches `LoggingPushAdapter`'s log output with the correctly-resolved
  recipient phone number and message body — same "structurally complete, not live-verified" bar
  Sprints E and F shipped at).
- A parent with digest mode enabled gets one bundled message instead of three separate ones within
  the configured window (Task 4's integration test proves this directly).
- Verify at the end: full backend unit + e2e suites green, `npm run build` clean, lint clean on every
  touched file; parent-app `flutter analyze` clean and full `flutter test` suite passing. Note any
  "not live-verified" gaps explicitly in the closing `PROJECT-STATUS.md`/roadmap entries, per this
  repo's established pattern (Sprints C, E, F).
