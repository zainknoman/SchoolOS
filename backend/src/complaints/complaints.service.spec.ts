import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudentAccessService } from '../common/student-access.service';
import type { OrgScopeService } from '../common/org-scope.service';
import type { NotificationsService } from '../notifications/notifications.service';
import type { FilesService } from '../files/files.service';

/** BL-30: the complaint workflow rules (visibility, resolution, assignment, notes). */
describe('ComplaintsService', () => {
  let prisma: Record<string, any>;
  let notifications: { notify: jest.Mock };
  let access: { assertCanAccessStudent: jest.Mock };
  let service: ComplaintsService;

  const person = (id: string, role: string, name = id) => ({
    id,
    role,
    identifier: id,
    teacher: role === 'TEACHER' ? { name } : null,
    staff: null,
    parentProfile: role === 'PARENT' ? { name } : null,
  });
  const detail = (over: object = {}) => ({
    id: 'c1',
    studentId: 's1',
    schoolId: 'school-1',
    raisedById: 'parent-1',
    raisedBy: person('parent-1', 'PARENT', 'Parent One'),
    category: 'TRANSPORT',
    subject: 'Van late',
    description: 'Every day',
    status: 'open',
    assignedToId: null,
    assignedTo: null,
    resolution: null,
    resolvedAt: null,
    resolvedById: null,
    resolvedBy: null,
    student: { name: 'Student', grNumber: 'GR-1' },
    notes: [
      {
        id: 'n1',
        body: 'internal',
        internal: true,
        author: person('t1', 'TEACHER'),
        createdAt: new Date('2026-09-02'),
      },
      {
        id: 'n2',
        body: 'reply',
        internal: false,
        author: person('a1', 'SCHOOL_ADMIN'),
        createdAt: new Date('2026-09-03'),
      },
    ],
    attachments: [],
    createdAt: new Date('2026-09-01'),
    updatedAt: new Date('2026-09-01'),
    ...over,
  });

  beforeEach(() => {
    prisma = {
      complaint: {
        create: jest.fn().mockResolvedValue({ id: 'c1', category: 'OTHER' }),
        findUnique: jest.fn().mockResolvedValue(detail()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      complaintNote: { create: jest.fn().mockResolvedValue({ id: 'n3' }) },
      enrollment: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ campus: { schoolId: 'school-1' } }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([person('t1', 'TEACHER')]),
      },
      auditLog: { create: jest.fn() },
    };
    notifications = { notify: jest.fn() };
    access = { assertCanAccessStudent: jest.fn() };
    service = new ComplaintsService(
      prisma as unknown as PrismaService,
      access as unknown as StudentAccessService,
      {} as OrgScopeService,
      notifications as unknown as NotificationsService,
      {} as FilesService,
    );
  });

  it('the parent view never carries internal notes, the owner or staff names', () => {
    const view = service.toParentView(detail() as never, 'parent-1');
    expect(view.responses).toEqual([
      expect.objectContaining({ body: 'reply', fromSchool: true }),
    ]);
    expect(JSON.stringify(view)).not.toContain('internal');
    expect(view).not.toHaveProperty('assignedTo');
    expect(view.raisedByMe).toBe(true);
  });

  it("a guardian cannot open another guardian's complaint", async () => {
    await expect(
      service.getForUser('c1', { id: 'parent-2', role: 'PARENT' }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.getForUser('c1', { id: 'parent-1', role: 'PARENT' }),
    ).resolves.toBeTruthy();
  });

  it('creates in the school of the student and audits', async () => {
    await service.create(
      { studentId: 's1', subject: 'x', description: 'y' },
      { id: 'parent-1', role: 'PARENT' },
    );
    expect(prisma.complaint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: 'school-1',
        category: 'OTHER',
        status: 'open',
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('resolving needs a resolution; the parent is notified', async () => {
    const admin = { id: 'a1', role: 'SCHOOL_ADMIN' };
    await expect(
      service.update(detail() as never, { status: 'resolved' }, admin),
    ).rejects.toThrow(BadRequestException);
    await service.update(
      detail() as never,
      { status: 'resolved', resolution: 'Fixed' },
      admin,
    );
    expect(prisma.complaint.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({
        status: 'resolved',
        resolution: 'Fixed',
        resolvedById: 'a1',
      }),
    });
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'parent-1', type: 'complaint' }),
    );
  });

  it("the owner must be staff of the student's school", async () => {
    const admin = { id: 'a1', role: 'SCHOOL_ADMIN' };
    await expect(
      service.update(detail() as never, { assignedToId: 'stranger' }, admin),
    ).rejects.toThrow(BadRequestException);
    await service.update(detail() as never, { assignedToId: 't1' }, admin);
    expect(notifications.notify).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 't1', entityRef: 'c1' }),
    );
  });

  it("a parent's note is never internal", async () => {
    await service.addNote(
      detail() as never,
      { body: 'thanks', internal: true },
      { id: 'parent-1', role: 'PARENT' },
    );
    expect(prisma.complaintNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ internal: false }),
    });
  });
});
