import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SchoolService } from './school.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SchoolService', () => {
  let service: SchoolService;
  let prisma: {
    school: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      school: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [SchoolService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SchoolService);
  });

  it('creates a school and audit-logs it', async () => {
    prisma.school.create.mockResolvedValue({ id: 's1', name: 'The Seeds School' });

    const result = await service.create({ name: 'The Seeds School' }, 'admin-1');

    expect(result).toEqual({ id: 's1', name: 'The Seeds School' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'school.create', entity: 'School', entityId: 's1', userId: 'admin-1' }),
      }),
    );
  });

  it('lists schools', async () => {
    prisma.school.findMany.mockResolvedValue([{ id: 's1', name: 'The Seeds School' }]);

    expect(await service.list()).toEqual([{ id: 's1', name: 'The Seeds School' }]);
  });

  it('updates a school and audit-logs it', async () => {
    prisma.school.findUnique.mockResolvedValue({ id: 's1', name: 'The Seeds School' });
    prisma.school.update.mockResolvedValue({ id: 's1', name: 'Renamed School' });

    const result = await service.update('s1', { name: 'Renamed School' }, 'admin-1');

    expect(result).toEqual({ id: 's1', name: 'Renamed School' });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'school.update', entityId: 's1' }) }),
    );
  });

  it('throws NotFoundException updating a school that does not exist', async () => {
    prisma.school.findUnique.mockResolvedValue(null);

    await expect(service.update('missing', { name: 'x' }, 'admin-1')).rejects.toThrow(NotFoundException);
    expect(prisma.school.update).not.toHaveBeenCalled();
  });

  it('deletes a school and audit-logs it', async () => {
    prisma.school.findUnique.mockResolvedValue({ id: 's1', name: 'The Seeds School' });
    prisma.school.delete.mockResolvedValue({ id: 's1', name: 'The Seeds School' });

    await service.delete('s1', 'admin-1');

    expect(prisma.school.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'school.delete', entityId: 's1' }) }),
    );
  });

  it('throws NotFoundException deleting a school that does not exist', async () => {
    prisma.school.findUnique.mockResolvedValue(null);

    await expect(service.delete('missing', 'admin-1')).rejects.toThrow(NotFoundException);
    expect(prisma.school.delete).not.toHaveBeenCalled();
  });

  it('translates a foreign-key violation on delete into a BadRequestException', async () => {
    prisma.school.findUnique.mockResolvedValue({ id: 's1', name: 'The Seeds School' });
    prisma.school.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: 'test' }),
    );

    await expect(service.delete('s1', 'admin-1')).rejects.toThrow(BadRequestException);
  });
});
