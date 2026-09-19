import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('StaffService — update / remove', () => {
  let service: StaffService;
  let prisma: {
    staff: { findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
  };

  const staffRow = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    name: 'Nazir',
    employeeType: 'JANITORIAL',
    employmentStatus: 'ACTIVE',
    teacherId: null,
    userId: null,
    campus: { name: 'PECHS', schoolId: 'school-1' },
    ...over,
  });
  const superAdmin = { id: 'u0', role: 'SUPER_ADMIN' } as const;
  const schoolAdmin = { id: 'u1', role: 'SCHOOL_ADMIN' } as const;

  beforeEach(async () => {
    prisma = {
      staff: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ schoolId: 'school-1' }) },
      auditLog: { create: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [StaffService, { provide: PrismaService, useValue: prisma }, OrgScopeService],
    }).compile();
    service = moduleRef.get(StaffService);
  });

  it('404s for an unknown staff member', async () => {
    prisma.staff.findUnique.mockResolvedValue(null);
    await expect(service.update('nope', { name: 'X' }, superAdmin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a school admin editing staff from another school', async () => {
    prisma.staff.findUnique.mockResolvedValue(staffRow({ campus: { name: 'X', schoolId: 'school-2' } }));
    await expect(service.update('s1', { name: 'X' }, schoolAdmin)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove('s1', schoolAdmin)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.staff.update).not.toHaveBeenCalled();
    expect(prisma.staff.delete).not.toHaveBeenCalled();
  });

  it('updates only the supplied quick-edit fields and audits it', async () => {
    prisma.staff.findUnique.mockResolvedValue(staffRow());
    prisma.staff.update.mockResolvedValue(staffRow({ name: 'Nazir Ahmed', employmentStatus: 'ON_LEAVE' }));
    const result = await service.update('s1', { name: ' Nazir Ahmed ', employmentStatus: 'ON_LEAVE' }, schoolAdmin);
    expect(prisma.staff.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: { name: 'Nazir Ahmed', employmentStatus: 'ON_LEAVE' } }),
    );
    expect(result).toMatchObject({ name: 'Nazir Ahmed', employmentStatus: 'ON_LEAVE', campusName: 'PECHS' });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('refuses to delete a staff member who has a teacher login', async () => {
    prisma.staff.findUnique.mockResolvedValue(staffRow({ teacherId: 't1', userId: 'u9' }));
    await expect(service.remove('s1', superAdmin)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.staff.delete).not.toHaveBeenCalled();
  });

  it('deletes a staff member with no login', async () => {
    prisma.staff.findUnique.mockResolvedValue(staffRow());
    await service.remove('s1', superAdmin);
    expect(prisma.staff.delete).toHaveBeenCalledWith({ where: { id: 's1' } });
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
