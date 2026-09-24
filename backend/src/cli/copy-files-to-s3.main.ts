// CLI for BL-10: `npm run storage:copy-to-s3 -- [--dry-run]`.
// Reads DATABASE_URL, UPLOADS_DIR and the S3_* settings (STORAGE_DRIVER=s3) from the environment.
// Prints a JSON report; exits 1 when any file failed verification (missing files are reported only).
import 'dotenv/config';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { resolveS3Config, s3ClientFor } from '../storage/s3-storage.adapter';
import { copyFilesToS3, s3CopyTarget } from './copy-files-to-s3';

async function* allFiles(prisma: PrismaClient) {
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.file.findMany({
      select: { id: true, storageKey: true },
      orderBy: { id: 'asc' },
      take: 500,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (page.length === 0) return;
    yield* page;
    cursor = page[page.length - 1].id;
  }
}

async function main(): Promise<number> {
  const config = resolveS3Config((k) => process.env[k]);
  if (!config) {
    console.error('Set STORAGE_DRIVER=s3 and the S3_* variables first.');
    return 1;
  }
  const s3 = s3ClientFor(config);
  const uploadsDir = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const report = await copyFilesToS3({
      files: allFiles(prisma),
      dryRun: process.argv.includes('--dry-run'),
      readLocal: async (storageKey) => {
        try {
          return await readFile(join(uploadsDir, storageKey));
        } catch {
          return null;
        }
      },
      target: s3CopyTarget(s3, config),
    });
    console.log(
      JSON.stringify(
        {
          total: report.total,
          copied: report.copied.length,
          skipped: report.skipped.length,
          missing: report.missing,
          failed: report.failed,
        },
        null,
        2,
      ),
    );
    return report.failed.length ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error('copy failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
