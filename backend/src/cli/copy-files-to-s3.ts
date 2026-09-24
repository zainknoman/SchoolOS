import { createHash } from 'crypto';
import {
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { S3StorageConfig } from '../storage/s3-storage.adapter';

/**
 * BL-10 copy tool: moves every existing File's bytes from local uploads to the S3 bucket under the
 * SAME storage key (no schema change). Per file:
 *   - local file missing       -> reported as `missing` (never deleted, the row stays as it is)
 *   - object already in bucket with the same size and sha256 metadata -> `skipped` (verified)
 *   - otherwise                -> uploaded with its sha256 as metadata, then re-read (HEAD) and
 *                                 verified -> `copied`, or `failed` when the check does not match
 * Safe to re-run: a second run over an unchanged set copies nothing. Nothing is ever deleted
 * locally; removing the local uploads is a separate, manual step after a verified run.
 */
export interface CopyTarget {
  /** Size and sha256 of the object if it exists, else null. */
  head(storageKey: string): Promise<{ size: number; sha256?: string } | null>;
  put(storageKey: string, body: Buffer, sha256: string): Promise<void>;
}

export interface CopyReport {
  total: number;
  copied: string[];
  skipped: string[];
  missing: string[];
  failed: { storageKey: string; reason: string }[];
}

export const sha256Of = (buf: Buffer) =>
  createHash('sha256').update(buf).digest('hex');

export async function copyFilesToS3(opts: {
  files:
    AsyncIterable<{ storageKey: string }> | Iterable<{ storageKey: string }>;
  readLocal(storageKey: string): Promise<Buffer | null>;
  target: CopyTarget;
  dryRun?: boolean;
}): Promise<CopyReport> {
  const report: CopyReport = {
    total: 0,
    copied: [],
    skipped: [],
    missing: [],
    failed: [],
  };
  for await (const { storageKey } of opts.files) {
    report.total++;
    try {
      const body = await opts.readLocal(storageKey);
      if (!body) {
        report.missing.push(storageKey);
        continue;
      }
      const sha256 = sha256Of(body);
      const existing = await opts.target.head(storageKey);
      if (
        existing &&
        existing.size === body.length &&
        existing.sha256 === sha256
      ) {
        report.skipped.push(storageKey);
        continue;
      }
      if (opts.dryRun) {
        report.copied.push(storageKey);
        continue;
      }
      await opts.target.put(storageKey, body, sha256);
      const check = await opts.target.head(storageKey);
      if (!check || check.size !== body.length || check.sha256 !== sha256) {
        report.failed.push({
          storageKey,
          reason: 'verification after upload did not match',
        });
        continue;
      }
      report.copied.push(storageKey);
    } catch (err) {
      report.failed.push({
        storageKey,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return report;
}

/** The real bucket as a CopyTarget; sha256 travels as object metadata (x-amz-meta-sha256). */
export function s3CopyTarget(
  s3: S3Client,
  config: S3StorageConfig,
): CopyTarget {
  const Key = (k: string) => `${config.keyPrefix}${k}`;
  return {
    head: async (storageKey) => {
      try {
        const res = await s3.send(
          new HeadObjectCommand({
            Bucket: config.bucket,
            Key: Key(storageKey),
          }),
        );
        return { size: res.ContentLength ?? -1, sha256: res.Metadata?.sha256 };
      } catch (err) {
        const status = (err as { $metadata?: { httpStatusCode?: number } })
          .$metadata?.httpStatusCode;
        if (status === 404) return null;
        throw err;
      }
    },
    put: async (storageKey, body, sha256) => {
      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: Key(storageKey),
          Body: body,
          ContentLength: body.length,
          Metadata: { sha256 },
        }),
      );
    },
  };
}
