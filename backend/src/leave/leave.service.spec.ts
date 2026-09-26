import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { StudentAccessService } from '../common/student-access.service';

describe('LeaveService', () => {
  let service: LeaveService;
  let prisma: {
    leaveRequest: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    section: { findUnique: jest.Mock };
    teacher: { findUnique: jest.Mock };
    attendance: { findMany: jest.Mock; upsert: jest.Mock };
    auditLog: { create: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let enrollmentService: { getCurrentEnrollment: jest.Mock };
  let studentAccess: { getTeacherSectionIds: jest.Mock };

  const studentRow = { student: { name: 'Eshaal Sample' } };

  beforeEach(async () => {
    prisma = {
      leaveRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        // BL-29: decisions are conditional on 'pending' (count 0 = lost the race / already decided)
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn(),
      },
      section: { findUnique: jest.fn() },
      teacher: { findUnique: jest.fn().mockResolvedValue(null) },
      attendance: { findMany: jest.fn(), upsert: jest.fn() },
      auditLog: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    enrollmentService = { getCurrentEnrollment: jest.fn() };
    studentAccess = { getTeacherSectionIds: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: PrismaService, useValue: prisma },
        OrgScopeService,
        { provide: EnrollmentService, useValue: enrollmentService },
        { provide: StudentAccessService, useValue: studentAccess },
      ],
    }).compile();
    service = moduleRef.get(LeaveService);
  });

  describe('listAll', () => {
    it('lists every leave request for a SUPER_ADMIN, optionally filtered by status', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      await service.listAll({ id: 'super-1', role: 'SUPER_ADMIN' }, 'pending');

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'pending' } }),
      );
    });

    it("scopes a SCHOOL_ADMIN's leave-request list to students enrolled in their own school", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: 'school-1',
      });
      prisma.leaveRequest.findMany.mockResolvedValue([]);

      await service.listAll({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            student: {
              enrollments: {
                some: {
                  section: { class: { campus: { schoolId: 'school-1' } } },
                },
              },
            },
          },
        }),
      );
    });

    it('fails closed (returns an empty list) for a SCHOOL_ADMIN with no schoolId', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        schoolId: null,
      });

      const result = await service.listAll({
        id: 'admin-1',
        role: 'SCHOOL_ADMIN',
      });

      expect(result).toEqual([]);
      expect(prisma.leaveRequest.findMany).not.toHaveBeenCalled();
    });
  });

  it('rejects a request whose startDate is after its endDate, without touching the database', async () => {
    await expect(
      service.create(
        {
          studentId: 's1',
          startDate: '2026-09-10',
          endDate: '2026-09-05',
          reason: 'Family trip',
        },
        'parent-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
  });

  it('creates a pending leave request and audits the write', async () => {
    prisma.leaveRequest.create.mockResolvedValue({
      id: 'lr-1',
      studentId: 's1',
      startDate: new Date('2026-09-05'),
      endDate: new Date('2026-09-06'),
      reason: 'Family trip',
      status: 'pending',
      createdAt: new Date('2026-09-01'),
      ...studentRow,
    });

    const result = await service.create(
      {
        studentId: 's1',
        startDate: '2026-09-05',
        endDate: '2026-09-06',
        reason: 'Family trip',
      },
      'parent-1',
    );

    expect(result).toEqual({
      id: 'lr-1',
      studentId: 's1',
      studentName: 'Eshaal Sample',
      startDate: '2026-09-05',
      endDate: '2026-09-06',
      reason: 'Family trip',
      status: 'pending',
      createdAt: '2026-09-01T00:00:00.000Z',
      recommendation: null,
      decision: null,
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'parent-1',
          action: 'leave-request.create',
          entity: 'LeaveRequest',
          entityId: 'lr-1',
        }),
      }),
    );
  });

  it('approving writes a LEAVE attendance row per day, skipping any day already marked HOLIDAY, attributed to the approver (BL-60)', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'lr-1',
      status: 'pending',
      studentId: 's1',
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      studentId: 's1',
      startDate: new Date('2026-09-05T00:00:00.000Z'),
      endDate: new Date('2026-09-07T00:00:00.000Z'),
      reason: 'Family trip',
      status: 'approved',
      createdAt: new Date('2026-09-01'),
      ...studentRow,
    });
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      sectionId: 'sec-1',
    });
    prisma.section.findUnique.mockResolvedValue({
      id: 'sec-1',
      classTeacherId: 'teacher-1',
    });
    prisma.attendance.findMany.mockResolvedValue([
      { date: new Date('2026-09-06T00:00:00.000Z'), status: 'HOLIDAY' },
    ]);

    await service.approve('lr-1', 'admin-1');

    expect(prisma.attendance.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId_date: {
            studentId: 's1',
            date: new Date('2026-09-05T00:00:00.000Z'),
          },
        },
        create: expect.objectContaining({
          status: 'LEAVE',
          markedById: null,
          markedByUserId: 'admin-1',
        }),
      }),
    );
    expect(prisma.attendance.upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          studentId_date: {
            studentId: 's1',
            date: new Date('2026-09-06T00:00:00.000Z'),
          },
        },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'leave-request.approve' }),
      }),
    );
  });

  // BL-60 replaced (leave.service.spec.ts:175 in the backlog): approval no longer needs a class teacher.
  it('approves for a section without a class teacher, attributing the LEAVE rows to the approver', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'lr-1',
      status: 'pending',
      studentId: 's1',
    });
    prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
      id: 'lr-1',
      studentId: 's1',
      startDate: new Date('2026-09-05T00:00:00.000Z'),
      endDate: new Date('2026-09-05T00:00:00.000Z'),
      reason: 'Fever',
      status: 'approved',
      createdAt: new Date('2026-09-01'),
      ...studentRow,
    });
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      sectionId: 'sec-1',
    });
    prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-7' });
    prisma.attendance.findMany.mockResolvedValue([]);

    await service.approve('lr-1', 'teacher-user-7');

    expect(prisma.section.findUnique).not.toHaveBeenCalled();
    expect(prisma.attendance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          status: 'LEAVE',
          markedById: 'teacher-7',
          markedByUserId: 'teacher-user-7',
        }),
      }),
    );
  });

  it('refuses to approve when the student has no active enrollment, and never touches the LeaveRequest row', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'lr-1',
      status: 'pending',
      studentId: 's1',
    });
    enrollmentService.getCurrentEnrollment.mockRejectedValue(
      new NotFoundException('Student has no active enrollment'),
    );

    await expect(service.approve('lr-1', 'admin-1')).rejects.toThrow(
      NotFoundException,
    );

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.updateMany).not.toHaveBeenCalled();
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('refuses to decide a request that is not pending', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'lr-1',
      status: 'approved',
    });

    await expect(service.reject('lr-1', 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when deciding a request that does not exist', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue(null);

    await expect(service.approve('missing', 'admin-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  describe('recommendation and decision (BL-29)', () => {
    const row = {
      id: 'lr-1',
      studentId: 's1',
      startDate: new Date('2026-09-05T00:00:00.000Z'),
      endDate: new Date('2026-09-05T00:00:00.000Z'),
      reason: 'Fever',
      createdAt: new Date('2026-09-01'),
      ...studentRow,
    };

    it('a recommendation never changes the status and is audited under the teacher', async () => {
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
        ...row,
        status: 'pending',
        recommendedAt: new Date('2026-09-02'),
        recommendsApproval: true,
        recommendationNote: 'Genuine',
        recommendedBy: { identifier: 't@x', teacher: { name: 'Ms Teacher' } },
        decidedBy: null,
      });
      const result = await service.recommend('lr-1', 'teacher-user-1', {
        approve: true,
        note: ' Genuine ',
      });
      const call = prisma.leaveRequest.updateMany.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'lr-1', status: 'pending' });
      expect(call.data).not.toHaveProperty('status');
      expect(call.data).toMatchObject({
        recommendedById: 'teacher-user-1',
        recommendsApproval: true,
        recommendationNote: 'Genuine',
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'teacher-user-1',
            action: 'leave-request.recommend',
          }),
        }),
      );
      expect(result.status).toBe('pending');
      expect(result.recommendation).toMatchObject({
        by: 'Ms Teacher',
        approve: true,
      });
    });

    it('cannot recommend on a decided request', async () => {
      prisma.leaveRequest.findUnique.mockResolvedValue({ id: 'lr-1' });
      await expect(
        service.recommend('lr-1', 'teacher-user-1', { approve: false }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('a rejection records the decider and the note, conditionally on pending', async () => {
      prisma.leaveRequest.updateMany.mockResolvedValue({ count: 1 });
      prisma.leaveRequest.findUniqueOrThrow.mockResolvedValue({
        ...row,
        status: 'rejected',
        decidedAt: new Date('2026-09-03'),
        decisionNote: 'No proof',
        decidedBy: { identifier: 'admin@x', teacher: null },
        recommendedBy: null,
      });
      const result = await service.reject('lr-1', 'admin-1', 'No proof');
      expect(prisma.leaveRequest.updateMany.mock.calls[0][0]).toMatchObject({
        where: { id: 'lr-1', status: 'pending' },
        data: {
          status: 'rejected',
          decidedById: 'admin-1',
          decisionNote: 'No proof',
        },
      });
      expect(result.decision).toMatchObject({
        by: 'admin@x',
        note: 'No proof',
      });
    });

    it('parents see the decision note but not the recommendation or who decided', async () => {
      prisma.leaveRequest.findMany.mockResolvedValue([
        {
          ...row,
          status: 'rejected',
          recommendedAt: new Date('2026-09-02'),
          recommendsApproval: false,
          recommendationNote: 'internal',
          recommendedBy: { identifier: 't@x', teacher: { name: 'T' } },
          decidedAt: new Date('2026-09-03'),
          decisionNote: 'Please bring a note',
          decidedBy: { identifier: 'admin@x', teacher: null },
        },
      ]);
      const [forParent] = await service.listForStudent('s1', {
        id: 'p1',
        role: 'PARENT',
      });
      expect(forParent).not.toHaveProperty('recommendation');
      expect(forParent.decision).toEqual({
        at: '2026-09-03T00:00:00.000Z',
        note: 'Please bring a note',
      });
    });

    it("a teacher's queue covers students enrolled in the sections they teach", async () => {
      prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-1' });
      studentAccess.getTeacherSectionIds.mockResolvedValue(new Set(['sec-1']));
      prisma.leaveRequest.findMany.mockResolvedValue([]);
      await service.listAll({ id: 'tu-1', role: 'TEACHER' }, 'pending');
      expect(prisma.leaveRequest.findMany.mock.calls[0][0].where).toEqual({
        status: 'pending',
        student: {
          enrollments: {
            some: { status: 'ACTIVE', sectionId: { in: ['sec-1'] } },
          },
        },
      });
    });
  });
});
