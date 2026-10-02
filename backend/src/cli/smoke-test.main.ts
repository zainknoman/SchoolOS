// CLI entry for the release smoke test: `npm run smoke` (runs the compiled dist build). Calls the
// API named by SMOKE_BASE_URL over HTTP; see docs/testing/RELEASE-VALIDATION.md §3 for the
// variables. Writes nothing unless SMOKE_WRITES=1. Exits 1 when any check fails.
import 'dotenv/config';
import { formatSmoke, runSmoke, smokeConfigFrom } from './smoke-test';

async function main(): Promise<number> {
  const results = await runSmoke(smokeConfigFrom(process.env));
  console.log(formatSmoke(results));
  return results.some((r) => r.status === 'FAIL') ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
