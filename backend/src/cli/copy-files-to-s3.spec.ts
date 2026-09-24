import {
  copyFilesToS3,
  s3CopyTarget,
  sha256Of,
  type CopyTarget,
} from './copy-files-to-s3';
import { s3ClientFor } from '../storage/s3-storage.adapter';
import { startS3Emulator } from '../../test/support/s3-emulator';

const local: Record<string, Buffer> = {
  'a.pdf': Buffer.from('%PDF-1.4 a'),
  'b.png': Buffer.from('png-bytes'),
};
const files = [
  { storageKey: 'a.pdf' },
  { storageKey: 'b.png' },
  { storageKey: 'gone.txt' },
];
const readLocal = (k: string) => Promise.resolve(local[k] ?? null);

function memoryTarget() {
  const store = new Map<string, { body: Buffer; sha256: string }>();
  const target: CopyTarget = {
    head: (k) => {
      const o = store.get(k);
      return Promise.resolve(
        o ? { size: o.body.length, sha256: o.sha256 } : null,
      );
    },
    put: (k, body, sha256) => {
      store.set(k, { body, sha256 });
      return Promise.resolve();
    },
  };
  return { store, target };
}

describe('copyFilesToS3 (BL-10)', () => {
  it('copies, reports missing files, and a second run is a no-op', async () => {
    const { store, target } = memoryTarget();
    const first = await copyFilesToS3({ files, readLocal, target });
    expect(first).toMatchObject({
      total: 3,
      copied: ['a.pdf', 'b.png'],
      skipped: [],
      missing: ['gone.txt'],
      failed: [],
    });
    expect(store.get('a.pdf')?.sha256).toBe(sha256Of(local['a.pdf']));

    const second = await copyFilesToS3({ files, readLocal, target });
    expect(second).toMatchObject({
      copied: [],
      skipped: ['a.pdf', 'b.png'],
      missing: ['gone.txt'],
    });
  });

  it('re-copies a mismatching object and flags a failed verification', async () => {
    const { store, target } = memoryTarget();
    store.set('a.pdf', { body: Buffer.from('truncated'), sha256: 'bad' });
    const report = await copyFilesToS3({
      files: [{ storageKey: 'a.pdf' }],
      readLocal,
      target,
    });
    expect(report.copied).toEqual(['a.pdf']);

    const lying: CopyTarget = {
      head: () => Promise.resolve(null),
      put: () => Promise.resolve(),
    };
    const failed = await copyFilesToS3({
      files: [{ storageKey: 'b.png' }],
      readLocal,
      target: lying,
    });
    expect(failed.failed).toEqual([
      {
        storageKey: 'b.png',
        reason: 'verification after upload did not match',
      },
    ]);
  });

  it('dry-run copies nothing', async () => {
    const { store, target } = memoryTarget();
    const report = await copyFilesToS3({
      files,
      readLocal,
      target,
      dryRun: true,
    });
    expect(report.copied).toEqual(['a.pdf', 'b.png']);
    expect(store.size).toBe(0);
  });

  it('works against a real S3-compatible endpoint: checksum-verified and idempotent', async () => {
    const emu = await startS3Emulator();
    try {
      const target = s3CopyTarget(s3ClientFor(emu.config), emu.config);
      const first = await copyFilesToS3({ files, readLocal, target });
      expect(first.copied).toEqual(['a.pdf', 'b.png']);
      expect(first.failed).toEqual([]);
      const second = await copyFilesToS3({ files, readLocal, target });
      expect(second.skipped).toEqual(['a.pdf', 'b.png']);
      expect(second.copied).toEqual([]);
    } finally {
      await emu.stop();
    }
  });
});
