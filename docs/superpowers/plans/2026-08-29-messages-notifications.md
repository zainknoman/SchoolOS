# Messages + Notifications (FEAT-010, FEAT-011) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two-party parent↔staff message threads (Class Teacher/Admin/Accounts/Principal, parent-initiated only) and an in-app notification center (bell icon, both clients) for diary/circular/message events, with push delivery behind a no-op adapter pending a real Firebase project.

**Architecture:** Two new backend feature modules (`notifications`, `messages`) following the existing `attendance`/`diary` module shape — controller + service + DTO, `@Roles()` guards where needed (global `PARENT`-only vs any-authenticated split via omitted `@Roles`), `EnrollmentService` for section resolution, audit-logged writes. `NotificationsService` is called from `DiaryService`, `CircularsService`, and the new `ConversationsService` on every create/reply. Both clients get a new Messages screen (staff: inbox+reply; parent: inbox+compose+reply) plus a bell/notification-center UI element.

**Tech Stack:** NestJS + Prisma (SQLite dev) + class-validator + Jest/Supertest; Vue 3 + Pinia + Vitest/@vue/test-utils; Flutter + Provider + `flutter_test`.

**Spec:** `docs/superpowers/specs/2026-08-29-messages-notifications-design.md`

## Global Constraints

- Every write endpoint creates an `AuditLog` row (`diary.create`/`circular.publish` precedent) — `conversation.create` and `message.send` follow this.
- `NotificationsService.notify()` writes the `Notification` row first, then calls the injected `PushAdapter.send()` inside a try/catch — a thrown/rejected send is logged and swallowed, never allowed to fail the triggering write.
- A parent may only create a conversation with `CLASS_TEACHER` (resolved via the target student's active enrollment → `Section.classTeacherId`), `SCHOOL_ADMIN`, `ACCOUNTS`, or `PRINCIPAL` (`User.isPrincipal = true`) — never any other staff member.
- `staffUserId` on a `Conversation` is resolved once at creation (earliest-`createdAt` tie-break for `SCHOOL_ADMIN`/`ACCOUNTS`/`PRINCIPAL`) and is the only user who may reply — no shared team inbox this sprint.
- Staff can reply to conversations they're already a party to but cannot create a new one to a parent — enforced server-side (`@Roles('PARENT')` on the create endpoint), not just absent from a client's UI.
- `Section.classTeacherId` is set only via `prisma/seed.ts` this sprint — there is no admin UI for assigning it (matches the existing precedent that Timetable rows are also seed-only, no creation UI yet).

---

## Task 1: Schema migration + seed data

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/prisma/seed.ts`

**Interfaces:**
- Produces: `User.isPrincipal`, `Section.classTeacherId`, `ConversationRecipientType` enum, `Conversation`/`Message` models (replacing the old placeholder `Message`/`MessageRecipient`) — every later backend task reads/writes these.

- [ ] **Step 1: Edit `schema.prisma` — add `isPrincipal` to `User`**

Add the field (next to `isLocked`):

```prisma
  isLocked     Boolean  @default(false)
  isPrincipal  Boolean  @default(false)
```

Replace the `User` model's relation block (everything from `sentMessages` down to the `@@index`) with:

```prisma
  circularsCreated Circular[]        @relation("CircularAuthor")
  circularRecipients CircularRecipient[]
  diaryEntriesAuthored DiaryEntry[]
  conversationsAsParent Conversation[] @relation("ConversationParent")
  conversationsAsStaff  Conversation[] @relation("ConversationStaff")
  messagesSent          Message[]      @relation("MessageSender")

  @@index([role])
```

- [ ] **Step 2: Add `classTeacherId` to `Section`, back-relation on `Teacher`**

In `model Section`, add (next to `timetables`):

```prisma
  classTeacherId String?
  classTeacher   Teacher?     @relation(fields: [classTeacherId], references: [id], onDelete: SetNull)
```

In `model Teacher`, add a back-relation (next to `timetables`):

```prisma
  classTeacherOfSections Section[]
```

- [ ] **Step 3: Add a `conversations` back-relation on `Student`**

In `model Student`, add (next to `leaveRequests`):

```prisma
  conversations   Conversation[]
```

- [ ] **Step 4: Replace `Message`/`MessageRecipient` with `Conversation`/`Message`**

Delete the current `model Message { ... }` and `model MessageRecipient { ... }` blocks entirely, and replace them with:

```prisma
enum ConversationRecipientType {
  CLASS_TEACHER
  SCHOOL_ADMIN
  ACCOUNTS
  PRINCIPAL
}

model Conversation {
  id            String                    @id @default(uuid())
  parentUserId  String
  parentUser    User                      @relation("ConversationParent", fields: [parentUserId], references: [id], onDelete: Cascade)
  staffUserId   String
  staffUser     User                      @relation("ConversationStaff", fields: [staffUserId], references: [id], onDelete: Cascade)
  recipientType ConversationRecipientType
  studentId     String?
  student       Student?                  @relation(fields: [studentId], references: [id], onDelete: SetNull)
  messages      Message[]
  parentReadAt  DateTime?
  staffReadAt   DateTime?
  lastMessageAt DateTime                  @default(now())
  createdAt     DateTime                  @default(now())

  @@index([parentUserId])
  @@index([staffUserId])
}

model Message {
  id             String       @id @default(uuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String
  sender         User         @relation("MessageSender", fields: [senderId], references: [id])
  body           String
  createdAt      DateTime     @default(now())

  @@index([conversationId])
}
```

Add the enum near the other enums at the top of the file (next to `EnrollmentStatus`), and place `Conversation`/`Message` where `Message`/`MessageRecipient` used to sit (just before `model Notification`).

The `Notification` model needs no schema change — it already has every field this sprint needs (`type`, `title`, `body`, `entityRef`, `readAt`).

- [ ] **Step 5: Reset and re-migrate the dev database**

The old `Message`/`MessageRecipient` tables are empty (never used by any endpoint), so this is safe — no data migration concern.

```bash
cd backend
rm -f prisma/dev.db
npx prisma migrate dev --name messages_notifications
```

Expected: a new migration folder under `prisma/migrations/`, `dev.db` recreated, "Your database is now in sync with your schema."

- [ ] **Step 6: Add an ACCOUNTS-role staff user, mark the admin as Principal, set the class teacher**

FEAT-010 needs a real `SCHOOL_ADMIN`, `ACCOUNTS`, and `PRINCIPAL` target to test against — today's seed only has one `SCHOOL_ADMIN`. Edit `seed.ts`:

Change the admin creation to also flag `isPrincipal` (the single admin doubles as Principal — same single-staff-per-role tolerance as the rest of this design):

```ts
  const adminUser = await prisma.user.create({
    data: {
      identifier: 'admin@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'SCHOOL_ADMIN',
      isPrincipal: true,
    },
  });
```

Right after that block, add a new accounts user:

```ts
  const accountsUser = await prisma.user.create({
    data: {
      identifier: 'accounts@seeds.edu.pk',
      passwordHash: await argon2.hash('ChangeMe123!'),
      role: 'ACCOUNTS',
    },
  });
```

After `section3A` and `teacher` both exist (i.e. after the `const teacher = await prisma.teacher.create(...)` line), set the class teacher:

```ts
  await prisma.section.update({
    where: { id: section3A.id },
    data: { classTeacherId: teacher.id },
  });
```

- [ ] **Step 7: Add sample conversation + notifications**

After the circular block (after the `await prisma.circularRecipient.createMany({...})` call), add:

```ts
  // --- Messages: parent A asks the class teacher a question; the teacher replies ---
  const conversation = await prisma.conversation.create({
    data: {
      parentUserId: parentAUser.id,
      staffUserId: teacherUser.id,
      recipientType: 'CLASS_TEACHER',
      studentId: student.id,
      parentReadAt: new Date(),
      messages: {
        create: [{ senderId: parentAUser.id, body: 'Hi, can Eshaal get extra homework in Urdu?' }],
      },
    },
  });
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: teacherUser.id,
      body: 'Sure, I will send some extra worksheets this week.',
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date(), staffReadAt: new Date() },
  });

  // --- Notifications: one sample per seeded role, so a fresh dev.db never looks blank ---
  await prisma.notification.createMany({
    data: [
      {
        userId: parentAUser.id,
        type: 'message',
        title: 'New reply from Ms. Sample Teacher',
        body: 'Sure, I will send some extra worksheets this week.',
        entityRef: conversation.id,
      },
      {
        userId: teacherUser.id,
        type: 'message',
        title: 'New message from Parent A',
        body: 'Hi, can Eshaal get extra homework in Urdu?',
        entityRef: conversation.id,
      },
      {
        userId: adminUser.id,
        type: 'circular',
        title: 'Circular published',
        body: 'Parent-Teacher Meeting — September',
        entityRef: circular.id,
      },
    ],
  });
```

Update the final `console.log` to also report this:

```ts
  console.log(
    'Seeded: 1 school, 2 campuses, 1 class/section, 1 teacher, 1 admin (principal), 1 accounts, ' +
      `1 student, 2 linked parents, ${timetableRows.length} timetable periods, ` +
      `${attendanceDates.length} attendance records, 1 diary entry, 1 circular, 1 conversation ` +
      '(with a reply), 3 notifications.',
  );
```

- [ ] **Step 8: Re-seed and verify**

```bash
npm run prisma:seed
```

Expected: seed script logs the updated summary line with no errors.

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/seed.ts
git commit -m "Add isPrincipal/classTeacherId; replace placeholder Message with Conversation+Message"
```

---

## Task 2: Notifications module (no-op push adapter + service + controller)

**Files:**
- Create: `backend/src/notifications/push-adapter.ts`
- Create: `backend/src/notifications/logging-push.adapter.ts`
- Create: `backend/src/notifications/logging-push.adapter.spec.ts`
- Create: `backend/src/notifications/notifications.service.ts`
- Create: `backend/src/notifications/notifications.service.spec.ts`
- Create: `backend/src/notifications/notifications.controller.ts`
- Create: `backend/src/notifications/notifications.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `PushAdapter` interface (`send(userId, { title, body, data }): Promise<void>`), `PUSH_ADAPTER` token, `NotificationsService.notify({ userId, type, title, body, entityRef? })` — consumed by Task 3 (Messages) and Task 4 (Diary/Circulars wiring). `GET /api/v1/notifications`, `POST /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all` — consumed by both clients (Task 8, 11).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/notifications/logging-push.adapter.spec.ts`:

```ts
import { LoggingPushAdapter } from './logging-push.adapter';

describe('LoggingPushAdapter', () => {
  it('resolves without throwing — this sprint has no real Firebase project to send through', async () => {
    const adapter = new LoggingPushAdapter();
    await expect(
      adapter.send('user-1', { title: 'Hi', body: 'Hello', data: { type: 'message' } }),
    ).resolves.toBeUndefined();
  });
});
```

Create `backend/src/notifications/notifications.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_ADAPTER } from './push-adapter';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: {
    notification: { create: jest.Mock; findMany: jest.Mock; updateMany: jest.Mock };
  };
  let push: { send: jest.Mock };

  beforeEach(async () => {
    prisma = {
      notification: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    };
    push = { send: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: PUSH_ADAPTER, useValue: push },
      ],
    }).compile();
    service = moduleRef.get(NotificationsService);
  });

  it('writes a Notification row and calls the push adapter', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n1' });

    await service.notify({
      userId: 'user-1',
      type: 'message',
      title: 'New message',
      body: 'Hi there',
      entityRef: 'conv-1',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', type: 'message', title: 'New message', body: 'Hi there', entityRef: 'conv-1' },
    });
    expect(push.send).toHaveBeenCalledWith('user-1', {
      title: 'New message',
      body: 'Hi there',
      data: { type: 'message', entityRef: 'conv-1' },
    });
  });

  it('still writes the Notification row and does not throw if the push adapter rejects', async () => {
    prisma.notification.create.mockResolvedValue({ id: 'n1' });
    push.send.mockRejectedValue(new Error('no provider configured'));

    await expect(
      service.notify({ userId: 'user-1', type: 'diary', title: 'x', body: 'y' }),
    ).resolves.toBeUndefined();
    expect(prisma.notification.create).toHaveBeenCalled();
  });

  it("lists a user's own notifications, newest first", async () => {
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'Hi',
        body: 'Hello',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: new Date('2026-08-29T00:00:00.000Z'),
      },
    ]);

    const result = await service.listForUser('user-1');

    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([
      {
        id: 'n1',
        type: 'message',
        title: 'Hi',
        body: 'Hello',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
  });

  it("marking read is scoped to the caller and 404s if it's not theirs", async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 1 });
    await service.markRead('n1', 'user-1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', userId: 'user-1' },
      data: { readAt: expect.any(Date) },
    });

    prisma.notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markRead('n1', 'someone-else')).rejects.toThrow(NotFoundException);
  });

  it('markAllRead only touches the caller\'s unread rows', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    await service.markAllRead('user-1');
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', readAt: null },
      data: { readAt: expect.any(Date) },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx jest src/notifications`
Expected: FAIL — implementation files don't exist yet.

- [ ] **Step 3: Implement**

Create `backend/src/notifications/push-adapter.ts`:

```ts
export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushAdapter {
  send(userId: string, payload: PushPayload): Promise<void>;
}

export const PUSH_ADAPTER = 'PUSH_ADAPTER';
```

Create `backend/src/notifications/logging-push.adapter.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PushAdapter, PushPayload } from './push-adapter';

/**
 * No real Firebase project exists yet (tracked for Sprint 11-12) — this adapter logs what would
 * have been sent and resolves immediately. Swapping in a real FCM-backed implementation later is
 * a one-file change behind the same PushAdapter interface, matching the StorageAdapter pattern.
 */
@Injectable()
export class LoggingPushAdapter implements PushAdapter {
  async send(userId: string, payload: PushPayload): Promise<void> {
    console.log(`[push:noop] would notify user ${userId}:`, payload.title);
  }
}
```

Create `backend/src/notifications/notifications.service.ts`:

```ts
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PUSH_ADAPTER, PushAdapter } from './push-adapter';

export type NotificationType = 'diary' | 'circular' | 'message';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityRef?: string;
}

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  body: string;
  entityRef: string | null;
  readAt: string | null;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_ADAPTER) private readonly push: PushAdapter,
  ) {}

  async notify(input: NotifyInput): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityRef: input.entityRef ?? null,
      },
    });

    try {
      await this.push.send(input.userId, {
        title: input.title,
        body: input.body,
        data: { type: input.type, entityRef: input.entityRef ?? '' },
      });
    } catch (err) {
      // Best-effort — a missing/failed push provider must never fail the write that triggered it
      // (diary/circular/message creation has already succeeded by the time this runs).
      console.error('Push delivery failed', err);
    }
  }

  async listForUser(userId: string): Promise<NotificationSummary[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      entityRef: r.entityRef,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async markRead(notificationId: string, userId: string): Promise<void> {
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
```

Create `backend/src/notifications/notifications.controller.ts`:

```ts
import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { RequestUser } from '../common/student-access.service';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.listForUser(req.user.id);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.notificationsService.markRead(id, req.user.id);
  }

  @Post('read-all')
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notificationsService.markAllRead(req.user.id);
  }
}
```

Create `backend/src/notifications/notifications.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PUSH_ADAPTER } from './push-adapter';
import { LoggingPushAdapter } from './logging-push.adapter';

@Module({
  providers: [
    NotificationsService,
    { provide: PUSH_ADAPTER, useClass: LoggingPushAdapter },
  ],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
```

Modify `backend/src/app.module.ts` — add the import and register it:

```ts
import { NotificationsModule } from './notifications/notifications.module';
```

```ts
    DiaryModule,
    CircularsModule,
    NotificationsModule,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/notifications`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/notifications src/app.module.ts
git commit -m "Add Notifications module: no-op PushAdapter, list/read/read-all"
```

---

## Task 3: Messages module (conversations)

**Files:**
- Create: `backend/src/messages/dto/create-conversation.dto.ts`
- Create: `backend/src/messages/dto/send-message.dto.ts`
- Create: `backend/src/messages/conversations.service.ts`
- Create: `backend/src/messages/conversations.service.spec.ts`
- Create: `backend/src/messages/conversations.controller.ts`
- Create: `backend/src/messages/messages.module.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `EnrollmentService.getCurrentEnrollment` (existing, `../enrollment/enrollment.service`), `NotificationsService.notify` (Task 2).
- Produces: `POST /api/v1/conversations`, `GET /api/v1/conversations?q=`, `GET /api/v1/conversations/:id`, `POST /api/v1/conversations/:id/messages`, `POST /api/v1/conversations/:id/read`; the `ConversationSummary` shape `{ id, recipientType, studentId, otherPartyName, lastMessageAt, unread }` and `ConversationDetail` shape `{ id, recipientType, studentId, messages: [{ id, senderId, body, createdAt }] }` — consumed by both clients (Task 7, 10) and Task 5's e2e tests.

- [ ] **Step 1: Write the failing tests**

Create `backend/src/messages/conversations.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: {
    section: { findUnique: jest.Mock };
    teacher: { findUnique: jest.Mock };
    user: { findFirst: jest.Mock };
    conversation: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    message: { create: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let enrollment: { getCurrentEnrollment: jest.Mock };
  let notifications: { notify: jest.Mock };

  beforeEach(async () => {
    prisma = {
      section: { findUnique: jest.fn() },
      teacher: { findUnique: jest.fn() },
      user: { findFirst: jest.fn() },
      conversation: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      message: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    enrollment = { getCurrentEnrollment: jest.fn() };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollment },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(ConversationsService);
  });

  it('starting a CLASS_TEACHER conversation resolves the staff user via the section class teacher', async () => {
    enrollment.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: 'teacher-1' });
    prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1', userId: 'teacher-user-1' });
    prisma.conversation.create.mockResolvedValue({ id: 'conv-1' });

    const result = await service.create(
      { recipientType: 'CLASS_TEACHER', studentId: 'student-1', body: 'Hello' },
      'parent-1',
    );

    expect(prisma.conversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentUserId: 'parent-1',
          staffUserId: 'teacher-user-1',
          recipientType: 'CLASS_TEACHER',
          studentId: 'student-1',
        }),
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'teacher-user-1', type: 'message', entityRef: 'conv-1' }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'conversation.create', entity: 'Conversation' }),
      }),
    );
    expect(result).toEqual({ id: 'conv-1' });
  });

  it('throws BadRequestException if the section has no class teacher assigned', async () => {
    enrollment.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({ id: 'sec-1', classTeacherId: null });

    await expect(
      service.create({ recipientType: 'CLASS_TEACHER', studentId: 'student-1', body: 'Hi' }, 'parent-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('starting a SCHOOL_ADMIN conversation resolves the earliest-created SCHOOL_ADMIN user', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
    prisma.conversation.create.mockResolvedValue({ id: 'conv-2' });

    await service.create({ recipientType: 'SCHOOL_ADMIN', body: 'Question' }, 'parent-1');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { role: 'SCHOOL_ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('starting a PRINCIPAL conversation resolves the earliest isPrincipal=true user', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
    prisma.conversation.create.mockResolvedValue({ id: 'conv-3' });

    await service.create({ recipientType: 'PRINCIPAL', body: 'Question' }, 'parent-1');

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { isPrincipal: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('throws BadRequestException if no user exists for the requested recipient type', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create({ recipientType: 'ACCOUNTS', body: 'Hi' }, 'parent-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it("a parent's list shows the staff member's name and marks unread when their own read timestamp is stale", async () => {
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        recipientType: 'CLASS_TEACHER',
        studentId: 'student-1',
        parentUser: { identifier: 'parent-a@seeds.edu.pk', parentProfile: { name: 'Parent A' } },
        staffUser: { identifier: 'teacher@seeds.edu.pk', teacher: { name: 'Ms. Sample Teacher' } },
        parentReadAt: new Date('2026-08-01T00:00:00.000Z'),
        staffReadAt: null,
        lastMessageAt: new Date('2026-08-02T00:00:00.000Z'),
      },
    ]);

    const result = await service.listForUser({ id: 'parent-1', role: 'PARENT' });

    expect(prisma.conversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { parentUserId: 'parent-1' } }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'conv-1',
        otherPartyName: 'Ms. Sample Teacher',
        unread: true, // parentReadAt (Aug 1) is older than lastMessageAt (Aug 2)
      }),
    ]);
  });

  it("a staff member's list shows the parent's name, filtered by the q search term", async () => {
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        recipientType: 'CLASS_TEACHER',
        studentId: 'student-1',
        parentUser: { identifier: 'parent-a@seeds.edu.pk', parentProfile: { name: 'Parent A' } },
        staffUser: { identifier: 'teacher@seeds.edu.pk', teacher: { name: 'Ms. Sample Teacher' } },
        parentReadAt: new Date(),
        staffReadAt: new Date(),
        lastMessageAt: new Date('2026-08-02T00:00:00.000Z'),
      },
    ]);

    const matched = await service.listForUser({ id: 'teacher-user-1', role: 'TEACHER' }, 'parent a');
    expect(matched).toHaveLength(1);
    expect(matched[0].otherPartyName).toBe('Parent A');

    const unmatched = await service.listForUser({ id: 'teacher-user-1', role: 'TEACHER' }, 'nobody');
    expect(unmatched).toHaveLength(0);
  });

  it('reply appends a message, bumps lastMessageAt, marks the sender\'s own read, and notifies the other party', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      parentUserId: 'parent-1',
      staffUserId: 'teacher-user-1',
    });

    await service.reply('conv-1', 'teacher-user-1', { body: 'Sure thing' });

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { conversationId: 'conv-1', senderId: 'teacher-user-1', body: 'Sure thing' },
    });
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'conv-1' },
        data: expect.objectContaining({ staffReadAt: expect.any(Date) }),
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'parent-1', type: 'message' }),
    );
  });

  it('reply is rejected for anyone not a party to the conversation', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      parentUserId: 'parent-1',
      staffUserId: 'teacher-user-1',
    });

    await expect(
      service.reply('conv-1', 'someone-else', { body: 'x' }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('reply 404s for an unknown conversation', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);
    await expect(service.reply('missing', 'user-1', { body: 'x' })).rejects.toThrow(NotFoundException);
  });

  it('getById is rejected for anyone not a party, 404s for unknown', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      parentUserId: 'parent-1',
      staffUserId: 'teacher-user-1',
      recipientType: 'CLASS_TEACHER',
      studentId: 'student-1',
      messages: [],
    });

    await expect(
      service.getById('conv-1', { id: 'someone-else', role: 'TEACHER' }),
    ).rejects.toThrow(ForbiddenException);

    prisma.conversation.findUnique.mockResolvedValue(null);
    await expect(
      service.getById('missing', { id: 'parent-1', role: 'PARENT' }),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/messages`
Expected: FAIL — implementation files don't exist yet.

- [ ] **Step 3: Implement**

Create `backend/src/messages/dto/create-conversation.dto.ts`:

```ts
import { IsIn, IsString, MinLength, ValidateIf } from 'class-validator';

export const CONVERSATION_RECIPIENT_TYPES = [
  'CLASS_TEACHER',
  'SCHOOL_ADMIN',
  'ACCOUNTS',
  'PRINCIPAL',
] as const;

export class CreateConversationDto {
  @IsIn(CONVERSATION_RECIPIENT_TYPES)
  recipientType!: (typeof CONVERSATION_RECIPIENT_TYPES)[number];

  @ValidateIf((o: CreateConversationDto) => o.recipientType === 'CLASS_TEACHER')
  @IsString()
  @MinLength(1)
  studentId?: string;

  @IsString()
  @MinLength(1)
  body!: string;
}
```

Create `backend/src/messages/dto/send-message.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  body!: string;
}
```

Create `backend/src/messages/conversations.service.ts`:

```ts
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RequestUser } from '../common/student-access.service';

export interface ConversationSummary {
  id: string;
  recipientType: string;
  studentId: string | null;
  otherPartyName: string;
  lastMessageAt: string;
  unread: boolean;
}

export interface MessageSummary {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  recipientType: string;
  studentId: string | null;
  messages: MessageSummary[];
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateConversationDto, parentUserId: string): Promise<{ id: string }> {
    const staffUserId = await this.resolveStaffUserId(dto);

    const conversation = await this.prisma.conversation.create({
      data: {
        parentUserId,
        staffUserId,
        recipientType: dto.recipientType,
        studentId: dto.recipientType === 'CLASS_TEACHER' ? dto.studentId : null,
        parentReadAt: new Date(),
        messages: { create: [{ senderId: parentUserId, body: dto.body }] },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: parentUserId,
        action: 'conversation.create',
        entity: 'Conversation',
        entityId: conversation.id,
        metadata: JSON.stringify({ recipientType: dto.recipientType, studentId: dto.studentId }),
      },
    });

    await this.notifications.notify({
      userId: staffUserId,
      type: 'message',
      title: 'New message',
      body: dto.body,
      entityRef: conversation.id,
    });

    return { id: conversation.id };
  }

  private async resolveStaffUserId(dto: CreateConversationDto): Promise<string> {
    if (dto.recipientType === 'CLASS_TEACHER') {
      const enrollment = await this.enrollmentService.getCurrentEnrollment(dto.studentId as string);
      const section = await this.prisma.section.findUnique({ where: { id: enrollment.sectionId } });
      if (!section?.classTeacherId) {
        throw new BadRequestException("This student's section has no class teacher assigned yet");
      }
      const teacher = await this.prisma.teacher.findUnique({ where: { id: section.classTeacherId } });
      return teacher!.userId;
    }

    const where = dto.recipientType === 'PRINCIPAL' ? { isPrincipal: true } : { role: dto.recipientType };
    const user = await this.prisma.user.findFirst({ where, orderBy: { createdAt: 'asc' } });
    if (!user) {
      throw new BadRequestException(`No ${dto.recipientType} account exists yet`);
    }
    return user.id;
  }

  async listForUser(user: RequestUser, q?: string): Promise<ConversationSummary[]> {
    const isParent = user.role === 'PARENT';
    const conversations = await this.prisma.conversation.findMany({
      where: isParent ? { parentUserId: user.id } : { staffUserId: user.id },
      include: {
        parentUser: { include: { parentProfile: true } },
        staffUser: { include: { teacher: true } },
      },
      orderBy: { lastMessageAt: 'desc' },
    });

    const summaries = conversations.map((c) => {
      // Branched directly on c.staffUser/c.parentUser (both always present regardless of caller
      // role, since the query above always includes both) rather than a shared "otherParty"
      // variable — TS can't narrow a union assigned from a runtime boolean, and a cast there would
      // silently defeat the type-checker instead of catching a real mismatch.
      const otherPartyName = isParent
        ? (c.staffUser.teacher?.name ?? c.staffUser.identifier)
        : (c.parentUser.parentProfile?.name ?? c.parentUser.identifier);
      const readAt = isParent ? c.parentReadAt : c.staffReadAt;
      return {
        id: c.id,
        recipientType: c.recipientType,
        studentId: c.studentId,
        otherPartyName,
        lastMessageAt: c.lastMessageAt.toISOString(),
        unread: !readAt || readAt < c.lastMessageAt,
      };
    });

    if (!q) return summaries;
    const needle = q.toLowerCase();
    return summaries.filter((s) => s.otherPartyName.toLowerCase().includes(needle));
  }

  async getById(conversationId: string, user: RequestUser): Promise<ConversationDetail> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (conversation.parentUserId !== user.id && conversation.staffUserId !== user.id) {
      throw new ForbiddenException('You are not a party to this conversation');
    }

    return {
      id: conversation.id,
      recipientType: conversation.recipientType,
      studentId: conversation.studentId,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async reply(conversationId: string, userId: string, dto: SendMessageDto): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    const isParent = conversation.parentUserId === userId;
    const isStaff = conversation.staffUserId === userId;
    if (!isParent && !isStaff) {
      throw new ForbiddenException('You are not a party to this conversation');
    }

    const now = new Date();
    await this.prisma.message.create({ data: { conversationId, senderId: userId, body: dto.body } });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: now, ...(isParent ? { parentReadAt: now } : { staffReadAt: now }) },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: 'message.send', entity: 'Conversation', entityId: conversationId },
    });

    const recipientId = isParent ? conversation.staffUserId : conversation.parentUserId;
    await this.notifications.notify({
      userId: recipientId,
      type: 'message',
      title: 'New message',
      body: dto.body,
      entityRef: conversationId,
    });
  }

  async markRead(conversationId: string, user: RequestUser): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    const isParent = conversation.parentUserId === user.id;
    const isStaff = conversation.staffUserId === user.id;
    if (!isParent && !isStaff) {
      throw new ForbiddenException('You are not a party to this conversation');
    }
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: isParent ? { parentReadAt: new Date() } : { staffReadAt: new Date() },
    });
  }
}
```

Create `backend/src/messages/conversations.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { RequestUser } from '../common/student-access.service';
import { Roles } from '../auth/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('api/v1/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Roles('PARENT')
  @Post()
  create(@Body() dto: CreateConversationDto, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.create(dto, req.user.id);
  }

  @Get()
  list(@Query('q') q: string | undefined, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.listForUser(req.user, q);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.getById(id, req.user);
  }

  @Post(':id/messages')
  reply(@Param('id') id: string, @Body() dto: SendMessageDto, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.reply(id, req.user.id, dto);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.conversationsService.markRead(id, req.user);
  }
}
```

Create `backend/src/messages/messages.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [ConversationsService, EnrollmentService],
  controllers: [ConversationsController],
})
export class MessagesModule {}
```

Modify `backend/src/app.module.ts`:

```ts
import { MessagesModule } from './messages/messages.module';
```

```ts
    NotificationsModule,
    MessagesModule,
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/messages`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/messages src/app.module.ts
git commit -m "Add Messages module: parent-initiated conversations, staff reply, read tracking"
```

---

## Task 4: Wire notifications into Diary and Circulars

**Files:**
- Modify: `backend/src/diary/diary.service.ts`
- Modify: `backend/src/diary/diary.service.spec.ts`
- Modify: `backend/src/diary/diary.module.ts`
- Modify: `backend/src/circulars/circulars.service.ts`
- Modify: `backend/src/circulars/circulars.service.spec.ts`
- Modify: `backend/src/circulars/circulars.module.ts`

**Interfaces:**
- Consumes: `NotificationsService.notify` (Task 2).

- [ ] **Step 1: Update the failing tests first**

In `backend/src/diary/diary.service.spec.ts`, add the import at the top (after the `EnrollmentService` import):

```ts
import { NotificationsService } from '../notifications/notifications.service';
```

Change the `prisma` type declaration to add `user`:

```ts
  let prisma: {
    diaryEntry: { upsert: jest.Mock; findMany: jest.Mock };
    diaryAttachment: { deleteMany: jest.Mock; createMany: jest.Mock };
    user: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let enrollmentService: { getEnrollmentForDate: jest.Mock };
  let notifications: { notify: jest.Mock };
```

Replace the `beforeEach` body:

```ts
  beforeEach(async () => {
    prisma = {
      diaryEntry: { upsert: jest.fn(), findMany: jest.fn() },
      diaryAttachment: { deleteMany: jest.fn(), createMany: jest.fn() },
      user: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    enrollmentService = { getEnrollmentForDate: jest.fn() };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DiaryService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollmentService },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(DiaryService);
  });
```

The existing `'creates a diary entry...'` and `'attaches the given files...'` tests call `prisma.diaryEntry.upsert.mockResolvedValue({ id: 'entry-1' })` without ever setting `prisma.user.findMany`, so it defaults to `undefined` — add `prisma.user.findMany.mockResolvedValue([]);` as the first line of both of those two existing `it(...)` bodies (and the `'creates a diary entry authored by a SCHOOL_ADMIN...'` one), so the new notify-loop at the end of `createEntry` has an empty array to iterate rather than crashing on `undefined.map`.

Add a new test in the `createEntry` describe block:

```ts
  it('notifies every parent whose child is enrolled in the section', async () => {
    prisma.diaryEntry.upsert.mockResolvedValue({ id: 'entry-1' });
    prisma.user.findMany.mockResolvedValue([{ id: 'parent-1' }, { id: 'parent-2' }]);

    await service.createEntry(
      { sectionId: 'sec-1', subjectId: 'sub-1', date: '2026-08-27', text: 'Read chapter 3.' },
      'teacher-user-1',
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'PARENT',
          parentProfile: expect.objectContaining({
            children: expect.objectContaining({
              some: expect.objectContaining({
                student: expect.objectContaining({
                  enrollments: { some: { sectionId: 'sec-1', status: 'ACTIVE' } },
                }),
              }),
            }),
          }),
        }),
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'parent-1', type: 'diary', entityRef: 'entry-1' }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'parent-2', type: 'diary', entityRef: 'entry-1' }),
    );
  });
```

Add `user: { findMany: jest.fn() }` to the `prisma` mock object at the top of the file if not already present.

In `backend/src/circulars/circulars.service.spec.ts`, add the import (after the `PrismaService` import):

```ts
import { NotificationsService } from '../notifications/notifications.service';
```

Add `let notifications: { notify: jest.Mock };` next to the `let prisma: {...}` declaration, and inside `beforeEach`, add `notifications = { notify: jest.fn().mockResolvedValue(undefined) };` before the `Test.createTestingModule` call, then add it to the providers array:

```ts
    const moduleRef = await Test.createTestingModule({
      providers: [
        CircularsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
```

Then add:

```ts
  it('notifies every recipient after publishing', async () => {
    prisma.circular.create.mockResolvedValue({ id: 'circ-1' });
    prisma.user.findMany.mockResolvedValue([{ id: 'parent-a' }, { id: 'parent-b' }]);

    await service.publish(
      { title: 'PTM', description: 'PTM in September.', scope: 'school' },
      'admin-1',
    );

    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'parent-a', type: 'circular', entityRef: 'circ-1' }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'parent-b', type: 'circular', entityRef: 'circ-1' }),
    );
  });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx jest src/diary src/circulars`
Expected: FAIL — the new assertions have no implementation yet (existing tests should still pass unless the constructor signature changed underneath them, in which case they'll fail too until Step 3 updates the modules).

- [ ] **Step 3: Implement**

In `backend/src/diary/diary.service.ts`, add the import and constructor param:

```ts
import { NotificationsService } from '../notifications/notifications.service';
```

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly enrollmentService: EnrollmentService,
    private readonly notifications: NotificationsService,
  ) {}
```

At the end of `createEntry`, right before `return entry;`, add:

```ts
    const parents = await this.prisma.user.findMany({
      where: {
        role: 'PARENT',
        parentProfile: {
          children: {
            some: {
              student: { enrollments: { some: { sectionId: dto.sectionId, status: 'ACTIVE' } } },
            },
          },
        },
      },
      select: { id: true },
    });
    await Promise.all(
      parents.map((p) =>
        this.notifications.notify({
          userId: p.id,
          type: 'diary',
          title: 'New diary entry',
          body: dto.text,
          entityRef: entry.id,
        }),
      ),
    );
```

In `backend/src/diary/diary.module.ts`, import and register `NotificationsModule`:

```ts
import { NotificationsModule } from '../notifications/notifications.module';
```

```ts
@Module({
  imports: [NotificationsModule],
  providers: [DiaryService, StudentAccessService, EnrollmentService],
  controllers: [DiaryController],
})
export class DiaryModule {}
```

In `backend/src/circulars/circulars.service.ts`, add the import and constructor param:

```ts
import { NotificationsService } from '../notifications/notifications.service';
```

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}
```

Right after the `if (recipients.length) { ... circularRecipient.createMany ... }` block in `publish`, add:

```ts
    await Promise.all(
      recipients.map((r) =>
        this.notifications.notify({
          userId: r.id,
          type: 'circular',
          title: dto.title,
          body: dto.description,
          entityRef: circular.id,
        }),
      ),
    );
```

In `backend/src/circulars/circulars.module.ts`, import and register `NotificationsModule`:

```ts
import { NotificationsModule } from '../notifications/notifications.module';
```

```ts
@Module({
  imports: [NotificationsModule],
  providers: [CircularsService],
  controllers: [CircularsController],
})
export class CircularsModule {}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/diary src/circulars`
Expected: PASS (all diary + circulars tests, including the two new ones)

- [ ] **Step 5: Run the full existing test suite to confirm nothing broke**

Run: `npm test`
Expected: all existing suites still PASS.

- [ ] **Step 6: Commit**

```bash
git add src/diary src/circulars
git commit -m "Notify affected parents on new diary entries and published circulars"
```

---

## Task 5: Backend e2e tests for Messages + Notifications

**Files:**
- Create: `backend/test/messages-notifications.e2e-spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-4.

- [ ] **Step 1: Write the e2e spec**

Create `backend/test/messages-notifications.e2e-spec.ts`, following `diary-circulars.e2e-spec.ts`'s fixture/cleanup pattern (own `mn-` prefixed identifiers, self-healing pre-flight cleanup, `afterAll` teardown):

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Messages + Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'CorrectHorseBattery9!';
  const ids: Record<string, string> = {};

  async function loginAs(identifier: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier, password })
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

    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'mn-' } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'MN-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({ where: { name: 'MN E2E School' } });
    for (const s of stale) {
      await prisma.school.delete({ where: { id: s.id } }).catch(() => undefined);
    }

    const school = await prisma.school.create({ data: { name: 'MN E2E School' } });
    const campus = await prisma.campus.create({ data: { schoolId: school.id, name: 'Main' } });
    const session = await prisma.academicSession.create({
      data: { label: 'MN', startDate: new Date(), endDate: new Date(), isActive: true },
    });
    const klass = await prisma.class.create({
      data: { campusId: campus.id, academicSessionId: session.id, name: 'MN Grade' },
    });
    const section = await prisma.section.create({ data: { classId: klass.id, name: 'MN-A' } });
    const otherSection = await prisma.section.create({ data: { classId: klass.id, name: 'MN-B' } });
    ids.school = school.id;
    ids.section = section.id;

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: { identifier: 'mn-teacher@seeds.edu.pk', passwordHash, role: 'TEACHER' },
    });
    const teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'MN Teacher' },
    });
    await prisma.section.update({ where: { id: section.id }, data: { classTeacherId: teacher.id } });
    ids.teacherUserId = teacherUser.id;

    const otherTeacherUser = await prisma.user.create({
      data: { identifier: 'mn-other-teacher@seeds.edu.pk', passwordHash, role: 'TEACHER' },
    });
    ids.otherTeacherUserId = otherTeacherUser.id;

    const adminUser = await prisma.user.create({
      data: { identifier: 'mn-admin@seeds.edu.pk', passwordHash, role: 'SCHOOL_ADMIN', isPrincipal: true },
    });
    ids.adminUserId = adminUser.id;

    const parentUser = await prisma.user.create({
      data: { identifier: 'mn-parent@seeds.edu.pk', passwordHash, role: 'PARENT' },
    });
    const otherParentUser = await prisma.user.create({
      data: { identifier: 'mn-other-parent@seeds.edu.pk', passwordHash, role: 'PARENT' },
    });
    ids.otherParentUserId = otherParentUser.id;
    const parentProfile = await prisma.parentProfile.create({
      data: { userId: parentUser.id, name: 'MN Parent' },
    });

    const child = await prisma.student.create({ data: { grNumber: 'MN-1', name: 'MN Child' } });
    await prisma.enrollment.create({
      data: {
        studentId: child.id,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.studentParent.create({
      data: { studentId: child.id, parentProfileId: parentProfile.id },
    });
    ids.childId = child.id;

    // A student in a section with no classTeacherId set — exercises the "no class teacher" 400.
    const orphanChild = await prisma.student.create({ data: { grNumber: 'MN-2', name: 'MN Orphan' } });
    await prisma.enrollment.create({
      data: {
        studentId: orphanChild.id,
        campusId: campus.id,
        sectionId: otherSection.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.studentParent.create({
      data: { studentId: orphanChild.id, parentProfileId: parentProfile.id },
    });
    ids.orphanChildId = orphanChild.id;
  });

  afterAll(async () => {
    await prisma.student.deleteMany({ where: { grNumber: { in: ['MN-1', 'MN-2'] } } }).catch(() => undefined);
    await prisma.school.delete({ where: { id: ids.school } }).catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'mn-' } } })
      .catch(() => undefined);
    await app.close();
  });

  it('a parent starts a conversation with the class teacher, the teacher sees and replies, and both get notified', async () => {
    const parentToken = await loginAs('mn-parent@seeds.edu.pk');

    const start = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ recipientType: 'CLASS_TEACHER', studentId: ids.childId, body: 'Can we talk about homework?' })
      .expect(201);
    ids.conversationId = start.body.id;

    const teacherToken = await loginAs('mn-teacher@seeds.edu.pk');
    const inbox = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(inbox.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.conversationId, unread: true })]),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${ids.conversationId}/messages`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ body: 'Sure, when works for you?' })
      .expect(201);

    const thread = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${ids.conversationId}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(thread.body.messages).toHaveLength(2);
    expect(thread.body.messages[1]).toEqual(
      expect.objectContaining({ body: 'Sure, when works for you?' }),
    );

    const parentNotifications = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(parentNotifications.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'message', entityRef: ids.conversationId, readAt: null }),
      ]),
    );
  });

  it('another parent and another teacher cannot read or reply to this conversation', async () => {
    const otherParentToken = await loginAs('mn-other-parent@seeds.edu.pk');
    await request(app.getHttpServer())
      .get(`/api/v1/conversations/${ids.conversationId}`)
      .set('Authorization', `Bearer ${otherParentToken}`)
      .expect(403);

    const otherTeacherToken = await loginAs('mn-other-teacher@seeds.edu.pk');
    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${ids.conversationId}/messages`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({ body: 'butting in' })
      .expect(403);
  });

  it('a TEACHER cannot start a new conversation to a parent', async () => {
    const teacherToken = await loginAs('mn-teacher@seeds.edu.pk');
    await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ recipientType: 'SCHOOL_ADMIN', body: 'x' })
      .expect(403);
  });

  it('a parent can message the Principal, resolved via isPrincipal', async () => {
    const parentToken = await loginAs('mn-parent@seeds.edu.pk');
    const res = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ recipientType: 'PRINCIPAL', body: 'A question for the principal.' })
      .expect(201);

    const adminToken = await loginAs('mn-admin@seeds.edu.pk');
    const inbox = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(inbox.body.map((c: { id: string }) => c.id)).toContain(res.body.id);
  });

  it('starting a CLASS_TEACHER conversation for a section with no class teacher assigned returns 400', async () => {
    const parentToken = await loginAs('mn-parent@seeds.edu.pk');
    await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ recipientType: 'CLASS_TEACHER', studentId: ids.orphanChildId, body: 'Hi' })
      .expect(400);
  });

  it('a notification can be marked read individually and in bulk', async () => {
    const parentToken = await loginAs('mn-parent@seeds.edu.pk');
    const before = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    const unread = before.body.find((n: { readAt: string | null }) => n.readAt === null);
    expect(unread).toBeDefined();

    await request(app.getHttpServer())
      .post(`/api/v1/notifications/${unread.id}/read`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(201);

    const after = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    expect(after.body.every((n: { readAt: string | null }) => n.readAt !== null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the e2e suite**

Run: `cd backend && npm run test:e2e -- messages-notifications`
Expected: PASS (7 tests). If the runner script name differs, check `package.json`'s `scripts.test:e2e` first.

- [ ] **Step 3: Run the full e2e suite to confirm nothing broke**

Run: `npm run test:e2e`
Expected: all e2e suites PASS.

- [ ] **Step 4: Commit**

```bash
git add test/messages-notifications.e2e-spec.ts
git commit -m "Add e2e coverage for Messages authorization boundaries and Notifications"
```

---

## Task 6: Staff console — API client additions

**Files:**
- Modify: `staff-console/src/lib/api.ts`

**Interfaces:**
- Produces: `ConversationSummary`, `MessageSummary`, `ConversationDetail`, `NotificationSummary` types and `api.listConversations`, `api.getConversation`, `api.replyToConversation`, `api.markConversationRead`, `api.listNotifications`, `api.markNotificationRead`, `api.markAllNotificationsRead` — consumed by Task 7 and Task 8.

- [ ] **Step 1: Add the types and methods**

Add these interfaces near the existing `CircularSummary` interface in `staff-console/src/lib/api.ts`:

```ts
export interface ConversationSummary {
  id: string;
  recipientType: 'CLASS_TEACHER' | 'SCHOOL_ADMIN' | 'ACCOUNTS' | 'PRINCIPAL';
  studentId: string | null;
  otherPartyName: string;
  lastMessageAt: string;
  unread: boolean;
}

export interface MessageSummary {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  recipientType: string;
  studentId: string | null;
  messages: MessageSummary[];
}

export interface NotificationSummary {
  id: string;
  type: 'diary' | 'circular' | 'message';
  title: string;
  body: string;
  entityRef: string | null;
  readAt: string | null;
  createdAt: string;
}
```

Add these methods to the `api` object, after `circularStats`:

```ts
  async listConversations(accessToken: string, q?: string): Promise<ConversationSummary[]> {
    const suffix = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetch(`${API_BASE_URL}/api/v1/conversations${suffix}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async getConversation(accessToken: string, id: string): Promise<ConversationDetail> {
    const res = await fetch(`${API_BASE_URL}/api/v1/conversations/${id}`, {
      headers: authHeaders(accessToken),
    });
    return asJson(res);
  },

  async replyToConversation(accessToken: string, id: string, body: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/conversations/${id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders(accessToken) },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async markConversationRead(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/conversations/${id}/read`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async listNotifications(accessToken: string): Promise<NotificationSummary[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/notifications`, { headers: authHeaders(accessToken) });
    return asJson(res);
  },

  async markNotificationRead(accessToken: string, id: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/notifications/${id}/read`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },

  async markAllNotificationsRead(accessToken: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/v1/notifications/read-all`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      throw new ApiError(await parseErrorMessage(res), res.status);
    }
  },
```

There's no dedicated test file for `api.ts` (checked: none exists today) — this task has no test step of its own; correctness is verified by Task 7/8's component specs, which mock this module.

- [ ] **Step 2: Type-check**

Run: `cd staff-console && npm run build`
Expected: PASS (type-check + build clean).

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.ts
git commit -m "Add Conversations/Notifications types and client methods to staff-console api.ts"
```

---

## Task 7: Staff console — MessagesView + routing + nav

**Files:**
- Create: `staff-console/src/views/MessagesView.vue`
- Create: `staff-console/src/views/MessagesView.spec.ts`
- Create: `staff-console/src/views/MessagesPageView.vue`
- Modify: `staff-console/src/router/index.ts`
- Modify: `staff-console/src/components/AppShell.vue`
- Modify: `staff-console/src/components/AppShell.spec.ts`

**Interfaces:**
- Consumes: `api.listConversations`, `api.getConversation`, `api.replyToConversation` (Task 6).

- [ ] **Step 1: Write the failing test**

Create `staff-console/src/views/MessagesView.spec.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import MessagesView from './MessagesView.vue';
import { useAuthStore } from '../stores/auth';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listConversations: vi.fn(),
    getConversation: vi.fn(),
    replyToConversation: vi.fn(),
    markConversationRead: vi.fn(),
  },
}));

describe('MessagesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    auth.accessToken = 'token-1';
    vi.mocked(api.listConversations).mockReset();
    vi.mocked(api.getConversation).mockReset();
    vi.mocked(api.replyToConversation).mockReset();
    vi.mocked(api.markConversationRead).mockReset().mockResolvedValue(undefined);
  });

  it('lists conversations, opens a thread, and sends a reply', async () => {
    vi.mocked(api.listConversations).mockResolvedValue([
      {
        id: 'conv-1',
        recipientType: 'CLASS_TEACHER',
        studentId: 'student-1',
        otherPartyName: 'Parent A',
        lastMessageAt: '2026-08-29T00:00:00.000Z',
        unread: true,
      },
    ]);
    vi.mocked(api.getConversation).mockResolvedValue({
      id: 'conv-1',
      recipientType: 'CLASS_TEACHER',
      studentId: 'student-1',
      messages: [
        { id: 'm1', senderId: 'parent-1', body: 'Can Eshaal get extra homework?', createdAt: '2026-08-29T00:00:00.000Z' },
      ],
    });
    vi.mocked(api.replyToConversation).mockResolvedValue(undefined);

    const wrapper = mount(MessagesView);
    await flushPromises();

    expect(wrapper.text()).toContain('Parent A');

    await wrapper.find('[data-testid="conversation-conv-1"]').trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Can Eshaal get extra homework?');

    await wrapper.find('[data-testid="reply-text"]').setValue('Sure, will send some.');
    await wrapper.find('[data-testid="send-reply"]').trigger('click');
    await flushPromises();

    expect(api.replyToConversation).toHaveBeenCalledWith('token-1', 'conv-1', 'Sure, will send some.');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd staff-console && npx vitest run src/views/MessagesView.spec.ts`
Expected: FAIL — `MessagesView.vue` doesn't exist yet.

- [ ] **Step 3: Implement `MessagesView.vue`**

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { useAuthStore } from '../stores/auth';
import { api, type ConversationSummary, type ConversationDetail } from '../lib/api';
import DirectionalText from '../components/DirectionalText.vue';

const auth = useAuthStore();
const conversations = ref<ConversationSummary[]>([]);
const selected = ref<ConversationDetail | null>(null);
const selectedId = ref('');
const replyText = ref('');
const isSending = ref(false);
const errorMessage = ref<string | null>(null);

async function loadConversations() {
  if (!auth.accessToken) return;
  try {
    conversations.value = await api.listConversations(auth.accessToken);
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not load messages.';
  }
}
loadConversations();

async function openConversation(id: string) {
  if (!auth.accessToken) return;
  selectedId.value = id;
  errorMessage.value = null;
  try {
    selected.value = await api.getConversation(auth.accessToken, id);
    await api.markConversationRead(auth.accessToken, id);
    await loadConversations();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Could not open this conversation.';
  }
}

async function onSendReply() {
  if (!auth.accessToken || !selectedId.value || !replyText.value) return;
  isSending.value = true;
  errorMessage.value = null;
  const accessToken = auth.accessToken;
  const conversationId = selectedId.value;
  const body = replyText.value;
  try {
    await api.replyToConversation(accessToken, conversationId, body);
    replyText.value = '';
    selected.value = await api.getConversation(accessToken, conversationId);
    await loadConversations();
  } catch (err) {
    errorMessage.value = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
  } finally {
    isSending.value = false;
  }
}
</script>

<template>
  <div class="messages">
    <h1>Messages</h1>
    <p v-if="errorMessage" class="error" role="alert">{{ errorMessage }}</p>

    <div class="layout">
      <ul class="conversation-list">
        <li v-if="!conversations.length" class="empty">No messages yet.</li>
        <li
          v-for="c in conversations"
          :key="c.id"
          :data-testid="`conversation-${c.id}`"
          :class="{ active: c.id === selectedId, unread: c.unread }"
          @click="openConversation(c.id)"
        >
          {{ c.otherPartyName }}
        </li>
      </ul>

      <div class="thread" v-if="selected">
        <div v-for="m in selected.messages" :key="m.id" class="message">
          <DirectionalText :text="m.body" />
        </div>
        <textarea
          data-testid="reply-text"
          v-model="replyText"
          rows="2"
          :disabled="isSending"
          placeholder="Type a reply…"
        ></textarea>
        <button data-testid="send-reply" :disabled="isSending || !replyText" @click="onSendReply">
          {{ isSending ? 'Sending…' : 'Send' }}
        </button>
      </div>
      <div class="thread empty" v-else>Select a conversation to view it.</div>
    </div>
  </div>
</template>

<style scoped>
.messages {
  max-width: 900px;
}
.layout {
  display: flex;
  gap: var(--space-4);
  margin-top: var(--space-3);
}
.conversation-list {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 240px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}
.conversation-list li {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
}
.conversation-list li.unread {
  font-weight: 700;
}
.conversation-list li.active {
  background: var(--color-surface-muted, #f2f4f7);
}
.thread {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.thread.empty {
  color: var(--color-muted);
}
.message {
  padding: var(--space-2);
  border-bottom: 1px solid var(--color-border);
}
textarea {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font: inherit;
}
button {
  align-self: flex-start;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--color-accent);
  color: var(--color-on-primary);
  font-weight: 700;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.error {
  color: var(--color-destructive);
}
.empty {
  color: var(--color-muted);
  padding: var(--space-3);
}
</style>
```

Create `staff-console/src/views/MessagesPageView.vue` (thin `AppShell` wrapper, matching `DiaryPageView.vue`/`CircularsPageView.vue`):

```vue
<script setup lang="ts">
import AppShell from '../components/AppShell.vue';
import MessagesView from './MessagesView.vue';
</script>

<template>
  <AppShell>
    <MessagesView />
  </AppShell>
</template>
```

- [ ] **Step 4: Wire the routes**

In `staff-console/src/router/index.ts`, add two routes (after `/teacher/diary` and before `/admin`, and after `/admin/circulars` respectively):

```ts
    {
      path: '/teacher/messages',
      name: 'teacher-messages',
      component: () => import('../views/MessagesPageView.vue'),
      meta: { requiresRole: ['TEACHER'] },
    },
```

```ts
    {
      path: '/admin/messages',
      name: 'admin-messages',
      component: () => import('../views/MessagesPageView.vue'),
      meta: { requiresRole: ['SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'] },
    },
```

- [ ] **Step 5: Wire the nav in `AppShell.vue`**

Replace the teacher nav's placeholder Messages link:

```html
          <a data-testid="nav-messages" href="#"><Icon name="chat" />Messages</a>
```

with:

```html
          <RouterLink data-testid="nav-messages" to="/teacher/messages"><Icon name="chat" />Messages</RouterLink>
```

Add a Messages link to the admin nav template (after `nav-fees`):

```html
          <RouterLink data-testid="nav-fees" to="/admin/fees"><Icon name="receipt" />Fees</RouterLink>
          <RouterLink data-testid="nav-messages" to="/admin/messages"><Icon name="chat" />Messages</RouterLink>
```

- [ ] **Step 6: Update `AppShell.spec.ts`'s router fixture and assertions**

In `makeRouter()`, add the two new routes:

```ts
      { path: '/teacher/messages', name: 'teacher-messages', component: { template: '<div>messages</div>' } },
      { path: '/admin/messages', name: 'admin-messages', component: { template: '<div>messages</div>' } },
```

In the existing `'shows Admin/Accounts nav items for a SCHOOL_ADMIN role...'` test, add:

```ts
    expect(wrapper.text()).toContain('Messages');
```

(next to the existing `expect(wrapper.text()).toContain('Fees')` line — `Messages` already appears once for teacher-role text, but this test mounts as `SCHOOL_ADMIN`, so it's a new assertion in that test specifically, not a duplicate.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/views/MessagesView.spec.ts src/components/AppShell.spec.ts`
Expected: PASS

- [ ] **Step 8: Run the full staff-console suite and build to confirm nothing broke**

Run: `npm test -- run && npm run build`
Expected: all suites PASS, type-check + build clean.

- [ ] **Step 9: Commit**

```bash
git add src/views/MessagesView.vue src/views/MessagesView.spec.ts src/views/MessagesPageView.vue src/router/index.ts src/components/AppShell.vue src/components/AppShell.spec.ts
git commit -m "Add staff-console Messages inbox+reply screen, routed for Teacher and Admin/Accounts"
```

---

## Task 8: Staff console — wire the notification bell

**Files:**
- Modify: `staff-console/src/components/AppShell.vue`
- Modify: `staff-console/src/components/AppShell.spec.ts`

**Interfaces:**
- Consumes: `api.listNotifications`, `api.markNotificationRead` (Task 6).

- [ ] **Step 1: Write the failing test**

Add to `staff-console/src/components/AppShell.spec.ts` — first add the `api` mock at the top of the file:

```ts
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    listNotifications: vi.fn().mockResolvedValue([]),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
    markAllNotificationsRead: vi.fn().mockResolvedValue(undefined),
  },
}));
```

Change `mountAsRole` to also set an access token (needed for the new bell's fetch-guard) and flush the notification-fetch promise before returning:

```ts
async function mountAsRole(role: string) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  auth.role = role;
  auth.accessToken = 'token-1';
  const router = makeRouter();
  await router.push('/login');
  await router.isReady();
  const wrapper = mount(AppShell, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}
```

The existing `'highlights the active nav item...'` and `'logs out and returns to /login...'` tests build their own `wrapper` directly (not through `mountAsRole`) — set `auth.accessToken = 'token-1'` there too, right after `auth.role = 'SCHOOL_ADMIN'`/inside `mountAsRole`'s caller, so the bell's fetch-guard doesn't skip the (mocked, harmless) `api.listNotifications` call in those tests either.

(add `flushPromises` to the `@vue/test-utils` import at the top of the file)

Add a new test:

```ts
  it('opens a dropdown of notifications, marks one read, and navigates on click', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('TEACHER');

    expect(wrapper.find('[data-testid="notif-badge"]').text()).toBe('1');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();

    expect(wrapper.find('[data-testid="notif-dropdown"]').text()).toContain('New message');

    await wrapper.find('[data-testid="notif-item-n1"]').trigger('click');
    await flushPromises();

    expect(api.markNotificationRead).toHaveBeenCalledWith(expect.any(String), 'n1');
  });

  it('"mark all read" clears every unread notification', async () => {
    vi.mocked(api.listNotifications).mockResolvedValue([
      {
        id: 'n1',
        type: 'message',
        title: 'New message',
        body: 'Hi there',
        entityRef: 'conv-1',
        readAt: null,
        createdAt: '2026-08-29T00:00:00.000Z',
      },
    ]);
    const wrapper = await mountAsRole('TEACHER');

    await wrapper.find('[data-testid="notifications"]').trigger('click');
    await flushPromises();
    await wrapper.find('[data-testid="notif-mark-all-read"]').trigger('click');
    await flushPromises();

    expect(api.markAllNotificationsRead).toHaveBeenCalledWith('token-1');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AppShell.spec.ts`
Expected: FAIL — the dropdown/badge don't exist yet.

- [ ] **Step 3: Implement**

In `AppShell.vue`'s `<script setup>`, add:

```ts
import { computed, onMounted, ref } from 'vue';
import { api, type NotificationSummary } from '../lib/api';
```

(merge with the existing `import { computed } from 'vue';` line — replace it, don't duplicate)

```ts
const notifications = ref<NotificationSummary[]>([]);
const isNotifOpen = ref(false);
const unreadCount = computed(() => notifications.value.filter((n) => !n.readAt).length);

async function loadNotifications() {
  if (!auth.accessToken) return;
  try {
    notifications.value = await api.listNotifications(auth.accessToken);
  } catch {
    // Convenience only — a failed fetch just leaves the bell showing zero unread.
  }
}
onMounted(loadNotifications);

// Notifications for diary/circular events only ever target parents (see NotificationsService
// callers); staff will realistically only ever see 'message' type here, but this stays generic
// to match the "deep-links to the right screen" requirement for all three types.
function routeForNotification(n: NotificationSummary): string {
  if (n.type === 'message') return isTeacher.value ? '/teacher/messages' : '/admin/messages';
  if (n.type === 'diary') return '/teacher/diary';
  return '/admin/circulars';
}

async function onOpenNotification(n: NotificationSummary) {
  isNotifOpen.value = false;
  if (!auth.accessToken) return;
  if (!n.readAt) {
    await api.markNotificationRead(auth.accessToken, n.id);
    await loadNotifications();
  }
  await router.push(routeForNotification(n));
}

async function onMarkAllRead() {
  if (!auth.accessToken) return;
  await api.markAllNotificationsRead(auth.accessToken);
  await loadNotifications();
}
```

Replace the topbar's notifications button:

```html
        <button data-testid="notifications" class="icon-button" aria-label="Notifications">
          <Icon name="bell" :size="18" />
        </button>
```

with:

```html
        <div class="notif-wrapper">
          <button
            data-testid="notifications"
            class="icon-button"
            aria-label="Notifications"
            @click="isNotifOpen = !isNotifOpen"
          >
            <Icon name="bell" :size="18" />
            <span v-if="unreadCount > 0" class="badge" data-testid="notif-badge">{{ unreadCount }}</span>
          </button>
          <div v-if="isNotifOpen" class="notif-dropdown" data-testid="notif-dropdown">
            <p v-if="!notifications.length" class="notif-empty">No notifications yet.</p>
            <button
              v-else
              data-testid="notif-mark-all-read"
              class="notif-mark-all"
              @click="onMarkAllRead"
            >
              Mark all read
            </button>
            <button
              v-for="n in notifications"
              :key="n.id"
              :data-testid="`notif-item-${n.id}`"
              class="notif-item"
              :class="{ unread: !n.readAt }"
              @click="onOpenNotification(n)"
            >
              <strong>{{ n.title }}</strong>
              <span>{{ n.body }}</span>
            </button>
          </div>
        </div>
```

Add styles (inside the existing `<style scoped>` block):

```css
.notif-wrapper {
  position: relative;
}
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--color-destructive);
  color: white;
  border-radius: 999px;
  font-size: 0.65rem;
  min-width: 1.1rem;
  height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.25rem;
}
.notif-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  width: 280px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 10;
  display: flex;
  flex-direction: column;
}
.notif-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.2rem;
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.notif-item.unread strong {
  font-weight: 700;
}
.notif-empty {
  padding: var(--space-3);
  color: var(--color-muted);
}
.notif-mark-all {
  padding: var(--space-2) var(--space-3);
  border: none;
  border-bottom: 1px solid var(--color-border);
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
  font-size: var(--font-size-sm);
  color: var(--color-accent);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/AppShell.spec.ts`
Expected: PASS (all AppShell tests, including the new one)

- [ ] **Step 5: Run the full staff-console suite and build to confirm nothing broke**

Run: `npm test -- run && npm run build`
Expected: all suites PASS, type-check + build clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/AppShell.vue src/components/AppShell.spec.ts
git commit -m "Wire the staff-console notification bell to real Notifications data"
```

---

## Task 9: Parent app — API client + model additions

**Files:**
- Modify: `parent-app/lib/src/api/models.dart`
- Modify: `parent-app/lib/src/api/api_client.dart`

**Interfaces:**
- Produces: `ConversationSummary`, `MessageSummary`, `ConversationDetail`, `NotificationSummary` model classes and `ApiClient.conversations`, `.conversation`, `.startConversation`, `.sendMessage`, `.markConversationRead`, `.notifications`, `.markNotificationRead` — consumed by Task 10 and Task 11.

- [ ] **Step 1: Add the models**

Append to `parent-app/lib/src/api/models.dart` (after `CircularSummary`):

```dart
class ConversationSummary {
  const ConversationSummary({
    required this.id,
    required this.recipientType,
    required this.studentId,
    required this.otherPartyName,
    required this.lastMessageAt,
    required this.unread,
  });

  final String id;
  final String recipientType;
  final String? studentId;
  final String otherPartyName;
  final String lastMessageAt;
  final bool unread;

  factory ConversationSummary.fromJson(Map<String, dynamic> json) => ConversationSummary(
    id: json['id'] as String,
    recipientType: json['recipientType'] as String,
    studentId: json['studentId'] as String?,
    otherPartyName: json['otherPartyName'] as String,
    lastMessageAt: json['lastMessageAt'] as String,
    unread: json['unread'] as bool,
  );
}

class MessageSummary {
  const MessageSummary({
    required this.id,
    required this.senderId,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String senderId;
  final String body;
  final String createdAt;

  factory MessageSummary.fromJson(Map<String, dynamic> json) => MessageSummary(
    id: json['id'] as String,
    senderId: json['senderId'] as String,
    body: json['body'] as String,
    createdAt: json['createdAt'] as String,
  );
}

class ConversationDetail {
  const ConversationDetail({
    required this.id,
    required this.recipientType,
    required this.studentId,
    required this.messages,
  });

  final String id;
  final String recipientType;
  final String? studentId;
  final List<MessageSummary> messages;

  factory ConversationDetail.fromJson(Map<String, dynamic> json) => ConversationDetail(
    id: json['id'] as String,
    recipientType: json['recipientType'] as String,
    studentId: json['studentId'] as String?,
    messages: (json['messages'] as List<dynamic>)
        .map((e) => MessageSummary.fromJson(e as Map<String, dynamic>))
        .toList(),
  );
}

class NotificationSummary {
  const NotificationSummary({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.entityRef,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String? entityRef;
  final String? readAt;
  final String createdAt;

  factory NotificationSummary.fromJson(Map<String, dynamic> json) => NotificationSummary(
    id: json['id'] as String,
    type: json['type'] as String,
    title: json['title'] as String,
    body: json['body'] as String,
    entityRef: json['entityRef'] as String?,
    readAt: json['readAt'] as String?,
    createdAt: json['createdAt'] as String,
  );
}
```

- [ ] **Step 2: Add the client methods**

Append to the `ApiClient` class in `parent-app/lib/src/api/api_client.dart` (after `markCircularRead`, before `fileDownloadUrl`):

```dart
  Future<List<ConversationSummary>> conversations(String accessToken, {String? q}) async {
    final path = (q == null || q.isEmpty)
        ? '/api/v1/conversations'
        : '/api/v1/conversations?q=${Uri.encodeQueryComponent(q)}';
    final list = await _get(path, accessToken) as List<dynamic>;
    return list.map((e) => ConversationSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<ConversationDetail> conversation(String accessToken, String id) async {
    final json = await _get('/api/v1/conversations/$id', accessToken) as Map<String, dynamic>;
    return ConversationDetail.fromJson(json);
  }

  Future<void> startConversation(
    String accessToken, {
    required String recipientType,
    String? studentId,
    required String body,
  }) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/conversations'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({
        'recipientType': recipientType,
        if (studentId != null) 'studentId': studentId,
        'body': body,
      }),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<void> sendMessage(String accessToken, String conversationId, String body) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/conversations/$conversationId/messages'),
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $accessToken'},
      body: jsonEncode({'body': body}),
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<void> markConversationRead(String accessToken, String conversationId) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/conversations/$conversationId/read'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<List<NotificationSummary>> notifications(String accessToken) async {
    final list = await _get('/api/v1/notifications', accessToken) as List<dynamic>;
    return list.map((e) => NotificationSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> markNotificationRead(String accessToken, String id) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/notifications/$id/read'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }

  Future<void> markAllNotificationsRead(String accessToken) async {
    final res = await _client.post(
      Uri.parse('$baseUrl/api/v1/notifications/read-all'),
      headers: {'Authorization': 'Bearer $accessToken'},
    );
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(_errorMessage(res), res.statusCode);
    }
  }
```

There's no dedicated test file for `api_client.dart`/`models.dart` today (checked: none exists) — correctness is verified by Task 10/11's widget tests, which exercise these through a `MockClient`.

- [ ] **Step 3: Analyze**

Run: `cd parent-app && flutter analyze`
Expected: no new issues.

- [ ] **Step 4: Commit**

```bash
git add lib/src/api/models.dart lib/src/api/api_client.dart
git commit -m "Add Conversation/Notification models and ApiClient methods to parent-app"
```

---

## Task 10: Parent app — Messages tab

**Files:**
- Create: `parent-app/lib/src/screens/messages_tab.dart`
- Create: `parent-app/test/screens/messages_tab_test.dart`
- Modify: `parent-app/lib/src/screens/home_shell.dart`

**Interfaces:**
- Consumes: `ApiClient.conversations/.conversation/.startConversation/.sendMessage/.markConversationRead` (Task 9), `ChildSummary` (existing).
- Produces: `MessagesTab` widget — consumed by `home_shell.dart`'s `_buildBody()`.

- [ ] **Step 1: Write the failing test**

Create `parent-app/test/screens/messages_tab_test.dart`:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/api/models.dart';
import 'package:parent_app/src/screens/messages_tab.dart';

void main() {
  const children = [
    ChildSummary(
      id: 's1',
      name: 'Eshaal',
      grNumber: 'GR-1001',
      campus: 'Gulistan-e-Jauhar',
      schoolClass: 'Grade 3',
      section: '3A',
    ),
  ];

  testWidgets('lists conversations, opens a thread, and starts a new one', (tester) async {
    var conversationStarted = false;
    var replySent = false;

    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations') {
          return http.Response(
            jsonEncode(
              conversationStarted
                  ? [
                      {
                        'id': 'conv-1',
                        'recipientType': 'CLASS_TEACHER',
                        'studentId': 's1',
                        'otherPartyName': 'Ms. Sample Teacher',
                        'lastMessageAt': '2026-08-29T00:00:00.000Z',
                        'unread': false,
                      },
                    ]
                  : [],
            ),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations') {
          conversationStarted = true;
          return http.Response(jsonEncode({'id': 'conv-1'}), 201);
        }
        if (request.method == 'GET' && request.url.path == '/api/v1/conversations/conv-1') {
          return http.Response(
            jsonEncode({
              'id': 'conv-1',
              'recipientType': 'CLASS_TEACHER',
              'studentId': 's1',
              'messages': [
                {
                  'id': 'm1',
                  'senderId': 'parent-1',
                  'body': 'Can Eshaal get extra homework?',
                  'createdAt': '2026-08-29T00:00:00.000Z',
                },
                if (replySent)
                  {
                    'id': 'm2',
                    'senderId': 'teacher-1',
                    'body': 'Sure thing.',
                    'createdAt': '2026-08-29T01:00:00.000Z',
                  },
              ],
            }),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/conversations/conv-1/read') {
          return http.Response('', 201);
        }
        if (request.method == 'POST' &&
            request.url.path == '/api/v1/conversations/conv-1/messages') {
          replySent = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: MessagesTab(accessToken: 'tok', api: api, children: children),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No messages yet.'), findsOneWidget);

    await tester.tap(find.byKey(const Key('newConversation')));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('bodyField')), 'Can Eshaal get extra homework?');
    await tester.tap(find.byKey(const Key('sendButton')));
    await tester.pumpAndSettle();

    expect(find.text('Ms. Sample Teacher'), findsOneWidget);

    await tester.tap(find.text('Ms. Sample Teacher'));
    await tester.pumpAndSettle();

    expect(find.text('Can Eshaal get extra homework?'), findsOneWidget);

    await tester.enterText(find.byKey(const Key('replyField')), 'Any update?');
    await tester.tap(find.byKey(const Key('sendReplyButton')));
    await tester.pumpAndSettle();

    expect(find.text('Sure thing.'), findsOneWidget);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/messages_tab_test.dart`
Expected: FAIL — `messages_tab.dart` doesn't exist yet.

- [ ] **Step 3: Implement `messages_tab.dart`**

```dart
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';
import '../theme/text_direction.dart';

enum _MessagesView { list, compose, thread }

String recipientLabel(String recipientType) {
  switch (recipientType) {
    case 'CLASS_TEACHER':
      return 'Class Teacher';
    case 'SCHOOL_ADMIN':
      return 'Admin';
    case 'ACCOUNTS':
      return 'Accounts';
    case 'PRINCIPAL':
      return 'Principal';
    default:
      return recipientType;
  }
}

/// Messages bottom-nav tab: a conversation list, a new-conversation compose flow (child picker
/// shown only when messaging the Class Teacher, since Admin/Accounts/Principal are school-wide),
/// and a thread view with reply.
class MessagesTab extends StatefulWidget {
  const MessagesTab({super.key, required this.accessToken, required this.api, required this.children});

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;

  @override
  State<MessagesTab> createState() => _MessagesTabState();
}

class _MessagesTabState extends State<MessagesTab> {
  _MessagesView _view = _MessagesView.list;
  List<ConversationSummary>? _conversations;
  String? _error;
  String? _openConversationId;
  ConversationDetail? _openConversation;

  @override
  void initState() {
    super.initState();
    _loadList();
  }

  Future<void> _loadList() async {
    try {
      final conversations = await widget.api.conversations(widget.accessToken);
      if (mounted) setState(() => _conversations = conversations);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _openThread(String id) async {
    setState(() {
      _view = _MessagesView.thread;
      _openConversationId = id;
      _openConversation = null;
    });
    await _refreshThread();
    try {
      await widget.api.markConversationRead(widget.accessToken, id);
      await _loadList();
    } on ApiException catch (_) {
      // Marking read is a convenience — the thread itself already loaded successfully.
    }
  }

  Future<void> _refreshThread() async {
    if (_openConversationId == null) return;
    try {
      final detail = await widget.api.conversation(widget.accessToken, _openConversationId!);
      if (mounted) setState(() => _openConversation = detail);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    switch (_view) {
      case _MessagesView.compose:
        return _ComposeView(
          accessToken: widget.accessToken,
          api: widget.api,
          children: widget.children,
          onCancel: () => setState(() => _view = _MessagesView.list),
          onSent: () {
            setState(() => _view = _MessagesView.list);
            _loadList();
          },
        );
      case _MessagesView.thread:
        return _ThreadView(
          accessToken: widget.accessToken,
          api: widget.api,
          conversationId: _openConversationId!,
          detail: _openConversation,
          onBack: () => setState(() => _view = _MessagesView.list),
          onSent: _refreshThread,
        );
      case _MessagesView.list:
        return _buildList();
    }
  }

  Widget _buildList() {
    if (_error != null) return Center(child: Text(_error!));
    final conversations = _conversations;
    if (conversations == null) return const Center(child: CircularProgressIndicator());

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton(
        key: const Key('newConversation'),
        onPressed: () => setState(() => _view = _MessagesView.compose),
        child: const Icon(Icons.add),
      ),
      body: conversations.isEmpty
          ? const Center(child: Text('No messages yet.'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: conversations.length,
              separatorBuilder: (_, _) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final c = conversations[i];
                return ListTile(
                  onTap: () => _openThread(c.id),
                  leading: Icon(c.unread ? Icons.circle : Icons.circle_outlined, size: 12),
                  title: Text(
                    c.otherPartyName,
                    style: TextStyle(fontWeight: c.unread ? FontWeight.bold : FontWeight.normal),
                  ),
                  subtitle: Text(recipientLabel(c.recipientType)),
                );
              },
            ),
    );
  }
}

class _ComposeView extends StatefulWidget {
  const _ComposeView({
    required this.accessToken,
    required this.api,
    required this.children,
    required this.onCancel,
    required this.onSent,
  });

  final String accessToken;
  final ApiClient api;
  final List<ChildSummary> children;
  final VoidCallback onCancel;
  final VoidCallback onSent;

  @override
  State<_ComposeView> createState() => _ComposeViewState();
}

class _ComposeViewState extends State<_ComposeView> {
  String _recipientType = 'CLASS_TEACHER';
  String? _studentId;
  final _bodyController = TextEditingController();
  bool _isSending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _studentId = widget.children.isNotEmpty ? widget.children.first.id : null;
  }

  @override
  void dispose() {
    _bodyController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_bodyController.text.trim().isEmpty) return;
    if (_recipientType == 'CLASS_TEACHER' && _studentId == null) return;
    setState(() {
      _isSending = true;
      _error = null;
    });
    try {
      await widget.api.startConversation(
        widget.accessToken,
        recipientType: _recipientType,
        studentId: _recipientType == 'CLASS_TEACHER' ? _studentId : null,
        body: _bodyController.text.trim(),
      );
      widget.onSent();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.close), onPressed: widget.onCancel),
        title: const Text('New message'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              key: const Key('recipientTypeField'),
              initialValue: _recipientType,
              items: const [
                DropdownMenuItem(value: 'CLASS_TEACHER', child: Text('Class Teacher')),
                DropdownMenuItem(value: 'SCHOOL_ADMIN', child: Text('Admin')),
                DropdownMenuItem(value: 'ACCOUNTS', child: Text('Accounts')),
                DropdownMenuItem(value: 'PRINCIPAL', child: Text('Principal')),
              ],
              onChanged: (value) => setState(() => _recipientType = value!),
              decoration: const InputDecoration(labelText: 'Send to'),
            ),
            if (_recipientType == 'CLASS_TEACHER') ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: const Key('studentField'),
                initialValue: _studentId,
                items: widget.children
                    .map((c) => DropdownMenuItem(value: c.id, child: Text(c.name)))
                    .toList(),
                onChanged: (value) => setState(() => _studentId = value),
                decoration: const InputDecoration(labelText: 'About which child?'),
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              key: const Key('bodyField'),
              controller: _bodyController,
              minLines: 3,
              maxLines: 6,
              enabled: !_isSending,
              decoration: const InputDecoration(labelText: 'Message', border: OutlineInputBorder()),
            ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 12),
            ElevatedButton(
              key: const Key('sendButton'),
              onPressed: _isSending ? null : _send,
              child: Text(_isSending ? 'Sending…' : 'Send'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThreadView extends StatefulWidget {
  const _ThreadView({
    required this.accessToken,
    required this.api,
    required this.conversationId,
    required this.detail,
    required this.onBack,
    required this.onSent,
  });

  final String accessToken;
  final ApiClient api;
  final String conversationId;
  final ConversationDetail? detail;
  final VoidCallback onBack;
  final Future<void> Function() onSent;

  @override
  State<_ThreadView> createState() => _ThreadViewState();
}

class _ThreadViewState extends State<_ThreadView> {
  final _replyController = TextEditingController();
  bool _isSending = false;
  String? _error;

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _reply() async {
    if (_replyController.text.trim().isEmpty) return;
    setState(() {
      _isSending = true;
      _error = null;
    });
    try {
      await widget.api.sendMessage(widget.accessToken, widget.conversationId, _replyController.text.trim());
      _replyController.clear();
      await widget.onSent();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final detail = widget.detail;
    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: widget.onBack),
        title: const Text('Conversation'),
      ),
      body: Column(
        children: [
          Expanded(
            child: detail == null
                ? const Center(child: CircularProgressIndicator())
                : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: detail.messages.length,
                    itemBuilder: (context, i) {
                      final m = detail.messages[i];
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: DirectionalText(m.body),
                      );
                    },
                  ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('replyField'),
                    controller: _replyController,
                    enabled: !_isSending,
                    decoration: const InputDecoration(hintText: 'Type a reply…'),
                  ),
                ),
                IconButton(
                  key: const Key('sendReplyButton'),
                  icon: const Icon(Icons.send),
                  onPressed: _isSending ? null : _reply,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

- [ ] **Step 4: Wire `MessagesTab` into `home_shell.dart`**

Add the import:

```dart
import 'messages_tab.dart';
```

Replace the `if (_tabIndex == 2) { ... }` block's successor — insert a new branch right after it, before the generic placeholder fallback:

```dart
    if (_tabIndex == 3) {
      final auth = context.read<AuthState>();
      final api = context.read<ApiClient>();
      return MessagesTab(accessToken: auth.accessToken!, api: api, children: _children);
    }

```

Update the placeholder `labels` list's comment context isn't required, but remove `'Messages'`'s now-stale implication by leaving the list as-is (`Fees`/`More` still land there) — no change needed to the `labels` array itself since index 3 is now handled above and never reaches the fallback.

- [ ] **Step 5: Run tests to verify they pass**

Run: `flutter test test/screens/messages_tab_test.dart`
Expected: PASS

- [ ] **Step 6: Run the full parent-app suite and analyze to confirm nothing broke**

Run: `flutter test && flutter analyze`
Expected: all tests PASS, no new analyzer issues.

- [ ] **Step 7: Commit**

```bash
git add lib/src/screens/messages_tab.dart lib/src/screens/home_shell.dart test/screens/messages_tab_test.dart
git commit -m "Add parent-app Messages tab: conversation list, compose, and thread reply"
```

---

## Task 11: Parent app — notification bell

**Files:**
- Create: `parent-app/lib/src/screens/notifications_sheet.dart`
- Create: `parent-app/test/screens/notifications_sheet_test.dart`
- Modify: `parent-app/lib/src/screens/home_shell.dart`

**Interfaces:**
- Consumes: `ApiClient.notifications/.markNotificationRead` (Task 9).

- [ ] **Step 1: Write the failing test**

Create `parent-app/test/screens/notifications_sheet_test.dart`:

```dart
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:parent_app/src/api/api_client.dart';
import 'package:parent_app/src/screens/notifications_sheet.dart';

void main() {
  testWidgets('lists notifications and reports the tapped type after marking it read', (tester) async {
    var markedRead = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/notifications') {
          return http.Response(
            jsonEncode([
              {
                'id': 'n1',
                'type': 'message',
                'title': 'New reply',
                'body': 'Sure thing.',
                'entityRef': 'conv-1',
                'readAt': markedRead ? '2026-08-29T01:00:00.000Z' : null,
                'createdAt': '2026-08-29T00:00:00.000Z',
              },
            ]),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/notifications/n1/read') {
          markedRead = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    String? openedType;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NotificationsSheet(accessToken: 'tok', api: api, onOpenType: (t) => openedType = t),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('New reply'), findsOneWidget);

    await tester.tap(find.byKey(const Key('notification-n1')));
    await tester.pumpAndSettle();

    expect(markedRead, true);
    expect(openedType, 'message');
  });

  testWidgets('"Mark all read" calls the bulk endpoint', (tester) async {
    var markedAllRead = false;
    final api = ApiClient(
      baseUrl: 'http://test',
      client: MockClient((request) async {
        if (request.method == 'GET' && request.url.path == '/api/v1/notifications') {
          return http.Response(
            jsonEncode([
              {
                'id': 'n1',
                'type': 'message',
                'title': 'New reply',
                'body': 'Sure thing.',
                'entityRef': 'conv-1',
                'readAt': null,
                'createdAt': '2026-08-29T00:00:00.000Z',
              },
            ]),
            200,
          );
        }
        if (request.method == 'POST' && request.url.path == '/api/v1/notifications/read-all') {
          markedAllRead = true;
          return http.Response('', 201);
        }
        return http.Response('not found', 404);
      }),
    );

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NotificationsSheet(accessToken: 'tok', api: api, onOpenType: (_) {}),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('markAllRead')));
    await tester.pumpAndSettle();

    expect(markedAllRead, true);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd parent-app && flutter test test/screens/notifications_sheet_test.dart`
Expected: FAIL — `notifications_sheet.dart` doesn't exist yet.

- [ ] **Step 3: Implement `notifications_sheet.dart`**

```dart
import 'package:flutter/material.dart';
import '../api/api_client.dart';
import '../api/models.dart';

/// Cross-cutting activity feed (diary/circular/message alerts), opened from HomeShell's AppBar
/// bell. Distinct from the Circulars tab, which stays the authoritative unread-tracking place for
/// circulars specifically — this sheet is an additive summary across all three event types.
class NotificationsSheet extends StatefulWidget {
  const NotificationsSheet({
    super.key,
    required this.accessToken,
    required this.api,
    required this.onOpenType,
  });

  final String accessToken;
  final ApiClient api;
  final ValueChanged<String> onOpenType;

  @override
  State<NotificationsSheet> createState() => _NotificationsSheetState();
}

class _NotificationsSheetState extends State<NotificationsSheet> {
  List<NotificationSummary>? _notifications;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final notifications = await widget.api.notifications(widget.accessToken);
      if (mounted) setState(() => _notifications = notifications);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  Future<void> _onTap(NotificationSummary n) async {
    if (n.readAt == null) {
      await widget.api.markNotificationRead(widget.accessToken, n.id);
    }
    widget.onOpenType(n.type);
  }

  Future<void> _onMarkAllRead() async {
    await widget.api.markAllNotificationsRead(widget.accessToken);
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) return Center(child: Text(_error!));
    final notifications = _notifications;
    if (notifications == null) return const Center(child: CircularProgressIndicator());
    if (notifications.isEmpty) return const Center(child: Text('No notifications yet.'));

    return Column(
      children: [
        Align(
          alignment: Alignment.centerRight,
          child: TextButton(
            key: const Key('markAllRead'),
            onPressed: _onMarkAllRead,
            child: const Text('Mark all read'),
          ),
        ),
        Expanded(
          child: ListView.separated(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: notifications.length,
            separatorBuilder: (_, _) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final n = notifications[i];
              final isUnread = n.readAt == null;
              return ListTile(
                key: Key('notification-${n.id}'),
                onTap: () => _onTap(n),
                leading: Icon(isUnread ? Icons.circle : Icons.circle_outlined, size: 12),
                title: Text(
                  n.title,
                  style: TextStyle(fontWeight: isUnread ? FontWeight.bold : FontWeight.normal),
                ),
                subtitle: Text(n.body),
              );
            },
          ),
        ),
      ],
    );
  }
}
```

- [ ] **Step 4: Wire the bell into `home_shell.dart`**

Add the import:

```dart
import 'notifications_sheet.dart';
```

Add state and a loader alongside the existing `_unreadCirculars` field:

```dart
  int _unreadNotifications = 0;
```

In `initState()`, alongside the existing `_loadCirculars();` call:

```dart
    _loadNotificationCount();
```

Add the loader method next to `_loadCirculars`:

```dart
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
          onOpenType: (type) {
            Navigator.of(context).pop();
            setState(() {
              if (type == 'diary') _tabIndex = 1;
              if (type == 'circular') _tabIndex = 2;
              if (type == 'message') _tabIndex = 3;
            });
          },
        ),
      ),
    );
    await _loadNotificationCount();
  }
```

Add the bell button to the `AppBar`'s `actions`, before the existing logout button:

```dart
          IconButton(
            key: const Key('notificationsButton'),
            icon: _unreadNotifications > 0
                ? Badge(label: Text('$_unreadNotifications'), child: const Icon(Icons.notifications_none))
                : const Icon(Icons.notifications_none),
            tooltip: 'Notifications',
            onPressed: _openNotifications,
          ),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `flutter test test/screens/notifications_sheet_test.dart`
Expected: PASS

- [ ] **Step 6: Run the full parent-app suite and analyze to confirm nothing broke**

Run: `flutter test && flutter analyze`
Expected: all tests PASS, no new analyzer issues. If `home_shell_test.dart`'s existing tests now fail because the `/api/v1/notifications` route isn't stubbed in their `MockClient`, add a `if (request.url.path == '/api/v1/notifications') return http.Response(jsonEncode([]), 200);` branch to each fixture in that file (the bell's own coverage lives in `notifications_sheet_test.dart`, so an empty stub here is correct, not a test gap).

- [ ] **Step 7: Commit**

```bash
git add lib/src/screens/notifications_sheet.dart lib/src/screens/home_shell.dart test/screens/notifications_sheet_test.dart
git commit -m "Add parent-app notification bell (HomeShell AppBar), separate from the Circulars tab"
```
