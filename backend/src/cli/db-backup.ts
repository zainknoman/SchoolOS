/**
 * BL-13 / A2: logical database backup and restore around the PostgreSQL client tools (pg_dump,
 * pg_restore — version 16 or newer). The managed database's own point-in-time recovery stays the
 * primary backup (BACKUP-RESTORE); this is the on-demand pre-deploy backup that a rollback restores,
 * and the tool for restore rehearsals. Uploaded files live in the bucket (versioning), not here.
 *
 * Every dump has a manifest (`<dump>.json`): SHA-256 and size of the dump, the applied migrations
 * and an exact row count per table — a restore is verified against it.
 */
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { join } from 'path';
import type { Client } from 'pg';

export interface PgConnection {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export interface BackupManifest {
  createdAt: string;
  database: string;
  dumpFile: string;
  bytes: number;
  sha256: string;
  migrations: string[];
  rowCounts: Record<string, number>;
}

export function parseDatabaseUrl(url: string): PgConnection {
  const u = new URL(url);
  if (!/^postgres(ql)?:$/.test(u.protocol)) {
    throw new Error('DATABASE_URL must be a postgresql:// URL');
  }
  const database = decodeURIComponent(u.pathname.replace(/^\//, ''));
  if (!database) throw new Error('DATABASE_URL names no database');
  return {
    host: u.hostname,
    port: u.port || '5432',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database,
  };
}

/** Path of a PostgreSQL client tool: PG_BIN (a directory) when set, else the PATH. */
export function pgTool(name: 'pg_dump' | 'pg_restore', pgBin?: string): string {
  if (!pgBin) return name;
  return join(pgBin, process.platform === 'win32' ? `${name}.exe` : name);
}

/** The password goes to the tool through PGPASSWORD, never on its command line. */
export function pgEnv(conn: PgConnection): NodeJS.ProcessEnv {
  return { ...process.env, PGPASSWORD: conn.password };
}

const target = (conn: PgConnection) => [
  '-h',
  conn.host,
  '-p',
  conn.port,
  '-U',
  conn.user,
];

/** Custom format (compressed, restorable table by table); no owners or grants (the target has its own). */
export function dumpArgs(conn: PgConnection, file: string): string[] {
  return [
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    ...target(conn),
    '-d',
    conn.database,
    '-f',
    file,
  ];
}

export function restoreArgs(conn: PgConnection, file: string): string[] {
  return [
    '--no-owner',
    '--no-privileges',
    '--exit-on-error',
    ...target(conn),
    '-d',
    conn.database,
    file,
  ];
}

/**
 * A restore replaces a whole database, so it only targets a database whose name says it is
 * disposable — or the exact name repeated in --overwrite (an emergency restore of production).
 */
export function checkRestoreTarget(
  database: string,
  overwrite?: string,
): { ok: true } | { ok: false; reason: string } {
  if (/(scratch|restore|rehearsal|e2e)/i.test(database)) return { ok: true };
  if (overwrite === database) return { ok: true };
  return {
    ok: false,
    reason: `refusing to restore into "${database}": use a database whose name contains scratch/restore/rehearsal, or pass --overwrite ${database} to replace it on purpose`,
  };
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path))
    hash.update(chunk as Buffer);
  return hash.digest('hex');
}

/** Applied migrations and exact row counts of every table in the public schema. */
export async function snapshot(
  client: Client,
): Promise<Pick<BackupManifest, 'migrations' | 'rowCounts'>> {
  const migrations = (
    await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ORDER BY migration_name`,
    )
  ).rows.map((r) => r.migration_name);
  const tables = (
    await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    )
  ).rows.map((r) => r.table_name);
  const rowCounts: Record<string, number> = {};
  for (const t of tables) {
    const { rows } = await client.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM "${t.replace(/"/g, '""')}"`,
    );
    rowCounts[t] = Number(rows[0].n);
  }
  return { migrations, rowCounts };
}

/** Differences between the backup's manifest and a restored database (empty = identical). */
export function compareSnapshot(
  expected: Pick<BackupManifest, 'migrations' | 'rowCounts'>,
  actual: Pick<BackupManifest, 'migrations' | 'rowCounts'>,
): string[] {
  const diffs: string[] = [];
  if (expected.migrations.join('\n') !== actual.migrations.join('\n')) {
    diffs.push(
      `migrations differ: backup has ${expected.migrations.length}, restored has ${actual.migrations.length}`,
    );
  }
  const tables = new Set([
    ...Object.keys(expected.rowCounts),
    ...Object.keys(actual.rowCounts),
  ]);
  for (const t of [...tables].sort()) {
    const a = expected.rowCounts[t];
    const b = actual.rowCounts[t];
    if (a !== b)
      diffs.push(`${t}: backup ${a ?? 'missing'}, restored ${b ?? 'missing'}`);
  }
  return diffs;
}

export function dumpFileName(database: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `${database}-${stamp}.dump`;
}
