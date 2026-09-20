import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

describe('LeaveService', () => {
  let service: LeaveService;
  let prisma: {
    leaveRequest: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    section: { findUnique: jest.Mock };
    attendance: { findMany: jest.Mock; upsert: jest.Mock };
    auditLog: { create: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let enrollmentService: { getCurrentEnrollment: jest.Mock };

  const studentRow = { student: { name: 'Eshaal Sample' } };

  beforeEach(async () => {
    prisma = {
      leaveRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      section: { findUnique: jest.fn() },
      attendance: { findMany: jest.fn(), upsert: jest.fn() },
      auditLog: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    enrollmentService = { getCurrentEnrollment: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeaveService,
        { provide: PrismaService, useValue: prisma },
        OrgScopeService,
        { provide: EnrollmentService, useValue: enrollmentService },
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

  it('approving writes a LEAVE attendance row per day, skipping any day already marked HOLIDAY, attributed to the class teacher', async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'lr-1',
      status: 'pending',
      studentId: 's1',
    });
    prisma.leaveRequest.update.mockResolvedValue({
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
          markedById: 'teacher-1',
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

  it("refuses to approve when the student's section has no class teacher assigned, and never touches the LeaveRequest row", async () => {
    prisma.leaveRequest.findUnique.mockResolvedValue({
      id: 'lr-1',
      status: 'pending',
      studentId: 's1',
    });
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      sectionId: 'sec-1',
    });
    prisma.section.findUnique.mockResolvedValue({
      id: 'sec-1',
      classTeacherId: null,
    });

    await expect(service.approve('lr-1', 'admin-1')).rejects.toThrow(
      BadRequestException,
    );

    // The class-teacher precondition is resolved BEFORE the write — a $transaction (and therefore
    // the status update inside it) must never even be opened, so the LeaveRequest stays 'pending'
    // and is still retryable, rather than getting stuck at 'approved' with no attendance/audit
    // trail (see leave.e2e-spec.ts for the persisted-state assertion against a real database).
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.update).not.toHaveBeenCalled();
    expect(prisma.attendance.upsert).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
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
});
