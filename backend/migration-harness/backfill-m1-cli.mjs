#!/usr/bin/env node
// npm run backfill:m1 -- [--url <postgres-url>]  — run AFTER migration 20260925090000 (M1) is deployed.
// Idempotent and transactional; prints before/after counts. Rehearsed by scenario `m1-attendance-actor`.
import pg from 'pg';
import { adminUrl } from './harness.mjs';
import { runM1Backfill, counts } from './backfills/m1-attendance-actor.mjs';

const i = process.argv.indexOf('--url');
const client = new pg.Client({ connectionString: i > 0 ? process.argv[i + 1] : adminUrl() });
await client.connect();
try {
  const before = await counts(client);
  const after = await runM1Backfill(client);
  console.log(JSON.stringify({ before, after }, null, 2));
} finally {
  await client.end();
}
