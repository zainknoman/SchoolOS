import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_ADAPTER } from './storage-adapter';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';
import { resolveS3Config, S3StorageAdapter } from './s3-storage.adapter';

/**
 * STORAGE_DRIVER=s3 selects S3-compatible object storage (BL-10); `local` (the default) writes to
 * UPLOADS_DIR and is for development/test only — boot-time validation refuses it elsewhere.
 */
@Module({
  providers: [
    {
      provide: STORAGE_ADAPTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const s3 = resolveS3Config((k) => config.get<string>(k));
        return s3 ? new S3StorageAdapter(s3) : new LocalDiskStorageAdapter();
      },
    },
  ],
  exports: [STORAGE_ADAPTER],
})
export class StorageModule {}
