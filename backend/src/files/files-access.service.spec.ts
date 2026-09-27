import { ForbiddenException } from '@nestjs/common';
import { FilesAccessService } from './files-access.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { OrgScopeService } from '../common/org-scope.service';

describe('FilesAccessService', () => {
  let service: FilesAccessService;
  let prisma: {
    file: { findUnique: jest.Mock };
    diaryAttachment: { findFirst: jest.Mock };
    circularAttachment: { findFirst: jest.Mock };
    complaintAttachment: { findFirst: jest.Mock };
  };
  let scope: { resolve: jest.Mock };
  const noHomes = {
    diaryAttachments: [],
    circularAttachments: [],
    complaintAttachments: [],
    reportCard: null,
    studentProfilePhotos: [],
    studentDocuments: [],
    staffProfilePhotos: [],
    staffDocuments: [],
    hiringCandidateResumes: [],
    schoolLogos: [],
    campusLogos: [],
  };
  const diaryIn = (schoolId: string, campusId: string) => ({
    ...noHomes,
    diaryAttachments: [
      {
        diaryEntry: {
          section: { class: { campus: { id: campusId, schoolId } } },
        },
      },
    ],
  });

  beforeEach(() => {
    prisma = {
      file: { findUnique: jest.fn() },
      diaryAttachment: { findFirst: jest.fn() },
      circularAttachment: { findFirst: jest.fn() },
      complaintAttachment: { findFirst: jest.fn() },
    };
    scope = {
      resolve: jest.fn().mockResolvedValue({
        denied: false,
        schoolId: 'school-a',
        campusId: null,
      }),
    };
    service = new FilesAccessService(
      prisma as unknown as PrismaService,
      scope as unknown as OrgScopeService,
    );
  });

  it('SUPER_ADMIN and the uploader may always read a file', async () => {
    await service.assertCanAccessFile({ id: 'su', role: 'SUPER_ADMIN' }, 'f1');
    prisma.file.findUnique.mockResolvedValueOnce({ uploadedById: 'u1' });
    await service.assertCanAccessFile({ id: 'u1', role: 'TEACHER' }, 'f1');
  });

  it("KG-30: staff read a file of their own school, not another school's", async () => {
    prisma.file.findUnique
      .mockResolvedValueOnce({ uploadedById: null })
      .mockResolvedValueOnce(diaryIn('school-a', 'campus-1'));
    await service.assertCanAccessFile({ id: 'u1', role: 'SCHOOL_ADMIN' }, 'f1');

    prisma.file.findUnique
      .mockResolvedValueOnce({ uploadedById: null })
      .mockResolvedValueOnce(diaryIn('school-b', 'campus-9'));
    await expect(
      service.assertCanAccessFile({ id: 'u1', role: 'SCHOOL_ADMIN' }, 'f1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('a campus-level user is confined to their campus', async () => {
    scope.resolve.mockResolvedValue({
      denied: false,
      schoolId: 'school-a',
      campusId: 'campus-1',
    });
    prisma.file.findUnique
      .mockResolvedValueOnce({ uploadedById: null })
      .mockResolvedValueOnce(diaryIn('school-a', 'campus-2'));
    await expect(
      service.assertCanAccessFile({ id: 't1', role: 'TEACHER' }, 'f1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it("allows a parent whose child's section has a diary entry with this attachment", async () => {
    prisma.file.findUnique.mockResolvedValue({ uploadedById: null });
    prisma.diaryAttachment.findFirst.mockResolvedValue({ id: 'att-1' });
    await service.assertCanAccessFile({ id: 'parent-1', role: 'PARENT' }, 'f1');
  });

  it('allows a parent through a circular or a visible complaint', async () => {
    prisma.file.findUnique.mockResolvedValue({ uploadedById: null });
    prisma.diaryAttachment.findFirst.mockResolvedValue(null);
    prisma.circularAttachment.findFirst.mockResolvedValueOnce({ id: 'att-1' });
    await service.assertCanAccessFile({ id: 'parent-1', role: 'PARENT' }, 'f1');
    prisma.circularAttachment.findFirst.mockResolvedValueOnce(null);
    prisma.complaintAttachment.findFirst.mockResolvedValueOnce({ id: 'att-2' });
    await service.assertCanAccessFile({ id: 'parent-1', role: 'PARENT' }, 'f1');
  });

  it('rejects a parent with no link to this file', async () => {
    prisma.file.findUnique.mockResolvedValue({ uploadedById: null });
    prisma.diaryAttachment.findFirst.mockResolvedValue(null);
    prisma.circularAttachment.findFirst.mockResolvedValue(null);
    prisma.complaintAttachment.findFirst.mockResolvedValue(null);
    await expect(
      service.assertCanAccessFile({ id: 'parent-1', role: 'PARENT' }, 'f1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
