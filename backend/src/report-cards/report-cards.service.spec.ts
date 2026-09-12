import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ReportCardsService } from './report-cards.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';

describe('ReportCardsService', () => {
  let service: ReportCardsService;
  let prisma: {
    reportCard: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let filesService: { upload: jest.Mock };

  const fakeFile = { originalname: 'card.pdf' } as Express.Multer.File;

  beforeEach(async () => {
    prisma = {
      reportCard: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };
    filesService = { upload: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportCardsService,
        { provide: PrismaService, useValue: prisma },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();
    service = moduleRef.get(ReportCardsService);
  });

  it('throws ConflictException when a report card already exists for this student+session', async () => {
    prisma.reportCard.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.upload('s1', 'session-1', fakeFile, 'teacher-1'),
    ).rejects.toThrow(ConflictException);
    expect(filesService.upload).not.toHaveBeenCalled();
    expect(prisma.reportCard.create).not.toHaveBeenCalled();
  });

  it('uploads the file then creates the ReportCard row with the returned fileId', async () => {
    prisma.reportCard.findUnique.mockResolvedValue(null);
    filesService.upload.mockResolvedValue({ id: 'file-1' });
    prisma.reportCard.create.mockResolvedValue({
      id: 'rc1',
      studentId: 's1',
      academicSessionId: 'session-1',
      fileId: 'file-1',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
    });

    const result = await service.upload(
      's1',
      'session-1',
      fakeFile,
      'teacher-1',
    );

    expect(filesService.upload).toHaveBeenCalledWith(fakeFile, 'teacher-1');
    expect(prisma.reportCard.create).toHaveBeenCalledWith({
      data: {
        studentId: 's1',
        academicSessionId: 'session-1',
        fileId: 'file-1',
        uploadedById: 'teacher-1',
      },
    });
    expect(result.fileId).toBe('file-1');
  });

  it('findForStudent orders newest-first', async () => {
    prisma.reportCard.findMany.mockResolvedValue([]);

    await service.findForStudent('s1');

    expect(prisma.reportCard.findMany).toHaveBeenCalledWith({
      where: { studentId: 's1' },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('getFileIdForDownload returns the fileId for a known report card', async () => {
    prisma.reportCard.findUnique.mockResolvedValue({ fileId: 'file-1' });

    expect(await service.getFileIdForDownload('rc1')).toBe('file-1');
  });

  it('getFileIdForDownload returns null for an unknown report card', async () => {
    prisma.reportCard.findUnique.mockResolvedValue(null);

    expect(await service.getFileIdForDownload('missing')).toBeNull();
  });
});
