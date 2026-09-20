// BL-65 — migration test harness.
//
// Builds a production-like LEGACY dataset at a previous schema, applies the target migration(s) and an
// optional backfill, and produces (1) reconciliation counts (before/after per table), (2) an
// ambiguity / manual-review report, and (3) an idempotency check (a second backfill run must change
// nothing). Runs ONLY against a throwaway scratch database that the harness creates and drops itself.
//
// Library + CLI:  node migration-harness/run.mjs <scenario> [--keep]
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = join(HERE, '..', 'prisma', 'migrations');
export const SCRATCH_PREFIX = 'schoolos_scratch_';

/** Reads DATABASE_URL-style admin URL from env, falling back to backend/.env (only to reach the server). */
export function adminUrl() {
  if (process.env.MIGRATION_HARNESS_ADMIN_URL) return process.env.MIGRATION_HARNESS_ADMIN_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = join(HERE, '..', '.env');
  if (existsSync(envFile)) {
    const m = /^DATABASE_URL="?([^"\n]+)"?/m.exec(readFileSync(envFile, 'utf8'));
    if (m) return m[1];
  }
  throw new Error('No admin connection: set MIGRATION_HARNESS_ADMIN_URL (or DATABASE_URL)');
}

const withDb = (url, db) => {
  const u = new URL(url.replace(/^postgresql:/, 'postgres:'));
  u.pathname = `/${db}`;
  u.search = '';
  return u.toString();
};

/** SAFETY: the harness may only ever connect to / drop databases created under the scratch prefix. */
export function assertScratchName(name) {
  if (!/^schoolos_scratch_[a-z0-9_]{4,40}$/.test(name)) {
    throw new Error(`Refusing to operate on "${name}": harness databases must match ${SCRATCH_PREFIX}<id>`);
  }
}

export async function createScratchDb() {
  const base = adminUrl();
  const name = `${SCRATCH_PREFIX}${randomBytes(4).toString('hex')}`;
  assertScratchName(name);
  const admin = new pg.Client({ connectionString: withDb(base, 'postgres') });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const client = new pg.Client({ connectionString: withDb(base, name) });
  await client.connect();
  return {
    name,
    client,
    async drop() {
      assertScratchName(name);
      await client.end().catch(() => {});
      const a = new pg.Client({ connectionString: withDb(base, 'postgres') });
      await a.connect();
      try {
        await a.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await a.end();
      }
    },
  };
}

export function listMigrations(dir = MIGRATIONS_DIR) {
  return readdirSync(dir).filter((n) => /^\d{14}_/.test(n)).sort();
}

/** Applies migration.sql files in order; `upTo` is inclusive, `after` is exclusive (apply those following it). */
export async function applyMigrations(client, { dir = MIGRATIONS_DIR, upTo, after } = {}) {
  const all = listMigrations(dir);
  const applied = [];
  for (const m of all) {
    if (after && m <= after) continue;
    if (upTo && m > upTo) break;
    const sql = readFileSync(join(dir, m, 'migration.sql'), 'utf8');
    await client.query(sql);
    applied.push(m);
  }
  return applied;
}

/** Per-table row counts and an order-independent content hash — the basis of reconciliation and idempotency. */
export async function snapshot(client) {
  const { rows: tables } = await client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  const snap = {};
  for (const { table_name: t } of tables) {
    const { rows } = await client.query(`SELECT md5(COALESCE(string_agg(md5(x::text), '' ORDER BY md5(x::text)), '')) AS h, count(*)::int AS n FROM "${t}" x`);
    snap[t] = { rows: rows[0].n, hash: rows[0].h };
  }
  return snap;
}

export function diffSnapshots(before, after) {
  const tables = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes = [];
  for (const t of tables) {
    const b = before[t];
    const a = after[t];
    if (!b) changes.push({ table: t, change: 'added', before: null, after: a.rows });
    else if (!a) changes.push({ table: t, change: 'removed', before: b.rows, after: null });
    else if (b.rows !== a.rows) changes.push({ table: t, change: 'row-count', before: b.rows, after: a.rows });
    else if (b.hash !== a.hash) changes.push({ table: t, change: 'content', before: b.rows, after: a.rows });
  }
  return changes;
}

/**
 * Generic row insert that fills bookkeeping columns. Prisma defaults (uuid, updatedAt) are client-side, so the
 * database has no default for them — the harness supplies id / createdAt / updatedAt when the table has them.
 */
export function makeInserter(client) {
  const cols = new Map();
  return async function insert(table, values) {
    if (!cols.has(table)) {
      const { rows } = await client.query(
        `SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
        [table],
      );
      cols.set(table, rows);
    }
    const meta = cols.get(table);
    const has = (c) => meta.some((m) => m.column_name === c);
    const row = { ...values };
    if (has('id') && row.id === undefined) row.id = crypto.randomUUID();
    for (const c of ['createdAt', 'updatedAt']) if (has(c) && row[c] === undefined) row[c] = new Date();
    const missing = meta.filter((m) => m.is_nullable === 'NO' && m.column_default === null && row[m.column_name] === undefined).map((m) => m.column_name);
    if (missing.length) throw new Error(`insert(${table}): missing required columns: ${missing.join(', ')}`);
    const keys = Object.keys(row);
    await client.query(`INSERT INTO "${table}" (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`, keys.map((k) => row[k]));
    return row.id;
  };
}

/**
 * Runs one scenario end to end.
 * scenario = {
 *   name, legacyUpTo?,            // last migration of the LEGACY schema (default: all currently present)
 *   buildFixture(client, insert), // seeds the legacy dataset, returns a manifest
 *   target?: { after },           // apply migrations following `after` (the migration(s) under test)
 *   backfill?(client),            // idempotent data backfill executed after the target migration
 *   checks?(client, ctx),         // returns [{ name, ok, details }]  — reconciliation assertions
 *   review?(client, ctx),         // returns [{ category, ... }]       — ambiguity / manual-review rows
 * }
 */
export async function runScenario(scenario, { keep = false, outDir } = {}) {
  const db = await createScratchDb();
  const result = { scenario: scenario.name, database: db.name, steps: [] };
  try {
    const legacyApplied = await applyMigrations(db.client, { upTo: scenario.legacyUpTo });
    result.steps.push({ step: 'legacy-schema', migrations: legacyApplied.length });
    const insert = makeInserter(db.client);
    const manifest = await scenario.buildFixture(db.client, insert);
    const before = await snapshot(db.client);
    result.legacyCounts = Object.fromEntries(Object.entries(before).map(([t, v]) => [t, v.rows]));

    let targetApplied = [];
    if (scenario.target) {
      targetApplied = await applyMigrations(db.client, { dir: scenario.target.dir ?? MIGRATIONS_DIR, after: scenario.target.after });
      result.steps.push({ step: 'target-migration', migrations: targetApplied });
    }
    if (scenario.backfill) {
      await scenario.backfill(db.client);
      result.steps.push({ step: 'backfill-run-1' });
    }
    const afterFirst = await snapshot(db.client);

    // Idempotency: a second backfill run must not change anything.
    if (scenario.backfill) {
      await scenario.backfill(db.client);
      const afterSecond = await snapshot(db.client);
      const changes = diffSnapshots(afterFirst, afterSecond);
      result.idempotent = changes.length === 0;
      result.idempotencyChanges = changes;
      result.steps.push({ step: 'backfill-run-2' });
    }

    result.reconciliation = {
      counts: diffSnapshots(before, afterFirst),
      checks: scenario.checks ? await scenario.checks(db.client, { manifest, before, after: afterFirst }) : [],
    };
    result.review = scenario.review ? await scenario.review(db.client, { manifest }) : [];
    result.ok = result.reconciliation.checks.every((c) => c.ok) && (result.idempotent ?? true);
    if (outDir) writeReports(result, outDir);
    return result;
  } finally {
    if (!keep) await db.drop();
    else result.kept = db.name;
  }
}

export function writeReports(result, outDir) {
  mkdirSync(outDir, { recursive: true });
  const stamp = createHash('sha1').update(result.database).digest('hex').slice(0, 6);
  writeFileSync(join(outDir, `${result.scenario}-${stamp}.json`), JSON.stringify(result, null, 2));
  const rows = result.review ?? [];
  if (rows.length) {
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    writeFileSync(join(outDir, `${result.scenario}-${stamp}-review.csv`), csv);
  }
}
