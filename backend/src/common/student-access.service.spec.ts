import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { StudentAccessService } from './student-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

describe('StudentAccessService', () => {
  let service: StudentAccessService;
  let prisma: {
    studentParent: { findFirst: jest.Mock };
    user: { findUnique: jest.Mock };
    teacher: { findUnique: jest.Mock };
    campus: { findUniqueOrThrow: jest.Mock };
  };
  let enrollmentService: { getCurrentEnrollment: jest.Mock };

  beforeEach(async () => {
    prisma = {
      studentParent: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      teacher: { findUnique: jest.fn() },
      campus: { findUniqueOrThrow: jest.fn() },
    };
    enrollmentService = { getCurrentEnrollment: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StudentAccessService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollmentService },
      ],
    }).compile();
    service = moduleRef.get(StudentAccessService);
  });

  it('allows SUPER_ADMIN to access any student without any lookup', async () => {
    await expect(
      service.assertCanAccessStudent({ id: 'u1', role: 'SUPER_ADMIN' }, 'student-1'),
    ).resolves.toBeUndefined();
    expect(enrollmentService.getCurrentEnrollment).not.toHaveBeenCalled();
  });

  it('denies staff roles (SCHOOL_ADMIN/ACCOUNTS/TEACHER) when the student has no active enrollment', async () => {
    enrollmentService.getCurrentEnrollment.mockRejectedValue(new Error('not found'));

    await expect(
      service.assertCanAccessStudent({ id: 'u1', role: 'SCHOOL_ADMIN' }, 'withdrawn-student'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows SCHOOL_ADMIN/ACCOUNTS to access a student in their own school', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1' });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: 'school-1' });

    await expect(
      service.assertCanAccessStudent({ id: 'admin-1', role: 'SCHOOL_ADMIN' }, 'student-1'),
    ).resolves.toBeUndefined();
  });

  it('denies SCHOOL_ADMIN/ACCOUNTS access to a student in a different school — the cross-tenant boundary', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1' });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-2', schoolId: 'school-2' });

    await expect(
      service.assertCanAccessStudent({ id: 'admin-2', role: 'ACCOUNTS' }, 'student-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies SCHOOL_ADMIN/ACCOUNTS with no schoolId at all — fail-closed, not fail-open', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1' });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-3', schoolId: null });

    await expect(
      service.assertCanAccessStudent({ id: 'admin-3', role: 'SCHOOL_ADMIN' }, 'student-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a TEACHER to access a student in their own campus', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1' });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.teacher.findUnique.mockResolvedValue({ userId: 'teacher-1', campusId: 'campus-1' });

    await expect(
      service.assertCanAccessStudent({ id: 'teacher-1', role: 'TEACHER' }, 'student-1'),
    ).resolves.toBeUndefined();
  });

  it('denies a TEACHER access to a student in a different campus — the core new guarantee', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-2' });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.teacher.findUnique.mockResolvedValue({ userId: 'teacher-1', campusId: 'campus-1' });

    await expect(
      service.assertCanAccessStudent({ id: 'teacher-1', role: 'TEACHER' }, 'student-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a PARENT linked to the student', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1' });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.studentParent.findFirst.mockResolvedValue({ id: 'link-1' });

    await expect(
      service.assertCanAccessStudent({ id: 'parent-user-1', role: 'PARENT' }, 'student-1'),
    ).resolves.toBeUndefined();

    expect(prisma.studentParent.findFirst).toHaveBeenCalledWith({
      where: { studentId: 'student-1', parentProfile: { userId: 'parent-user-1' } },
    });
  });

  it('rejects a PARENT NOT linked to the student — the pre-existing isolation guarantee, unchanged', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({ campusId: 'campus-1' });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.studentParent.findFirst.mockResolvedValue(null);

    await expect(
      service.assertCanAccessStudent({ id: 'parent-user-1', role: 'PARENT' }, 'someone-elses-child'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a PARENT linked to a student with no active enrollment — parent access survives a lapsed/withdrawn enrollment', async () => {
    enrollmentService.getCurrentEnrollment.mockRejectedValue(new Error('not found'));
    prisma.studentParent.findFirst.mockResolvedValue({ id: 'link-1' });

    await expect(
      service.assertCanAccessStudent({ id: 'parent-user-1', role: 'PARENT' }, 'withdrawn-child'),
    ).resolves.toBeUndefined();
    expect(prisma.campus.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
