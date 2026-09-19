import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SectionsService } from './sections.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentAccessService } from '../common/student-access.service';

describe('SectionsService', () => {
  let service: SectionsService;
  let prisma: {
    section: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    enrollment: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
    user: { findUnique: jest.Mock };
    teacher: { findUnique: jest.Mock };
    class: { findUnique: jest.Mock };
  };
  let studentAccess: { getTeacherSectionIds: jest.Mock };

  const fullRecord = {
    id: 'sec1',
    name: '3A',
    classId: 'cl1',
    classTeacherId: 't1',
    class: { name: 'Grade 3', academicSessionId: 'sess1', campus: { name: 'Gulistan-e-Jauhar' } },
    classTeacher: { name: 'Ms. Ayesha' },
  };
  const expectedSummary = {
    id: 'sec1',
    name: '3A',
    className: 'Grade 3',
    campusName: 'Gulistan-e-Jauhar',
    classTeacherId: 't1',
    classTeacherName: 'Ms. Ayesha',
    classId: 'cl1',
    academicSessionId: 'sess1',
  };

  beforeEach(async () => {
    prisma = {
      section: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      enrollment: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
      user: { findUnique: jest.fn() },
      teacher: { findUnique: jest.fn().mockResolvedValue({ campusId: 'c1' }) },
      class: { findUnique: jest.fn().mockResolvedValue({ campusId: 'c1' }) },
    };
    studentAccess = { getTeacherSectionIds: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SectionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: StudentAccessService, useValue: studentAccess },
      ],
    }).compile();
    service = moduleRef.get(SectionsService);
  });

  it('lists every section for a SUPER_ADMIN including their class teacher', async () => {
    prisma.section.findMany.mockResolvedValue([fullRecord]);

    const result = await service.listAll({ id: 'super-1', role: 'SUPER_ADMIN' });

    expect(result).toEqual([expectedSummary]);
    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('lists all sections when a section has no class teacher assigned', async () => {
    prisma.section.findMany.mockResolvedValue([
      { ...fullRecord, classTeacherId: null, classTeacher: null },
    ]);

    const [result] = await service.listAll({ id: 'super-1', role: 'SUPER_ADMIN' });
    expect(result.classTeacherId).toBeNull();
    expect(result.classTeacherName).toBeNull();
  });

  it("scopes a SCHOOL_ADMIN/ACCOUNTS's section list to their own school", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: 's1' });
    prisma.section.findMany.mockResolvedValue([fullRecord]);

    const result = await service.listAll({ id: 'admin-1', role: 'ACCOUNTS' });

    expect(result).toEqual([expectedSummary]);
    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { class: { campus: { schoolId: 's1' } } } }),
    );
  });

  it('fails closed (returns an empty list) for a non-SUPER_ADMIN caller with no schoolId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: null });

    const result = await service.listAll({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(result).toEqual([]);
    expect(prisma.section.findMany).not.toHaveBeenCalled();
  });

  it("scopes a TEACHER's section list to sections they're assigned to teach", async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 'teacher-row-1' });
    studentAccess.getTeacherSectionIds.mockResolvedValue(new Set(['sec1', 'sec9']));
    prisma.section.findMany.mockResolvedValue([fullRecord]);

    const result = await service.listAll({ id: 'teacher-1', role: 'TEACHER' });

    expect(result).toEqual([expectedSummary]);
    expect(studentAccess.getTeacherSectionIds).toHaveBeenCalledWith('teacher-row-1');
    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['sec1', 'sec9'] } } }),
    );
  });

  it('fails closed (returns an empty list) for a TEACHER with no Teacher profile', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    const result = await service.listAll({ id: 'ghost-1', role: 'TEACHER' });

    expect(result).toEqual([]);
    expect(prisma.section.findMany).not.toHaveBeenCalled();
  });

  it('creates a section under a class, optionally with a class teacher, and audit-logs it', async () => {
    prisma.section.create.mockResolvedValue(fullRecord);

    const result = await service.create(
      { classId: 'cl1', name: '3A', classTeacherId: 't1' },
      'admin-1',
    );

    expect(result).toEqual(expectedSummary);
    expect(prisma.section.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { classId: 'cl1', name: '3A', classTeacherId: 't1' },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'section.create',
          entityId: 'sec1',
        }),
      }),
    );
  });

  it('creates a section with no class teacher when none is given', async () => {
    prisma.section.create.mockResolvedValue({
      ...fullRecord,
      classTeacherId: null,
      classTeacher: null,
    });

    await service.create({ classId: 'cl1', name: '3A' }, 'admin-1');

    expect(prisma.section.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { classId: 'cl1', name: '3A', classTeacherId: undefined },
      }),
    );
  });

  it('translates a foreign-key violation on create into a BadRequestException (invalid classId/classTeacherId)', async () => {
    prisma.section.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: 'test' },
      ),
    );

    await expect(
      service.create({ classId: 'missing', name: '3A' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('updates a section (classId is not editable, name and classTeacherId are)', async () => {
    prisma.section.findUnique.mockResolvedValue({
      id: 'sec1',
      name: '3A',
      classId: 'cl1',
      class: { campusId: 'c1' },
    });
    prisma.section.update.mockResolvedValue({
      ...fullRecord,
      name: '3A (Renamed)',
    });

    const result = await service.update(
      'sec1',
      { name: '3A (Renamed)', classTeacherId: 't1' },
      'admin-1',
    );

    expect(result.name).toBe('3A (Renamed)');
    expect(prisma.section.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sec1' },
        data: { name: '3A (Renamed)', classTeacherId: 't1' },
      }),
    );
  });

  it('translates a foreign-key violation on update into a BadRequestException (invalid classTeacherId)', async () => {
    prisma.section.findUnique.mockResolvedValue({
      id: 'sec1',
      name: '3A',
      classId: 'cl1',
      class: { campusId: 'c1' },
    });
    prisma.section.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: 'test' },
      ),
    );

    await expect(
      service.update('sec1', { classTeacherId: 'missing-teacher' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException updating a section that does not exist', async () => {
    prisma.section.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing', { name: 'x' }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes a section and audit-logs it', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', name: '3A' });
    prisma.section.delete.mockResolvedValue({ id: 'sec1' });

    await service.delete('sec1', 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'section.delete',
          entityId: 'sec1',
        }),
      }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException (e.g. Timetable/DiaryEntry/Circular rows still exist)', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', name: '3A' });
    prisma.section.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: 'test' },
      ),
    );

    await expect(service.delete('sec1', 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('still returns a student list unchanged (getStudents behavior untouched)', async () => {
    prisma.enrollment.findMany.mockResolvedValue([
      { student: { id: 'st1', name: 'Eshaal Sample', grNumber: 'GR-1001' } },
    ]);

    expect(await service.getStudents('sec1')).toEqual([
      { id: 'st1', name: 'Eshaal Sample', grNumber: 'GR-1001' },
    ]);
  });

  it('rejects creating a section whose class teacher belongs to another campus', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ campusId: 'other-campus' });

    await expect(
      service.create({ classId: 'cl1', name: '3A', classTeacherId: 't-other' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.section.create).not.toHaveBeenCalled();
  });

  it('rejects updating a section to a class teacher from another campus', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', class: { campusId: 'c1' } });
    prisma.teacher.findUnique.mockResolvedValue({ campusId: 'other-campus' });

    await expect(
      service.update('sec1', { classTeacherId: 't-other' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.section.update).not.toHaveBeenCalled();
  });

  it('allows clearing the class teacher (null) without a campus check', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', class: { campusId: 'c1' } });
    prisma.section.update.mockResolvedValue({ ...fullRecord, classTeacherId: null, classTeacher: null });

    await service.update('sec1', { classTeacherId: null as unknown as undefined }, 'admin-1');

    expect(prisma.teacher.findUnique).not.toHaveBeenCalled();
  });
});
