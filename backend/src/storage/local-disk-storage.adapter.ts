import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { StorageAdapter } from './storage-adapter';

@Injectable()
export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly rootDir =
    process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');

  async save(buffer: Buffer, extension: string): Promise<string> {
    await mkdir(this.rootDir, { recursive: true });
    const storageKey = `${randomUUID()}${extension}`;
    await writeFile(join(this.rootDir, storageKey), buffer);
    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    return readFile(join(this.rootDir, storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    await rm(join(this.rootDir, storageKey), { force: true });
  }
}
