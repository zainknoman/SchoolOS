import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ParentService } from './parent.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrgScopeService } from '../common/org-scope.service';

describe('ParentService — profile / guardian links', () => {
  let service: ParentService;
  let tx: {
    studentParent: { findMany: jest.Mock; update: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let prisma: {
    parentProfile: {
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      update: jest.Mock;
    };
    studentParent: { findFirst: jest.Mock; findUnique: jest.Mock };
    student: { findUnique: jest.Mock };
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
        relationshipType: 'MOTHER',
        relationshipNote: null,
        primarySlot: 1,
        isPrimary: true,
        isEmergencyContact: true,
        student: {
          id: 's1',
          name: 'Eshaal',
          grNumber: 'GR-1',
          enrollments: [
            {
              section: { name: '3A', class: { name: 'Grade 3' } },
              campus: { school: { name: 'Demo School North' } },
            },
          ],
        },
      },
    ],
  };

  beforeEach(async () => {
    tx = {
      studentParent: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      parentProfile: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'pu1',
          currentAddressId: null,
          permanentAddressId: null,
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(profileRow),
        update: jest.fn().mockResolvedValue({
          id: 'p1',
          name: 'Sana',
          phone: '0300',
          user: { identifier: 'sana@x.pk' },
          _count: { children: 1 },
        }),
      },
      studentParent: {
        findFirst: jest.fn().mockResolvedValue({ id: 'link' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'link1',
          relationshipType: 'MOTHER',
          relationshipNote: null,
          primarySlot: null,
        }),
      },
      // BL-23: the student must be in the caller's scope (a super admin passes).
      student: { findUnique: jest.fn().mockResolvedValue({ enrollments: [] }) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ schoolId: 'school-1' }),
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ParentService,
        { provide: PrismaService, useValue: prisma },
        OrgScopeService,
      ],
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
        {
          studentName: 'Eshaal',
          className: 'Grade 3',
          sectionName: '3A',
          relationshipType: 'MOTHER',
          primarySlot: 1,
          isPrimary: true,
          isEmergencyContact: true,
          schoolName: 'Demo School North',
        },
      ],
    });
  });

  it('404s for an unknown parent', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue(null);
    await expect(service.getProfile('nope', superAdmin)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses a school admin reading a parent with no child in their school', async () => {
    prisma.studentParent.findFirst.mockResolvedValue(null);
    await expect(service.getProfile('p1', schoolAdmin)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  // BL-04 replaces the old "demote every other primary" rule: up to two primaries, a third is refused.
  it('marking primary takes the first free slot and keeps the legacy flags in step', async () => {
    tx.studentParent.findMany.mockResolvedValue([{ primarySlot: 1 }]);
    await service.updateChildLink('p1', 's1', { isPrimary: true }, superAdmin);
    expect(tx.studentParent.update).toHaveBeenCalledWith({
      where: { id: 'link1' },
      data: expect.objectContaining({
        primarySlot: 2,
        isPrimary: true,
        relationshipType: 'MOTHER',
        relationship: 'mother',
      }),
    });
  });

  it('refuses a third primary guardian (409) and changes nothing', async () => {
    tx.studentParent.findMany.mockResolvedValue([
      { primarySlot: 1 },
      { primarySlot: 2 },
    ]);
    await expect(
      service.updateChildLink('p1', 's1', { isPrimary: true }, superAdmin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.studentParent.update).not.toHaveBeenCalled();
  });

  it('un-marking primary releases the slot; the emergency flag is independent', async () => {
    prisma.studentParent.findUnique.mockResolvedValue({
      id: 'link1',
      relationshipType: 'FATHER',
      relationshipNote: null,
      primarySlot: 1,
    });
    await service.updateChildLink(
      'p1',
      's1',
      { isEmergencyContact: false, isPrimary: false },
      superAdmin,
    );
    expect(tx.studentParent.update).toHaveBeenCalledWith({
      where: { id: 'link1' },
      data: expect.objectContaining({
        primarySlot: null,
        isPrimary: false,
        isEmergencyContact: false,
      }),
    });
  });

  it('404s when the parent is not linked to the student', async () => {
    prisma.studentParent.findUnique.mockResolvedValue(null);
    await expect(
      service.updateChildLink('p1', 's9', { isPrimary: true }, superAdmin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a current address when none exists and blanks empty text fields to null', async () => {
    await service.update(
      'p1',
      {
        cnic: ' ',
        occupation: 'Teacher',
        currentAddress: { line1: '5 Rose St' },
      },
      superAdmin,
    );
    const data = prisma.parentProfile.update.mock.calls[0][0].data;
    expect(data.cnic).toBeNull();
    expect(data.occupation).toBe('Teacher');
    expect(data.currentAddress).toEqual({ create: { line1: '5 Rose St' } });
    expect(data.permanentAddress).toBeUndefined();
  });
});
