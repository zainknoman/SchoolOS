import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FilesAccessService } from './files-access.service';
import { StorageModule } from '../storage/storage.module';
import { ConfigService } from '@nestjs/config';
import { MALWARE_SCANNER, createMalwareScanner } from './malware-scanner';

@Module({
  imports: [StorageModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    FilesAccessService,
    // BL-52: clamd scanning when CLAMAV_HOST is set, otherwise a no-op.
    {
      provide: MALWARE_SCANNER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createMalwareScanner({ get: (k) => config.get<string>(k) }),
    },
  ],
  exports: [FilesService],
})
export class FilesModule {}
