import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StudentService } from './student.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('argon2', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

describe('StudentService', () => {
  let service: StudentService;
  let tx: {
    student: { create: jest.Mock };
    enrollment: { create: jest.Mock };
    studentParent: { create: jest.Mock };
    user: { create: jest.Mock };
    parentProfile: { create: jest.Mock; findUnique: jest.Mock; findFirst: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let prisma: {
    academicSession: { findFirst: jest.Mock };
    section: { findUnique: jest.Mock };
    student: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  const activeSession = { id: 'as1', isActive: true };
  const sectionRow = { id: 'sec1', classId: 'cl1', class: { campusId: 'c1' } };

  beforeEach(async () => {
    tx = {
      student: { create: jest.fn() },
      enrollment: { create: jest.fn() },
      studentParent: { create: jest.fn() },
      user: { create: jest.fn() },
      parentProfile: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      academicSession: { findFirst: jest.fn().mockResolvedValue(activeSession) },
      section: { findUnique: jest.fn().mockResolvedValue(sectionRow) },
      student: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [StudentService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(StudentService);
  });

  it('rejects when neither parentProfileId nor newParent is given, without touching the database', async () => {
    await expect(
      service.create({ grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects with a BadRequestException when both parentProfileId and newParent are explicitly null (not just omitted)', async () => {
    await expect(
      service.create(
        {
          grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1',
          parentProfileId: null, newParent: null,
        } as unknown as Parameters<typeof service.create>[0],
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects with a BadRequestException (not an unhandled error downstream) when parentProfileId is omitted and newParent is explicitly null', async () => {
    tx.student.create.mockResolvedValue({ id: 's-mixed', grNumber: 'GR-2004', name: 'Mixed Null' });

    await expect(
      service.create(
        {
          grNumber: 'GR-2004', name: 'Mixed Null', sectionId: 'sec1',
          newParent: null,
        } as unknown as Parameters<typeof service.create>[0],
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when both parentProfileId and newParent are given', async () => {
    await expect(
      service.create(
        {
          grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1',
          parentProfileId: 'p1',
          newParent: { identifier: 'x@schoolos.edu.pk', password: 'ChangeMe123!', name: 'X' },
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the section does not exist', async () => {
    prisma.section.findUnique.mockResolvedValue(null);

    await expect(
      service.create({ grNumber: 'GR-2001', name: 'New Student', sectionId: 'missing', parentProfileId: 'p1' }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when there is no active academic session', async () => {
    prisma.academicSession.findFirst.mockResolvedValue(null);

    await expect(
      service.create({ grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1', parentProfileId: 'p1' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates a Student + Enrollment (campusId derived from the section) linked to an existing parent, in one transaction', async () => {
    tx.student.create.mockResolvedValue({ id: 's1', grNumber: 'GR-2001', name: 'New Student' });
    tx.parentProfile.findUnique.mockResolvedValue({ id: 'p1', name: 'Existing Parent' });
    prisma.student.findUniqueOrThrow.mockResolvedValue({
      id: 's1', grNumber: 'GR-2001', name: 'New Student', enrollments: [], parents: [],
    });

    await service.create({ grNumber: 'GR-2001', name: 'New Student', sectionId: 'sec1', parentProfileId: 'p1' }, 'admin-1');

    expect(tx.student.create).toHaveBeenCalledWith({ data: { grNumber: 'GR-2001', name: 'New Student' } });
    expect(tx.enrollment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        studentId: 's1',
        campusId: 'c1',
        sectionId: 'sec1',
        academicSessionId: 'as1',
        status: 'ACTIVE',
      }),
    });
    expect(tx.studentParent.create).toHaveBeenCalledWith({ data: { studentId: 's1', parentProfileId: 'p1' } });
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'student.create', entityId: 's1' }) }),
    );
  });

  it('creates a Student linked to a brand-new parent, via the same createParentWithUser logic, inside the same transaction', async () => {
    tx.student.create.mockResolvedValue({ id: 's2', grNumber: 'GR-2002', name: 'Another Student' });
    tx.user.create.mockResolvedValue({ id: 'u1', identifier: 'new-parent@schoolos.edu.pk' });
    tx.parentProfile.create.mockResolvedValue({ id: 'p-new', name: 'New Parent', phone: null });
    prisma.student.findUniqueOrThrow.mockResolvedValue({
      id: 's2', grNumber: 'GR-2002', name: 'Another Student', enrollments: [], parents: [],
    });

    await service.create(
      {
        grNumber: 'GR-2002', name: 'Another Student', sectionId: 'sec1',
        newParent: { identifier: 'new-parent@schoolos.edu.pk', password: 'ChangeMe123!', name: 'New Parent' },
      },
      'admin-1',
    );

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ identifier: 'new-parent@schoolos.edu.pk', role: 'PARENT' }) }),
    );
    expect(tx.studentParent.create).toHaveBeenCalledWith({ data: { studentId: 's2', parentProfileId: 'p-new' } });

    // Finding 1: the inline-created Parent account must get its own parent.create audit-log row,
    // in the same shape ParentService.create() writes, in addition to the student.create row.
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'parent.create',
          entity: 'ParentProfile',
          entityId: 'p-new',
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'student.create', entity: 'Student', entityId: 's2' }),
      }),
    );
    const allAuditPayloads = tx.auditLog.create.mock.calls.map((call) => JSON.stringify(call[0]));
    expect(allAuditPayloads.some((payload) => payload.includes('ChangeMe123!'))).toBe(false);
    const parentAuditCall = tx.auditLog.create.mock.calls.find(
      (call) => call[0].data.action === 'parent.create',
    )![0];
    expect(JSON.parse(parentAuditCall.data.metadata)).toEqual({
      identifier: 'new-parent@schoolos.edu.pk',
      name: 'New Parent',
    });
  });

  it('translates a duplicate GR number or parent identifier into a BadRequestException', async () => {
    tx.student.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(
      service.create({ grNumber: 'GR-1001', name: 'Dupe', sectionId: 'sec1', parentProfileId: 'p1' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects with a BadRequestException (not an unhandled error) when parentProfileId does not refer to an existing ParentProfile', async () => {
    tx.student.create.mockResolvedValue({ id: 's3', grNumber: 'GR-2003', name: 'Orphan Link' });
    tx.parentProfile.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        { grNumber: 'GR-2003', name: 'Orphan Link', sectionId: 'sec1', parentProfileId: 'does-not-exist' },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(tx.studentParent.create).not.toHaveBeenCalled();
  });

  it('lists students with their current section chain and linked parent names for a SUPER_ADMIN', async () => {
    prisma.student.findMany.mockResolvedValue([
      {
        id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample',
        enrollments: [{ section: { name: '3A', class: { name: 'Grade 3', campus: { name: 'Gulistan-e-Jauhar' } } } }],
        parents: [{ parentProfile: { name: 'Parent A' } }, { parentProfile: { name: 'Parent B' } }],
      },
    ]);

    const result = await service.list({ id: 'super-1', role: 'SUPER_ADMIN' });

    expect(result).toEqual([
      {
        id: 's1', grNumber: 'GR-1001', name: 'Eshaal Sample',
        sectionName: '3A', className: 'Grade 3', campusName: 'Gulistan-e-Jauhar',
        parentNames: ['Parent A', 'Parent B'],
      },
    ]);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.student.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });

  it('lists a student with no active enrollment using null section fields', async () => {
    prisma.student.findMany.mockResolvedValue([
      { id: 's2', grNumber: 'GR-1002', name: 'No Section', enrollments: [], parents: [] },
    ]);

    const [result] = await service.list({ id: 'super-1', role: 'SUPER_ADMIN' });
    expect(result.sectionName).toBeNull();
    expect(result.parentNames).toEqual([]);
  });

  it("scopes a SCHOOL_ADMIN's student list to students with an enrollment in their own school", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: 's1' });
    prisma.student.findMany.mockResolvedValue([]);

    await service.list({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(prisma.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { enrollments: { some: { section: { class: { campus: { schoolId: 's1' } } } } } },
      }),
    );
  });

  it('fails closed (returns an empty list) for a SCHOOL_ADMIN with no schoolId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: null });

    const result = await service.list({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(result).toEqual([]);
    expect(prisma.student.findMany).not.toHaveBeenCalled();
  });

  it('updates only name/grNumber (no enrollment/parent changes)', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 's1' });
    prisma.student.update.mockResolvedValue({
      id: 's1', grNumber: 'GR-1001', name: 'Renamed',
      enrollments: [], parents: [],
    });

    const result = await service.update('s1', { name: 'Renamed' }, 'admin-1');

    expect(result.name).toBe('Renamed');
    expect(prisma.student.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: { name: 'Renamed' } }),
    );
  });

  it('throws NotFoundException updating a student that does not exist', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes a student and audit-logs it', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 's1' });
    prisma.student.delete.mockResolvedValue({ id: 's1' });

    await service.delete('s1', 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'student.delete', entityId: 's1' }) }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException (e.g. real Attendance/FeeVoucher/LeaveRequest history exists)', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 's1' });
    prisma.student.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('s1', 'admin-1')).rejects.toThrow(BadRequestException);
  });
});
