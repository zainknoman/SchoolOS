import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

export interface ChildSummary {
  id: string;
  name: string;
  grNumber: string;
  campus: string;
  class: string;
  section: string;
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Only ever returns students linked to THIS parent's profile (via StudentParent) — a parent can
   * never fetch a child they are not linked to, because the query is scoped by userId, not by an
   * open student/campus filter the caller could widen.
   */
  async getChildrenForUser(userId: string): Promise<ChildSummary[]> {
    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId },
      include: {
        children: {
          include: {
            student: {
              include: {
                enrollments: {
                  where: { status: 'ACTIVE' },
                  orderBy: { startDate: 'desc' },
                  take: 1,
                  include: {
                    campus: true,
                    section: { include: { class: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parentProfile) {
      return [];
    }

    return parentProfile.children.map(({ student }) => {
      const enrollment = student.enrollments[0];
      return {
        id: student.id,
        name: student.name,
        grNumber: student.grNumber,
        campus: enrollment.campus.name,
        class: enrollment.section.class.name,
        section: enrollment.section.name,
      };
    });
  }

  /**
   * Upsert by token (not userId+token) — a device token is unique per install, and if the same
   * device logs out and a different user logs back in on it, the token must move to the new
   * user, not create a stale duplicate row still pointing at the old one.
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: string,
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  /**
   * Partial update — only the fields present in the DTO are written, so a client can flip just
   * the channel or just the digest checkbox without needing to resend the other. The no-op
   * behavior for a channel with no resolvable destination (e.g. WHATSAPP with no ParentProfile
   * phone) lives in the adapter, not here — this write always succeeds.
   */
  async updateNotificationPreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.channel !== undefined && { notificationChannel: dto.channel }),
        ...(dto.digestEnabled !== undefined && { digestEnabled: dto.digestEnabled }),
      },
    });
  }
}
