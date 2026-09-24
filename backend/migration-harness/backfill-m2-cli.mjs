#!/usr/bin/env node
// npm run backfill:m2 -- [--url <postgres-url>]  — run AFTER migration 20260925120000 (M2) is deployed.
// Idempotent and transactional; prints what it did and the open review items. Rehearsed by scenario `m2-school-anchors`.
import pg from 'pg';
import { adminUrl } from './harness.mjs';
import { runM2Backfill } from './backfills/m2-school-anchors.mjs';

const i = process.argv.indexOf('--url');
const client = new pg.Client({ connectionString: i > 0 ? process.argv[i + 1] : adminUrl() });
await client.connect();
try {
  const result = await runM2Backfill(client);
  const open = (await client.query(`SELECT category, blocking, count(*)::int AS n FROM "MigrationReviewItem" WHERE migration = 'M2' AND status = 'OPEN' GROUP BY 1, 2`)).rows;
  console.log(JSON.stringify({ result, openReviewItems: open }, null, 2));
} finally {
  await client.end();
}
