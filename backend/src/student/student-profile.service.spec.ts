import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StudentProfileService } from './student-profile.service';
import { PrismaService } from '../prisma/prisma.service';

describe('StudentProfileService', () => {
  let service: StudentProfileService;
  let prisma: {
    student: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock; update: jest.Mock };
    enrollment: { findFirst: jest.Mock; update: jest.Mock };
    file: { findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    studentPreviousSchool: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    studentEmergencyContact: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    studentMedicalInfo: { upsert: jest.Mock };
    studentDocument: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      student: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
      enrollment: { findFirst: jest.fn(), update: jest.fn() },
      file: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
      studentPreviousSchool: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      studentEmergencyContact: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
      studentMedicalInfo: { upsert: jest.fn() },
      studentDocument: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [StudentProfileService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(StudentProfileService);
  });

  describe('getProfile', () => {
    it('throws NotFoundException when the student does not exist', async () => {
      prisma.student.findUnique.mockResolvedValue(null);
      await expect(service.getProfile('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the full profile include when the student exists', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.student.findUniqueOrThrow.mockResolvedValue({ id: 's1', firstName: 'Eshaal' });

      const result = await service.getProfile('s1');

      expect(result).toEqual({ id: 's1', firstName: 'Eshaal' });
      expect(prisma.student.findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's1' } }),
      );
    });
  });

  describe('updateProfile', () => {
    it('throws NotFoundException when the student does not exist', async () => {
      prisma.student.findUnique.mockResolvedValue(null);
      await expect(service.updateProfile('missing', { firstName: 'X' }, 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates a new currentAddress when the student has none yet', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
      prisma.student.update.mockResolvedValue({ id: 's1' });

      await service.updateProfile(
        's1',
        { currentAddress: { line1: 'House 1' } },
        'admin-1',
      );

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's1' },
          data: expect.objectContaining({ currentAddress: { create: { line1: 'House 1' } } }),
        }),
      );
    });

    it('updates the existing currentAddress in place when one is already linked', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: 'addr-1', permanentAddressId: null });
      prisma.student.update.mockResolvedValue({ id: 's1' });

      await service.updateProfile('s1', { currentAddress: { line1: 'New line' } }, 'admin-1');

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentAddress: { update: { line1: 'New line' } } }),
        }),
      );
    });

    it('rejects a profilePhotoFileId that was never uploaded', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
      prisma.file.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile('s1', { profilePhotoFileId: 'missing-file' }, 'admin-1'),
      ).rejects.toThrow('Upload the photo first via POST /api/v1/files, then link it here.');
      expect(prisma.student.update).not.toHaveBeenCalled();
    });

    it('accepts a profilePhotoFileId that was already uploaded', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
      prisma.file.findUnique.mockResolvedValue({ id: 'f1' });
      prisma.student.update.mockResolvedValue({ id: 's1', profilePhotoFileId: 'f1' });

      await service.updateProfile('s1', { profilePhotoFileId: 'f1' }, 'admin-1');

      expect(prisma.student.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ profilePhoto: { connect: { id: 'f1' } } }) }),
      );
    });

    it('translates a duplicate bFormNumber into a BadRequestException', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
      prisma.student.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
      );

      await expect(
        service.updateProfile('s1', { bFormNumber: 'dupe' }, 'admin-1'),
      ).rejects.toThrow('This B-Form number is already in use.');
    });

    it('writes an audit log row on success', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1', currentAddressId: null, permanentAddressId: null });
      prisma.student.update.mockResolvedValue({ id: 's1', firstName: 'Eshaal' });

      await service.updateProfile('s1', { firstName: 'Eshaal' }, 'admin-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'student.profile.update', entityId: 's1' }),
        }),
      );
    });
  });

  describe('updateCurrentEnrollment', () => {
    it('throws NotFoundException when the student has no active enrollment', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.enrollment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateCurrentEnrollment('s1', { rollNumber: '12' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates rollNumber/remarks on the active enrollment', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.enrollment.findFirst.mockResolvedValue({ id: 'enr-1' });
      prisma.enrollment.update.mockResolvedValue({ id: 'enr-1', rollNumber: '12' });

      await service.updateCurrentEnrollment('s1', { rollNumber: '12' }, 'admin-1');

      expect(prisma.enrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr-1' },
        data: { rollNumber: '12' },
      });
    });
  });

  describe('upsertPreviousSchool', () => {
    it('creates a new previous-school record when none exists yet', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentPreviousSchool.findUnique.mockResolvedValue(null);
      prisma.studentPreviousSchool.create.mockResolvedValue({ id: 'ps1', schoolName: 'Old School' });

      await service.upsertPreviousSchool('s1', { schoolName: 'Old School' }, 'admin-1');

      expect(prisma.studentPreviousSchool.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ student: { connect: { id: 's1' } }, schoolName: 'Old School' }),
        }),
      );
    });

    it('updates the existing previous-school record in place', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentPreviousSchool.findUnique.mockResolvedValue({ id: 'ps1', addressId: null });
      prisma.studentPreviousSchool.update.mockResolvedValue({ id: 'ps1', schoolName: 'Renamed' });

      await service.upsertPreviousSchool('s1', { schoolName: 'Renamed' }, 'admin-1');

      expect(prisma.studentPreviousSchool.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's1' } }),
      );
      expect(prisma.studentPreviousSchool.create).not.toHaveBeenCalled();
    });

    it('creates a nested address when one is provided and none exists yet', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentPreviousSchool.findUnique.mockResolvedValue(null);
      prisma.studentPreviousSchool.create.mockResolvedValue({ id: 'ps1' });

      await service.upsertPreviousSchool(
        's1',
        { schoolName: 'Old School', address: { line1: 'Old address line' } },
        'admin-1',
      );

      expect(prisma.studentPreviousSchool.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ address: { create: { line1: 'Old address line' } } }),
        }),
      );
    });
  });

  describe('emergency contacts', () => {
    it('lists contacts ordered by priority', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentEmergencyContact.findMany.mockResolvedValue([{ id: 'c1', priority: 1 }]);

      const result = await service.listEmergencyContacts('s1');

      expect(result).toEqual([{ id: 'c1', priority: 1 }]);
      expect(prisma.studentEmergencyContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's1' }, orderBy: { priority: 'asc' } }),
      );
    });

    it('creates a contact scoped to the student', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentEmergencyContact.create.mockResolvedValue({ id: 'c1' });

      await service.createEmergencyContact(
        's1',
        { name: 'Amina', relationship: 'Mother', phone: '0300-0000000' },
        'admin-1',
      );

      expect(prisma.studentEmergencyContact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            student: { connect: { id: 's1' } },
            name: 'Amina',
            priority: 1,
            isPrimary: false,
          }),
        }),
      );
    });

    it('throws NotFoundException updating a contact that does not belong to this student', async () => {
      prisma.studentEmergencyContact.findUnique.mockResolvedValue({ id: 'c1', studentId: 'other-student' });

      await expect(
        service.updateEmergencyContact('s1', 'c1', { name: 'Renamed' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates a contact that belongs to the student', async () => {
      prisma.studentEmergencyContact.findUnique.mockResolvedValue({ id: 'c1', studentId: 's1', addressId: null });
      prisma.studentEmergencyContact.update.mockResolvedValue({ id: 'c1', name: 'Renamed' });

      await service.updateEmergencyContact('s1', 'c1', { name: 'Renamed' }, 'admin-1');

      expect(prisma.studentEmergencyContact.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'c1' }, data: expect.objectContaining({ name: 'Renamed' }) }),
      );
    });

    it('throws NotFoundException deleting a contact that does not belong to this student', async () => {
      prisma.studentEmergencyContact.findUnique.mockResolvedValue({ id: 'c1', studentId: 'other-student' });

      await expect(service.deleteEmergencyContact('s1', 'c1', 'admin-1')).rejects.toThrow(NotFoundException);
      expect(prisma.studentEmergencyContact.delete).not.toHaveBeenCalled();
    });

    it('deletes a contact that belongs to the student and audit-logs it', async () => {
      prisma.studentEmergencyContact.findUnique.mockResolvedValue({ id: 'c1', studentId: 's1' });

      await service.deleteEmergencyContact('s1', 'c1', 'admin-1');

      expect(prisma.studentEmergencyContact.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'student.emergencyContact.delete' }) }),
      );
    });
  });

  describe('upsertMedicalInfo', () => {
    it('upserts on studentId and audit-logs it', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentMedicalInfo.upsert.mockResolvedValue({ id: 'm1', bloodGroup: 'O_POS' });

      await service.upsertMedicalInfo('s1', { bloodGroup: 'O_POS' }, 'admin-1');

      expect(prisma.studentMedicalInfo.upsert).toHaveBeenCalledWith({
        where: { studentId: 's1' },
        create: { studentId: 's1', bloodGroup: 'O_POS' },
        update: { bloodGroup: 'O_POS' },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'student.medicalInfo.upsert' }) }),
      );
    });
  });

  describe('documents', () => {
    it('lists documents newest-first', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.studentDocument.findMany.mockResolvedValue([{ id: 'd1' }]);

      const result = await service.listDocuments('s1');

      expect(result).toEqual([{ id: 'd1' }]);
      expect(prisma.studentDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { studentId: 's1' }, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('rejects adding a document whose fileId was never uploaded', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.file.findUnique.mockResolvedValue(null);

      await expect(
        service.addDocument('s1', { documentType: 'BIRTH_CERTIFICATE', fileId: 'missing-file' }, 'admin-1'),
      ).rejects.toThrow('Upload the file first via POST /api/v1/files, then link it here.');
    });

    it('links an already-uploaded file as a document', async () => {
      prisma.student.findUnique.mockResolvedValue({ id: 's1' });
      prisma.file.findUnique.mockResolvedValue({ id: 'f1' });
      prisma.studentDocument.create.mockResolvedValue({ id: 'd1', documentType: 'BIRTH_CERTIFICATE' });

      await service.addDocument('s1', { documentType: 'BIRTH_CERTIFICATE', fileId: 'f1' }, 'admin-1');

      expect(prisma.studentDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ studentId: 's1', documentType: 'BIRTH_CERTIFICATE', fileId: 'f1' }),
        }),
      );
    });

    it('throws NotFoundException verifying a document that does not belong to this student', async () => {
      prisma.studentDocument.findUnique.mockResolvedValue({ id: 'd1', studentId: 'other-student' });

      await expect(service.verifyDocument('s1', 'd1', true, 'admin-1')).rejects.toThrow(NotFoundException);
    });

    it('marks a document VERIFIED, stamping verifiedById/verifiedAt', async () => {
      prisma.studentDocument.findUnique.mockResolvedValue({ id: 'd1', studentId: 's1' });
      prisma.studentDocument.update.mockResolvedValue({ id: 'd1', verificationStatus: 'VERIFIED' });

      await service.verifyDocument('s1', 'd1', true, 'admin-1');

      expect(prisma.studentDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd1' },
          data: expect.objectContaining({ verificationStatus: 'VERIFIED', verifiedById: 'admin-1' }),
        }),
      );
    });

    it('marks a document REJECTED when verified is false', async () => {
      prisma.studentDocument.findUnique.mockResolvedValue({ id: 'd1', studentId: 's1' });
      prisma.studentDocument.update.mockResolvedValue({ id: 'd1', verificationStatus: 'REJECTED' });

      await service.verifyDocument('s1', 'd1', false, 'admin-1');

      expect(prisma.studentDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ verificationStatus: 'REJECTED' }) }),
      );
    });
  });
});
