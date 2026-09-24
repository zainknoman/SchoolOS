import { HeadObjectCommand } from '@aws-sdk/client-s3';
import {
  resolveS3Config,
  S3StorageAdapter,
  s3ClientFor,
} from './s3-storage.adapter';
import { startS3Emulator } from '../../test/support/s3-emulator';

describe('S3StorageAdapter (BL-10) against a local S3 emulator', () => {
  let emu: Awaited<ReturnType<typeof startS3Emulator>>;
  beforeAll(async () => {
    emu = await startS3Emulator();
  });
  afterAll(async () => {
    await emu.stop();
  });

  it('saves under a <uuid><ext> key, reads the same bytes back, and deletes', async () => {
    const adapter = new S3StorageAdapter(emu.config);
    const bytes = Buffer.from('%PDF-1.4 report card');
    const key = await adapter.save(bytes, '.pdf');
    expect(key).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect((await adapter.read(key)).equals(bytes)).toBe(true);

    await adapter.delete(key);
    await expect(
      s3ClientFor(emu.config).send(
        new HeadObjectCommand({ Bucket: emu.config.bucket, Key: key }),
      ),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
  });

  it('applies the optional key prefix', async () => {
    const adapter = new S3StorageAdapter({
      ...emu.config,
      keyPrefix: 'pilot/',
    });
    const key = await adapter.save(Buffer.from('x'), '.txt');
    const head = await s3ClientFor(emu.config).send(
      new HeadObjectCommand({ Bucket: emu.config.bucket, Key: `pilot/${key}` }),
    );
    expect(head.ContentLength).toBe(1);
  });
});

describe('resolveS3Config', () => {
  const env = (vars: Record<string, string>) => (k: string) => vars[k];

  it('is null unless STORAGE_DRIVER=s3', () => {
    expect(resolveS3Config(env({}))).toBeNull();
    expect(resolveS3Config(env({ STORAGE_DRIVER: 'local' }))).toBeNull();
  });

  it('requires a bucket and reads the rest with defaults', () => {
    expect(() => resolveS3Config(env({ STORAGE_DRIVER: 's3' }))).toThrow(
      /S3_BUCKET/,
    );
    expect(
      resolveS3Config(env({ STORAGE_DRIVER: 'S3', S3_BUCKET: 'b' })),
    ).toEqual({
      bucket: 'b',
      region: 'us-east-1',
      endpoint: undefined,
      accessKeyId: undefined,
      secretAccessKey: undefined,
      forcePathStyle: false,
      keyPrefix: '',
    });
  });
});
