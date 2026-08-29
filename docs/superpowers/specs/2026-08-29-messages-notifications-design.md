# Sprint 7-8 — Messages + Notifications (FEAT-010, FEAT-011)

Status: approved, ready for implementation planning.
Spec source: `Seeds/apk/MVP-Plan-V3.md` → `plan/docs/FEATURES.txt` (FEAT-010, FEAT-011 — now fully
detailed there, matching the FEAT-001..005 format).

## Goal

- **FEAT-010 (Messages):** a parent can start a two-way conversation with only their child's Class
  Teacher, School Admin, Accounts, or the Principal — never any other staff member — enforced
  server-side. Staff can reply to conversations addressed to them; search/filter the inbox.
- **FEAT-011 (Notifications):** an in-app notification center (bell icon, both clients) surfaces new
  diary entries, circulars, and messages, and deep-links to the right screen. Real push delivery is
  stubbed behind a swappable adapter — no Firebase project exists yet (tracked for Sprint 11-12).

## Data model changes

- `User`: add `isPrincipal Boolean @default(false)`. Flags which `SCHOOL_ADMIN` account is the
  Principal recipient for Messages. No separate `PRINCIPAL` role — Principal is a distinction within
  `SCHOOL_ADMIN`, not a new value in the `Role` enum.
- `Section`: add `classTeacherId String?` + `classTeacher Teacher? @relation(fields: [classTeacherId], references: [id], onDelete: SetNull)`.
  This is a new homeroom/class-teacher designation, distinct from the per-subject teachers already
  assigned via `Timetable` rows (a section can have several `Timetable` teachers but at most one
  class teacher). Needed because Messages must route "Class Teacher" to exactly one person.
- Replace the FEAT-001 placeholder `Message`/`MessageRecipient` (shaped for one-shot broadcast, same
  as `Circular`) with a real two-party thread:
  ```
  enum ConversationRecipientType {
    CLASS_TEACHER
    SCHOOL_ADMIN
    ACCOUNTS
    PRINCIPAL
  }

  model Conversation {
    id            String   @id @default(uuid())
    parentUserId  String
    parentUser    User     @relation("ConversationParent", fields: [parentUserId], references: [id], onDelete: Cascade)
    staffUserId   String
    staffUser     User     @relation("ConversationStaff", fields: [staffUserId], references: [id], onDelete: Cascade)
    recipientType ConversationRecipientType
    studentId     String?
    student       Student? @relation(fields: [studentId], references: [id], onDelete: SetNull)
    messages      Message[]
    parentReadAt  DateTime?
    staffReadAt   DateTime?
    lastMessageAt DateTime @default(now())
    createdAt     DateTime @default(now())

    @@index([parentUserId])
    @@index([staffUserId])
  }

  model Message {
    id             String       @id @default(uuid())
    conversationId String
    conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
    senderId       String
    sender         User         @relation(fields: [senderId], references: [id])
    body           String
    createdAt      DateTime     @default(now())

    @@index([conversationId])
  }
  ```
  `studentId` is required only when `recipientType == CLASS_TEACHER`. `staffUserId` is resolved
  **once**, at creation time, and is the only user who can reply — not a shared team inbox. This is a
  deliberate simplification: this is a single-school system (Sprint 6.5 already accepts equivalent
  single-admin assumptions elsewhere), and today's seed has exactly one `SCHOOL_ADMIN` and one
  `ACCOUNTS` user. **Follow-up (tracked, not blocking):** if the admin/accounts roster ever grows past
  one person per role, conversations created before the second hire won't be visible to the new hire —
  revisit with a real team-inbox model then.
- `Notification` (exists since FEAT-001, unused until now) becomes the backing table for both
  in-app notification centers. `type` ∈ `"diary" | "circular" | "message"`; `entityRef` holds the
  diary entry id / circular id / conversation id for deep-linking.
- One new Prisma migration. Update `prisma/seed.ts`: set a `classTeacherId` on the seeded section, add
  one sample `Conversation` (with a reply) and one sample `Notification` per role — the same
  "never regress to looks-blank-but-isn't-broken" discipline as every prior sprint's seed update.

## Push delivery abstraction

A `PushAdapter` interface — `send(userId, { title, body, data }): Promise<void>` — with a
logging/no-op implementation for this sprint. `NotificationsService.notify(...)` writes the
`Notification` row first, then calls `PushAdapter.send()`; a thrown/rejected send is caught and
logged, never allowed to fail or roll back the triggering write (diary/circular/message creation
must succeed regardless of notification delivery). Swapping in a real FCM-backed implementation
later — once a Firebase project exists — is a one-file change behind the same interface, matching
the `StorageAdapter` pattern from Sprint 5-6.

## Backend API

New NestJS modules, following the existing `attendance`/`diary` module shape (controller + service +
DTOs, `@Roles()` guards, audit-logged writes).

**Messages module:**
- `POST /api/v1/conversations` — `@Roles('PARENT')` — `{ recipientType, studentId?, body }`.
  `studentId` ownership is checked via the existing `StudentAccessService`. Resolves `staffUserId`:
  `CLASS_TEACHER` → the student's active-`Enrollment` section's `classTeacherId` (400 if unset);
  `SCHOOL_ADMIN`/`ACCOUNTS` → the `User` with that role and the earliest `createdAt` (400 if none
  exist); `PRINCIPAL` → the `User` with `isPrincipal = true` and the earliest `createdAt` (400 if none
  flagged) — a deterministic tie-break, since today's seed has exactly one of each anyway. Creates the
  `Conversation` + first `Message`, fires a `Notification` for `staffUserId`.
- `GET /api/v1/conversations?q=` — any authenticated role. A parent gets conversations where they're
  `parentUserId`; staff gets ones where they're `staffUserId`. `q` searches participant name + message
  body.
- `GET /api/v1/conversations/:id` — ownership-checked (caller must be `parentUserId` or `staffUserId`),
  returns messages ordered by `createdAt`.
- `POST /api/v1/conversations/:id/messages` — ownership-checked, `{ body }`, appends a `Message`,
  bumps `lastMessageAt`, fires a `Notification` for the other party. A staff token that is not the
  conversation's `staffUserId` gets 403 — no reply-on-behalf, and no staff-initiated new
  conversations this sprint (creation is `PARENT`-only, above).
- `POST /api/v1/conversations/:id/read` — ownership-checked, sets the caller's own read timestamp
  (`parentReadAt` or `staffReadAt` depending on which side the caller is).

**Notifications module:**
- `GET /api/v1/notifications` — any authenticated role, own rows only, newest first.
- `POST /api/v1/notifications/:id/read` — ownership-checked.
- `POST /api/v1/notifications/read-all` — marks all of the caller's unread rows as read.
- Internal `NotificationsService.notify(userId, { type, title, body, entityRef })`, called from
  `DiaryService.create`, `CircularsService.publish` (once per `CircularRecipient` row), and both
  Messages-module write paths above.

Every write (`conversation.create`, `message.send`, `notification.read`) gets an `AuditLog` row,
matching the existing convention.

## Client UI

**Staff console (Vue):**
- `MessagesView.vue` — conversation list (search box) + thread view + reply box, following
  `AttendanceView.vue`/`DiaryView.vue`'s layout conventions. Routed at `/teacher/messages` and
  `/admin/messages`.
- `AppShell.vue`'s placeholder `nav-messages` link (`<a href="#">`, teacher-only today) becomes a real
  `RouterLink`; an equivalent Messages link is added to the admin nav (not present today).
- `AppShell.vue`'s placeholder notification bell (`data-testid="notifications"`, currently inert)
  becomes a real dropdown backed by `GET /notifications` — unread-count badge, click-to-mark-read,
  click-to-navigate to the relevant screen (Diary/Circulars/Messages).

**Parent app (Flutter):**
- The Messages bottom-nav tab (index 3, currently a placeholder per `home_shell.dart`) gets a
  conversation list + new-conversation flow (recipient-type picker; a child picker appears only for
  Class Teacher) + thread view, following `calendar_tab.dart`'s fetch-and-list pattern.
- A new bell icon is added to `HomeShell`'s `AppBar` (mirroring the staff console), opening a
  notification list with the same deep-link behavior. The existing Circulars tab (which already
  occupies the bottom nav's "Notifications" slot per Sprint 5-6) is left completely unchanged — this
  is an additive, separate entry point, not a rework.

## Testing & rollout

Same rigor as prior sprints, TDD throughout:
- Backend: one `*.service.spec.ts` per new service (mocked `PrismaService`) + e2e tests for the
  authorization boundaries — a parent can't read/reply into another parent's conversation; staff can't
  reply to a conversation they're not `staffUserId` on; a TEACHER/SCHOOL_ADMIN/ACCOUNTS token can't
  create a new conversation; `CLASS_TEACHER` resolution with no `classTeacherId` set returns a clean
  4xx; `GET /notifications` never leaks another user's rows.
- Staff console: one component spec for `MessagesView.vue`, updated `AppShell.spec.ts` coverage for
  the bell dropdown and the new admin nav link.
- Parent app: one widget test for the Messages tab, one for the new bell/notification list.
- `prisma/seed.ts`: set the seeded section's `classTeacherId`, add one sample conversation (with a
  reply) and one sample notification per seeded role.
