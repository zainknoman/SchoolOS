import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';

/**
 * BL-29 (Q12, M1b): teacher recommendation → SCHOOL_ADMIN decision, each attributed to its real
 * actor and audited separately; no class teacher needed; one decision only; confined to the
 * student's school (KG-27).
 */
describe('Leave workflow (e2e, BL-29)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const userId = async (identifier: string) =>
    (
      await f.prisma.user.findUniqueOrThrow({
        where: { identifier: `bl29-${identifier}` },
      })
    ).id;

  const apply = async (studentId: string, day: string) =>
    (
      await http()
        .post('/api/v1/leave-requests')
        .set(as('parent-a'))
        .send({ studentId, startDate: day, endDate: day, reason: 'Fever' })
        .expect(201)
    ).body.id as string;

  beforeAll(async () => {
    f = await createTwoSchools('bl29');
    for (const who of [
      'admin-a',
      'admin-b',
      'teacher-a',
      'teacher-b',
      'parent-a',
    ]) {
      tokens[who] = await f.login(who);
    }
  });

  afterAll(async () => {
    await f.close();
  });

  it('recommend → approve: two actors, two audit rows, LEAVE attributed to the decider', async () => {
    const id = await apply(f.ids.studentA, '2026-10-05');

    const queue = await http()
      .get('/api/v1/leave-requests?status=pending')
      .set(as('teacher-a'))
      .expect(200);
    expect(queue.body.map((r: { id: string }) => r.id)).toContain(id);
    const otherQueue = await http()
      .get('/api/v1/leave-requests?status=pending')
      .set(as('teacher-b'))
      .expect(200);
    expect(otherQueue.body.map((r: { id: string }) => r.id)).not.toContain(id);

    await http()
      .post(`/api/v1/leave-requests/${id}/recommend`)
      .set(as('teacher-b'))
      .send({ approve: true })
      .expect(403);
    const rec = await http()
      .post(`/api/v1/leave-requests/${id}/recommend`)
      .set(as('teacher-a'))
      .send({ approve: true, note: 'Mother called in' })
      .expect(201);
    expect(rec.body.status).toBe('pending');
    expect(rec.body.recommendation).toMatchObject({
      by: 'BL29 Teacher A',
      approve: true,
      note: 'Mother called in',
    });

    await http()
      .post(`/api/v1/leave-requests/${id}/approve`)
      .set(as('admin-b'))
      .send({})
      .expect(403);
    const approved = await http()
      .post(`/api/v1/leave-requests/${id}/approve`)
      .set(as('admin-a'))
      .send({ note: 'Get well soon' })
      .expect(201);
    expect(approved.body).toMatchObject({
      status: 'approved',
      decision: { by: 'bl29-admin-a', note: 'Get well soon' },
    });

    const [teacherId, adminId] = await Promise.all([
      userId('teacher-a'),
      userId('admin-a'),
    ]);
    const audits = await f.prisma.auditLog.findMany({
      where: { entityId: id, action: { startsWith: 'leave-request.' } },
      orderBy: { createdAt: 'asc' },
      select: { action: true, userId: true },
    });
    expect(audits).toEqual([
      { action: 'leave-request.create', userId: await userId('parent-a') },
      { action: 'leave-request.recommend', userId: teacherId },
      { action: 'leave-request.approve', userId: adminId },
    ]);
    const leave = await f.prisma.attendance.findUniqueOrThrow({
      where: {
        studentId_date: {
          studentId: f.ids.studentA,
          date: new Date('2026-10-05'),
        },
      },
    });
    expect(leave).toMatchObject({
      status: 'LEAVE',
      markedByUserId: adminId,
      markedById: null, // the admin is not a teacher — no teacher is made up
    });
  });

  it('the decision is final: a second decision or a late recommendation is refused', async () => {
    const id = await apply(f.ids.studentA, '2026-10-06');
    await http()
      .post(`/api/v1/leave-requests/${id}/reject`)
      .set(as('admin-a'))
      .send({ note: 'Exam day' })
      .expect(201);
    await http()
      .post(`/api/v1/leave-requests/${id}/approve`)
      .set(as('admin-a'))
      .send({})
      .expect(400);
    await http()
      .post(`/api/v1/leave-requests/${id}/recommend`)
      .set(as('teacher-a'))
      .send({ approve: true })
      .expect(400);
  });

  it('approval and rejection need no class teacher and no recommendation', async () => {
    const approveId = await apply(f.ids.studentANoTeacher, '2026-10-07');
    const rejectId = await apply(f.ids.studentANoTeacher, '2026-10-08');
    const a = await http()
      .post(`/api/v1/leave-requests/${approveId}/approve`)
      .set(as('admin-a'))
      .send({})
      .expect(201);
    expect(a.body).toMatchObject({ status: 'approved', recommendation: null });
    const r = await http()
      .post(`/api/v1/leave-requests/${rejectId}/reject`)
      .set(as('admin-a'))
      .send({})
      .expect(201);
    expect(r.body.status).toBe('rejected');
  });

  it('parents see the outcome and the decision note, not the internal recommendation', async () => {
    const res = await http()
      .get(`/api/v1/students/${f.ids.studentA}/leave-requests`)
      .set(as('parent-a'))
      .expect(200);
    const approved = res.body.find(
      (r: { startDate: string }) => r.startDate === '2026-10-05',
    );
    expect(approved).not.toHaveProperty('recommendation');
    expect(approved.decision).toEqual({
      at: expect.any(String),
      note: 'Get well soon',
    });
    const staff = await http()
      .get(`/api/v1/students/${f.ids.studentA}/leave-requests`)
      .set(as('admin-a'))
      .expect(200);
    expect(
      staff.body.find(
        (r: { startDate: string }) => r.startDate === '2026-10-05',
      ).recommendation.by,
    ).toBe('BL29 Teacher A');
  });
});
