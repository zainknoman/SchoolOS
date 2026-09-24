import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import type { RequestUser } from '../common/student-access.service';
import { AuthService } from './auth.service';

export interface AccountAccessStatus {
  id: string;
  identifier: string;
  role: string;
  disabled: boolean;
  lockedUntil: string | null;
}

type Placement = { schoolId: string; campusId: string | null };

/**
 * Admin control over an account's ability to sign in (BL-21, KG-23): disable, enable (which also
 * clears a failed-login lockout) and revoke every session. `User.isLocked` is the "disabled" flag;
 * JwtStrategy rejects a disabled user on the very next request.
 *
 * Scope: SUPER_ADMIN may act on any account except their own (acting on yourself is always
 * refused — use logout-all). A SCHOOL_ADMIN (or campus principal) may act only on an
 * account that sits ENTIRELY inside their scope: every school/campus the account is attached to
 * (its own school/campus, its Teacher/Staff campus, or — for a parent — the campuses of all its
 * children's active enrolments) must be allowed. A parent with children in two schools affects
 * both, so only SUPER_ADMIN may disable that identity.
 */
@Injectable()
export class AccountAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgScope: OrgScopeService,
    private readonly auth: AuthService,
  ) {}

  async status(targetId: string, actor: RequestUser) {
    const target = await this.assertCanManage(targetId, actor, 'view');
    return this.toStatus(target);
  }

  async disable(targetId: string, actor: RequestUser) {
    await this.assertCanManage(targetId, actor, 'change');
    await this.prisma.user.update({
      where: { id: targetId },
      data: { isLocked: true },
    });
    await this.auth.revokeAllSessions(targetId);
    await this.audit(actor, 'account.disable', targetId);
    return this.status(targetId, actor);
  }

  async enable(targetId: string, actor: RequestUser) {
    await this.assertCanManage(targetId, actor, 'change');
    await this.prisma.user.update({
      where: { id: targetId },
      data: { isLocked: false, lockedUntil: null, failedLoginCount: 0 },
    });
    await this.audit(actor, 'account.enable', targetId);
    return this.status(targetId, actor);
  }

  async revokeSessions(targetId: string, actor: RequestUser) {
    await this.assertCanManage(targetId, actor, 'change');
    await this.auth.revokeAllSessions(targetId);
    await this.audit(actor, 'account.revoke-sessions', targetId);
    return this.status(targetId, actor);
  }

  private async assertCanManage(
    targetId: string,
    actor: RequestUser,
    mode: 'view' | 'change',
  ) {
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        identifier: true,
        role: true,
        isLocked: true,
        lockedUntil: true,
        schoolId: true,
        campusId: true,
        campus: { select: { schoolId: true } },
        teacher: {
          select: { campus: { select: { id: true, schoolId: true } } },
        },
        staff: { select: { campus: { select: { id: true, schoolId: true } } } },
        parentProfile: {
          select: {
            children: {
              select: {
                student: {
                  select: {
                    enrollments: {
                      where: { status: 'ACTIVE' },
                      select: {
                        campus: { select: { id: true, schoolId: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!target) throw new NotFoundException('User not found');
    if (mode === 'change' && target.id === actor.id) {
      throw new BadRequestException(
        'You cannot disable, enable or revoke your own account here; use sign out of all devices.',
      );
    }

    const scope = await this.orgScope.resolve(actor);
    if (scope.unrestricted) return target;
    if (target.role === 'SUPER_ADMIN') {
      throw new ForbiddenException(
        'Only a super admin can manage this account',
      );
    }

    const placements: Placement[] = [];
    if (target.campusId && target.campus) {
      placements.push({
        schoolId: target.campus.schoolId,
        campusId: target.campusId,
      });
    } else if (target.schoolId) {
      placements.push({ schoolId: target.schoolId, campusId: null });
    }
    for (const c of [target.teacher?.campus, target.staff?.campus]) {
      if (c) placements.push({ schoolId: c.schoolId, campusId: c.id });
    }
    for (const link of target.parentProfile?.children ?? []) {
      for (const e of link.student.enrollments) {
        placements.push({ schoolId: e.campus.schoolId, campusId: e.campus.id });
      }
    }

    // A school-wide placement (campusId null) is only inside a school-wide admin's scope.
    const inScope = (p: Placement) =>
      p.campusId === null
        ? !scope.denied &&
          scope.campusId === null &&
          p.schoolId === scope.schoolId
        : scope.allows({ schoolId: p.schoolId, campusId: p.campusId });
    if (placements.length === 0 || !placements.every(inScope)) {
      throw new ForbiddenException(
        'This account is outside your school, or also belongs to another school; ask a super admin.',
      );
    }
    return target;
  }

  private toStatus(u: {
    id: string;
    identifier: string;
    role: string;
    isLocked: boolean;
    lockedUntil: Date | null;
  }): AccountAccessStatus {
    return {
      id: u.id,
      identifier: u.identifier,
      role: u.role,
      disabled: u.isLocked,
      lockedUntil:
        u.lockedUntil && u.lockedUntil.getTime() > Date.now()
          ? u.lockedUntil.toISOString()
          : null,
    };
  }

  private async audit(actor: RequestUser, action: string, targetId: string) {
    await this.prisma.auditLog.create({
      data: { userId: actor.id, action, entity: 'User', entityId: targetId },
    });
  }
}
