// CLI entry: `npm run db:restore -- --file <dump> --target-url <postgresql://…/db> [--overwrite <db>]`
// (compiled dist build). Checks the dump against its manifest, (re)creates the target database,
// restores with pg_restore and verifies migrations and row counts against the manifest. Refuses a
// target whose name is not disposable (scratch/restore/rehearsal) unless --overwrite repeats it.
import 'dotenv/config';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { Client } from 'pg';
import {
  checkRestoreTarget,
  compareSnapshot,
  parseDatabaseUrl,
  pgEnv,
  pgTool,
  restoreArgs,
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
  const file = arg('file');
  const targetUrl = arg('target-url');
  if (!file || !targetUrl) {
    throw new Error(
      'usage: --file <dump> --target-url <postgresql://…/db> [--overwrite <db>]',
    );
  }
  const conn = parseDatabaseUrl(targetUrl);
  const allowed = checkRestoreTarget(conn.database, arg('overwrite'));
  if (!allowed.ok) throw new Error(allowed.reason);

  const manifest = JSON.parse(
    readFileSync(`${file}.json`, 'utf8'),
  ) as BackupManifest;
  if ((await sha256File(file)) !== manifest.sha256) {
    throw new Error('the dump does not match its manifest checksum');
  }

  const started = Date.now();
  const admin = new Client({
    connectionString: targetUrl.replace(/\/[^/?]+(\?.*)?$/, '/postgres'),
  });
  await admin.connect();
  try {
    const ident = `"${conn.database.replace(/"/g, '""')}"`;
    await admin.query(`DROP DATABASE IF EXISTS ${ident} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${ident}`);
  } finally {
    await admin.end();
  }
  await run(
    pgTool('pg_restore', process.env.PG_BIN),
    restoreArgs(conn, file),
    pgEnv(conn),
  );

  const client = new Client({
    connectionString: targetUrl.replace(/\?.*$/, ''),
  });
  await client.connect();
  const restored = await snapshot(client).finally(() => client.end());
  const diffs = compareSnapshot(manifest, restored);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (diffs.length) {
    console.error(
      `restore finished in ${seconds} s but does NOT match the backup:\n  ${diffs.join('\n  ')}`,
    );
    return 1;
  }
  const rows = Object.values(restored.rowCounts).reduce((a, b) => a + b, 0);
  console.log(
    `restored ${manifest.database} (${manifest.createdAt}) into ${conn.database} in ${seconds} s — ${restored.migrations.length} migrations and ${rows} rows match the manifest`,
  );
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(
      `restore failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  },
);
