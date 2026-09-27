import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import {
  StudentAccessService,
  type RequestUser,
} from '../common/student-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FilesService } from '../files/files.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import type {
  AddComplaintNoteDto,
  UpdateComplaintDto,
} from './dto/complaint-workflow.dto';

const STAFF_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'ACCOUNTS', 'SUPER_ADMIN'];

export interface ComplaintPerson {
  id: string;
  role: string;
  name: string;
}

export interface ComplaintAttachmentSummary {
  id: string;
  fileId: string;
  originalName: string;
  createdAt: string;
}

/** What a parent sees: never internal notes, the owner or staff identities (Q10, RD-9). */
export interface ParentComplaintView {
  id: string;
  studentId: string;
  category: string;
  subject: string;
  description: string;
  status: string;
  resolution: string | null;
  resolvedAt: string | null;
  raisedByMe: boolean;
  responses: Array<{
    id: string;
    body: string;
    fromSchool: boolean;
    createdAt: string;
  }>;
  attachments: ComplaintAttachmentSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffComplaintView {
  id: string;
  studentId: string;
  studentName: string;
  grNumber: string;
  schoolId: string | null;
  raisedById: string;
  raisedBy: ComplaintPerson | null;
  category: string;
  subject: string;
  description: string;
  status: string;
  assignedTo: ComplaintPerson | null;
  resolution: string | null;
  resolvedAt: string | null;
  resolvedBy: ComplaintPerson | null;
  notes: Array<{
    id: string;
    body: string;
    internal: boolean;
    author: ComplaintPerson | null;
    createdAt: string;
  }>;
  attachments: ComplaintAttachmentSummary[];
  createdAt: string;
  updatedAt: string;
}

const PERSON = {
  select: {
    id: true,
    role: true,
    identifier: true,
    teacher: { select: { name: true } },
    staff: { select: { name: true } },
    parentProfile: { select: { name: true } },
  },
} as const;

const DETAIL = {
  student: { select: { name: true, grNumber: true } },
  raisedBy: PERSON,
  assignedTo: PERSON,
  resolvedBy: PERSON,
  notes: { orderBy: { createdAt: 'asc' }, include: { author: PERSON } },
  attachments: {
    orderBy: { createdAt: 'asc' },
    include: { file: { select: { originalName: true } } },
  },
} satisfies Prisma.ComplaintInclude;

type ComplaintDetail = Prisma.ComplaintGetPayload<{ include: typeof DETAIL }>;
type PersonRow = Prisma.UserGetPayload<typeof PERSON>;

/**
 * BL-30 (Q10, RD-9): complaints about a student. Parents raise them about their own children and
 * see only their own (plus those staff recorded), without internal notes; staff of the student's
 * school (campus, for campus-level users) run the queue — owner, notes, replies, resolution.
 * Every change is audited.
 */
@Injectable()
export class ComplaintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentAccess: StudentAccessService,
    private readonly orgScope: OrgScopeService,
    private readonly notifications: NotificationsService,
    private readonly files: FilesService,
  ) {}

  private isStaff(user: RequestUser) {
    return STAFF_ROLES.includes(user.role);
  }

  private person(u: PersonRow | null): ComplaintPerson | null {
    if (!u) return null;
    return {
      id: u.id,
      role: u.role,
      name:
        u.teacher?.name ??
        u.staff?.name ??
        u.parentProfile?.name ??
        u.identifier,
    };
  }

  private attachments(c: ComplaintDetail): ComplaintAttachmentSummary[] {
    return c.attachments.map((a) => ({
      id: a.id,
      fileId: a.fileId,
      originalName: a.file.originalName,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  toStaffView(c: ComplaintDetail): StaffComplaintView {
    return {
      id: c.id,
      studentId: c.studentId,
      studentName: c.student.name,
      grNumber: c.student.grNumber,
      schoolId: c.schoolId,
      raisedById: c.raisedById,
      raisedBy: this.person(c.raisedBy),
      category: c.category,
      subject: c.subject,
      description: c.description,
      status: c.status,
      assignedTo: this.person(c.assignedTo),
      resolution: c.resolution,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
      resolvedBy: this.person(c.resolvedBy),
      notes: c.notes.map((n) => ({
        id: n.id,
        body: n.body,
        internal: n.internal,
        author: this.person(n.author),
        createdAt: n.createdAt.toISOString(),
      })),
      attachments: this.attachments(c),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  toParentView(c: ComplaintDetail, parentUserId: string): ParentComplaintView {
    return {
      id: c.id,
      studentId: c.studentId,
      category: c.category,
      subject: c.subject,
      description: c.description,
      status: c.status,
      resolution: c.resolution,
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
      raisedByMe: c.raisedById === parentUserId,
      responses: c.notes
        .filter((n) => !n.internal)
        .map((n) => ({
          id: n.id,
          body: n.body,
          fromSchool: n.author?.role !== 'PARENT',
          createdAt: n.createdAt.toISOString(),
        })),
      attachments: this.attachments(c),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  view(c: ComplaintDetail, user: RequestUser) {
    return this.isStaff(user)
      ? this.toStaffView(c)
      : this.toParentView(c, user.id);
  }

  /** Parents see complaints they raised and those staff recorded — not another guardian's. */
  private parentVisible(parentUserId: string): Prisma.ComplaintWhereInput {
    return {
      OR: [
        { raisedById: parentUserId },
        { raisedBy: { role: { not: 'PARENT' } } },
      ],
    };
  }

  private async load(id: string): Promise<ComplaintDetail> {
    const c = await this.prisma.complaint.findUnique({
      where: { id },
      include: DETAIL,
    });
    if (!c) throw new NotFoundException('Complaint not found');
    return c;
  }

  /** Loads a complaint the caller may see (403 otherwise). */
  async getForUser(id: string, user: RequestUser): Promise<ComplaintDetail> {
    const c = await this.load(id);
    await this.studentAccess.assertCanAccessStudent(user, c.studentId);
    if (
      !this.isStaff(user) &&
      c.raisedById !== user.id &&
      c.raisedBy.role === 'PARENT'
    ) {
      throw new ForbiddenException('You do not have access to this complaint');
    }
    return c;
  }

  private async audit(
    userId: string,
    action: string,
    complaintId: string,
    metadata: object,
  ) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action,
        entity: 'Complaint',
        entityId: complaintId,
        metadata: JSON.stringify(metadata),
      },
    });
  }

  private async schoolOfStudent(studentId: string): Promise<string | null> {
    const e = await this.prisma.enrollment.findFirst({
      where: { studentId },
      orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
      select: { campus: { select: { schoolId: true } } },
    });
    return e?.campus.schoolId ?? null;
  }

  /** Caller access to the student is checked by the controller. */
  async create(dto: CreateComplaintDto, user: RequestUser) {
    const record = await this.prisma.complaint.create({
      data: {
        studentId: dto.studentId,
        schoolId: await this.schoolOfStudent(dto.studentId),
        raisedById: user.id,
        category: dto.category ?? 'OTHER',
        subject: dto.subject,
        description: dto.description,
        status: 'open',
      },
    });
    await this.audit(user.id, 'complaint.create', record.id, {
      studentId: dto.studentId,
      category: record.category,
    });
    return this.view(await this.load(record.id), user);
  }

  async findForStudent(studentId: string, user: RequestUser) {
    const records = await this.prisma.complaint.findMany({
      where: {
        studentId,
        ...(this.isStaff(user) ? {} : this.parentVisible(user.id)),
      },
      include: DETAIL,
      orderBy: { createdAt: 'desc' },
    });
    return records.map((r) => this.view(r, user));
  }

  /**
   * Staff queue: SCHOOL_ADMIN / ACCOUNTS (with the grant) see their school's (campus's)
   * complaints; a TEACHER sees those assigned to them; SUPER_ADMIN may narrow by school.
   */
  async queue(
    user: RequestUser,
    filter: {
      status?: string;
      category?: string;
      assigned?: string;
      schoolId?: string;
    },
  ): Promise<StaffComplaintView[]> {
    const scope = await this.orgScope.resolve(user);
    const where: Prisma.ComplaintWhereInput[] = [];
    if (user.role === 'TEACHER') {
      where.push({ assignedToId: user.id });
    } else if (!scope.unrestricted) {
      const campusWhere = scope.campusWhere ?? { id: '__none__' };
      where.push({
        student: { enrollments: { some: { campus: campusWhere } } },
        OR: [{ schoolId: scope.schoolId }, { schoolId: null }],
      });
    } else if (filter.schoolId) {
      where.push({ schoolId: filter.schoolId });
    }
    if (filter.status) where.push({ status: filter.status });
    if (filter.category) {
      where.push({
        category:
          filter.category as Prisma.EnumComplaintCategoryFilter['equals'],
      });
    }
    if (filter.assigned === 'me') where.push({ assignedToId: user.id });
    if (filter.assigned === 'none') where.push({ assignedToId: null });
    const records = await this.prisma.complaint.findMany({
      where: { AND: where },
      include: DETAIL,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    });
    return records.map((r) => this.toStaffView(r));
  }

  /** Staff of the complaint's school who can own it (admins, teachers, granted accounts). */
  async assignees(c: ComplaintDetail): Promise<ComplaintPerson[]> {
    const schoolId = c.schoolId ?? (await this.schoolOfStudent(c.studentId));
    if (!schoolId) return [];
    const users = await this.prisma.user.findMany({
      where: {
        schoolId,
        OR: [
          { role: { in: ['SCHOOL_ADMIN', 'TEACHER'] } },
          { role: 'ACCOUNTS', grants: { has: 'COMPLAINTS' } },
        ],
      },
      ...PERSON,
      orderBy: { identifier: 'asc' },
    });
    return users.map((u) => this.person(u)!);
  }

  /** Access to the complaint (staff of its school) is checked by the controller. */
  async update(
    c: ComplaintDetail,
    dto: UpdateComplaintDto,
    user: RequestUser,
  ): Promise<StaffComplaintView> {
    const data: Prisma.ComplaintUncheckedUpdateInput = {};
    const changes: Record<string, unknown> = {};

    if (dto.assignedToId !== undefined && dto.assignedToId !== c.assignedToId) {
      if (dto.assignedToId !== null) {
        const allowed = await this.assignees(c);
        if (!allowed.some((p) => p.id === dto.assignedToId)) {
          throw new BadRequestException(
            "The owner must be a staff member of the student's school",
          );
        }
      }
      data.assignedToId = dto.assignedToId;
      changes.assignedToId = dto.assignedToId;
    }
    if (dto.resolution !== undefined && dto.resolution !== c.resolution) {
      data.resolution = dto.resolution;
      changes.resolution = dto.resolution;
    }
    if (dto.status !== undefined && dto.status !== c.status) {
      const resolution = dto.resolution ?? c.resolution;
      if (dto.status === 'resolved' && !resolution?.trim()) {
        throw new BadRequestException(
          'Write a resolution before resolving the complaint',
        );
      }
      data.status = dto.status;
      data.resolvedAt = dto.status === 'resolved' ? new Date() : null;
      data.resolvedById = dto.status === 'resolved' ? user.id : null;
      changes.status = { from: c.status, to: dto.status };
    }
    if (Object.keys(changes).length === 0) return this.toStaffView(c);

    await this.prisma.complaint.update({ where: { id: c.id }, data });
    await this.audit(user.id, 'complaint.update', c.id, changes);

    if (changes.assignedToId) {
      await this.notifications.notify({
        userId: changes.assignedToId as string,
        type: 'complaint',
        title: 'Complaint assigned to you',
        body: c.subject,
        entityRef: c.id,
      });
    }
    if (changes.status && c.raisedBy.role === 'PARENT') {
      await this.notifications.notify({
        userId: c.raisedById,
        type: 'complaint',
        title: `Your complaint is ${dto.status!.replace('_', ' ')}`,
        body: c.subject,
        entityRef: c.id,
      });
    }
    return this.toStaffView(await this.load(c.id));
  }

  /** Staff choose internal or not; a parent's comment is always visible to the school. */
  async addNote(
    c: ComplaintDetail,
    dto: AddComplaintNoteDto,
    user: RequestUser,
  ) {
    const internal = this.isStaff(user) ? dto.internal : false;
    const note = await this.prisma.complaintNote.create({
      data: { complaintId: c.id, authorId: user.id, body: dto.body, internal },
    });
    await this.prisma.complaint.update({
      where: { id: c.id },
      data: { updatedAt: new Date() },
    });
    await this.audit(user.id, 'complaint.note', c.id, {
      noteId: note.id,
      internal,
    });
    if (!internal && this.isStaff(user) && c.raisedBy.role === 'PARENT') {
      await this.notifications.notify({
        userId: c.raisedById,
        type: 'complaint',
        title: 'The school replied to your complaint',
        body: c.subject,
        entityRef: c.id,
      });
    }
    return this.view(await this.load(c.id), user);
  }

  async attach(
    c: ComplaintDetail,
    file: Express.Multer.File,
    user: RequestUser,
  ) {
    const stored = await this.files.upload(file, user.id);
    await this.prisma.complaintAttachment.create({
      data: { complaintId: c.id, fileId: stored.id, uploadedById: user.id },
    });
    await this.audit(user.id, 'complaint.attach', c.id, { fileId: stored.id });
    return this.view(await this.load(c.id), user);
  }
}
