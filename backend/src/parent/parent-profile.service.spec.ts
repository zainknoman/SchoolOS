import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ParentService } from './parent.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('ParentService — profile / guardian links', () => {
  let service: ParentService;
  let tx: {
    studentParent: { updateMany: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let prisma: {
    parentProfile: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    studentParent: { findFirst: jest.Mock; findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  const superAdmin = { id: 'u0', role: 'SUPER_ADMIN' } as const;
  const schoolAdmin = { id: 'u1', role: 'SCHOOL_ADMIN' } as const;

  const profileRow = {
    id: 'p1',
    name: 'Sana',
    phone: '0300',
    cnic: '42101-1',
    gender: 'FEMALE',
    dateOfBirth: new Date('1985-03-04'),
    alternatePhone: null,
    whatsappNumber: null,
    email: 's@x.pk',
    occupation: 'Doctor',
    employerName: null,
    designation: null,
    currentAddressId: null,
    permanentAddressId: null,
    currentAddress: null,
    permanentAddress: null,
    user: { identifier: 'sana@x.pk' },
    children: [
      {
        relationship: 'mother',
        isPrimary: true,
        isEmergencyContact: true,
        student: {
          id: 's1',
          name: 'Eshaal',
          grNumber: 'GR-1',
          enrollments: [{ section: { name: '3A', class: { name: 'Grade 3' } } }],
        },
      },
    ],
  };

  beforeEach(async () => {
    tx = {
      studentParent: { updateMany: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      parentProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', userId: 'pu1', currentAddressId: null, permanentAddressId: null }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(profileRow),
        update: jest.fn().mockResolvedValue({ id: 'p1', name: 'Sana', phone: '0300', user: { identifier: 'sana@x.pk' }, _count: { children: 1 } }),
      },
      studentParent: {
        findFirst: jest.fn().mockResolvedValue({ id: 'link' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'link1' }),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ schoolId: 'school-1' }) },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [ParentService, { provide: PrismaService, useValue: prisma }, OrgScopeService],
    }).compile();
    service = moduleRef.get(ParentService);
  });

  it('returns the profile with children, class labels and guardian flags', async () => {
    const profile = await service.getProfile('p1', superAdmin);
    expect(profile).toMatchObject({
      name: 'Sana',
      dateOfBirth: '1985-03-04',
      occupation: 'Doctor',
      childrenCount: 1,
      children: [
        { studentName: 'Eshaal', className: 'Grade 3', sectionName: '3A', isPrimary: true, isEmergencyContact: true },
      ],
    });
  });

  it('404s for an unknown parent', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue(null);
    await expect(service.getProfile('nope', superAdmin)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses a school admin reading a parent with no child in their school', async () => {
    prisma.studentParent.findFirst.mockResolvedValue(null);
    await expect(service.getProfile('p1', schoolAdmin)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('demotes other primary guardians when one is marked primary', async () => {
    await service.updateChildLink('p1', 's1', { isPrimary: true }, superAdmin);
    expect(tx.studentParent.updateMany).toHaveBeenCalledWith({
      where: { studentId: 's1', NOT: { parentProfileId: 'p1' } },
      data: { isPrimary: false },
    });
    expect(tx.studentParent.update).toHaveBeenCalledWith({ where: { id: 'link1' }, data: { isPrimary: true } });
  });

  it('does not touch other guardians when un-marking primary or setting the emergency flag', async () => {
    await service.updateChildLink('p1', 's1', { isEmergencyContact: false, isPrimary: false }, superAdmin);
    expect(tx.studentParent.updateMany).not.toHaveBeenCalled();
  });

  it('404s when the parent is not linked to the student', async () => {
    prisma.studentParent.findUnique.mockResolvedValue(null);
    await expect(service.updateChildLink('p1', 's9', { isPrimary: true }, superAdmin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a current address when none exists and blanks empty text fields to null', async () => {
    await service.update('p1', { cnic: ' ', occupation: 'Teacher', currentAddress: { line1: '5 Rose St' } }, 'u0');
    const data = prisma.parentProfile.update.mock.calls[0][0].data;
    expect(data.cnic).toBeNull();
    expect(data.occupation).toBe('Teacher');
    expect(data.currentAddress).toEqual({ create: { line1: '5 Rose St' } });
    expect(data.permanentAddress).toBeUndefined();
  });
});
