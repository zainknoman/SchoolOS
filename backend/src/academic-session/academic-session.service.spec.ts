import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AcademicSessionService } from './academic-session.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('AcademicSessionService', () => {
  let service: AcademicSessionService;
  let tx: {
    academicSession: {
      updateMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let prisma: {
    academicSession: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
    auditLog: { create: jest.Mock };
    school: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      academicSession: {
        updateMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    prisma = {
      academicSession: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      school: { findUnique: jest.fn().mockResolvedValue({ id: 'school-a' }) },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AcademicSessionService,
        { provide: PrismaService, useValue: prisma },
        OrgScopeService,
      ],
    }).compile();
    service = moduleRef.get(AcademicSessionService);
  });

  it("creating an active session deactivates that school's other sessions first, inside one transaction", async () => {
    tx.academicSession.create.mockResolvedValue({
      id: 'as2',
      label: '2027-2028',
      startDate: new Date('2027-08-01'),
      endDate: new Date('2028-06-30'),
      isActive: true,
      schoolId: 'school-a',
    });

    const result = await service.create(
      {
        label: '2027-2028',
        startDate: '2027-08-01',
        endDate: '2028-06-30',
        isActive: true,
        schoolId: 'school-a',
      },
      'admin-1',
    );

    expect(result).toEqual({
      id: 'as2',
      schoolId: 'school-a',
      label: '2027-2028',
      startDate: '2027-08-01',
      endDate: '2028-06-30',
      isActive: true,
    });
    // BL-01: only the same school's sessions are deactivated.
    expect(tx.academicSession.updateMany).toHaveBeenCalledWith({
      where: { isActive: true, schoolId: 'school-a' },
      data: { isActive: false },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'academic-session.create',
          entityId: 'as2',
        }),
      }),
    );
  });

  it('creating a non-active session does not touch any other session', async () => {
    tx.academicSession.create.mockResolvedValue({
      id: 'as3',
      label: 'Draft',
      startDate: new Date('2028-08-01'),
      endDate: new Date('2029-06-30'),
      isActive: false,
    });

    await service.create(
      {
        label: 'Draft',
        startDate: '2028-08-01',
        endDate: '2029-06-30',
        isActive: false,
        schoolId: 'school-a',
      },
      'admin-1',
    );

    expect(tx.academicSession.updateMany).not.toHaveBeenCalled();
  });

  it('activating an existing session excludes itself from the deactivation sweep', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({
      id: 'as1',
      label: '2026-2027',
      isActive: false,
      schoolId: 'school-a',
    });
    tx.academicSession.update.mockResolvedValue({
      id: 'as1',
      label: '2026-2027',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-06-30'),
      isActive: true,
      schoolId: 'school-a',
    });

    await service.update('as1', { isActive: true }, 'admin-1');

    // BL-01: other schools' active sessions are not touched.
    expect(tx.academicSession.updateMany).toHaveBeenCalledWith({
      where: { isActive: true, id: { not: 'as1' }, schoolId: 'school-a' },
      data: { isActive: false },
    });
  });

  it('refuses to deactivate the only active session', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({
      id: 'as1',
      label: '2026-2027',
      isActive: true,
    });

    await expect(
      service.update('as1', { isActive: false }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
    expect(tx.academicSession.update).not.toHaveBeenCalled();
  });

  it('allows an update that leaves an already-inactive session inactive', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({
      id: 'as1',
      label: '2026-2027',
      isActive: false,
    });
    tx.academicSession.update.mockResolvedValue({
      id: 'as1',
      label: '2026-2027 Renamed',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-06-30'),
      isActive: false,
    });

    await expect(
      service.update('as1', { label: '2026-2027 Renamed' }, 'admin-1'),
    ).resolves.toBeDefined();
  });

  it('lists sessions with dates as YYYY-MM-DD', async () => {
    prisma.academicSession.findMany.mockResolvedValue([
      {
        id: 'as1',
        label: '2026-2027',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2027-06-30'),
        isActive: true,
        schoolId: 'school-a',
      },
    ]);

    expect(await service.list({ id: 'super-1', role: 'SUPER_ADMIN' })).toEqual([
      {
        id: 'as1',
        schoolId: 'school-a',
        label: '2026-2027',
        startDate: '2026-08-01',
        endDate: '2027-06-30',
        isActive: true,
      },
    ]);
  });

  it('throws NotFoundException updating a session that does not exist', async () => {
    prisma.academicSession.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing', { label: 'x' }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes a session and audit-logs it', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({
      id: 'as1',
      label: '2026-2027',
    });
    prisma.academicSession.delete.mockResolvedValue({ id: 'as1' });

    await service.delete('as1', 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'academic-session.delete',
          entityId: 'as1',
        }),
      }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({
      id: 'as1',
      label: '2026-2027',
    });
    prisma.academicSession.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: 'test' },
      ),
    );

    await expect(service.delete('as1', 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuses to delete the active session', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({
      id: 'as1',
      label: '2026-2027',
      isActive: true,
    });

    await expect(service.delete('as1', 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.academicSession.delete).not.toHaveBeenCalled();
  });

  describe('BL-01 school-scoped sessions', () => {
    it("a school admin lists only their school's sessions (and legacy school-less ones)", async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-a',
        schoolId: 'school-a',
        campusId: null,
      });
      prisma.academicSession.findMany.mockResolvedValue([]);
      await service.list({ id: 'admin-a', role: 'SCHOOL_ADMIN' });
      expect(prisma.academicSession.findMany).toHaveBeenCalledWith({
        where: { OR: [{ schoolId: 'school-a' }, { schoolId: null }] },
        orderBy: { startDate: 'desc' },
      });
    });

    it('a super admin can filter by school', async () => {
      prisma.academicSession.findMany.mockResolvedValue([]);
      await service.list({ id: 'super-1', role: 'SUPER_ADMIN' }, 'school-b');
      expect(prisma.academicSession.findMany.mock.calls[0][0].where).toEqual({
        schoolId: 'school-b',
      });
    });

    it('creating a session for an unknown school is refused', async () => {
      prisma.school.findUnique.mockResolvedValue(null);
      await expect(
        service.create(
          {
            label: 'x',
            startDate: '2027-08-01',
            endDate: '2028-06-30',
            isActive: false,
            schoolId: 'nope',
          },
          'admin-1',
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.academicSession.create).not.toHaveBeenCalled();
    });

    it('refuses to copy a class structure between two schools', async () => {
      prisma.academicSession.findUnique
        .mockResolvedValueOnce({ id: 't', schoolId: 'school-a' })
        .mockResolvedValueOnce({ id: 's', schoolId: 'school-b' });
      await expect(
        service.copyStructure('t', 's', { id: 'super-1', role: 'SUPER_ADMIN' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
