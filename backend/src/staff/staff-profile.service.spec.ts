import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { StaffProfileService } from './staff-profile.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StaffProfileService', () => {
  let service: StaffProfileService;
  let prisma: {
    staff: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    file: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    staffEmergencyContact: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    staffExperience: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    staffDocument: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      staff: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
      file: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
      staffEmergencyContact: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      staffExperience: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      staffDocument: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [StaffProfileService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(StaffProfileService);
  });

  describe('getProfile', () => {
    it('throws NotFoundException when the staff member does not exist', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the full profile include when the staff member exists', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'st1' });
      prisma.staff.findUniqueOrThrow.mockResolvedValue({ id: 'st1', name: 'Nazir Ahmed' });

      const result = await service.getProfile('st1');

      expect(result).toEqual({ id: 'st1', name: 'Nazir Ahmed' });
      expect(prisma.staff.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'st1' } }),
      );
    });
  });

  describe('updateProfile', () => {
    it('throws NotFoundException when the staff member does not exist', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);
      await expect(service.updateProfile('missing', { mobile: '0300-1112233' }, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a new currentAddress when the staff member has none yet', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'st1', currentAddressId: null, permanentAddressId: null });
      prisma.staff.update.mockResolvedValue({ id: 'st1' });

      await service.updateProfile('st1', { currentAddress: { line1: 'House 1' } }, 'admin-1');

      expect(prisma.staff.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentAddress: { create: { line1: 'House 1' } } }),
        }),
      );
    });

    it('writes an audit log entry naming only the changed field keys, never their values', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'st1', currentAddressId: null, permanentAddressId: null });
      prisma.staff.update.mockResolvedValue({ id: 'st1' });

      await service.updateProfile('st1', { cnic: '42101-1234567-1' }, 'admin-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ metadata: JSON.stringify({ fields: ['cnic'] }) }) }),
      );
    });
  });

  describe('emergency contacts', () => {
    it('creates a contact scoped to the staff member', async () => {
        prisma.staff.findUnique.mockResolvedValue({ id: 'st1' });
        prisma.staffEmergencyContact.create.mockResolvedValue({ id: 'ec1', name: 'Bushra Ahmed' });

        await service.createEmergencyContact('st1', { name: 'Bushra Ahmed', relationship: 'Spouse', phone: '0300-1112233' }, 'admin-1');

        expect(prisma.staffEmergencyContact.create).toHaveBeenCalledWith(
        expect.objectContaining({
            data: expect.objectContaining({ staff: { connect: { id: 'st1' } }, name: 'Bushra Ahmed' }),
        }),
        );
    });

    it('throws NotFoundException updating a contact that belongs to a different staff member', async () => {
        prisma.staffEmergencyContact.findUnique.mockResolvedValue({ id: 'ec1', staffId: 'st-other', addressId: null });

        await expect(
        service.updateEmergencyContact('st1', 'ec1', { name: 'New name' }, 'admin-1'),
        ).rejects.toThrow(NotFoundException);
    });

    it('deletes a contact scoped to the staff member', async () => {
        prisma.staffEmergencyContact.findUnique.mockResolvedValue({ id: 'ec1', staffId: 'st1' });

        await service.deleteEmergencyContact('st1', 'ec1', 'admin-1');

        expect(prisma.staffEmergencyContact.delete).toHaveBeenCalledWith({ where: { id: 'ec1' } });
    });
  });

  describe('experience', () => {
    it('creates an experience entry scoped to the staff member', async () => {
        prisma.staff.findUnique.mockResolvedValue({ id: 'st1' });
        prisma.staffExperience.create.mockResolvedValue({ id: 'exp1', organization: 'City Grammar School' });

        await service.createExperience('st1', { organization: 'City Grammar School', role: 'Janitorial Staff' }, 'admin-1');

        expect(prisma.staffExperience.create).toHaveBeenCalledWith(
        expect.objectContaining({
            data: expect.objectContaining({ staffId: 'st1', organization: 'City Grammar School', role: 'Janitorial Staff' }),
        }),
        );
    });

    it('throws NotFoundException deleting an entry that belongs to a different staff member', async () => {
        prisma.staffExperience.findUnique.mockResolvedValue({ id: 'exp1', staffId: 'st-other' });

        await expect(service.deleteExperience('st1', 'exp1', 'admin-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('documents', () => {
    it('rejects adding a document whose fileId was never uploaded', async () => {
        prisma.staff.findUnique.mockResolvedValue({ id: 'st1' });
        prisma.file.findUnique.mockResolvedValue(null);

        await expect(
        service.addDocument('st1', { documentType: 'CNIC', fileId: 'missing' }, 'admin-1'),
        ).rejects.toThrow('Upload the file first');
    });

    it('marks a document verified and records who verified it', async () => {
        prisma.staffDocument.findUnique.mockResolvedValue({ id: 'doc1', staffId: 'st1' });
        prisma.staffDocument.update.mockResolvedValue({ id: 'doc1', verificationStatus: 'VERIFIED' });

        await service.verifyDocument('st1', 'doc1', true, 'admin-1');

        expect(prisma.staffDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
            data: expect.objectContaining({ verificationStatus: 'VERIFIED', verifiedById: 'admin-1' }),
        }),
        );
    });
  });
});