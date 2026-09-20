import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RequestUser } from '../common/student-access.service';

const STAFF_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];

/**
 * File-scoped counterpart to StudentAccessService — a parent may only read a file that's
 * actually attached to a diary entry in their child's section, or a circular they're a
 * recipient of. Staff may read any file.
 */
@Injectable()
export class FilesAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanAccessFile(user: RequestUser, fileId: string): Promise<void> {
    if (STAFF_ROLES.includes(user.role)) {
      return;
    }

    const viaDiary = await this.prisma.diaryAttachment.findFirst({
      where: {
        fileId,
        diaryEntry: {
          section: {
            enrollments: {
              some: {
                status: 'ACTIVE',
                student: {
                  parents: { some: { parentProfile: { userId: user.id } } },
                },
              },
            },
          },
        },
      },
    });
    if (viaDiary) return;

    const viaCircular = await this.prisma.circularAttachment.findFirst({
      where: {
        fileId,
        circular: { recipients: { some: { userId: user.id } } },
      },
    });
    if (viaCircular) return;

    throw new ForbiddenException('You do not have access to this file');
  }
}
