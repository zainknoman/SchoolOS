#!/usr/bin/env node
// npm run backfill:m8 -- [--url <postgres-url>]  — run AFTER migration 20260927150000 (M8) is deployed.
// Idempotent and transactional; prints what it recorded. Rehearsed by scenario `m8-teaching-assignments`.
import pg from 'pg';
import { adminUrl } from './harness.mjs';
import { runM8Backfill } from './backfills/m8-teaching-assignments.mjs';

const i = process.argv.indexOf('--url');
const client = new pg.Client({ connectionString: i > 0 ? process.argv[i + 1] : adminUrl() });
await client.connect();
try {
  console.log(JSON.stringify({ result: await runM8Backfill(client) }, null, 2));
} finally {
  await client.end();
}
