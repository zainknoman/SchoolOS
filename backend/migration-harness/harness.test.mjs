// Harness self-tests. Requires a reachable PostgreSQL server (creates and drops its own scratch databases).
// Run: node --test migration-harness/harness.test.mjs   (skips DB tests when the server is unreachable)
import test from 'node:test';
import assert from 'node:assert/strict';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { assertScratchName, createScratchDb, runScenario, snapshot, diffSnapshots, adminUrl } from './harness.mjs';
import baseline from './scenarios/baseline.mjs';
import m1 from './scenarios/m1-attendance-actor.mjs';
import { buildLegacyDataset } from './fixtures/legacy-dataset.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELFTEST_DIR = join(HERE, 'selftest', 'migrations');

async function dbAvailable() {
  try {
    const u = new URL(adminUrl().replace(/^postgresql:/, 'postgres:'));
    u.pathname = '/postgres';
    u.search = '';
    const c = new pg.Client({ connectionString: u.toString() });
    await c.connect();
    await c.end();
    return true;
  } catch {
    return false;
  }
}
const hasDb = await dbAvailable();
const dbTest = (name, fn) => test(name, { skip: hasDb ? false : 'no PostgreSQL server reachable' }, fn);

test('SAFETY: only harness-prefixed scratch databases are accepted', () => {
  assert.doesNotThrow(() => assertScratchName('schoolos_scratch_ab12cd34'));
  for (const bad of ['schoolportal', 'postgres', 'schoolos', 'schoolos_scratch_', 'schoolos_scratch_UPPER', 'x; DROP DATABASE y', 'schoolos_scratch_ab"c']) {
    assert.throws(() => assertScratchName(bad), /Refusing/);
  }
});

test('diffSnapshots reports added/removed/row-count/content changes and nothing when identical', () => {
  const a = { t1: { rows: 1, hash: 'a' }, t2: { rows: 2, hash: 'b' }, t3: { rows: 1, hash: 'c' } };
  const b = { t1: { rows: 1, hash: 'a' }, t2: { rows: 3, hash: 'b2' }, t3: { rows: 1, hash: 'c2' }, t4: { rows: 0, hash: 'd' } };
  assert.deepEqual(diffSnapshots(a, a), []);
  const d = diffSnapshots(a, b);
  assert.deepEqual(d.map((x) => `${x.table}:${x.change}`), ['t2:row-count', 't3:content', 't4:added']);
});

dbTest('baseline scenario: legacy dataset builds, dry-run classifies every ambiguous shape, review list produced', async () => {
  const res = await runScenario(baseline);
  assert.equal(res.ok, true, JSON.stringify(res.reconciliation.checks.filter((c) => !c.ok)));
  const cats = new Set(res.review.map((r) => r.category));
  for (const c of ['SESSION_SPLIT_REQUIRED', 'SUBJECT_CLONE_REQUIRED', 'SUBJECT_UNREFERENCED', 'GUARDIAN_DUPLICATE_CANDIDATE', 'GUARDIAN_PRIMARY_SLOT_REVIEW', 'LIFECYCLE_LEFT_MANUAL_REVIEW', 'CIRCULAR_SCHOOL_UNRESOLVABLE', 'HOLIDAY_NO_CAMPUS', 'SESSION_UNREFERENCED', 'SESSION_DEPENDENT_UNRESOLVABLE', 'FEE_STRUCTURE_CLONE_REQUIRED', 'FEE_STRUCTURE_UNREFERENCED', 'FEE_STRUCTURE_NAME_COLLISION', 'FEE_STRUCTURE_ATTRIBUTED_BY_LABEL']) {
    assert.ok(cats.has(c), `missing review category ${c}`);
  }
  assert.equal(res.review.filter((r) => r.category === 'LIFECYCLE_LEFT_MANUAL_REVIEW').length, 2, 'only unmatched LEFT rows go to manual review');
});

dbTest('the scratch database is dropped after a run', async () => {
  const res = await runScenario(baseline);
  const admin = new pg.Client({ connectionString: (() => { const u = new URL(adminUrl().replace(/^postgresql:/, 'postgres:')); u.pathname = '/postgres'; u.search = ''; return u.toString(); })() });
  await admin.connect();
  const { rows } = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [res.database]);
  await admin.end();
  assert.equal(rows.length, 0);
});

const synthetic = (backfill) => ({
  name: 'selftest',
  buildFixture: buildLegacyDataset,
  target: { dir: SELFTEST_DIR },
  backfill,
  checks: async (client) => {
    const { rows } = await client.query(`SELECT count(*)::int AS n FROM "Student" WHERE "selftestMarker" IS NOT NULL`);
    return [{ name: 'LEFT students marked', ok: rows[0].n === 3, details: `marked=${rows[0].n}` }];
  },
});

dbTest('idempotent backfill on a synthetic target migration: reconciliation counts and idempotency pass', async () => {
  const res = await runScenario(
    synthetic((c) => c.query(`UPDATE "Student" SET "selftestMarker" = 'X' WHERE status = 'LEFT' AND "selftestMarker" IS NULL`)),
  );
  assert.equal(res.idempotent, true);
  assert.equal(res.ok, true);
  assert.ok(res.reconciliation.counts.some((c) => c.table === 'Student'), 'Student content change is reconciled');
});

dbTest('a NON-idempotent backfill is detected and fails the scenario', async () => {
  const res = await runScenario(
    synthetic((c) => c.query(`UPDATE "Student" SET "selftestMarker" = COALESCE("selftestMarker", '') || 'X' WHERE status = 'LEFT'`)),
  );
  assert.equal(res.idempotent, false);
  assert.equal(res.ok, false);
  assert.deepEqual(res.idempotencyChanges.map((c) => c.table), ['Student']);
});

dbTest('snapshot is stable across identical databases built from the same fixture ids', async () => {
  const db = await createScratchDb();
  try {
    const s1 = await snapshot(db.client);
    const s2 = await snapshot(db.client);
    assert.deepEqual(diffSnapshots(s1, s2), []);
  } finally {
    await db.drop();
  }
});

dbTest('M1 (BL-60) rehearsal: backfill resolves the audited actors, keeps markedById, is idempotent', async () => {
  const res = await runScenario(m1);
  assert.equal(res.idempotent, true, JSON.stringify(res.idempotencyChanges));
  assert.equal(res.ok, true, JSON.stringify(res.reconciliation.checks.filter((c) => !c.ok)));
});
