import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import {
  RequestUser,
  StudentAccessService,
} from '../common/student-access.service';

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
  senderName: string;
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
    private readonly studentAccess: StudentAccessService,
  ) {}

  async create(
    dto: CreateConversationDto,
    parentUser: RequestUser,
  ): Promise<{ id: string }> {
    if (dto.studentId) {
      await this.studentAccess.assertCanAccessStudent(
        parentUser,
        dto.studentId,
      );
    }

    const staffUserId = await this.resolveStaffUserId(dto);

    const conversation = await this.prisma.conversation.create({
      data: {
        parentUserId: parentUser.id,
        staffUserId,
        recipientType: dto.recipientType,
        studentId: dto.recipientType === 'CLASS_TEACHER' ? dto.studentId : null,
        parentReadAt: new Date(),
        messages: { create: [{ senderId: parentUser.id, body: dto.body }] },
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: parentUser.id,
        action: 'conversation.create',
        entity: 'Conversation',
        entityId: conversation.id,
        metadata: JSON.stringify({
          recipientType: dto.recipientType,
          studentId: dto.studentId,
        }),
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

  private async resolveStaffUserId(
    dto: CreateConversationDto,
  ): Promise<string> {
    if (dto.recipientType === 'CLASS_TEACHER') {
      const enrollment = await this.enrollmentService.getCurrentEnrollment(
        dto.studentId as string,
      );
      const section = await this.prisma.section.findUnique({
        where: { id: enrollment.sectionId },
      });
      if (!section?.classTeacherId) {
        throw new BadRequestException(
          "This student's section has no class teacher assigned yet",
        );
      }
      const teacher = await this.prisma.teacher.findUnique({
        where: { id: section.classTeacherId },
      });
      return teacher!.userId;
    }

    const where =
      dto.recipientType === 'PRINCIPAL'
        ? { isPrincipal: true }
        : dto.recipientType === 'ACCOUNTS'
          ? // BL-32: only an ACCOUNTS user granted MESSAGES can receive parent messages.
            { role: dto.recipientType, grants: { has: 'MESSAGES' as const } }
          : { role: dto.recipientType };
    const user = await this.prisma.user.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
    });
    if (!user) {
      throw new BadRequestException(
        `No ${dto.recipientType} account exists yet`,
      );
    }
    return user.id;
  }

  async listForUser(
    user: RequestUser,
    q?: string,
  ): Promise<ConversationSummary[]> {
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
    return summaries.filter((s) =>
      s.otherPartyName.toLowerCase().includes(needle),
    );
  }

  async getById(
    conversationId: string,
    user: RequestUser,
  ): Promise<ConversationDetail> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        parentUser: { include: { parentProfile: true } },
        staffUser: { include: { teacher: true } },
      },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    if (
      conversation.parentUserId !== user.id &&
      conversation.staffUserId !== user.id
    ) {
      throw new ForbiddenException('You are not a party to this conversation');
    }

    // Every message's sender is one of this conversation's exactly two parties — resolve the
    // display name once per party rather than per message.
    const parentName =
      conversation.parentUser.parentProfile?.name ??
      conversation.parentUser.identifier;
    const staffName =
      conversation.staffUser.teacher?.name ?? conversation.staffUser.identifier;

    return {
      id: conversation.id,
      recipientType: conversation.recipientType,
      studentId: conversation.studentId,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName:
          m.senderId === conversation.parentUserId ? parentName : staffName,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  async reply(
    conversationId: string,
    userId: string,
    dto: SendMessageDto,
  ): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }
    const isParent = conversation.parentUserId === userId;
    const isStaff = conversation.staffUserId === userId;
    if (!isParent && !isStaff) {
      throw new ForbiddenException('You are not a party to this conversation');
    }

    const now = new Date();
    await this.prisma.message.create({
      data: { conversationId, senderId: userId, body: dto.body },
    });
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        ...(isParent ? { parentReadAt: now } : { staffReadAt: now }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'message.send',
        entity: 'Conversation',
        entityId: conversationId,
      },
    });

    const recipientId = isParent
      ? conversation.staffUserId
      : conversation.parentUserId;
    await this.notifications.notify({
      userId: recipientId,
      type: 'message',
      title: 'New message',
      body: dto.body,
      entityRef: conversationId,
    });
  }

  async markRead(conversationId: string, user: RequestUser): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
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
      data: isParent
        ? { parentReadAt: new Date() }
        : { staffReadAt: new Date() },
    });
  }
}
