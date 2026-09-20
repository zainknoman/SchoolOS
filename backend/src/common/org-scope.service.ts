import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from './student-access.service';

export interface OrgScope {
  unrestricted: boolean;
  denied: boolean;
  schoolId: string | null;
  campusId: string | null;
  campusWhere: Prisma.CampusWhereInput | undefined;
  allows(target: { campusId: string; schoolId: string }): boolean;
}

// Matches no campus — used only so `campusWhere` is never undefined for a denied caller.
const NO_CAMPUS: Prisma.CampusWhereInput = { id: '__no-access__' };

/**
 * The one place that turns "who is asking" into "which campuses may they touch". Every list /
 * ownership check that used to read `user.schoolId` directly goes through here, so a campus-level
 * principal (User.campusId set) is confined to their campus and a school-wide admin
 * (campusId null) to their school. SUPER_ADMIN is unrestricted.
 */
@Injectable()
export class OrgScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(user: RequestUser): Promise<OrgScope> {
    if (user.role === 'SUPER_ADMIN') {
      return {
        unrestricted: true,
        denied: false,
        schoolId: null,
        campusId: null,
        campusWhere: undefined,
        allows: () => true,
      };
    }
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
    });
    if (!account?.schoolId) {
      return {
        unrestricted: false,
        denied: true,
        schoolId: null,
        campusId: null,
        campusWhere: NO_CAMPUS,
        allows: () => false,
      };
    }
    const schoolId = account.schoolId;
    const campusId = account.campusId ?? null;
    return {
      unrestricted: false,
      denied: false,
      schoolId,
      campusId,
      campusWhere: campusId ? { id: campusId, schoolId } : { schoolId },
      allows: (target) =>
        target.schoolId === schoolId &&
        (campusId === null || target.campusId === campusId),
    };
  }

  async assertCampusAccess(user: RequestUser, campusId: string): Promise<void> {
    const scope = await this.resolve(user);
    if (scope.unrestricted) return;
    const campus = await this.prisma.campus.findUnique({
      where: { id: campusId },
      select: { id: true, schoolId: true },
    });
    if (
      !campus ||
      !scope.allows({ campusId: campus.id, schoolId: campus.schoolId })
    ) {
      throw new ForbiddenException('You do not have access to this campus');
    }
  }
}
