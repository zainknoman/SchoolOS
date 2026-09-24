import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { AddressInfo } from 'net';
import type { S3StorageConfig } from '../../src/storage/s3-storage.adapter';

// s3rver ships no type declarations; only the constructor/run/close surface is used here.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const S3rver = require('s3rver') as new (options: Record<string, unknown>) => {
  run(): Promise<AddressInfo>;
  close(): Promise<void>;
};

/**
 * A throwaway S3-compatible endpoint (s3rver, in-process) on a random port with one bucket — the
 * "local S3 emulator" BL-10 asks for. Used by unit and e2e tests; needs no Docker.
 */
export async function startS3Emulator(bucket = 'schoolos-test') {
  const directory = mkdtempSync(join(tmpdir(), 's3rver-'));
  const server = new S3rver({
    address: '127.0.0.1',
    port: 0,
    silent: true,
    directory,
    configureBuckets: [{ name: bucket }],
  });
  const { port } = await server.run();
  const config: S3StorageConfig = {
    bucket,
    region: 'us-east-1',
    endpoint: `http://127.0.0.1:${port}`,
    accessKeyId: 'S3RVER',
    secretAccessKey: 'S3RVER',
    forcePathStyle: true,
    keyPrefix: '',
  };
  return {
    config,
    env: {
      STORAGE_DRIVER: 's3',
      S3_BUCKET: bucket,
      S3_REGION: 'us-east-1',
      S3_ENDPOINT: `http://127.0.0.1:${port}`,
      S3_ACCESS_KEY_ID: 'S3RVER',
      S3_SECRET_ACCESS_KEY: 'S3RVER',
      S3_FORCE_PATH_STYLE: 'true',
    },
    async stop() {
      await server.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
