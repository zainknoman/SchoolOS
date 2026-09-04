import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AcademicSessionService } from './academic-session.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AcademicSessionService', () => {
  let service: AcademicSessionService;
  let tx: {
    academicSession: { updateMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  };
  let prisma: {
    academicSession: { findMany: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      academicSession: { updateMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    prisma = {
      academicSession: { findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [AcademicSessionService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(AcademicSessionService);
  });

  it('creating an active session deactivates every other session first, inside one transaction', async () => {
    tx.academicSession.create.mockResolvedValue({
      id: 'as2',
      label: '2027-2028',
      startDate: new Date('2027-08-01'),
      endDate: new Date('2028-06-30'),
      isActive: true,
    });

    const result = await service.create(
      { label: '2027-2028', startDate: '2027-08-01', endDate: '2028-06-30', isActive: true },
      'admin-1',
    );

    expect(result).toEqual({ id: 'as2', label: '2027-2028', startDate: '2027-08-01', endDate: '2028-06-30', isActive: true });
    expect(tx.academicSession.updateMany).toHaveBeenCalledWith({
      where: { isActive: true },
      data: { isActive: false },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'academic-session.create', entityId: 'as2' }) }),
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

    await service.create({ label: 'Draft', startDate: '2028-08-01', endDate: '2029-06-30', isActive: false }, 'admin-1');

    expect(tx.academicSession.updateMany).not.toHaveBeenCalled();
  });

  it('activating an existing session excludes itself from the deactivation sweep', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({ id: 'as1', label: '2026-2027', isActive: false });
    tx.academicSession.update.mockResolvedValue({
      id: 'as1',
      label: '2026-2027',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2027-06-30'),
      isActive: true,
    });

    await service.update('as1', { isActive: true }, 'admin-1');

    expect(tx.academicSession.updateMany).toHaveBeenCalledWith({
      where: { isActive: true, id: { not: 'as1' } },
      data: { isActive: false },
    });
  });

  it('lists sessions with dates as YYYY-MM-DD', async () => {
    prisma.academicSession.findMany.mockResolvedValue([
      { id: 'as1', label: '2026-2027', startDate: new Date('2026-08-01'), endDate: new Date('2027-06-30'), isActive: true },
    ]);

    expect(await service.list()).toEqual([
      { id: 'as1', label: '2026-2027', startDate: '2026-08-01', endDate: '2027-06-30', isActive: true },
    ]);
  });

  it('throws NotFoundException updating a session that does not exist', async () => {
    prisma.academicSession.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { label: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes a session and audit-logs it', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({ id: 'as1', label: '2026-2027' });
    prisma.academicSession.delete.mockResolvedValue({ id: 'as1' });

    await service.delete('as1', 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'academic-session.delete', entityId: 'as1' }) }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException', async () => {
    prisma.academicSession.findUnique.mockResolvedValue({ id: 'as1', label: '2026-2027' });
    prisma.academicSession.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('as1', 'admin-1')).rejects.toThrow(BadRequestException);
  });
});
