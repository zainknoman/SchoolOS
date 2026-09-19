import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MeService } from './me.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MeService — child detail / parent edit', () => {
  let service: MeService;
  let tx: {
    student: { findUniqueOrThrow: jest.Mock; update: jest.Mock };
    studentMedicalInfo: { upsert: jest.Mock };
    studentEmergencyContact: { deleteMany: jest.Mock; createMany: jest.Mock };
    auditLog: { create: jest.Mock };
  };
  let prisma: {
    studentParent: { findFirst: jest.Mock };
    student: { findUniqueOrThrow: jest.Mock };
    $transaction: jest.Mock;
  };

  const studentRow = {
    id: 's1',
    name: 'Eshaal',
    grNumber: 'GR-1',
    gender: 'FEMALE',
    dateOfBirth: new Date('2015-04-02'),
    admissionDate: null,
    status: 'ACTIVE',
    studentMobile: null,
    studentEmail: null,
    currentAddress: null,
    medicalInfo: null,
    emergencyContacts: [],
    parents: [{ relationship: 'mother', parentProfile: { name: 'Sana', phone: '0300' } }],
    enrollments: [
      { rollNumber: '4', campus: { name: 'Main' }, section: { name: '3A', class: { name: 'Grade 3' } } },
    ],
  };

  beforeEach(async () => {
    tx = {
      student: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ currentAddressId: null }),
        update: jest.fn(),
      },
      studentMedicalInfo: { upsert: jest.fn() },
      studentEmergencyContact: { deleteMany: jest.fn(), createMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    prisma = {
      studentParent: { findFirst: jest.fn().mockResolvedValue({ id: 'link' }) },
      student: { findUniqueOrThrow: jest.fn().mockResolvedValue(studentRow) },
      $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [MeService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(MeService);
  });

  it('rejects a child that is not linked to the parent', async () => {
    prisma.studentParent.findFirst.mockResolvedValue(null);
    await expect(service.getChildDetail('u1', 's9')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.updateChild('u1', 's9', { studentMobile: '1' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopes the link check by the parent user id', async () => {
    await service.getChildDetail('u1', 's1');
    expect(prisma.studentParent.findFirst).toHaveBeenCalledWith({
      where: { studentId: 's1', parentProfile: { userId: 'u1' } },
      select: { id: true },
    });
  });

  it('returns the child with class, guardians and formatted dates', async () => {
    const detail = await service.getChildDetail('u1', 's1');
    expect(detail).toMatchObject({
      name: 'Eshaal',
      dateOfBirth: '2015-04-02',
      class: 'Grade 3',
      section: '3A',
      guardians: [{ name: 'Sana', relationship: 'mother', phone: '0300' }],
    });
  });

  it('writes only the supplied contact fields and never touches identity fields', async () => {
    await service.updateChild('u1', 's1', { studentMobile: '0311', studentEmail: 'e@x.pk' });
    expect(tx.student.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { studentMobile: '0311', studentEmail: 'e@x.pk' },
    });
    expect(tx.studentMedicalInfo.upsert).not.toHaveBeenCalled();
    expect(tx.studentEmergencyContact.deleteMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it('creates the current address when none exists yet', async () => {
    await service.updateChild('u1', 's1', { currentAddress: { line1: '12 Rose St', city: 'Karachi' } });
    expect(tx.student.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { currentAddress: { create: { line1: '12 Rose St', city: 'Karachi' } } },
    });
  });

  it('upserts medical notes and replaces emergency contacts in priority order', async () => {
    await service.updateChild('u1', 's1', {
      allergies: 'Peanuts',
      emergencyContacts: [
        { name: 'Uncle', relationship: 'uncle', phone: '0322' },
        { name: 'Aunt', relationship: 'aunt', phone: '0333' },
      ],
    });
    expect(tx.studentMedicalInfo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentId: 's1' }, update: { allergies: 'Peanuts' } }),
    );
    expect(tx.studentEmergencyContact.deleteMany).toHaveBeenCalledWith({ where: { studentId: 's1' } });
    const rows = tx.studentEmergencyContact.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { priority: number; isPrimary: boolean }) => [r.priority, r.isPrimary])).toEqual([
      [1, true],
      [2, false],
    ]);
  });
});
