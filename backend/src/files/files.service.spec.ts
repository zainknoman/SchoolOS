import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER } from '../storage/storage-adapter';

describe('FilesService', () => {
  let service: FilesService;
  let prisma: {
    file: { create: jest.Mock; findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: { save: jest.Mock; read: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    prisma = {
      file: { create: jest.fn(), findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    storage = { save: jest.fn(), read: jest.fn(), delete: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_ADAPTER, useValue: storage },
      ],
    }).compile();
    service = moduleRef.get(FilesService);
  });

  it('saves the buffer via the storage adapter and records a File row', async () => {
    storage.save.mockResolvedValue('abc123.pdf');
    prisma.file.create.mockResolvedValue({
      id: 'file-1',
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });

    const result = await service.upload(
      {
        buffer: Buffer.from('hello'),
        originalname: 'sheet.pdf',
        mimetype: 'application/pdf',
        size: 10,
      } as Express.Multer.File,
      'user-1',
    );

    expect(storage.save).toHaveBeenCalledWith(Buffer.from('hello'), '.pdf');
    expect(prisma.file.create).toHaveBeenCalledWith({
      data: {
        storageKey: 'abc123.pdf',
        originalName: 'sheet.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
      },
    });
    expect(result).toEqual({
      id: 'file-1',
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });
  });

  it('writes an AuditLog row for the upload', async () => {
    storage.save.mockResolvedValue('abc123.pdf');
    prisma.file.create.mockResolvedValue({
      id: 'file-1',
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 10,
    });

    await service.upload(
      {
        buffer: Buffer.from('hello'),
        originalname: 'sheet.pdf',
        mimetype: 'application/pdf',
        size: 10,
      } as Express.Multer.File,
      'user-1',
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        action: 'file.upload',
        entity: 'File',
        entityId: 'file-1',
        metadata: JSON.stringify({
          originalName: 'sheet.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10,
        }),
      },
    });
  });

  it('reads a file back via the storage adapter', async () => {
    prisma.file.findUnique.mockResolvedValue({
      id: 'file-1',
      storageKey: 'abc123.pdf',
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
    });
    storage.read.mockResolvedValue(Buffer.from('hello'));

    const result = await service.read('file-1');

    expect(storage.read).toHaveBeenCalledWith('abc123.pdf');
    expect(result).toEqual({
      buffer: Buffer.from('hello'),
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('throws NotFoundException for an unknown file id', async () => {
    prisma.file.findUnique.mockResolvedValue(null);
    await expect(service.read('missing')).rejects.toThrow(NotFoundException);
  });
});
