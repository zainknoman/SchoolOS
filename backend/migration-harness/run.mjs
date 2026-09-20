#!/usr/bin/env node
// CLI: node migration-harness/run.mjs <scenario> [--keep]   (scenario = file name in migration-harness/scenarios)
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { runScenario } from './harness.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2];
if (!name) {
  console.error('usage: node migration-harness/run.mjs <scenario> [--keep]');
  process.exit(2);
}
const scenario = (await import(pathToFileURL(join(here, 'scenarios', `${name}.mjs`)).href)).default;
const res = await runScenario(scenario, { keep: process.argv.includes('--keep'), outDir: join(here, 'out') });
console.log(`scenario=${res.scenario} ok=${res.ok} idempotent=${res.idempotent ?? 'n/a'} review-rows=${res.review.length}`);
for (const c of res.reconciliation.checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  (${c.details})`);
console.log(`reports written to migration-harness/out/`);
process.exit(res.ok ? 0 : 1);
