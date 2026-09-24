import { existsSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { HeadObjectCommand } from '@aws-sdk/client-s3';
import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';
import { startS3Emulator } from './support/s3-emulator';
import { s3ClientFor } from '../src/storage/s3-storage.adapter';

/**
 * BL-10: with STORAGE_DRIVER=s3 the whole app stores and serves files through an S3-compatible
 * endpoint (local emulator here); access checks are unchanged and nothing is written to disk.
 */
describe('S3 object storage (e2e)', () => {
  let f: TwoSchools;
  let emu: Awaited<ReturnType<typeof startS3Emulator>>;
  const saved: Record<string, string | undefined> = {};
  const uploadsDir = mkdtempSync(join(tmpdir(), 'uploads-'));

  beforeAll(async () => {
    emu = await startS3Emulator();
    const env = { ...emu.env, UPLOADS_DIR: uploadsDir };
    for (const [k, v] of Object.entries(env)) {
      saved[k] = process.env[k];
      process.env[k] = v;
    }
    f = await createTwoSchools('bl10');
  });

  afterAll(async () => {
    await f.close();
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await emu.stop();
    rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('uploads to the bucket and downloads the same bytes; nothing touches local disk', async () => {
    const token = await f.login('admin-a');
    const bytes = Buffer.from('%PDF-1.4 stored in S3');
    const up = await request(f.app.getHttpServer())
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', bytes, 'sheet.pdf')
      .expect(201);

    const row = await f.prisma.file.findUniqueOrThrow({
      where: { id: up.body.id as string },
    });
    const head = await s3ClientFor(emu.config).send(
      new HeadObjectCommand({ Bucket: emu.config.bucket, Key: row.storageKey }),
    );
    expect(head.ContentLength).toBe(bytes.length);
    expect(existsSync(uploadsDir) ? readdirSync(uploadsDir) : []).toEqual([]);

    const down = await request(f.app.getHttpServer())
      .get(`/api/v1/files/${row.id}`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(Buffer.compare(down.body as Buffer, bytes)).toBe(0);

    await f.prisma.auditLog.deleteMany({ where: { entityId: row.id } });
    await f.prisma.file.delete({ where: { id: row.id } });
  });
});
