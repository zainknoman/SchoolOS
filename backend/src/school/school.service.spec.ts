import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SchoolService } from './school.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SchoolService', () => {
  let service: SchoolService;
  let prisma: {
    school: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    campus: { count: jest.Mock };
    enrollment: { count: jest.Mock };
    staff: { count: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      school: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      campus: { count: jest.fn().mockResolvedValue(0) },
      enrollment: { count: jest.fn().mockResolvedValue(0) },
      staff: { count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [SchoolService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(SchoolService);
  });

  it('creates a school (with address/phone/email) and audit-logs it', async () => {
    prisma.school.create.mockResolvedValue({
      id: 's1', name: 'The Seeds School', address: '123 Main St', phone: '021-111', email: 'info@seeds.edu',
    });
    prisma.campus.count.mockResolvedValue(2);
    prisma.enrollment.count.mockResolvedValue(40);
    prisma.staff.count.mockResolvedValue(5);

    const result = await service.create(
      { name: 'The Seeds School', address: '123 Main St', phone: '021-111', email: 'info@seeds.edu' },
      'admin-1',
    );

    expect(result).toEqual({
      id: 's1', name: 'The Seeds School', address: '123 Main St', phone: '021-111', email: 'info@seeds.edu',
      campusCount: 2, studentCount: 40, staffCount: 5,
    });
    expect(prisma.campus.count).toHaveBeenCalledWith({ where: { schoolId: 's1' } });
    expect(prisma.enrollment.count).toHaveBeenCalledWith({ where: { status: 'ACTIVE', campus: { schoolId: 's1' } } });
    expect(prisma.staff.count).toHaveBeenCalledWith({ where: { campus: { schoolId: 's1' } } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'school.create', entity: 'School', entityId: 's1', userId: 'admin-1' }),
      }),
    );
  });

  it('lists schools with computed stats', async () => {
    prisma.school.findMany.mockResolvedValue([{ id: 's1', name: 'The Seeds School', address: null, phone: null, email: null }]);
    prisma.campus.count.mockResolvedValue(1);
    prisma.enrollment.count.mockResolvedValue(10);
    prisma.staff.count.mockResolvedValue(3);

    expect(await service.list()).toEqual([
      { id: 's1', name: 'The Seeds School', address: null, phone: null, email: null, campusCount: 1, studentCount: 10, staffCount: 3 },
    ]);
  });

  it('updates a school and audit-logs it', async () => {
    prisma.school.findUnique.mockResolvedValue({ id: 's1', name: 'The Seeds School', address: null, phone: null, email: null });
    prisma.school.update.mockResolvedValue({ id: 's1', name: 'Renamed School', address: null, phone: null, email: null });

    const result = await service.update('s1', { name: 'Renamed School' }, 'admin-1');

    expect(result).toEqual(
      expect.objectContaining({ id: 's1', name: 'Renamed School', campusCount: 0, studentCount: 0, staffCount: 0 }),
    );
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
