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
  };

  beforeEach(async () => {
    prisma = {
      student: { findUnique: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
      enrollment: { findFirst: jest.fn(), update: jest.fn() },
      file: { findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
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
        expect.objectContaining({ data: expect.objectContaining({ profilePhotoFileId: 'f1' }) }),
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
});
