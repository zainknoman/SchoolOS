import type { Server } from 'http';
import type { AddressInfo } from 'net';
import {
  createTwoSchools,
  type TwoSchools,
  PASSWORD,
} from './pending/two-school-fixture';
import { formatSmoke, runSmoke, type SmokeResult } from '../src/cli/smoke-test';

/**
 * RELEASE-VALIDATION §3: the release smoke test runs green against a real API — here the app
 * in-process on a random port, with the two-school fixture as the "test school" (school B is the
 * foreign school for the isolation check). Writes are switched on; the rate-limit check is not
 * (NODE_ENV=test raises the login limit to 1000 — the check is covered by smoke-test.spec.ts).
 */
describe('Release smoke test (e2e)', () => {
  let f: TwoSchools;
  let results: SmokeResult[];

  beforeAll(async () => {
    f = await createTwoSchools('smk');
    await f.app.listen(0, '127.0.0.1');
    const server = f.app.getHttpServer() as unknown as Server;
    const { port } = server.address() as AddressInfo;
    const subject = await f.prisma.subject.create({
      data: { name: 'SMK Science', schoolId: f.ids.schoolA },
    });
    const account = (who: string) => ({
      identifier: `smk-${who}`,
      password: PASSWORD,
    });
    results = await runSmoke({
      baseUrl: `http://127.0.0.1:${port}`,
      accounts: {
        SUPER_ADMIN: account('super'),
        SCHOOL_ADMIN: account('admin-a'),
        TEACHER: account('teacher-a'),
        PARENT: account('parent-a'),
      },
      writes: true,
      checkRateLimit: false,
      sectionId: f.ids.sectionA,
      studentId: f.ids.studentA,
      subjectId: subject.id,
      foreignStudentId: f.ids.studentB,
      throttleWaitMs: 61_000,
    });
  }, 300_000);

  afterAll(async () => {
    try {
      await f.prisma.diaryEntry.deleteMany({
        where: { sectionId: f.ids.sectionA },
      });
      await f.prisma.subject.deleteMany({
        where: { name: { startsWith: 'SMK ' } },
      });
      await f.prisma.file.deleteMany({
        where: {
          originalName: 'smoke.png',
          uploadedBy: { identifier: { startsWith: 'smk-' } },
        },
      });
    } finally {
      await f.close();
    }
  });

  it('has no failing check', () => {
    const failed = results.filter((r) => r.status === 'FAIL');
    expect(failed.map((r) => `${r.id}: ${r.detail}`)).toEqual([]);
  });

  it('ran every check that a local API can answer', () => {
    const passed = new Set(
      results.filter((r) => r.status === 'PASS').map((r) => r.id),
    );
    for (const id of [
      'S1',
      'S2a',
      'S2-SUPER_ADMIN',
      'S2-SCHOOL_ADMIN',
      'S2-TEACHER',
      'S2-PARENT',
      'S4-SUPER_ADMIN',
      'S4-SCHOOL_ADMIN',
      'S4-TEACHER',
      'S4-PARENT',
      'S5a',
      'S5b',
      'S6',
      'S7',
    ]) {
      expect({ id, passed: passed.has(id) }).toEqual({ id, passed: true });
    }
    expect(formatSmoke(results)).toContain('0 failed');
  });
});
