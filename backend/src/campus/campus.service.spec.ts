import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CampusService } from './campus.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CampusService', () => {
  let service: CampusService;
  let prisma: {
    campus: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    enrollment: { count: jest.Mock };
    staff: { count: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const withSchool = { school: { select: { name: true } } };

  beforeEach(async () => {
    prisma = {
      campus: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      enrollment: { count: jest.fn().mockResolvedValue(0) },
      staff: { count: jest.fn().mockResolvedValue(0) },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [CampusService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(CampusService);
  });

  it('creates a campus under a school (with address/phone/email) and audit-logs it', async () => {
    prisma.campus.create.mockResolvedValue({
      id: 'c1',
      name: 'Gulistan-e-Jauhar',
      schoolId: 's1',
      address: '45 Main Rd',
      phone: '021-222',
      email: 'gulistan@seeds.edu',
      school: { name: 'The Seeds School' },
    });
    prisma.enrollment.count.mockResolvedValue(80);
    prisma.staff.count.mockResolvedValue(6);

    const result = await service.create(
      { schoolId: 's1', name: 'Gulistan-e-Jauhar', address: '45 Main Rd', phone: '021-222', email: 'gulistan@seeds.edu' },
      'admin-1',
    );

    expect(result).toEqual({
      id: 'c1',
      name: 'Gulistan-e-Jauhar',
      schoolId: 's1',
      schoolName: 'The Seeds School',
      address: '45 Main Rd',
      phone: '021-222',
      email: 'gulistan@seeds.edu',
      studentCount: 80,
      staffCount: 6,
    });
    expect(prisma.enrollment.count).toHaveBeenCalledWith({ where: { status: 'ACTIVE', campusId: 'c1' } });
    expect(prisma.staff.count).toHaveBeenCalledWith({ where: { campusId: 'c1' } });
    expect(prisma.campus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { schoolId: 's1', name: 'Gulistan-e-Jauhar', address: '45 Main Rd', phone: '021-222', email: 'gulistan@seeds.edu' },
        include: withSchool,
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'campus.create',
          entityId: 'c1',
        }),
      }),
    );
  });

  it('translates a foreign-key violation on create into a BadRequestException (invalid schoolId)', async () => {
    prisma.campus.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: 'test' },
      ),
    );

    await expect(
      service.create({ schoolId: 'missing', name: 'x' }, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('lists every campus for a SUPER_ADMIN without a schoolId lookup', async () => {
    prisma.campus.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Gulistan-e-Jauhar',
        schoolId: 's1',
        address: null,
        phone: null,
        email: null,
        school: { name: 'The Seeds School' },
      },
    ]);

    const result = await service.list({ id: 'super-1', role: 'SUPER_ADMIN' });

    expect(result).toEqual([
      {
        id: 'c1',
        name: 'Gulistan-e-Jauhar',
        schoolId: 's1',
        schoolName: 'The Seeds School',
        address: null,
        phone: null,
        email: null,
        studentCount: 0,
        staffCount: 0,
      },
    ]);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.campus.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it("scopes a SCHOOL_ADMIN's campus list to their own school", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: 's1' });
    prisma.campus.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Gulistan-e-Jauhar',
        schoolId: 's1',
        address: null,
        phone: null,
        email: null,
        school: { name: 'The Seeds School' },
      },
    ]);

    const result = await service.list({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(result).toEqual([
      {
        id: 'c1',
        name: 'Gulistan-e-Jauhar',
        schoolId: 's1',
        schoolName: 'The Seeds School',
        address: null,
        phone: null,
        email: null,
        studentCount: 0,
        staffCount: 0,
      },
    ]);
    expect(prisma.campus.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { schoolId: 's1' } }),
    );
  });

  it('fails closed (returns an empty list) for a non-SUPER_ADMIN caller with no schoolId', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', schoolId: null });

    const result = await service.list({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(result).toEqual([]);
    expect(prisma.campus.findMany).not.toHaveBeenCalled();
  });

  it('updates the name and contact fields (schoolId is not editable)', async () => {
    prisma.campus.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Old Name',
      schoolId: 's1',
    });
    prisma.campus.update.mockResolvedValue({
      id: 'c1',
      name: 'New Name',
      schoolId: 's1',
      address: 'New Address',
      phone: null,
      email: null,
      school: { name: 'The Seeds School' },
    });

    const result = await service.update('c1', { name: 'New Name', address: 'New Address' }, 'admin-1');

    expect(result.name).toBe('New Name');
    expect(result.address).toBe('New Address');
    expect(prisma.campus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: { name: 'New Name', address: 'New Address' },
      }),
    );
  });

  it('throws NotFoundException updating a campus that does not exist', async () => {
    prisma.campus.findUnique.mockResolvedValue(null);

    await expect(
      service.update('missing', { name: 'x' }, 'admin-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('deletes a campus and audit-logs it', async () => {
    prisma.campus.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Gulistan-e-Jauhar',
      schoolId: 's1',
    });
    prisma.campus.delete.mockResolvedValue({ id: 'c1' });

    await service.delete('c1', 'admin-1');

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'campus.delete',
          entityId: 'c1',
        }),
      }),
    );
  });

  it('translates a foreign-key violation on delete into a BadRequestException', async () => {
    prisma.campus.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Gulistan-e-Jauhar',
      schoolId: 's1',
    });
    prisma.campus.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        { code: 'P2003', clientVersion: 'test' },
      ),
    );

    await expect(service.delete('c1', 'admin-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
