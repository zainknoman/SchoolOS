import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER } from '../storage/storage-adapter';
import { MALWARE_SCANNER } from './malware-scanner';

describe('FilesService', () => {
  let service: FilesService;
  let prisma: {
    file: { create: jest.Mock; findUnique: jest.Mock };
    auditLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: { save: jest.Mock; read: jest.Mock; delete: jest.Mock };
  let scanner: { enabled: boolean; scan: jest.Mock };

  beforeEach(async () => {
    prisma = {
      file: { create: jest.fn(), findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    storage = { save: jest.fn(), read: jest.fn(), delete: jest.fn() };
    scanner = {
      enabled: true,
      scan: jest.fn().mockResolvedValue({ status: 'clean' }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        FilesService,
        { provide: PrismaService, useValue: prisma },
        { provide: STORAGE_ADAPTER, useValue: storage },
        { provide: MALWARE_SCANNER, useValue: scanner },
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
        buffer: Buffer.from('%PDF-1.4 hello'),
        originalname: 'sheet.pdf',
        mimetype: 'application/pdf',
        size: 10,
      } as Express.Multer.File,
      'user-1',
    );

    expect(storage.save).toHaveBeenCalledWith(
      Buffer.from('%PDF-1.4 hello'),
      '.pdf',
    );
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
        buffer: Buffer.from('%PDF-1.4 hello'),
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
    storage.read.mockResolvedValue(Buffer.from('%PDF-1.4 hello'));

    const result = await service.read('file-1');

    expect(storage.read).toHaveBeenCalledWith('abc123.pdf');
    expect(result).toEqual({
      buffer: Buffer.from('%PDF-1.4 hello'),
      originalName: 'sheet.pdf',
      mimeType: 'application/pdf',
    });
  });

  it('throws NotFoundException for an unknown file id', async () => {
    prisma.file.findUnique.mockResolvedValue(null);
    await expect(service.read('missing')).rejects.toThrow(NotFoundException);
  });

  describe('BL-52 inspection and scanning', () => {
    const upload = (
      buffer: Buffer,
      originalname: string,
      mimetype = 'application/pdf',
    ) =>
      service.upload(
        {
          buffer,
          originalname,
          mimetype,
          size: buffer.length,
        } as Express.Multer.File,
        'user-1',
      );

    it('stores the type detected from the bytes, not the client-reported one', async () => {
      storage.save.mockResolvedValue('k.png');
      prisma.file.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({ id: 'f', ...data }),
      );
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const result = await upload(png, 'logo.png', 'text/html');
      expect(result.mimeType).toBe('image/png');
    });

    it('refuses a disallowed type before storing anything', async () => {
      await expect(
        upload(Buffer.from('<html>'), 'x.pdf'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(storage.save).not.toHaveBeenCalled();
      expect(scanner.scan).not.toHaveBeenCalled();
    });

    it('refuses an infected file with 422 and audits the signature', async () => {
      scanner.scan.mockResolvedValue({
        status: 'infected',
        signature: 'Eicar-Test-Signature',
      });
      await expect(
        upload(Buffer.from('%PDF-1.4 x'), 'x.pdf'),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'file.rejected-malware' }),
      });
    });

    it('fails closed with 503 when the scanner errors', async () => {
      scanner.scan.mockResolvedValue({ status: 'error', message: 'down' });
      await expect(
        upload(Buffer.from('%PDF-1.4 x'), 'x.pdf'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(storage.save).not.toHaveBeenCalled();
    });
  });
});
