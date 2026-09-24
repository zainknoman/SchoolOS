import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { JobLockService } from '../src/prisma/job-lock.service';
import { DigestDispatchJob } from '../src/notifications/digest-dispatch.job';
import { AttendanceRiskJob } from '../src/attendance-risk/attendance-risk.job';
import { PUSH_ADAPTER } from '../src/notifications/push-adapter';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/**
 * BL-39: two application instances sharing one database run the same scheduled jobs at the same
 * moment; the results must be exactly what one instance would produce.
 */
describe('Scheduled jobs across two instances (e2e)', () => {
  let f: TwoSchools;
  const sends: { userId: string; title: string }[] = [];
  const countingPush = {
    send: (userId: string, msg: { title: string }) => {
      sends.push({ userId, title: msg.title });
      return Promise.resolve();
    },
  };
  let instances: INestApplication[] = [];

  async function instance(): Promise<INestApplication> {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PUSH_ADAPTER)
      .useValue(countingPush)
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    instances.push(app);
    return app;
  }

  beforeAll(async () => {
    f = await createTwoSchools('bl39');
  });
  afterAll(async () => {
    await f.prisma.notification.deleteMany({
      where: { userId: { in: await userIds() } },
    });
    await f.prisma.attendanceRiskFlag.deleteMany({
      where: { studentId: f.ids.studentA },
    });
    for (const app of instances) await app.close();
    instances = [];
    await f.close();
  });

  async function userIds() {
    const users = await f.prisma.user.findMany({
      where: { identifier: { startsWith: 'bl39-' } },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  it('the lock lets exactly one instance in while it is held', async () => {
    const [a, b] = [await instance(), await instance()];
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    const first = a.get(JobLockService).runExclusive('bl39-probe', () => held);
    await new Promise((r) => setTimeout(r, 200));
    await expect(
      b.get(JobLockService).runExclusive('bl39-probe', () => Promise.resolve()),
    ).resolves.toBe('skipped');
    release();
    await expect(first).resolves.toBe('ran');
    // Released on commit: the next run gets it again.
    await expect(
      b.get(JobLockService).runExclusive('bl39-probe', () => Promise.resolve()),
    ).resolves.toBe('ran');
  });

  it('two instances dispatching digests at once send each digest once', async () => {
    const [a, b] = instances;
    const parent = await f.prisma.user.update({
      where: { identifier: 'bl39-parent-a' },
      data: { digestEnabled: true },
    });
    await f.prisma.notification.createMany({
      data: [1, 2, 3].map((i) => ({
        userId: parent.id,
        type: 'test',
        title: `Update ${i}`,
        body: 'x',
      })),
    });
    sends.length = 0;

    await Promise.all([
      a.get(DigestDispatchJob).run(),
      b.get(DigestDispatchJob).run(),
    ]);

    expect(sends.filter((s) => s.userId === parent.id)).toEqual([
      { userId: parent.id, title: 'You have 3 new updates' },
    ]);
    expect(
      await f.prisma.notification.count({
        where: { userId: parent.id, dispatchedAt: null },
      }),
    ).toBe(0);
  });

  it('two instances recomputing attendance risk at once notify the class teacher once', async () => {
    const [a, b] = instances;
    const today = new Date();
    const days = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(
        Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate() - (i + 1),
        ),
      );
      return d;
    });
    await f.prisma.attendance.createMany({
      data: days.map((date) => ({
        studentId: f.ids.studentA,
        date,
        status: 'ABSENT' as const,
      })),
    });
    const teacherUser = await f.prisma.user.findUniqueOrThrow({
      where: { identifier: 'bl39-teacher-a' },
    });

    await Promise.all([
      a.get(AttendanceRiskJob).run(),
      b.get(AttendanceRiskJob).run(),
    ]);

    const flag = await f.prisma.attendanceRiskFlag.findUniqueOrThrow({
      where: { studentId: f.ids.studentA },
    });
    expect(flag.flagged).toBe(true);
    expect(
      await f.prisma.notification.count({
        where: { userId: teacherUser.id, type: 'attendance-risk' },
      }),
    ).toBe(1);
  });
});
