import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_ADAPTER } from '../storage/storage-adapter';
import type { StorageAdapter } from '../storage/storage-adapter';
import { inspectUpload } from './upload-inspection';
import {
  MALWARE_SCANNER,
  NoopMalwareScanner,
  type MalwareScanner,
} from './malware-scanner';

export interface FileMeta {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_ADAPTER) private readonly storage: StorageAdapter,
    @Optional()
    @Inject(MALWARE_SCANNER)
    private readonly scanner: MalwareScanner = new NoopMalwareScanner(),
  ) {}

  async upload(
    file: Express.Multer.File,
    uploadingUserId: string,
  ): Promise<FileMeta> {
    // BL-52: the type is decided from the bytes (allow-list), never the client's claim.
    const inspection = inspectUpload(file);
    if (!inspection.ok) {
      throw new BadRequestException(inspection.reason);
    }
    const scan = await this.scanner.scan(file.buffer);
    if (scan.status === 'infected') {
      await this.prisma.auditLog.create({
        data: {
          userId: uploadingUserId,
          action: 'file.rejected-malware',
          entity: 'File',
          metadata: JSON.stringify({
            originalName: file.originalname,
            signature: scan.signature,
          }),
        },
      });
      throw new UnprocessableEntityException(
        'The file was rejected by the virus scan.',
      );
    }
    if (scan.status === 'error') {
      // Fail closed: scanning is configured, so an unscanned file is never stored.
      throw new ServiceUnavailableException(
        'Virus scanning is unavailable right now; please try again later.',
      );
    }

    const storageKey = await this.storage.save(
      file.buffer,
      extname(file.originalname),
    );

    // The File row and its audit-log entry are wrapped in one $transaction so a bad
    // uploadingUserId (e.g. a stale/orphaned session) rolls back the File row too, instead of
    // silently persisting a File with no audit trail while the caller sees a 500.
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.file.create({
        data: {
          storageKey,
          originalName: file.originalname,
          mimeType: inspection.mimeType,
          sizeBytes: file.size,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: uploadingUserId,
          action: 'file.upload',
          entity: 'File',
          entityId: created.id,
          metadata: JSON.stringify({
            originalName: created.originalName,
            mimeType: created.mimeType,
            sizeBytes: created.sizeBytes,
          }),
        },
      });

      return created;
    });

    return {
      id: record.id,
      originalName: record.originalName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
    };
  }

  async read(
    fileId: string,
  ): Promise<{ buffer: Buffer; originalName: string; mimeType: string }> {
    const record = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!record) {
      throw new NotFoundException('File not found');
    }
    const buffer = await this.storage.read(record.storageKey);
    return {
      buffer,
      originalName: record.originalName,
      mimeType: record.mimeType,
    };
  }
}
