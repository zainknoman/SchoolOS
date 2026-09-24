import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/**
 * BL-60 (migration M1): attendance and leave approval work without a class teacher; every write
 * names the real actor (markedByUserId) and names a Teacher only when the actor is one. No
 * Teacher identity is ever synthesised. (Also the approval half of BL-29.)
 */
describe('Attendance actor attribution (e2e)', () => {
  let f: TwoSchools;
  const http = () => request(f.app.getHttpServer());
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  const userId = async (who: string) =>
    (
      await f.prisma.user.findUniqueOrThrow({
        where: { identifier: `bl60-${who}` },
      })
    ).id;

  beforeAll(async () => {
    f = await createTwoSchools('bl60');
  });
  afterAll(async () => {
    await f.close();
  });

  it('an admin marks a section with no class teacher; the row names the admin and no teacher', async () => {
    const res = await http()
      .post('/api/v1/attendance')
      .set(bearer(await f.login('admin-a')))
      .send({
        studentId: f.ids.studentANoTeacher,
        date: '2026-02-02',
        status: 'PRESENT',
      })
      .expect(201);
    const row = await f.prisma.attendance.findUniqueOrThrow({
      where: { id: res.body.id as string },
    });
    expect(row.markedById).toBeNull();
    expect(row.markedByUserId).toBe(await userId('admin-a'));
    const audit = await f.prisma.auditLog.findFirstOrThrow({
      where: { action: 'attendance.mark', entityId: row.id },
    });
    expect(audit.userId).toBe(await userId('admin-a'));
  });

  it('an admin marks a section that HAS a class teacher without borrowing that teacher', async () => {
    const res = await http()
      .post('/api/v1/attendance/bulk')
      .set(bearer(await f.login('admin-a')))
      .send({
        date: '2026-02-03',
        marks: [{ studentId: f.ids.studentA, status: 'ABSENT' }],
      })
      .expect(201);
    const [row] = res.body as { id: string }[];
    const stored = await f.prisma.attendance.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(stored.markedById).toBeNull();
    expect(stored.markedByUserId).toBe(await userId('admin-a'));
  });

  it('a teacher is recorded as both the actor and the Teacher', async () => {
    const res = await http()
      .post('/api/v1/attendance')
      .set(bearer(await f.login('teacher-a')))
      .send({
        studentId: f.ids.studentA,
        date: '2026-02-04',
        status: 'PRESENT',
      })
      .expect(201);
    const row = await f.prisma.attendance.findUniqueOrThrow({
      where: { id: res.body.id as string },
    });
    const teacher = await f.prisma.teacher.findUniqueOrThrow({
      where: { userId: await userId('teacher-a') },
    });
    expect(row.markedById).toBe(teacher.id);
    expect(row.markedByUserId).toBe(await userId('teacher-a'));
  });

  it('leave is approved for a section without a class teacher; LEAVE rows name the approver', async () => {
    const created = await http()
      .post('/api/v1/leave-requests')
      .set(bearer(await f.login('parent-a')))
      .send({
        studentId: f.ids.studentANoTeacher,
        startDate: '2026-02-10',
        endDate: '2026-02-11',
        reason: 'Fever',
      })
      .expect(201);
    const res = await http()
      .post(`/api/v1/leave-requests/${created.body.id}/approve`)
      .set(bearer(await f.login('admin-a')))
      .expect(201);
    expect(res.body.status).toBe('approved');
    const rows = await f.prisma.attendance.findMany({
      where: { studentId: f.ids.studentANoTeacher, status: 'LEAVE' },
    });
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r.markedById).toBeNull();
      expect(r.markedByUserId).toBe(await userId('admin-a'));
    }
  });

  it('parents still cannot mark attendance', async () => {
    await http()
      .post('/api/v1/attendance')
      .set(bearer(await f.login('parent-a')))
      .send({
        studentId: f.ids.studentA,
        date: '2026-02-05',
        status: 'PRESENT',
      })
      .expect(403);
  });
});
