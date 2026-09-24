import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrgScopeService } from '../common/org-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCircularDto } from './dto/create-circular.dto';
import { RequestUser } from '../common/student-access.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CircularSummary {
  id: string;
  title: string;
  description: string;
  scope: string;
  priority: string;
  publishedAt: string;
  expiresAt: string | null;
  attachments: { id: string; originalName: string; mimeType: string }[];
  readAt: string | null;
}

interface CircularWithAttachments {
  id: string;
  title: string;
  description: string;
  scope: string;
  priority: string;
  publishedAt: Date;
  expiresAt: Date | null;
  attachments: {
    file: { id: string; originalName: string; mimeType: string };
  }[];
}

@Injectable()
export class CircularsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly orgScope: OrgScopeService,
  ) {}

  /**
   * BL-20: every circular belongs to one school. A section circular takes the section's school
   * (the section must be in the author's scope); a school-wide one goes to the author's school —
   * or, for SUPER_ADMIN, the given schoolId — and only to parents of children actively enrolled
   * in that school (a campus principal reaches only their campus). Before BL-20 it went to every
   * parent in the database.
   */
  private async resolveAudience(
    dto: CreateCircularDto,
    author: RequestUser,
  ): Promise<{ schoolId: string; campusWhere: Prisma.CampusWhereInput }> {
    const scope = await this.orgScope.resolve(author);
    if (scope.denied) {
      throw new ForbiddenException('No school is linked to this account');
    }
    if (dto.scope === 'section') {
      const section = await this.prisma.section.findUnique({
        where: { id: dto.sectionId },
        select: {
          class: {
            select: { campusId: true, campus: { select: { schoolId: true } } },
          },
        },
      });
      if (!section) throw new BadRequestException('Section not found');
      const target = {
        campusId: section.class.campusId,
        schoolId: section.class.campus.schoolId,
      };
      if (!scope.allows(target)) {
        throw new ForbiddenException('You do not have access to this section');
      }
      return {
        schoolId: target.schoolId,
        campusWhere: { id: target.campusId },
      };
    }
    if (scope.unrestricted) {
      if (!dto.schoolId) {
        throw new BadRequestException(
          'schoolId is required for a school-wide circular published by a super admin',
        );
      }
      const school = await this.prisma.school.findUnique({
        where: { id: dto.schoolId },
        select: { id: true },
      });
      if (!school) throw new BadRequestException('School not found');
      return { schoolId: school.id, campusWhere: { schoolId: school.id } };
    }
    if (dto.schoolId && dto.schoolId !== scope.schoolId) {
      throw new ForbiddenException('You can only publish to your own school');
    }
    return {
      schoolId: scope.schoolId as string,
      campusWhere: scope.campusWhere as Prisma.CampusWhereInput,
    };
  }

  async publish(dto: CreateCircularDto, author: RequestUser) {
    const authorId = author.id;
    const audience = await this.resolveAudience(dto, author);
    const circular = await this.prisma.circular.create({
      data: {
        schoolId: audience.schoolId,
        title: dto.title,
        description: dto.description,
        scope: dto.scope,
        sectionId: dto.scope === 'section' ? dto.sectionId : null,
        priority: dto.priority ?? 'normal',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        authorId,
      },
    });

    if (dto.fileIds?.length) {
      await this.prisma.circularAttachment.createMany({
        data: dto.fileIds.map((fileId) => ({
          circularId: circular.id,
          fileId,
        })),
      });
    }

    const recipients =
      dto.scope === 'school'
        ? await this.prisma.user.findMany({
            where: {
              role: 'PARENT',
              parentProfile: {
                children: {
                  some: {
                    student: {
                      enrollments: {
                        some: {
                          status: 'ACTIVE',
                          campus: audience.campusWhere,
                        },
                      },
                    },
                  },
                },
              },
            },
            select: { id: true },
          })
        : await this.prisma.user.findMany({
            where: {
              role: 'PARENT',
              parentProfile: {
                children: {
                  some: {
                    student: {
                      enrollments: {
                        some: { sectionId: dto.sectionId, status: 'ACTIVE' },
                      },
                    },
                  },
                },
              },
            },
            select: { id: true },
          });

    if (recipients.length) {
      await this.prisma.circularRecipient.createMany({
        data: recipients.map((r) => ({
          circularId: circular.id,
          userId: r.id,
        })),
      });
    }

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

    await this.prisma.auditLog.create({
      data: {
        userId: authorId,
        action: 'circular.publish',
        entity: 'Circular',
        entityId: circular.id,
        metadata: JSON.stringify({
          scope: dto.scope,
          sectionId: dto.sectionId,
          recipients: recipients.length,
        }),
      },
    });

    return circular;
  }

  async listForUser(user: RequestUser): Promise<CircularSummary[]> {
    if (user.role === 'PARENT') {
      const rows = await this.prisma.circularRecipient.findMany({
        where: { userId: user.id },
        include: {
          circular: { include: { attachments: { include: { file: true } } } },
        },
        orderBy: { circular: { publishedAt: 'desc' } },
      });
      return rows.map((r) => this.toSummary(r.circular, r.readAt));
    }

    const circulars = await this.prisma.circular.findMany({
      where: { authorId: user.id },
      include: { attachments: { include: { file: true } } },
      orderBy: { publishedAt: 'desc' },
    });
    return circulars.map((c) => this.toSummary(c, null));
  }

  async markRead(circularId: string, userId: string): Promise<void> {
    const result = await this.prisma.circularRecipient.updateMany({
      where: { circularId, userId },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException('Circular not found for this recipient');
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'circular.read',
        entity: 'Circular',
        entityId: circularId,
      },
    });
  }

  async getStats(
    circularId: string,
    actor: RequestUser,
  ): Promise<{ delivered: number; read: number }> {
    const circular = await this.prisma.circular.findUnique({
      where: { id: circularId },
    });
    if (!circular) {
      throw new NotFoundException('Circular not found');
    }
    // BL-20: another school's circular is not yours to inspect (a legacy null-school one: SUPER_ADMIN).
    const scope = await this.orgScope.resolve(actor);
    if (
      !scope.unrestricted &&
      (scope.denied ||
        !circular.schoolId ||
        circular.schoolId !== scope.schoolId)
    ) {
      throw new NotFoundException('Circular not found');
    }
    const delivered = await this.prisma.circularRecipient.count({
      where: { circularId },
    });
    const read = await this.prisma.circularRecipient.count({
      where: { circularId, readAt: { not: null } },
    });
    return { delivered, read };
  }

  private toSummary(
    circular: CircularWithAttachments,
    readAt: Date | null,
  ): CircularSummary {
    return {
      id: circular.id,
      title: circular.title,
      description: circular.description,
      scope: circular.scope,
      priority: circular.priority,
      publishedAt: circular.publishedAt.toISOString(),
      expiresAt: circular.expiresAt ? circular.expiresAt.toISOString() : null,
      attachments: circular.attachments.map((a) => ({
        id: a.file.id,
        originalName: a.file.originalName,
        mimeType: a.file.mimeType,
      })),
      readAt: readAt ? readAt.toISOString() : null,
    };
  }
}
