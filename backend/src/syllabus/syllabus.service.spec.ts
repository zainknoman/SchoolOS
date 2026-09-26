import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SyllabusService } from './syllabus.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { OrgScopeService } from '../common/org-scope.service';
import type { StudentAccessService } from '../common/student-access.service';

describe('SyllabusService (BL-26)', () => {
  const prisma = {
    class: { findUnique: jest.fn() },
    subject: { findUnique: jest.fn() },
    teacher: { findUnique: jest.fn() },
    term: { count: jest.fn() },
    syllabus: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const orgScope = { resolve: jest.fn() };
  const access = { getTeacherSectionIds: jest.fn() };
  const service = new SyllabusService(
    prisma as unknown as PrismaService,
    orgScope as unknown as OrgScopeService,
    access as unknown as StudentAccessService,
  );
  const admin = { id: 'u1', role: 'SCHOOL_ADMIN' };
  const future = new Date(Date.now() + 86_400_000 * 90);
  const klass = (endDate = future) => ({
    id: 'c1',
    campusId: 'campus-a',
    academicSessionId: 's1',
    campus: { schoolId: 'school-a' },
    academicSession: { endDate },
  });

  beforeEach(() => {
    jest.resetAllMocks();
    orgScope.resolve.mockResolvedValue({
      denied: false,
      campusWhere: { schoolId: 'school-a' },
      allows: (t: { schoolId: string }) => t.schoolId === 'school-a',
    });
    prisma.syllabus.findMany.mockResolvedValue([]);
  });

  it('a list needs a class or a session', async () => {
    await expect(service.list(admin, {})).rejects.toThrow(BadRequestException);
  });

  it('a teacher lists only classes with a section they teach', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1' });
    access.getTeacherSectionIds.mockResolvedValue(new Set(['sec-1']));
    await service.list(
      { id: 'u2', role: 'TEACHER' },
      { academicSessionId: 's1' },
    );
    expect(prisma.syllabus.findMany.mock.calls[0][0]).toMatchObject({
      where: {
        class: {
          academicSessionId: 's1',
          sections: { some: { id: { in: ['sec-1'] } } },
        },
      },
    });
  });

  it('refuses another school, an ended session and an inactive subject', async () => {
    prisma.class.findUnique.mockResolvedValue({
      ...klass(),
      campus: { schoolId: 'school-b' },
    });
    await expect(
      service.create(admin, { classId: 'c1', subjectId: 'sub' }),
    ).rejects.toThrow(ForbiddenException);

    prisma.class.findUnique.mockResolvedValue(klass(new Date('2020-12-31')));
    await expect(
      service.create(admin, { classId: 'c1', subjectId: 'sub' }),
    ).rejects.toThrow(/has ended/);

    prisma.class.findUnique.mockResolvedValue(klass());
    prisma.subject.findUnique.mockResolvedValue({
      schoolId: 'school-a',
      isActive: false,
    });
    await expect(
      service.create(admin, { classId: 'c1', subjectId: 'sub' }),
    ).rejects.toThrow(/inactive/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
