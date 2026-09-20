import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { StudentAccessService } from './student-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { EnrollmentService } from '../enrollment/enrollment.service';
import { OrgScopeService } from './org-scope.service';

describe('StudentAccessService', () => {
  let service: StudentAccessService;
  let prisma: {
    studentParent: { findFirst: jest.Mock };
    user: { findUnique: jest.Mock };
    teacher: { findUnique: jest.Mock };
    campus: { findUniqueOrThrow: jest.Mock };
    section: { findUnique: jest.Mock; findMany: jest.Mock };
    class: { findUnique: jest.Mock };
    timetable: { findMany: jest.Mock };
  };
  let enrollmentService: { getCurrentEnrollment: jest.Mock };

  beforeEach(async () => {
    prisma = {
      studentParent: { findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      teacher: { findUnique: jest.fn() },
      campus: { findUniqueOrThrow: jest.fn() },
      section: { findUnique: jest.fn(), findMany: jest.fn() },
      class: { findUnique: jest.fn() },
      timetable: { findMany: jest.fn() },
    };
    enrollmentService = { getCurrentEnrollment: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StudentAccessService,
        OrgScopeService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnrollmentService, useValue: enrollmentService },
      ],
    }).compile();
    service = moduleRef.get(StudentAccessService);
  });

  it('allows SUPER_ADMIN to access any student without any lookup', async () => {
    await expect(
      service.assertCanAccessStudent(
        { id: 'u1', role: 'SUPER_ADMIN' },
        'student-1',
      ),
    ).resolves.toBeUndefined();
    expect(enrollmentService.getCurrentEnrollment).not.toHaveBeenCalled();
  });

  it('denies staff roles (SCHOOL_ADMIN/ACCOUNTS/TEACHER) when the student has no active enrollment', async () => {
    enrollmentService.getCurrentEnrollment.mockRejectedValue(
      new Error('not found'),
    );

    await expect(
      service.assertCanAccessStudent(
        { id: 'u1', role: 'SCHOOL_ADMIN' },
        'withdrawn-student',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows SCHOOL_ADMIN/ACCOUNTS to access a student in their own school', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-1',
    });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-1',
      schoolId: 'school-1',
    });

    await expect(
      service.assertCanAccessStudent(
        { id: 'admin-1', role: 'SCHOOL_ADMIN' },
        'student-1',
      ),
    ).resolves.toBeUndefined();
  });

  it('denies SCHOOL_ADMIN/ACCOUNTS access to a student in a different school — the cross-tenant boundary', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-1',
    });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-2',
      schoolId: 'school-2',
    });

    await expect(
      service.assertCanAccessStudent(
        { id: 'admin-2', role: 'ACCOUNTS' },
        'student-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies SCHOOL_ADMIN/ACCOUNTS with no schoolId at all — fail-closed, not fail-open', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-1',
    });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-3', schoolId: null });

    await expect(
      service.assertCanAccessStudent(
        { id: 'admin-3', role: 'SCHOOL_ADMIN' },
        'student-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies a campus principal (SCHOOL_ADMIN with campusId) a section in another campus of the same school', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'p1',
      schoolId: 's1',
      campusId: 'c1',
    });
    prisma.section.findUnique.mockResolvedValue({
      id: 'sec2',
      class: { campusId: 'c2', campus: { schoolId: 's1' } },
    });
    await expect(
      service.assertCanAccessSection(
        { id: 'p1', role: 'SCHOOL_ADMIN' },
        'sec2',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a campus principal a section in their own campus', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'p1',
      schoolId: 's1',
      campusId: 'c1',
    });
    prisma.section.findUnique.mockResolvedValue({
      id: 'sec1',
      class: { campusId: 'c1', campus: { schoolId: 's1' } },
    });
    await expect(
      service.assertCanAccessSection(
        { id: 'p1', role: 'SCHOOL_ADMIN' },
        'sec1',
      ),
    ).resolves.toBeUndefined();
  });

  it("allows a TEACHER assigned (via timetable) to teach the student's section", async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-1',
      sectionId: 'section-9',
    });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.teacher.findUnique.mockResolvedValue({
      id: 'teacher-row-1',
      userId: 'teacher-1',
      campusId: 'campus-1',
    });
    prisma.timetable.findMany.mockResolvedValue([{ sectionId: 'section-9' }]);
    prisma.section.findMany.mockResolvedValue([]);

    await expect(
      service.assertCanAccessStudent(
        { id: 'teacher-1', role: 'TEACHER' },
        'student-1',
      ),
    ).resolves.toBeUndefined();
  });

  it("allows a TEACHER who is the homeroom class teacher of the student's section, with no timetable row", async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-1',
      sectionId: 'section-9',
    });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.teacher.findUnique.mockResolvedValue({
      id: 'teacher-row-1',
      userId: 'teacher-1',
      campusId: 'campus-1',
    });
    prisma.timetable.findMany.mockResolvedValue([]);
    prisma.section.findMany.mockResolvedValue([{ id: 'section-9' }]);

    await expect(
      service.assertCanAccessStudent(
        { id: 'teacher-1', role: 'TEACHER' },
        'student-1',
      ),
    ).resolves.toBeUndefined();
  });

  it("denies a TEACHER in the right campus but NOT assigned to teach the student's section — the core new guarantee", async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-1',
      sectionId: 'section-9',
    });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.teacher.findUnique.mockResolvedValue({
      id: 'teacher-row-1',
      userId: 'teacher-1',
      campusId: 'campus-1',
    });
    prisma.timetable.findMany.mockResolvedValue([{ sectionId: 'section-4' }]);
    prisma.section.findMany.mockResolvedValue([]);

    await expect(
      service.assertCanAccessStudent(
        { id: 'teacher-1', role: 'TEACHER' },
        'student-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies a TEACHER access to a student in a different campus', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-2',
      sectionId: 'section-9',
    });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.teacher.findUnique.mockResolvedValue({
      userId: 'teacher-1',
      campusId: 'campus-1',
    });

    await expect(
      service.assertCanAccessStudent(
        { id: 'teacher-1', role: 'TEACHER' },
        'student-1',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.timetable.findMany).not.toHaveBeenCalled();
  });

  it('allows a PARENT linked to the student', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-1',
    });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.studentParent.findFirst.mockResolvedValue({ id: 'link-1' });

    await expect(
      service.assertCanAccessStudent(
        { id: 'parent-user-1', role: 'PARENT' },
        'student-1',
      ),
    ).resolves.toBeUndefined();

    expect(prisma.studentParent.findFirst).toHaveBeenCalledWith({
      where: {
        studentId: 'student-1',
        parentProfile: { userId: 'parent-user-1' },
      },
    });
  });

  it('rejects a PARENT NOT linked to the student — the pre-existing isolation guarantee, unchanged', async () => {
    enrollmentService.getCurrentEnrollment.mockResolvedValue({
      campusId: 'campus-1',
    });
    prisma.campus.findUniqueOrThrow.mockResolvedValue({ schoolId: 'school-1' });
    prisma.studentParent.findFirst.mockResolvedValue(null);

    await expect(
      service.assertCanAccessStudent(
        { id: 'parent-user-1', role: 'PARENT' },
        'someone-elses-child',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows a PARENT linked to a student with no active enrollment — parent access survives a lapsed/withdrawn enrollment', async () => {
    enrollmentService.getCurrentEnrollment.mockRejectedValue(
      new Error('not found'),
    );
    prisma.studentParent.findFirst.mockResolvedValue({ id: 'link-1' });

    await expect(
      service.assertCanAccessStudent(
        { id: 'parent-user-1', role: 'PARENT' },
        'withdrawn-child',
      ),
    ).resolves.toBeUndefined();
    expect(prisma.campus.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  describe('assertCanAccessSection', () => {
    it('allows SUPER_ADMIN without any lookup', async () => {
      await expect(
        service.assertCanAccessSection(
          { id: 'u1', role: 'SUPER_ADMIN' },
          'section-1',
        ),
      ).resolves.toBeUndefined();
      expect(prisma.section.findUnique).not.toHaveBeenCalled();
    });

    it('denies access when the section does not exist', async () => {
      prisma.section.findUnique.mockResolvedValue(null);

      await expect(
        service.assertCanAccessSection(
          { id: 'admin-1', role: 'SCHOOL_ADMIN' },
          'missing-section',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a TEACHER assigned to teach that section, denies a different campus', async () => {
      prisma.section.findUnique.mockResolvedValue({
        class: { campusId: 'campus-1', campus: { schoolId: 'school-1' } },
      });
      prisma.teacher.findUnique.mockResolvedValue({
        id: 'teacher-row-1',
        userId: 'teacher-1',
        campusId: 'campus-1',
      });
      prisma.timetable.findMany.mockResolvedValue([{ sectionId: 'section-1' }]);
      prisma.section.findMany.mockResolvedValue([]);

      await expect(
        service.assertCanAccessSection(
          { id: 'teacher-1', role: 'TEACHER' },
          'section-1',
        ),
      ).resolves.toBeUndefined();

      prisma.teacher.findUnique.mockResolvedValue({
        userId: 'teacher-2',
        campusId: 'campus-2',
      });
      await expect(
        service.assertCanAccessSection(
          { id: 'teacher-2', role: 'TEACHER' },
          'section-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies a TEACHER in the right campus but not assigned to teach that section', async () => {
      prisma.section.findUnique.mockResolvedValue({
        class: { campusId: 'campus-1', campus: { schoolId: 'school-1' } },
      });
      prisma.teacher.findUnique.mockResolvedValue({
        id: 'teacher-row-1',
        userId: 'teacher-1',
        campusId: 'campus-1',
      });
      prisma.timetable.findMany.mockResolvedValue([
        { sectionId: 'some-other-section' },
      ]);
      prisma.section.findMany.mockResolvedValue([]);

      await expect(
        service.assertCanAccessSection(
          { id: 'teacher-1', role: 'TEACHER' },
          'section-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('assertCanAccessClass', () => {
    it('allows SUPER_ADMIN without any lookup', async () => {
      await expect(
        service.assertCanAccessClass(
          { id: 'u1', role: 'SUPER_ADMIN' },
          'class-1',
        ),
      ).resolves.toBeUndefined();
      expect(prisma.class.findUnique).not.toHaveBeenCalled();
    });

    it('denies access when the class does not exist', async () => {
      prisma.class.findUnique.mockResolvedValue(null);

      await expect(
        service.assertCanAccessClass(
          { id: 'admin-1', role: 'SCHOOL_ADMIN' },
          'missing-class',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a TEACHER assigned to teach at least one section of that class, denies a different campus', async () => {
      prisma.class.findUnique.mockResolvedValue({
        campusId: 'campus-1',
        campus: { schoolId: 'school-1' },
        sections: [{ id: 'section-1' }, { id: 'section-2' }],
      });
      prisma.teacher.findUnique.mockResolvedValue({
        id: 'teacher-row-1',
        userId: 'teacher-1',
        campusId: 'campus-1',
      });
      prisma.timetable.findMany.mockResolvedValue([{ sectionId: 'section-2' }]);
      prisma.section.findMany.mockResolvedValue([]);

      await expect(
        service.assertCanAccessClass(
          { id: 'teacher-1', role: 'TEACHER' },
          'class-1',
        ),
      ).resolves.toBeUndefined();

      prisma.teacher.findUnique.mockResolvedValue({
        userId: 'teacher-2',
        campusId: 'campus-2',
      });
      await expect(
        service.assertCanAccessClass(
          { id: 'teacher-2', role: 'TEACHER' },
          'class-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('denies a TEACHER in the right campus but not assigned to teach any section of that class', async () => {
      prisma.class.findUnique.mockResolvedValue({
        campusId: 'campus-1',
        campus: { schoolId: 'school-1' },
        sections: [{ id: 'section-1' }, { id: 'section-2' }],
      });
      prisma.teacher.findUnique.mockResolvedValue({
        id: 'teacher-row-1',
        userId: 'teacher-1',
        campusId: 'campus-1',
      });
      prisma.timetable.findMany.mockResolvedValue([
        { sectionId: 'some-other-section' },
      ]);
      prisma.section.findMany.mockResolvedValue([]);

      await expect(
        service.assertCanAccessClass(
          { id: 'teacher-1', role: 'TEACHER' },
          'class-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a SCHOOL_ADMIN in the same school, denies a different school', async () => {
      prisma.class.findUnique.mockResolvedValue({
        campusId: 'campus-1',
        campus: { schoolId: 'school-1' },
        sections: [],
      });
      prisma.user.findUnique.mockResolvedValue({ schoolId: 'school-1' });

      await expect(
        service.assertCanAccessClass(
          { id: 'admin-1', role: 'SCHOOL_ADMIN' },
          'class-1',
        ),
      ).resolves.toBeUndefined();

      prisma.user.findUnique.mockResolvedValue({ schoolId: 'school-2' });
      await expect(
        service.assertCanAccessClass(
          { id: 'admin-2', role: 'SCHOOL_ADMIN' },
          'class-1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
