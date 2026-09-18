import { existsSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalDiskStorageAdapter } from './local-disk-storage.adapter';

describe('LocalDiskStorageAdapter', () => {
  let dir: string;
  let adapter: LocalDiskStorageAdapter;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'schoolos-storage-'));
    process.env.UPLOADS_DIR = dir;
    adapter = new LocalDiskStorageAdapter();
  });

  afterEach(() => {
    delete process.env.UPLOADS_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it('saves a buffer and returns a storage key ending in the given extension', async () => {
    const key = await adapter.save(Buffer.from('hello'), '.pdf');
    expect(key).toMatch(/\.pdf$/);
    expect(existsSync(join(dir, key))).toBe(true);
  });

  it('reads back exactly what was saved', async () => {
    const key = await adapter.save(Buffer.from('hello world'), '.txt');
    const readBack = await adapter.read(key);
    expect(readBack.toString()).toBe('hello world');
  });

  it('deletes a saved file', async () => {
    const key = await adapter.save(Buffer.from('bye'), '.txt');
    await adapter.delete(key);
    expect(existsSync(join(dir, key))).toBe(false);
  });
});
