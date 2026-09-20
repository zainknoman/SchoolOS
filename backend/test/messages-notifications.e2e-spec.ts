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

    // Conversation.parentUserId/staffUserId cascade on user delete, but Message.senderId is
    // ON DELETE RESTRICT — a leftover Conversation from a prior run must be deleted explicitly
    // (which cascades its Messages) before any mn- user can be deleted.
    const stalePartyIds = (
      await prisma.user.findMany({
        where: { identifier: { startsWith: 'mn-' } },
        select: { id: true },
      })
    ).map((u) => u.id);
    await prisma.conversation
      .deleteMany({
        where: {
          OR: [
            { parentUserId: { in: stalePartyIds } },
            { staffUserId: { in: stalePartyIds } },
          ],
        },
      })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'mn-' } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'MN-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'MN E2E School' },
    });
    for (const s of stale) {
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const school = await prisma.school.create({
      data: { name: 'MN E2E School' },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'MN',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'MN Grade',
      },
    });
    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'MN-A' },
    });
    const otherSection = await prisma.section.create({
      data: { classId: klass.id, name: 'MN-B' },
    });
    ids.school = school.id;
    ids.section = section.id;

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'mn-teacher@schoolos.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    const teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'MN Teacher', campusId: campus.id },
    });
    await prisma.section.update({
      where: { id: section.id },
      data: { classTeacherId: teacher.id },
    });
    ids.teacherUserId = teacherUser.id;

    const otherTeacherUser = await prisma.user.create({
      data: {
        identifier: 'mn-other-teacher@schoolos.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    ids.otherTeacherUserId = otherTeacherUser.id;

    // createdAt is pinned to the epoch so this fixture admin is always the oldest `isPrincipal`
    // row — resolveStaffUserId() for PRINCIPAL picks `orderBy: { createdAt: 'asc' }`, and this
    // dev.db already has a seeded principal (admin@schoolos.edu.pk) created before this test runs.
    const adminUser = await prisma.user.create({
      data: {
        identifier: 'mn-admin@schoolos.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
        isPrincipal: true,
        createdAt: new Date(0),
      },
    });
    ids.adminUserId = adminUser.id;

    const parentUser = await prisma.user.create({
      data: {
        identifier: 'mn-parent@schoolos.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    const otherParentUser = await prisma.user.create({
      data: {
        identifier: 'mn-other-parent@schoolos.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    ids.otherParentUserId = otherParentUser.id;
    const parentProfile = await prisma.parentProfile.create({
      data: { userId: parentUser.id, name: 'MN Parent' },
    });

    const child = await prisma.student.create({
      data: { grNumber: 'MN-1', name: 'MN Child' },
    });
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
    const orphanChild = await prisma.student.create({
      data: { grNumber: 'MN-2', name: 'MN Orphan' },
    });
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

    const otherParentProfile = await prisma.parentProfile.create({
      data: { userId: otherParentUser.id, name: 'MN Other Parent' },
    });
    const otherChild = await prisma.student.create({
      data: { grNumber: 'MN-3', name: 'MN Other Child' },
    });
    await prisma.enrollment.create({
      data: {
        studentId: otherChild.id,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.studentParent.create({
      data: {
        studentId: otherChild.id,
        parentProfileId: otherParentProfile.id,
      },
    });
    ids.otherChildId = otherChild.id;
  });

  afterAll(async () => {
    await prisma.student
      .deleteMany({ where: { grNumber: { in: ['MN-1', 'MN-2', 'MN-3'] } } })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.school } })
      .catch(() => undefined);
    // Same RESTRICT-vs-CASCADE ordering as the pre-flight cleanup above: delete this run's
    // Conversations (cascades their Messages) before deleting the mn- users who sent them.
    const partyIds = (
      await prisma.user.findMany({
        where: { identifier: { startsWith: 'mn-' } },
        select: { id: true },
      })
    ).map((u) => u.id);
    await prisma.conversation
      .deleteMany({
        where: {
          OR: [
            { parentUserId: { in: partyIds } },
            { staffUserId: { in: partyIds } },
          ],
        },
      })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'mn-' } } })
      .catch(() => undefined);
    await app.close();
  });

  it('a parent starts a conversation with the class teacher, the teacher sees and replies, and both get notified', async () => {
    const parentToken = await loginAs('mn-parent@schoolos.edu.pk');

    const start = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        recipientType: 'CLASS_TEACHER',
        studentId: ids.childId,
        body: 'Can we talk about homework?',
      })
      .expect(201);
    ids.conversationId = start.body.id;

    const teacherToken = await loginAs('mn-teacher@schoolos.edu.pk');
    const inbox = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(inbox.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.conversationId, unread: true }),
      ]),
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
        expect.objectContaining({
          type: 'message',
          entityRef: ids.conversationId,
          readAt: null,
        }),
      ]),
    );
  });

  it('another parent and another teacher cannot read or reply to this conversation', async () => {
    const otherParentToken = await loginAs('mn-other-parent@schoolos.edu.pk');
    await request(app.getHttpServer())
      .get(`/api/v1/conversations/${ids.conversationId}`)
      .set('Authorization', `Bearer ${otherParentToken}`)
      .expect(403);

    const otherTeacherToken = await loginAs('mn-other-teacher@schoolos.edu.pk');
    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${ids.conversationId}/messages`)
      .set('Authorization', `Bearer ${otherTeacherToken}`)
      .send({ body: 'butting in' })
      .expect(403);
  });

  it("a parent cannot start a CLASS_TEACHER conversation using another parent's child's studentId", async () => {
    const parentToken = await loginAs('mn-parent@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        recipientType: 'CLASS_TEACHER',
        studentId: ids.otherChildId,
        body: 'Not my child',
      })
      .expect(403);
  });

  it('a TEACHER cannot start a new conversation to a parent', async () => {
    const teacherToken = await loginAs('mn-teacher@schoolos.edu.pk');
    await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ recipientType: 'SCHOOL_ADMIN', body: 'x' })
      .expect(403);
  });

  it('a parent can message the Principal, resolved via isPrincipal', async () => {
    const parentToken = await loginAs('mn-parent@schoolos.edu.pk');
    const res = await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        recipientType: 'PRINCIPAL',
        body: 'A question for the principal.',
      })
      .expect(201);

    const adminToken = await loginAs('mn-admin@schoolos.edu.pk');
    const inbox = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(inbox.body.map((c: { id: string }) => c.id)).toContain(res.body.id);
  });

  it('starting a CLASS_TEACHER conversation for a section with no class teacher assigned returns 400', async () => {
    const parentToken = await loginAs('mn-parent@schoolos.edu.pk');
    await request(app.getHttpServer())
      .post('/api/v1/conversations')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        recipientType: 'CLASS_TEACHER',
        studentId: ids.orphanChildId,
        body: 'Hi',
      })
      .expect(400);
  });

  it('a notification can be marked read individually and in bulk', async () => {
    const parentToken = await loginAs('mn-parent@schoolos.edu.pk');
    const before = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);
    const unread = before.body.find(
      (n: { readAt: string | null }) => n.readAt === null,
    );
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
    expect(
      after.body.every((n: { readAt: string | null }) => n.readAt !== null),
    ).toBe(true);
  });
});
