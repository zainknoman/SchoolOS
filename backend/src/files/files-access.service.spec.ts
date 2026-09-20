import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { FilesAccessService } from './files-access.service';
import { PrismaService } from '../prisma/prisma.service';

describe('FilesAccessService', () => {
  let service: FilesAccessService;
  let prisma: {
    diaryAttachment: { findFirst: jest.Mock };
    circularAttachment: { findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      diaryAttachment: { findFirst: jest.fn() },
      circularAttachment: { findFirst: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FilesAccessService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(FilesAccessService);
  });

  it('allows any staff role without checking attachments', async () => {
    await service.assertCanAccessFile({ id: 'u1', role: 'TEACHER' }, 'file-1');
    expect(prisma.diaryAttachment.findFirst).not.toHaveBeenCalled();
  });

  it("allows a parent whose child's section has a diary entry with this attachment", async () => {
    prisma.diaryAttachment.findFirst.mockResolvedValue({ id: 'att-1' });
    await service.assertCanAccessFile(
      { id: 'parent-1', role: 'PARENT' },
      'file-1',
    );
  });

  it('allows a parent who is a recipient of a circular with this attachment', async () => {
    prisma.diaryAttachment.findFirst.mockResolvedValue(null);
    prisma.circularAttachment.findFirst.mockResolvedValue({ id: 'att-1' });
    await service.assertCanAccessFile(
      { id: 'parent-1', role: 'PARENT' },
      'file-1',
    );
  });

  it('rejects a parent with no diary or circular link to this file', async () => {
    prisma.diaryAttachment.findFirst.mockResolvedValue(null);
    prisma.circularAttachment.findFirst.mockResolvedValue(null);

    await expect(
      service.assertCanAccessFile({ id: 'parent-1', role: 'PARENT' }, 'file-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
