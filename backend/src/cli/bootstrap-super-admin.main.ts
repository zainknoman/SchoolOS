// CLI entry for BL-22: `npm run bootstrap:super-admin` (runs the compiled dist build).
// Reads DATABASE_URL and BOOTSTRAP_SUPER_ADMIN_* from the environment (a local .env is loaded).
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { bootstrapSuperAdmin } from './bootstrap-super-admin';

async function main(): Promise<number> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    const result = await bootstrapSuperAdmin(prisma, process.env);
    if (!result.ok) {
      console.error(`bootstrap refused: ${result.reason}`);
      return 1;
    }
    console.log(
      `SUPER_ADMIN created: ${result.identifier} (must change password at first sign-in). ` +
        'Now remove BOOTSTRAP_SUPER_ADMIN_PASSWORD from the environment.',
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
      'bootstrap failed:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  });
