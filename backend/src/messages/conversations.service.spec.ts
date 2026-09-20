import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentAccessService } from '../common/student-access.service';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let prisma: {
    section: { findUnique: jest.Mock };
    teacher: { findUnique: jest.Mock };
    user: { findFirst: jest.Mock };
    conversation: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    message: { create: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let enrollment: { getCurrentEnrollment: jest.Mock };
  let notifications: { notify: jest.Mock };
  let studentAccess: { assertCanAccessStudent: jest.Mock };

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
    studentAccess = {
      assertCanAccessStudent: jest.fn().mockResolvedValue(undefined),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ConversationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollment },
        { provide: NotificationsService, useValue: notifications },
        { provide: StudentAccessService, useValue: studentAccess },
      ],
    }).compile();
    service = moduleRef.get(ConversationsService);
  });

  it('starting a CLASS_TEACHER conversation resolves the staff user via the section class teacher', async () => {
    enrollment.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({
      id: 'sec-1',
      classTeacherId: 'teacher-1',
    });
    prisma.teacher.findUnique.mockResolvedValue({
      id: 'teacher-1',
      userId: 'teacher-user-1',
    });
    prisma.conversation.create.mockResolvedValue({ id: 'conv-1' });

    const result = await service.create(
      { recipientType: 'CLASS_TEACHER', studentId: 'student-1', body: 'Hello' },
      { id: 'parent-1', role: 'PARENT' },
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
      expect.objectContaining({
        userId: 'teacher-user-1',
        type: 'message',
        entityRef: 'conv-1',
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'conversation.create',
          entity: 'Conversation',
        }),
      }),
    );
    expect(result).toEqual({ id: 'conv-1' });
  });

  it('throws BadRequestException if the section has no class teacher assigned', async () => {
    enrollment.getCurrentEnrollment.mockResolvedValue({ sectionId: 'sec-1' });
    prisma.section.findUnique.mockResolvedValue({
      id: 'sec-1',
      classTeacherId: null,
    });

    await expect(
      service.create(
        { recipientType: 'CLASS_TEACHER', studentId: 'student-1', body: 'Hi' },
        { id: 'parent-1', role: 'PARENT' },
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('starting a SCHOOL_ADMIN conversation resolves the earliest-created SCHOOL_ADMIN user', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
    prisma.conversation.create.mockResolvedValue({ id: 'conv-2' });

    await service.create(
      { recipientType: 'SCHOOL_ADMIN', body: 'Question' },
      { id: 'parent-1', role: 'PARENT' },
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { role: 'SCHOOL_ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('starting a PRINCIPAL conversation resolves the earliest isPrincipal=true user', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
    prisma.conversation.create.mockResolvedValue({ id: 'conv-3' });

    await service.create(
      { recipientType: 'PRINCIPAL', body: 'Question' },
      { id: 'parent-1', role: 'PARENT' },
    );

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { isPrincipal: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('throws BadRequestException if no user exists for the requested recipient type', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.create(
        { recipientType: 'ACCOUNTS', body: 'Hi' },
        { id: 'parent-1', role: 'PARENT' },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ForbiddenException if the parent cannot access the given student', async () => {
    studentAccess.assertCanAccessStudent.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(
      service.create(
        { recipientType: 'CLASS_TEACHER', studentId: 'student-1', body: 'Hi' },
        { id: 'parent-1', role: 'PARENT' },
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it("a parent's list shows the staff member's name and marks unread when their own read timestamp is stale", async () => {
    prisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        recipientType: 'CLASS_TEACHER',
        studentId: 'student-1',
        parentUser: {
          identifier: 'parent-a@schoolos.edu.pk',
          parentProfile: { name: 'Parent A' },
        },
        staffUser: {
          identifier: 'teacher@schoolos.edu.pk',
          teacher: { name: 'Ms. Sample Teacher' },
        },
        parentReadAt: new Date('2026-08-01T00:00:00.000Z'),
        staffReadAt: null,
        lastMessageAt: new Date('2026-08-02T00:00:00.000Z'),
      },
    ]);

    const result = await service.listForUser({
      id: 'parent-1',
      role: 'PARENT',
    });

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
        parentUser: {
          identifier: 'parent-a@schoolos.edu.pk',
          parentProfile: { name: 'Parent A' },
        },
        staffUser: {
          identifier: 'teacher@schoolos.edu.pk',
          teacher: { name: 'Ms. Sample Teacher' },
        },
        parentReadAt: new Date(),
        staffReadAt: new Date(),
        lastMessageAt: new Date('2026-08-02T00:00:00.000Z'),
      },
    ]);

    const matched = await service.listForUser(
      { id: 'teacher-user-1', role: 'TEACHER' },
      'parent a',
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].otherPartyName).toBe('Parent A');

    const unmatched = await service.listForUser(
      { id: 'teacher-user-1', role: 'TEACHER' },
      'nobody',
    );
    expect(unmatched).toHaveLength(0);
  });

  it("reply appends a message, bumps lastMessageAt, marks the sender's own read, and notifies the other party", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      parentUserId: 'parent-1',
      staffUserId: 'teacher-user-1',
    });

    await service.reply('conv-1', 'teacher-user-1', { body: 'Sure thing' });

    expect(prisma.message.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        senderId: 'teacher-user-1',
        body: 'Sure thing',
      },
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
    await expect(
      service.reply('missing', 'user-1', { body: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('getById is rejected for anyone not a party, 404s for unknown', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      parentUserId: 'parent-1',
      staffUserId: 'teacher-user-1',
      recipientType: 'CLASS_TEACHER',
      studentId: 'student-1',
      messages: [],
      parentUser: {
        identifier: 'parent-a@schoolos.edu.pk',
        parentProfile: { name: 'Parent A' },
      },
      staffUser: {
        identifier: 'teacher@schoolos.edu.pk',
        teacher: { name: 'Ms. Sample Teacher' },
      },
    });

    await expect(
      service.getById('conv-1', { id: 'someone-else', role: 'TEACHER' }),
    ).rejects.toThrow(ForbiddenException);

    prisma.conversation.findUnique.mockResolvedValue(null);
    await expect(
      service.getById('missing', { id: 'parent-1', role: 'PARENT' }),
    ).rejects.toThrow(NotFoundException);
  });

  it("getById labels each message with its sender's display name", async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      parentUserId: 'parent-1',
      staffUserId: 'teacher-user-1',
      recipientType: 'CLASS_TEACHER',
      studentId: 'student-1',
      messages: [
        {
          id: 'm1',
          senderId: 'parent-1',
          body: 'Hi',
          createdAt: new Date('2026-08-29T00:00:00.000Z'),
        },
        {
          id: 'm2',
          senderId: 'teacher-user-1',
          body: 'Sure',
          createdAt: new Date('2026-08-29T01:00:00.000Z'),
        },
      ],
      parentUser: {
        identifier: 'parent-a@schoolos.edu.pk',
        parentProfile: { name: 'Parent A' },
      },
      staffUser: {
        identifier: 'teacher@schoolos.edu.pk',
        teacher: { name: 'Ms. Sample Teacher' },
      },
    });

    const result = await service.getById('conv-1', {
      id: 'parent-1',
      role: 'PARENT',
    });

    expect(result.messages).toEqual([
      expect.objectContaining({
        id: 'm1',
        senderId: 'parent-1',
        senderName: 'Parent A',
      }),
      expect.objectContaining({
        id: 'm2',
        senderId: 'teacher-user-1',
        senderName: 'Ms. Sample Teacher',
      }),
    ]);
  });

  it('getById falls back to the identifier when a party has no name profile', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      parentUserId: 'parent-1',
      staffUserId: 'admin-user-1',
      recipientType: 'SCHOOL_ADMIN',
      studentId: null,
      messages: [
        {
          id: 'm1',
          senderId: 'admin-user-1',
          body: 'Hi',
          createdAt: new Date('2026-08-29T00:00:00.000Z'),
        },
      ],
      parentUser: {
        identifier: 'parent-a@schoolos.edu.pk',
        parentProfile: { name: 'Parent A' },
      },
      staffUser: { identifier: 'admin@schoolos.edu.pk', teacher: null },
    });

    const result = await service.getById('conv-1', {
      id: 'parent-1',
      role: 'PARENT',
    });

    expect(result.messages[0]).toEqual(
      expect.objectContaining({ senderName: 'admin@schoolos.edu.pk' }),
    );
  });
});
