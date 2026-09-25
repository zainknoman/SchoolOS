import { Test } from '@nestjs/testing';
import { TeachingAssignmentsService } from './teaching-assignments.service';
import { OrgScopeService } from '../common/org-scope.service';
import { PrismaService } from '../prisma/prisma.service';

describe('TeachingAssignmentsService (BL-25)', () => {
  let service: TeachingAssignmentsService;
  let prisma: {
    user: { findUnique: jest.Mock };
    teachingAssignment: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn() },
      teachingAssignment: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TeachingAssignmentsService,
        OrgScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(TeachingAssignmentsService);
  });

  const where = () =>
    (prisma.teachingAssignment.findMany.mock.calls[0][0] as { where: object })
      .where;

  it('a school admin only sees their own school, with the filters applied', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'a',
      schoolId: 'school-1',
      campusId: null,
    });
    await service.list(
      { id: 'a', role: 'SCHOOL_ADMIN' },
      { academicSessionId: 'sess', subjectId: 'math', current: true },
    );
    expect(where()).toEqual({
      schoolId: 'school-1',
      academicSessionId: 'sess',
      subjectId: 'math',
      endDate: null,
    });
  });

  it('a campus principal is confined to their campus', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'p',
      schoolId: 'school-1',
      campusId: 'campus-1',
    });
    await service.list({ id: 'p', role: 'SCHOOL_ADMIN' }, { teacherId: 't' });
    expect(where()).toEqual({
      schoolId: 'school-1',
      campusId: 'campus-1',
      teacherId: 't',
    });
  });

  it('a super admin is unrestricted; an account without a school sees nothing', async () => {
    await service.list({ id: 's', role: 'SUPER_ADMIN' }, { sectionId: 'sec' });
    expect(where()).toEqual({ sectionId: 'sec' });

    prisma.teachingAssignment.findMany.mockClear();
    prisma.user.findUnique.mockResolvedValue({ id: 'x', schoolId: null });
    await expect(
      service.list({ id: 'x', role: 'SCHOOL_ADMIN' }, {}),
    ).resolves.toEqual([]);
    expect(prisma.teachingAssignment.findMany).not.toHaveBeenCalled();
  });
});
