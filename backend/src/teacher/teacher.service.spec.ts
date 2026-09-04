import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TeacherService } from './teacher.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('argon2', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

describe('TeacherService', () => {
  let service: TeacherService;
  let tx: { user: { create: jest.Mock }; teacher: { create: jest.Mock } };
  let prisma: {
    teacher: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { update: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(async () => {
    tx = { user: { create: jest.fn() }, teacher: { create: jest.fn() } };
    prisma = {
      teacher: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      user: { update: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [TeacherService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(TeacherService);
  });

  it('creates a Teacher (User + Teacher) and audit-logs it without leaking the password', async () => {
    tx.user.create.mockResolvedValue({ id: 'u1', identifier: 'teacher-x@seeds.edu.pk' });
    tx.teacher.create.mockResolvedValue({ id: 't1', name: 'New Teacher' });

    const result = await service.create(
      { identifier: 'teacher-x@seeds.edu.pk', password: 'ChangeMe123!', name: 'New Teacher' },
      'admin-1',
    );

    expect(result).toEqual({ id: 't1', identifier: 'teacher-x@seeds.edu.pk', name: 'New Teacher' });
    expect(tx.user.create).toHaveBeenCalledWith({
      data: { identifier: 'teacher-x@seeds.edu.pk', passwordHash: 'hashed-password', role: 'TEACHER' },
    });
    expect(tx.teacher.create).toHaveBeenCalledWith({ data: { userId: 'u1', name: 'New Teacher' } });
    const auditCall = prisma.auditLog.create.mock.calls[0][0];
    expect(auditCall.data.action).toBe('teacher.create');
    expect(JSON.stringify(auditCall.data)).not.toContain('ChangeMe123!');
  });

  it('translates a duplicate identifier into a BadRequestException', async () => {
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(
      service.create({ identifier: 'dupe@seeds.edu.pk', password: 'ChangeMe123!', name: 'X' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists teachers with their login identifier', async () => {
    prisma.teacher.findMany.mockResolvedValue([
      { id: 't1', name: 'New Teacher', user: { identifier: 'teacher-x@seeds.edu.pk' } },
    ]);

    expect(await service.list()).toEqual([{ id: 't1', identifier: 'teacher-x@seeds.edu.pk', name: 'New Teacher' }]);
  });

  it('updates the name without touching the password', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
    prisma.teacher.update.mockResolvedValue({ id: 't1', name: 'Renamed', user: { identifier: 'teacher-x@seeds.edu.pk' } });

    const result = await service.update('t1', { name: 'Renamed' }, 'admin-1');

    expect(result.name).toBe('Renamed');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('updates the password (hashed) when one is given', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
    prisma.teacher.update.mockResolvedValue({ id: 't1', name: 'New Teacher', user: { identifier: 'teacher-x@seeds.edu.pk' } });

    await service.update('t1', { password: 'NewPass123!' }, 'admin-1');

    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordHash: 'hashed-password' } });
  });

  it('throws NotFoundException updating a teacher that does not exist', async () => {
    prisma.teacher.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes a teacher (Teacher then User) and audit-logs it', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
    prisma.teacher.delete.mockResolvedValue({ id: 't1' });
    prisma.user.delete.mockResolvedValue({ id: 'u1' });

    await service.delete('t1', 'admin-1');

    expect(prisma.teacher.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'teacher.delete', entityId: 't1' }) }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException (e.g. Attendance.markedById still references this teacher)', async () => {
    prisma.teacher.findUnique.mockResolvedValue({ id: 't1', userId: 'u1' });
    prisma.teacher.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('t1', 'admin-1')).rejects.toThrow(BadRequestException);
  });
});
