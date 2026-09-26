import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';
import { AttendanceRiskService } from '../src/attendance-risk/attendance-risk.service';

/**
 * BL-28 (Q8, BR-ATT-04): attendance-risk settings per school (defaults 30 days / 25 % / 5 days,
 * parent alerts off), read by the nightly job; alerts to the class teacher and school admins, and
 * to guardians only when the school enables it.
 */
describe('Attendance-risk settings (e2e, BL-28)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const settings = '/api/v1/attendance-risk/settings';
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - n);
    return d;
  };

  beforeAll(async () => {
    f = await createTwoSchools('bl28');
    const adminA = await f.prisma.user.findUniqueOrThrow({
      where: { identifier: 'bl28-admin-a' },
    });
    // A campus-level admin of school A (may read, not change, school-wide settings).
    await f.prisma.user.create({
      data: {
        identifier: 'bl28-campus-admin',
        passwordHash: adminA.passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: f.ids.schoolA,
        campusId: f.ids.campusA,
      },
    });
    for (const who of [
      'super',
      'admin-a',
      'admin-b',
      'teacher-a',
      'campus-admin',
    ]) {
      tokens[who] = await f.login(who);
    }
  });

  afterAll(async () => {
    const users = await f.prisma.user.findMany({
      where: { identifier: { startsWith: 'bl28-' } },
      select: { id: true },
    });
    await f.prisma.notification.deleteMany({
      where: { userId: { in: users.map((u) => u.id) } },
    });
    await f.prisma.attendanceRiskFlag.deleteMany({
      where: { student: { grNumber: { startsWith: 'BL28-' } } },
    });
    await f.close();
  });

  it('a school without settings reports the defaults', async () => {
    const res = await http().get(settings).set(as('admin-a')).expect(200);
    expect(res.body).toEqual({
      schoolId: f.ids.schoolA,
      windowDays: 30,
      thresholdPercent: 25,
      minTrackedDays: 5,
      notifyParents: false,
    });
  });

  it('a school-wide admin changes them (audited); others cannot', async () => {
    const body = {
      windowDays: 14,
      thresholdPercent: 20,
      minTrackedDays: 3,
      notifyParents: true,
    };
    await http().put(settings).set(as('campus-admin')).send(body).expect(403);
    await http().put(settings).set(as('teacher-a')).send(body).expect(403);
    await http()
      .put(settings)
      .set(as('admin-a'))
      .send({ ...body, minTrackedDays: 20 })
      .expect(400);
    await http()
      .put(settings)
      .set(as('admin-a'))
      .send({ ...body, windowDays: 3 })
      .expect(400);
    const res = await http()
      .put(settings)
      .set(as('admin-a'))
      .send(body)
      .expect(200);
    expect(res.body).toEqual({ schoolId: f.ids.schoolA, ...body });
    expect(
      await f.prisma.auditLog.count({
        where: {
          action: 'attendance-risk-policy.update',
          entityId: f.ids.schoolA,
        },
      }),
    ).toBe(1);

    const campus = await http()
      .get(settings)
      .set(as('campus-admin'))
      .expect(200);
    expect(campus.body.windowDays).toBe(14);
  });

  it('settings stay inside their school', async () => {
    await http()
      .get(`${settings}?schoolId=${f.ids.schoolA}`)
      .set(as('admin-b'))
      .expect(403);
    const b = await http().get(settings).set(as('admin-b')).expect(200);
    expect(b.body.windowDays).toBe(30);
    await http().get(settings).set(as('super')).expect(400);
    const s = await http()
      .get(`${settings}?schoolId=${f.ids.schoolA}`)
      .set(as('super'))
      .expect(200);
    expect(s.body.thresholdPercent).toBe(20);
  });

  it("the nightly run uses the school's settings and alerts teacher, admins and (enabled) guardians", async () => {
    // School A: 3 absences in the last 14 days — enough under A's settings (3 days, 20 %).
    // School B: the same, but B keeps the defaults (needs 5 tracked days) — not evaluated.
    await f.prisma.attendance.createMany({
      data: [1, 2, 3].flatMap((n) => [
        { studentId: f.ids.studentA, date: daysAgo(n), status: 'ABSENT' },
        { studentId: f.ids.studentB, date: daysAgo(n), status: 'ABSENT' },
      ]),
    });
    await f.app.get(AttendanceRiskService).recomputeAll();

    const flagA = await f.prisma.attendanceRiskFlag.findUnique({
      where: { studentId: f.ids.studentA },
    });
    expect(flagA).toMatchObject({ flagged: true, absenceRate: 1 });
    expect(
      await f.prisma.attendanceRiskFlag.findUnique({
        where: { studentId: f.ids.studentB },
      }),
    ).toBeNull();

    const notified = await f.prisma.notification.findMany({
      where: { type: 'attendance-risk', entityRef: f.ids.studentA },
      select: { userId: true },
    });
    const recipients = await f.prisma.user.findMany({
      where: { id: { in: notified.map((n) => n.userId) } },
      select: { identifier: true },
    });
    expect(notified).toHaveLength(recipients.length); // one alert per person
    expect(recipients.map((u) => u.identifier).sort()).toEqual([
      'bl28-admin-a',
      'bl28-campus-admin',
      'bl28-parent-a',
      'bl28-parent-shared',
      'bl28-teacher-a',
    ]);

    const flagged = await http()
      .get('/api/v1/attendance-risk')
      .set(as('admin-a'))
      .expect(200);
    expect(
      flagged.body.map((r: { studentId: string }) => r.studentId),
    ).toContain(f.ids.studentA);
  });
});
