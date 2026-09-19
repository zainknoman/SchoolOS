import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrgStatus, Prisma } from '@prisma/client';
import { CampusService } from './campus.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

// Default values for the profile fields added on top of the original id/name/schoolId/address/
// phone/email columns, used to keep fixtures realistic without hand-repeating every field in
// every test.
const NEW_PROFILE_FIELDS = {
  code: null,
  campusType: null,
  logoFileId: null,
  principalName: null,
  principalPhone: null,
  principalEmail: null,
  openingDate: null,
  capacity: null,
  latitude: null,
  longitude: null,
  status: OrgStatus.ACTIVE,
  departments: [],
  alternatePhone: null,
  addressId: null,
};

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
    $transaction: jest.Mock;
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
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [CampusService, { provide: PrismaService, useValue: prisma }, OrgScopeService],
    }).compile();
    service = moduleRef.get(CampusService);
  });

  it('rejects a campus principal creating a campus', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'p1', schoolId: 's1', campusId: 'c1' });
    await expect(
      service.create({ schoolId: 's1', name: 'New' }, 'p1', { id: 'p1', role: 'SCHOOL_ADMIN' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a school admin creating a campus in another school', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'a1', schoolId: 's1', campusId: null });
    await expect(
      service.create({ schoolId: 's2', name: 'New' }, 'a1', { id: 'a1', role: 'SCHOOL_ADMIN' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a user with no school scope creating a campus', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'a1', schoolId: null, campusId: null });
    await expect(
      service.create({ schoolId: 's1', name: 'New' }, 'a1', { id: 'a1', role: 'SCHOOL_ADMIN' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets a school-wide admin create a campus in their own school', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'a1', schoolId: 's1', campusId: null });
    prisma.campus.create.mockResolvedValue({
      id: 'c9', name: 'New', schoolId: 's1', ...NEW_PROFILE_FIELDS,
      address: null, phone: null, email: null, school: { name: 'S' },
    });
    const result = await service.create({ schoolId: 's1', name: 'New' }, 'a1', {
      id: 'a1',
      role: 'SCHOOL_ADMIN',
    });
    expect(result.id).toBe('c9');
  });

  it('creates a campus under a school (with address/phone/email) and audit-logs it', async () => {
    prisma.campus.create.mockResolvedValue({
      id: 'c1',
      name: 'Gulistan-e-Jauhar',
      schoolId: 's1',
      ...NEW_PROFILE_FIELDS,
      address: '45 Main Rd',
      phone: '021-222',
      email: 'gulistan@schoolos.edu',
      school: { name: 'The SchoolOS School' },
    });
    prisma.enrollment.count.mockResolvedValue(80);
    prisma.staff.count.mockResolvedValue(6);

    const result = await service.create(
      {
        schoolId: 's1',
        name: 'Gulistan-e-Jauhar',
        address: '45 Main Rd',
        phone: '021-222',
        email: 'gulistan@schoolos.edu',
      },
      'admin-1',
    );

    expect(result).toEqual({
      id: 'c1',
      name: 'Gulistan-e-Jauhar',
      schoolId: 's1',
      schoolName: 'The SchoolOS School',
      ...NEW_PROFILE_FIELDS,
      address: '45 Main Rd',
      phone: '021-222',
      email: 'gulistan@schoolos.edu',
      studentCount: 80,
      staffCount: 6,
    });
    expect(prisma.enrollment.count).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', campusId: 'c1' },
    });
    expect(prisma.staff.count).toHaveBeenCalledWith({
      where: { campusId: 'c1' },
    });
    expect(prisma.campus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          schoolId: 's1',
          name: 'Gulistan-e-Jauhar',
          address: '45 Main Rd',
          phone: '021-222',
          email: 'gulistan@schoolos.edu',
        },
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

  it('passes every new profile field through to prisma.campus.create', async () => {
    const dto = {
      schoolId: 's1',
      name: 'Full Fields Campus',
      code: 'FFC',
      campusType: 'Primary',
      logoFileId: 'file-1',
      principalName: 'Jane Doe',
      principalPhone: '021-999',
      principalEmail: 'principal@ffc.edu',
      openingDate: '2010-08-15',
      capacity: 500,
      latitude: 24.86,
      longitude: 67.01,
      status: OrgStatus.ACTIVE,
      departments: ['Science', 'Arts'],
      alternatePhone: '021-888',
      addressId: 'addr-1',
      address: '123 Main St',
      phone: '021-111',
      email: 'info@ffc.edu',
    };
    prisma.campus.create.mockResolvedValue({
      id: 'c2',
      ...dto,
      openingDate: new Date('2010-08-15'),
      school: { name: 'The SchoolOS School' },
    });

    await service.create(dto, 'admin-1');

    expect(prisma.campus.create).toHaveBeenCalledWith({
      data: {
        ...dto,
        openingDate: new Date('2010-08-15'),
      },
      include: withSchool,
    });
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

  it('translates a unique-constraint violation on create into a BadRequestException (duplicate code for this school)', async () => {
    prisma.campus.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.create(
        { schoolId: 's1', name: 'Duplicate Code Campus', code: 'MAIN' },
        'admin-1',
      ),
    ).rejects.toThrow(
      new BadRequestException(
        'This campus code is already in use for this school.',
      ),
    );
  });

  it('allows a second campus in a different school to reuse the same code', async () => {
    prisma.campus.create.mockResolvedValue({
      id: 'c3',
      name: 'Other School Campus',
      schoolId: 's2',
      ...NEW_PROFILE_FIELDS,
      code: 'MAIN',
      address: null,
      phone: null,
      email: null,
      school: { name: 'Another School' },
    });

    const result = await service.create(
      { schoolId: 's2', name: 'Other School Campus', code: 'MAIN' },
      'admin-1',
    );

    expect(result.code).toBe('MAIN');
    expect(result.schoolId).toBe('s2');
    expect(prisma.campus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schoolId: 's2', code: 'MAIN' }),
      }),
    );
  });

  it('lists every campus for a SUPER_ADMIN without a schoolId lookup', async () => {
    prisma.campus.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Gulistan-e-Jauhar',
        schoolId: 's1',
        ...NEW_PROFILE_FIELDS,
        address: null,
        phone: null,
        email: null,
        school: { name: 'The SchoolOS School' },
      },
    ]);

    const result = await service.list({ id: 'super-1', role: 'SUPER_ADMIN' });

    expect(result).toEqual([
      {
        id: 'c1',
        name: 'Gulistan-e-Jauhar',
        schoolId: 's1',
        schoolName: 'The SchoolOS School',
        ...NEW_PROFILE_FIELDS,
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
        ...NEW_PROFILE_FIELDS,
        address: null,
        phone: null,
        email: null,
        school: { name: 'The SchoolOS School' },
      },
    ]);

    const result = await service.list({ id: 'admin-1', role: 'SCHOOL_ADMIN' });

    expect(result).toEqual([
      {
        id: 'c1',
        name: 'Gulistan-e-Jauhar',
        schoolId: 's1',
        schoolName: 'The SchoolOS School',
        ...NEW_PROFILE_FIELDS,
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
      ...NEW_PROFILE_FIELDS,
      address: null,
      phone: null,
      email: null,
    });
    prisma.campus.update.mockResolvedValue({
      id: 'c1',
      name: 'New Name',
      schoolId: 's1',
      ...NEW_PROFILE_FIELDS,
      address: 'New Address',
      phone: null,
      email: null,
      school: { name: 'The SchoolOS School' },
    });

    const result = await service.update(
      'c1',
      { name: 'New Name', address: 'New Address' },
      'admin-1',
    );

    expect(result.name).toBe('New Name');
    expect(result.address).toBe('New Address');
    expect(prisma.campus.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1' },
        data: { name: 'New Name', address: 'New Address' },
      }),
    );
  });

  it('update() with only { name } does not touch any new profile field', async () => {
    prisma.campus.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Old Name',
      schoolId: 's1',
      ...NEW_PROFILE_FIELDS,
      address: null,
      phone: null,
      email: null,
    });
    prisma.campus.update.mockResolvedValue({
      id: 'c1',
      name: 'New Name',
      schoolId: 's1',
      ...NEW_PROFILE_FIELDS,
      address: null,
      phone: null,
      email: null,
      school: { name: 'The SchoolOS School' },
    });

    await service.update('c1', { name: 'New Name' }, 'admin-1');

    expect(prisma.campus.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { name: 'New Name' },
      include: withSchool,
    });
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
