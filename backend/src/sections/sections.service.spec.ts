import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SectionsService } from './sections.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SectionsService', () => {
  let service: SectionsService;
  let prisma: {
    section: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    enrollment: { findMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const fullRecord = {
    id: 'sec1',
    name: '3A',
    classId: 'cl1',
    classTeacherId: 't1',
    class: { name: 'Grade 3', campus: { name: 'Gulistan-e-Jauhar' } },
    classTeacher: { name: 'Ms. Ayesha' },
  };
  const expectedSummary = {
    id: 'sec1',
    name: '3A',
    className: 'Grade 3',
    campusName: 'Gulistan-e-Jauhar',
    classTeacherId: 't1',
    classTeacherName: 'Ms. Ayesha',
  };

  beforeEach(async () => {
    prisma = {
      section: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      enrollment: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [SectionsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SectionsService);
  });

  it('lists all sections including their class teacher', async () => {
    prisma.section.findMany.mockResolvedValue([fullRecord]);

    expect(await service.listAll()).toEqual([expectedSummary]);
  });

  it('lists all sections when a section has no class teacher assigned', async () => {
    prisma.section.findMany.mockResolvedValue([{ ...fullRecord, classTeacherId: null, classTeacher: null }]);

    const [result] = await service.listAll();
    expect(result.classTeacherId).toBeNull();
    expect(result.classTeacherName).toBeNull();
  });

  it('creates a section under a class, optionally with a class teacher, and audit-logs it', async () => {
    prisma.section.create.mockResolvedValue(fullRecord);

    const result = await service.create({ classId: 'cl1', name: '3A', classTeacherId: 't1' }, 'admin-1');

    expect(result).toEqual(expectedSummary);
    expect(prisma.section.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { classId: 'cl1', name: '3A', classTeacherId: 't1' } }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'section.create', entityId: 'sec1' }) }),
    );
  });

  it('creates a section with no class teacher when none is given', async () => {
    prisma.section.create.mockResolvedValue({ ...fullRecord, classTeacherId: null, classTeacher: null });

    await service.create({ classId: 'cl1', name: '3A' }, 'admin-1');

    expect(prisma.section.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { classId: 'cl1', name: '3A', classTeacherId: undefined } }),
    );
  });

  it('updates a section (classId is not editable, name and classTeacherId are)', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', name: '3A', classId: 'cl1' });
    prisma.section.update.mockResolvedValue({ ...fullRecord, name: '3A (Renamed)' });

    const result = await service.update('sec1', { name: '3A (Renamed)', classTeacherId: 't1' }, 'admin-1');

    expect(result.name).toBe('3A (Renamed)');
    expect(prisma.section.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sec1' }, data: { name: '3A (Renamed)', classTeacherId: 't1' } }),
    );
  });

  it('throws NotFoundException updating a section that does not exist', async () => {
    prisma.section.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes a section and audit-logs it', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', name: '3A' });
    prisma.section.delete.mockResolvedValue({ id: 'sec1' });

    await service.delete('sec1', 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'section.delete', entityId: 'sec1' }) }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException (e.g. Timetable/DiaryEntry/Circular rows still exist)', async () => {
    prisma.section.findUnique.mockResolvedValue({ id: 'sec1', name: '3A' });
    prisma.section.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('sec1', 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('still returns a student list unchanged (getStudents behavior untouched)', async () => {
    prisma.enrollment.findMany.mockResolvedValue([{ student: { id: 'st1', name: 'Eshaal Sample', grNumber: 'GR-1001' } }]);

    expect(await service.getStudents('sec1')).toEqual([{ id: 'st1', name: 'Eshaal Sample', grNumber: 'GR-1001' }]);
  });
});
