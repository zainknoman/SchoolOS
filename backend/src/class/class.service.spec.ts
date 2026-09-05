import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ClassService } from './class.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClassService', () => {
  let service: ClassService;
  let prisma: {
    class: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const withParents = { campus: { select: { name: true } }, academicSession: { select: { label: true } } };
  const fullRecord = {
    id: 'cl1',
    name: 'Grade 3',
    campusId: 'c1',
    academicSessionId: 'as1',
    campus: { name: 'Gulistan-e-Jauhar' },
    academicSession: { label: '2026-2027' },
  };
  const expectedSummary = {
    id: 'cl1',
    name: 'Grade 3',
    campusId: 'c1',
    campusName: 'Gulistan-e-Jauhar',
    academicSessionId: 'as1',
    academicSessionLabel: '2026-2027',
  };

  beforeEach(async () => {
    prisma = {
      class: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ClassService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(ClassService);
  });

  it('creates a class under a campus + academic session and audit-logs it', async () => {
    prisma.class.create.mockResolvedValue(fullRecord);

    const result = await service.create({ campusId: 'c1', academicSessionId: 'as1', name: 'Grade 3' }, 'admin-1');

    expect(result).toEqual(expectedSummary);
    expect(prisma.class.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { campusId: 'c1', academicSessionId: 'as1', name: 'Grade 3' }, include: withParents }),
    );
  });

  it('translates a foreign-key violation on create into a BadRequestException (invalid campusId/academicSessionId)', async () => {
    prisma.class.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(
      service.create({ campusId: 'missing', academicSessionId: 'as1', name: 'Grade 3' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists classes with their campus + academic session names', async () => {
    prisma.class.findMany.mockResolvedValue([fullRecord]);

    expect(await service.list()).toEqual([expectedSummary]);
  });

  it('updates only the name (campusId/academicSessionId are not editable)', async () => {
    prisma.class.findUnique.mockResolvedValue({ id: 'cl1', name: 'Old', campusId: 'c1', academicSessionId: 'as1' });
    prisma.class.update.mockResolvedValue({ ...fullRecord, name: 'Grade 3 (Renamed)' });

    const result = await service.update('cl1', { name: 'Grade 3 (Renamed)' }, 'admin-1');

    expect(result.name).toBe('Grade 3 (Renamed)');
    expect(prisma.class.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cl1' }, data: { name: 'Grade 3 (Renamed)' } }),
    );
  });

  it('throws NotFoundException updating a class that does not exist', async () => {
    prisma.class.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
  });

  it('deletes a class and audit-logs it', async () => {
    prisma.class.findUnique.mockResolvedValue({ id: 'cl1', name: 'Grade 3' });
    prisma.class.delete.mockResolvedValue({ id: 'cl1' });

    await service.delete('cl1', 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'class.delete', entityId: 'cl1' }) }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException', async () => {
    prisma.class.findUnique.mockResolvedValue({ id: 'cl1', name: 'Grade 3' });
    prisma.class.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('cl1', 'admin-1')).rejects.toThrow(BadRequestException);
  });
});
