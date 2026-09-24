import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SubjectsService } from './subjects.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';
import { assertSubjectUsable } from './subject-guard';

/** BL-02: subjects are per school and managed by that school's admins. */
describe('SubjectsService', () => {
  let service: SubjectsService;
  let prisma: {
    subject: Record<
      'findMany' | 'findUnique' | 'create' | 'update' | 'delete',
      jest.Mock
    >;
    school: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    timetable: { count: jest.Mock };
    assessment: { count: jest.Mock };
    diaryEntry: { count: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  const admin = { id: 'admin-a', role: 'SCHOOL_ADMIN' };
  const superAdmin = { id: 'super-1', role: 'SUPER_ADMIN' };
  const asAdminOf = (schoolId: string | null, campusId: string | null = null) =>
    prisma.user.findUnique.mockResolvedValue({
      id: 'admin-a',
      schoolId,
      campusId,
    });
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'sub-1',
    name: 'Urdu',
    schoolId: 'school-a',
    isActive: true,
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      subject: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      school: { findUnique: jest.fn() },
      user: { findUnique: jest.fn() },
      timetable: { count: jest.fn().mockResolvedValue(0) },
      assessment: { count: jest.fn().mockResolvedValue(0) },
      diaryEntry: { count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SubjectsService,
        OrgScopeService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(SubjectsService);
  });

  it("lists the caller's school's active subjects (plus legacy school-less ones)", async () => {
    asAdminOf('school-a');
    prisma.subject.findMany.mockResolvedValue([row()]);
    const result = await service.listAll(admin);
    expect(prisma.subject.findMany).toHaveBeenCalledWith({
      where: {
        isActive: true,
        OR: [{ schoolId: 'school-a' }, { schoolId: null }],
      },
      orderBy: { name: 'asc' },
    });
    expect(result).toEqual([
      { id: 'sub-1', name: 'Urdu', schoolId: 'school-a', isActive: true },
    ]);
  });

  it('a super admin can list one school, including inactive subjects', async () => {
    await service.listAll(superAdmin, {
      schoolId: 'school-b',
      includeInactive: true,
    });
    expect(prisma.subject.findMany.mock.calls[0][0].where).toEqual({
      schoolId: 'school-b',
    });
  });

  it('a school admin creates subjects for their own school only', async () => {
    asAdminOf('school-a');
    prisma.subject.create.mockResolvedValue(row({ name: 'Physics' }));
    await service.create({ name: ' Physics ' }, admin);
    expect(prisma.subject.create).toHaveBeenCalledWith({
      data: { name: 'Physics', schoolId: 'school-a' },
    });
    await expect(
      service.create({ name: 'x', schoolId: 'school-b' }, admin),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a campus principal cannot manage subjects; a super admin must name the school', async () => {
    asAdminOf('school-a', 'campus-1');
    await expect(service.create({ name: 'x' }, admin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.create({ name: 'x' }, superAdmin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a duplicate name in the same school is a 409', async () => {
    asAdminOf('school-a');
    prisma.subject.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'x',
      }),
    );
    await expect(
      service.create({ name: 'Urdu' }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("cannot rename or deactivate another school's subject", async () => {
    asAdminOf('school-a');
    prisma.subject.findUnique.mockResolvedValue(row({ schoolId: 'school-b' }));
    await expect(
      service.update('sub-1', { isActive: false }, admin),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('a subject in use is deactivated, not deleted; an unused one is deleted', async () => {
    asAdminOf('school-a');
    prisma.subject.findUnique.mockResolvedValue(row());
    prisma.timetable.count.mockResolvedValueOnce(3);
    await expect(service.delete('sub-1', admin)).rejects.toThrow(
      /deactivate it instead/,
    );
    expect(prisma.subject.delete).not.toHaveBeenCalled();

    await service.delete('sub-1', admin);
    expect(prisma.subject.delete).toHaveBeenCalledWith({
      where: { id: 'sub-1' },
    });
  });
});

describe('assertSubjectUsable (BL-02)', () => {
  const db = (subject: unknown, schoolId = 'school-a') => ({
    subject: { findUnique: jest.fn().mockResolvedValue(subject) },
    section: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ class: { campus: { schoolId } } }),
    },
    class: {
      findUnique: jest.fn().mockResolvedValue({ campus: { schoolId } }),
    },
  });

  it('accepts an active subject of the same school, and a legacy school-less one', async () => {
    await expect(
      assertSubjectUsable(
        db({ schoolId: 'school-a', isActive: true }) as never,
        's',
        { sectionId: 'sec' },
      ),
    ).resolves.toBeUndefined();
    await expect(
      assertSubjectUsable(
        db({ schoolId: null, isActive: true }) as never,
        's',
        { classId: 'c' },
      ),
    ).resolves.toBeUndefined();
  });

  it("refuses a missing, inactive or other school's subject", async () => {
    await expect(
      assertSubjectUsable(db(null) as never, 's', { sectionId: 'sec' }),
    ).rejects.toThrow(/not found/);
    await expect(
      assertSubjectUsable(
        db({ schoolId: 'school-a', isActive: false }) as never,
        's',
        { sectionId: 'sec' },
      ),
    ).rejects.toThrow(/inactive/);
    await expect(
      assertSubjectUsable(
        db({ schoolId: 'school-b', isActive: true }) as never,
        's',
        { classId: 'c' },
      ),
    ).rejects.toThrow(/another school/);
  });
});
