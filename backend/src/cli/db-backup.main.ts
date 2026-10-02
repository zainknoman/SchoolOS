// CLI entry: `npm run db:backup -- --out <dir>` (compiled dist build). Dumps DATABASE_URL with
// pg_dump (custom format) and writes <dir>/<db>-<time>.dump plus its manifest <dump>.json.
// PG_BIN may point at the PostgreSQL client tools' directory when they are not on the PATH.
import 'dotenv/config';
import { spawn } from 'child_process';
import { mkdirSync, statSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { Client } from 'pg';
import {
  dumpArgs,
  dumpFileName,
  parseDatabaseUrl,
  pgEnv,
  pgTool,
  sha256File,
  snapshot,
  type BackupManifest,
} from './db-backup';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((done, fail) => {
    const child = spawn(cmd, args, { env, stdio: 'inherit' });
    child.on('error', fail);
    child.on('exit', (code) =>
      code === 0 ? done() : fail(new Error(`${cmd} exited with ${code}`)),
    );
  });
}

async function main(): Promise<number> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required');
  const conn = parseDatabaseUrl(url);
  const outDir = resolve(arg('out') ?? 'backups');
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, dumpFileName(conn.database));

  const started = Date.now();
  // Counts first, then the dump: on a live database rows written in between show up as a
  // difference at restore time, which is the honest answer.
  const client = new Client({ connectionString: url.replace(/\?.*$/, '') });
  await client.connect();
  const snap = await snapshot(client).finally(() => client.end());
  await run(
    pgTool('pg_dump', process.env.PG_BIN),
    dumpArgs(conn, file),
    pgEnv(conn),
  );

  const manifest: BackupManifest = {
    createdAt: new Date(started).toISOString(),
    database: conn.database,
    dumpFile: file,
    bytes: statSync(file).size,
    sha256: await sha256File(file),
    ...snap,
  };
  writeFileSync(`${file}.json`, JSON.stringify(manifest, null, 2));
  const rows = Object.values(snap.rowCounts).reduce((a, b) => a + b, 0);
  console.log(
    `backup ${file} — ${(manifest.bytes / 1e6).toFixed(1)} MB, ${Object.keys(snap.rowCounts).length} tables, ${rows} rows, ${snap.migrations.length} migrations, ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(
      `backup failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  },
);
