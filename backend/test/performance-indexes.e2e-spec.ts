import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * BL-15: indexes the load test showed the hot paths need. Attendance is read school- or
 * section-wide by day (dashboard, "attendance already marked today"), and the dashboard's alerts
 * are the newest notifications across a school — both scanned the whole table without these.
 */
describe('Load-test indexes (BL-15, e2e)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  afterAll(() => prisma.$disconnect());

  it.each([
    ['Attendance', 'Attendance_date_idx', '(date)'],
    ['Notification', 'Notification_createdAt_idx', '("createdAt")'],
  ])('%s has %s', async (table, name, columns) => {
    const rows = await prisma.$queryRaw<{ indexdef: string }[]>`
      SELECT indexdef FROM pg_indexes
      WHERE schemaname = current_schema() AND tablename = ${table} AND indexname = ${name}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain(columns);
  });
});
