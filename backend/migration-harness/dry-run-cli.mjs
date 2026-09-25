#!/usr/bin/env node
// BL-62 dry-run against a REAL database copy (production-like restore, staging, or local dev).
// Usage: npm run migration:dry-run -- [--url <postgres-url>]   (default: DATABASE_URL, else backend/.env)
// Safety: the whole run happens inside a READ ONLY transaction that is rolled back — it cannot write.
// Output: migration-harness/out/dry-run-<database>-<stamp>.json (summary) and -review.csv (manual-review list).
import pg from 'pg';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminUrl, writeReports } from './harness.mjs';
import { dryRun } from './dry-run.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--url');
const url = i > 0 ? process.argv[i + 1] : adminUrl();
const database = new URL(url.replace(/^postgresql:/, 'postgres:')).pathname.slice(1);

const client = new pg.Client({ connectionString: url });
await client.connect();
let res;
try {
  await client.query('BEGIN TRANSACTION READ ONLY');
  res = await dryRun(client);
} finally {
  await client.query('ROLLBACK').catch(() => undefined);
  await client.end();
}

const counts = {};
for (const r of res.review) counts[r.category] = (counts[r.category] ?? 0) + 1;
writeReports({ scenario: `dry-run-${database}`, database: `${database}-${new Date().toISOString()}`, summary: res.summary, reviewCounts: counts, review: res.review }, join(here, 'out'));
console.log(JSON.stringify({ database, summary: res.summary, reviewCounts: counts }, null, 2));
const BLOCKING = { SESSION_MULTIPLE_ACTIVE: 'M3', M12_DUPLICATE_ACTIVE_ENROLMENT: 'M12', M12_DUPLICATE_VOUCHER: 'M12', M12_INVALID_STATUS: 'M12' };
const blocking = Object.entries(BLOCKING).filter(([c]) => counts[c]);
for (const [c, m] of blocking) console.log(`BLOCKING: ${counts[c]} ${c} row(s) must be resolved before ${m}`);
if (blocking.length === 0) console.log('no blocking rows');
