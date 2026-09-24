import { randomUUID } from 'crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { StorageAdapter } from './storage-adapter';

/**
 * S3-compatible object storage (BL-10). Works with AWS S3 and any S3-compatible provider (the
 * provider is not chosen yet — RD-3): endpoint, bucket and credentials come from configuration.
 * Keys keep the existing `<uuid><ext>` shape, so File.storageKey needs no schema change and the
 * copy tool moves existing files under the same key.
 */
export interface S3StorageConfig {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle: boolean;
  keyPrefix: string;
}

export function s3ClientFor(config: S3StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials:
      config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined, // fall back to the SDK's default chain (instance role, env)
  });
}

export class S3StorageAdapter implements StorageAdapter {
  constructor(
    private readonly config: S3StorageConfig,
    private readonly client: S3Client = s3ClientFor(config),
  ) {}

  objectKey(storageKey: string): string {
    return `${this.config.keyPrefix}${storageKey}`;
  }

  async save(buffer: Buffer, extension: string): Promise<string> {
    const storageKey = `${randomUUID()}${extension}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: this.objectKey(storageKey),
        Body: buffer,
        ContentLength: buffer.length,
      }),
    );
    return storageKey;
  }

  async read(storageKey: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: this.objectKey(storageKey),
      }),
    );
    if (!res.Body) throw new Error(`Empty object body for ${storageKey}`);
    return Buffer.from(await res.Body.transformToByteArray());
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: this.objectKey(storageKey),
      }),
    );
  }
}

/** Reads S3_* settings; returns null when STORAGE_DRIVER is not `s3`. */
export function resolveS3Config(
  get: (key: string) => string | undefined,
): S3StorageConfig | null {
  if ((get('STORAGE_DRIVER') ?? 'local').trim().toLowerCase() !== 's3') {
    return null;
  }
  const bucket = get('S3_BUCKET')?.trim();
  if (!bucket) throw new Error('STORAGE_DRIVER=s3 requires S3_BUCKET.');
  return {
    bucket,
    region: get('S3_REGION')?.trim() || 'us-east-1',
    endpoint: get('S3_ENDPOINT')?.trim() || undefined,
    accessKeyId: get('S3_ACCESS_KEY_ID')?.trim() || undefined,
    secretAccessKey: get('S3_SECRET_ACCESS_KEY')?.trim() || undefined,
    forcePathStyle: (get('S3_FORCE_PATH_STYLE') ?? '').trim() === 'true',
    keyPrefix: get('S3_KEY_PREFIX')?.trim() ?? '',
  };
}
