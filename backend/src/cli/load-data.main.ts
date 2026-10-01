// CLI entry for BL-15: `npm run load:data` (runs the compiled dist build). Generates the load-test
// data set into a scratch database; see docs/release/LOAD-TEST-REPORT.md.
// Reads NODE_ENV, DATABASE_URL and LOAD_PASSWORD (a local .env is loaded).
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  buildLoadDataPlan,
  checkLoadDataTarget,
  writeLoadData,
} from './load-data';

async function main(): Promise<number> {
  const target = checkLoadDataTarget(process.env);
  if (!target.ok) {
    console.error(`load data refused: ${target.reason}`);
    return 1;
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const started = Date.now();
    const plan = buildLoadDataPlan(await argon2.hash(target.password));
    const inserted = await writeLoadData(prisma, plan, (line) =>
      console.log(line),
    );
    const total = Object.values(inserted).reduce((a, b) => a + b, 0);
    console.log(
      `load data ready in ${target.database}: ${total} rows inserted (0 = already present) in ${((Date.now() - started) / 1000).toFixed(1)} s`,
    );
    return 0;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err: unknown) => {
    console.error(
      'load data failed:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
