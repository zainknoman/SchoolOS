import {
  buildLoadDataPlan,
  checkLoadDataTarget,
  loadId,
  parentIdentifier,
  schoolDays,
  teacherIdentifier,
  writeLoadData,
} from './load-data';

describe('load-test data generator (BL-15)', () => {
  const ok = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/schoolos_load?schema=public',
    LOAD_PASSWORD: 'Load-Test-Password-1',
  };

  describe('checkLoadDataTarget', () => {
    it('accepts development/test against a scratch database', () => {
      expect(checkLoadDataTarget(ok)).toEqual({
        ok: true,
        database: 'schoolos_load',
        password: ok.LOAD_PASSWORD,
      });
      for (const name of ['schoolos_scratch_e2e', 'load', 'x_e2e_1']) {
        const env = {
          ...ok,
          NODE_ENV: 'development',
          DATABASE_URL: `postgresql://u:p@h/${name}`,
        };
        expect(checkLoadDataTarget(env).ok).toBe(true);
      }
    });

    it.each(['production', 'staging', undefined])(
      'refuses NODE_ENV=%s',
      (nodeEnv) => {
        const result = checkLoadDataTarget({ ...ok, NODE_ENV: nodeEnv });
        expect(result.ok).toBe(false);
      },
    );

    it.each(['schoolos', 'schoolportal', 'download_prod', 'loader'])(
      'refuses a non-scratch database name (%s)',
      (name) => {
        const result = checkLoadDataTarget({
          ...ok,
          DATABASE_URL: `postgresql://u:p@h:5432/${name}`,
        });
        expect(result).toMatchObject({ ok: false });
      },
    );

    it('refuses a missing URL or a short password', () => {
      expect(checkLoadDataTarget({ ...ok, DATABASE_URL: undefined }).ok).toBe(
        false,
      );
      expect(checkLoadDataTarget({ ...ok, LOAD_PASSWORD: 'short' }).ok).toBe(
        false,
      );
    });
  });

  it('derives stable, well-formed UUIDs', () => {
    expect(loadId('student:1')).toBe(loadId('student:1'));
    expect(loadId('student:1')).not.toBe(loadId('student:2'));
    expect(loadId('x')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('lists the weekdays of a month', () => {
    const days = schoolDays('2026-09');
    expect(days).toHaveLength(22);
    expect(days[0].toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(days.every((d) => d.getUTCDay() >= 1 && d.getUTCDay() <= 5)).toBe(
      true,
    );
  });

  describe('buildLoadDataPlan', () => {
    const plan = buildLoadDataPlan('hash');

    it('has the BL-15 shape: 2 campuses, 60 sections, 2,000 students with two guardians', () => {
      expect(plan.campus).toHaveLength(2);
      expect(plan.class).toHaveLength(20);
      expect(plan.section).toHaveLength(60);
      expect(plan.teacher).toHaveLength(60);
      expect(plan.student).toHaveLength(2000);
      expect(plan.enrollment).toHaveLength(2000);
      expect(plan.parentUser).toHaveLength(4000);
      expect(plan.studentParent).toHaveLength(4000);
      expect(plan.attendance).toHaveLength(2000 * 22);
      expect(plan.timetable).toHaveLength(60 * 5 * 6);
      expect(plan.feeVoucher).toHaveLength(4000);
      expect(plan.generatedReportCard).toHaveLength(2000);
      expect(plan.feePayment.length).toBeGreaterThan(1200);
      expect(plan.feePayment.length).toBeLessThan(1600);
    });

    it('is deterministic', () => {
      expect(buildLoadDataPlan('hash')).toEqual(plan);
    });

    it('never produces duplicate ids or duplicate unique keys', () => {
      const all = Object.values(plan).flatMap((rows: { id?: string }[]) =>
        rows.map((r) => r.id),
      );
      expect(new Set(all).size).toBe(all.length);
      const ids = (xs: string[]) => new Set(xs).size === xs.length;
      expect(
        ids([...plan.staffUser, ...plan.parentUser].map((u) => u.identifier)),
      ).toBe(true);
      expect(
        ids(plan.attendance.map((a) => `${a.studentId}|${String(a.date)}`)),
      ).toBe(true);
      expect(
        ids(
          plan.diaryEntry.map(
            (d) => `${d.sectionId}|${d.subjectId}|${String(d.date)}`,
          ),
        ),
      ).toBe(true);
      expect(ids(plan.receipt.map((r) => r.receiptNumber))).toBe(true);
    });

    it('never double-books a teacher in one period', () => {
      const slots = plan.timetable.map(
        (t) => `${t.teacherId}|${t.dayOfWeek}|${t.period}`,
      );
      expect(new Set(slots).size).toBe(slots.length);
    });

    it('uses the documented login identifiers', () => {
      const identifiers = new Set(
        [...plan.staffUser, ...plan.parentUser].map((u) => u.identifier),
      );
      expect(identifiers.has(teacherIdentifier(1))).toBe(true);
      expect(identifiers.has(teacherIdentifier(60))).toBe(true);
      expect(identifiers.has(parentIdentifier('father', 2000))).toBe(true);
      expect(identifiers.has(parentIdentifier('mother', 1))).toBe(true);
    });
  });

  it('writes every table with skipDuplicates in chunks', async () => {
    const calls: { model: string; rows: number; skip: boolean }[] = [];
    const prisma = new Proxy(
      {},
      {
        get: (_t, model: string) => ({
          createMany: ({
            data,
            skipDuplicates,
          }: {
            data: unknown[];
            skipDuplicates: boolean;
          }) => {
            calls.push({ model, rows: data.length, skip: skipDuplicates });
            return Promise.resolve({ count: 0 });
          },
        }),
      },
    );
    const plan = buildLoadDataPlan('hash');
    const inserted = await writeLoadData(prisma as never, plan);

    expect(calls.every((c) => c.skip && c.rows <= 2000)).toBe(true);
    expect(calls.filter((c) => c.model === 'attendance')).toHaveLength(22);
    expect(Object.values(inserted).every((n) => n === 0)).toBe(true);
    expect(calls[0].model).toBe('school');
  });
});
