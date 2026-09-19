import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ParentService } from './parent.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

jest.mock('argon2', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

describe('ParentService', () => {
  let service: ParentService;
  let tx: { user: { create: jest.Mock; delete: jest.Mock }; parentProfile: { create: jest.Mock; delete: jest.Mock } };
  let prisma: {
    parentProfile: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = {
      user: { create: jest.fn(), delete: jest.fn() },
      parentProfile: { create: jest.fn(), delete: jest.fn() },
    };
    prisma = {
      parentProfile: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      user: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ParentService, { provide: PrismaService, useValue: prisma }, OrgScopeService],
    }).compile();
    service = moduleRef.get(ParentService);
  });

  it('creates a Parent (User + ParentProfile) and audit-logs it without leaking the password', async () => {
    tx.user.create.mockResolvedValue({ id: 'u1', identifier: 'parent-x@schoolos.edu.pk' });
    tx.parentProfile.create.mockResolvedValue({ id: 'p1', name: 'New Parent', phone: null });

    const result = await service.create(
      { identifier: 'parent-x@schoolos.edu.pk', password: 'ChangeMe123!', name: 'New Parent' },
      'admin-1',
    );

    expect(result).toEqual({ id: 'p1', identifier: 'parent-x@schoolos.edu.pk', name: 'New Parent', phone: null, childrenCount: 0 });
    const auditCall = prisma.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe('parent.create');
    expect(auditCall.data.entityId).toBe('p1');
    expect(JSON.stringify(auditCall.data)).not.toContain('ChangeMe123!');
  });

  it('translates a duplicate identifier into a BadRequestException', async () => {
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(
      service.create({ identifier: 'dupe@schoolos.edu.pk', password: 'ChangeMe123!', name: 'X' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists every parent with their linked-children count for a SUPER_ADMIN', async () => {
    prisma.parentProfile.findMany.mockResolvedValue([
      { id: 'p1', name: 'New Parent', phone: null, user: { identifier: 'parent-x@schoolos.edu.pk' }, _count: { children: 2 } },
    ]);

    const result = await service.list({ id: 'super-1', role: 'SUPER_ADMIN' });

    expect(result).toEqual([
      { id: 'p1', identifier: 'parent-x@schoolos.edu.pk', name: 'New Parent', phone: null, childrenCount: 2 },
    ]);
    expect(prisma.parentProfile.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined }));
  });

  it("scopes a SCHOOL_ADMIN's parent list to parents with a child enrolled in their own school", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: 'school-1' });
    prisma.parentProfile.findMany.mockResolvedValue([]);

    await service.list({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(prisma.parentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          children: {
            some: { student: { enrollments: { some: { section: { class: { campus: { schoolId: 'school-1' } } } } } } },
          },
        },
      }),
    );
  });

  it('fails closed (returns an empty list) for a SCHOOL_ADMIN with no schoolId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: null });

    const result = await service.list({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(result).toEqual([]);
    expect(prisma.parentProfile.findMany).not.toHaveBeenCalled();
  });

  it('updates name/phone without touching the password', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    prisma.parentProfile.update.mockResolvedValue({
      id: 'p1', name: 'Renamed', phone: '0300-9999999', user: { identifier: 'parent-x@schoolos.edu.pk' }, _count: { children: 0 },
    });

    const result = await service.update('p1', { name: 'Renamed', phone: '0300-9999999' }, 'admin-1');

    expect(result.name).toBe('Renamed');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates the password (hashed) when one is given', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    prisma.parentProfile.update.mockResolvedValue({
      id: 'p1', name: 'New Parent', phone: null, user: { identifier: 'parent-x@schoolos.edu.pk' }, _count: { children: 0 },
    });

    await service.update('p1', { password: 'NewPass123!' }, 'admin-1');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordHash: 'hashed-password' } });
  });

  it('throws NotFoundException updating a parent that does not exist', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes a parent (ParentProfile then User) inside one transaction and audit-logs it', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    tx.parentProfile.delete.mockResolvedValue({ id: 'p1' });
    tx.user.delete.mockResolvedValue({ id: 'u1' });

    await service.delete('p1', 'admin-1');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(tx.parentProfile.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'parent.delete', entityId: 'p1' }) }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    tx.parentProfile.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('p1', 'admin-1')).rejects.toThrow(BadRequestException);
  });

  it('rolls back and translates a foreign-key violation when the second delete (User) fails, without audit-logging a mutation that did not happen', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' });
    tx.parentProfile.delete.mockResolvedValue({ id: 'p1' });
    tx.user.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('p1', 'admin-1')).rejects.toThrow(BadRequestException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
