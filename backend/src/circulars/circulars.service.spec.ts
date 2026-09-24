import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CircularsService } from './circulars.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrgScopeService } from '../common/org-scope.service';

/** BL-20: a circular belongs to one school and reaches only that school's parents. */
describe('CircularsService', () => {
  let service: CircularsService;
  let prisma: {
    circular: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    circularAttachment: { createMany: jest.Mock };
    circularRecipient: Record<
      'createMany' | 'findMany' | 'updateMany' | 'count',
      jest.Mock
    >;
    user: { findMany: jest.Mock; findUnique: jest.Mock };
    section: { findUnique: jest.Mock };
    school: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let notifications: { notify: jest.Mock };
  const adminA = { id: 'admin-a', role: 'SCHOOL_ADMIN' };
  const superAdmin = { id: 'super-1', role: 'SUPER_ADMIN' };
  const asAdminOf = (schoolId: string | null, campusId: string | null = null) =>
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-a',
      schoolId,
      campusId,
    });
  const school = {
    title: 'PTM',
    description: 'PTM in September.',
    scope: 'school' as const,
  };

  beforeEach(async () => {
    prisma = {
      circular: {
        create: jest.fn().mockResolvedValue({ id: 'circ-1' }),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      circularAttachment: { createMany: jest.fn() },
      circularRecipient: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
      },
      section: { findUnique: jest.fn() },
      school: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        CircularsService,
        OrgScopeService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(CircularsService);
  });

  it("a school-wide circular is anchored to the author's school and reaches only its parents", async () => {
    asAdminOf('school-a');
    prisma.user.findMany.mockResolvedValue([
      { id: 'parent-a' },
      { id: 'parent-b' },
    ]);

    await service.publish(school, adminA);

    expect(prisma.circular.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ schoolId: 'school-a', scope: 'school' }),
    });
    expect(prisma.user.findMany.mock.calls[0][0].where).toEqual({
      role: 'PARENT',
      parentProfile: {
        children: {
          some: {
            student: {
              enrollments: {
                some: { status: 'ACTIVE', campus: { schoolId: 'school-a' } },
              },
            },
          },
        },
      },
    });
    expect(prisma.circularRecipient.createMany).toHaveBeenCalledWith({
      data: [
        { circularId: 'circ-1', userId: 'parent-a' },
        { circularId: 'circ-1', userId: 'parent-b' },
      ],
    });
    expect(notifications.notify).toHaveBeenCalledTimes(2);
  });

  it("a campus principal's school-wide circular reaches only their campus", async () => {
    asAdminOf('school-a', 'campus-1');
    await service.publish(school, adminA);
    expect(
      prisma.user.findMany.mock.calls[0][0].where.parentProfile.children.some
        .student.enrollments.some.campus,
    ).toEqual({ id: 'campus-1', schoolId: 'school-a' });
  });

  it('a super admin must name the school; another school is refused for a school admin', async () => {
    await expect(service.publish(school, superAdmin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    prisma.school.findUnique.mockResolvedValue({ id: 'school-b' });
    await service.publish({ ...school, schoolId: 'school-b' }, superAdmin);
    expect(prisma.circular.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ schoolId: 'school-b' }),
    });

    asAdminOf('school-a');
    await expect(
      service.publish({ ...school, schoolId: 'school-b' }, adminA),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("a section circular takes the section's school; a section outside the author's scope is refused", async () => {
    asAdminOf('school-a');
    prisma.section.findUnique.mockResolvedValueOnce({
      class: { campusId: 'campus-1', campus: { schoolId: 'school-a' } },
    });
    await service.publish(
      { ...school, scope: 'section', sectionId: 'sec-1' },
      adminA,
    );
    expect(prisma.circular.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        schoolId: 'school-a',
        sectionId: 'sec-1',
      }),
    });
    expect(
      prisma.user.findMany.mock.calls[0][0].where.parentProfile.children.some
        .student,
    ).toEqual({
      enrollments: { some: { sectionId: 'sec-1', status: 'ACTIVE' } },
    });

    prisma.section.findUnique.mockResolvedValueOnce({
      class: { campusId: 'campus-b', campus: { schoolId: 'school-b' } },
    });
    await expect(
      service.publish(
        { ...school, scope: 'section', sectionId: 'sec-b' },
        adminA,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("marking read updates the caller's recipient row and 404s if none exists", async () => {
    prisma.circularRecipient.updateMany.mockResolvedValueOnce({ count: 1 });
    await service.markRead('circ-1', 'parent-a');
    expect(prisma.circularRecipient.updateMany).toHaveBeenCalledWith({
      where: { circularId: 'circ-1', userId: 'parent-a' },
      data: { readAt: expect.any(Date) },
    });
    prisma.circularRecipient.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.markRead('circ-x', 'parent-a')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("stats are visible only within the circular's school", async () => {
    prisma.circular.findUnique.mockResolvedValue({
      id: 'circ-1',
      schoolId: 'school-a',
    });
    prisma.circularRecipient.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(4);
    asAdminOf('school-a');
    await expect(service.getStats('circ-1', adminA)).resolves.toEqual({
      delivered: 10,
      read: 4,
    });

    asAdminOf('school-b');
    await expect(service.getStats('circ-1', adminA)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.circular.findUnique.mockResolvedValue(null);
    await expect(
      service.getStats('missing', superAdmin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
