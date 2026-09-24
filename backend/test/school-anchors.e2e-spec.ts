import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/** BL-20 (migration M2): circulars and holidays belong to one school and never cross schools. */
describe('Circulars and holidays stay inside their school (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    f = await createTwoSchools('bl20');
    for (const who of [
      'super',
      'admin-a',
      'admin-b',
      'parent-a',
      'parent-b',
      'parent-shared',
      'teacher-b',
    ]) {
      tokens[who] = await f.login(who);
    }
  });
  afterAll(async () => {
    await f.close();
  });

  it("school A's school-wide circular reaches school A's parents only, and records its school", async () => {
    const pub = await http()
      .post('/api/v1/circulars')
      .set(as('admin-a'))
      .send({
        title: 'BL20 A notice',
        description: 'School A only',
        scope: 'school',
      })
      .expect(201);
    const row = await f.prisma.circular.findUniqueOrThrow({
      where: { id: pub.body.id as string },
    });
    expect(row.schoolId).toBe(f.ids.schoolA);

    const ids = async (who: string) =>
      (
        (await http().get('/api/v1/circulars').set(as(who)).expect(200))
          .body as { id: string }[]
      ).map((c) => c.id);
    expect(await ids('parent-a')).toContain(pub.body.id);
    expect(await ids('parent-shared')).toContain(pub.body.id); // has a child in school A
    expect(await ids('parent-b')).not.toContain(pub.body.id);

    await http()
      .get(`/api/v1/circulars/${pub.body.id}/stats`)
      .set(as('admin-a'))
      .expect(200);
    await http()
      .get(`/api/v1/circulars/${pub.body.id}/stats`)
      .set(as('admin-b'))
      .expect(404);
  });

  it('a super admin must name the school of a school-wide circular', async () => {
    await http()
      .post('/api/v1/circulars')
      .set(as('super'))
      .send({ title: 'BL20 x', description: 'x', scope: 'school' })
      .expect(400);
    const pub = await http()
      .post('/api/v1/circulars')
      .set(as('super'))
      .send({
        title: 'BL20 B notice',
        description: 'x',
        scope: 'school',
        schoolId: f.ids.schoolB,
      })
      .expect(201);
    const recipients = await f.prisma.circularRecipient.findMany({
      where: { circularId: pub.body.id as string },
    });
    const parentB = await f.prisma.user.findUniqueOrThrow({
      where: { identifier: 'bl20-parent-b' },
    });
    const parentA = await f.prisma.user.findUniqueOrThrow({
      where: { identifier: 'bl20-parent-a' },
    });
    expect(recipients.map((r) => r.userId)).toContain(parentB.id);
    expect(recipients.map((r) => r.userId)).not.toContain(parentA.id);
  });

  it("an admin cannot publish to another school's section", async () => {
    await http()
      .post('/api/v1/circulars')
      .set(as('admin-a'))
      .send({
        title: 'BL20 x',
        description: 'x',
        scope: 'section',
        sectionId: f.ids.sectionB,
      })
      .expect(403);
  });

  it("school A's school-wide holiday is not visible to, and does not apply in, school B", async () => {
    const hol = await http()
      .post('/api/v1/holidays')
      .set(as('admin-a'))
      .send({
        title: 'BL20 A holiday',
        startDate: '2026-03-02',
        endDate: '2026-03-02',
      })
      .expect(201);
    expect(hol.body.schoolId).toBe(f.ids.schoolA);

    const list = async (who: string) =>
      (
        (await http().get('/api/v1/holidays').set(as(who)).expect(200))
          .body as { id: string }[]
      ).map((h) => h.id);
    expect(await list('parent-a')).toContain(hol.body.id);
    expect(await list('parent-b')).not.toContain(hol.body.id);

    // It blocks attendance in school A but not in school B.
    await http()
      .post('/api/v1/attendance')
      .set(as('admin-a'))
      .send({
        studentId: f.ids.studentA,
        date: '2026-03-02',
        status: 'PRESENT',
      })
      .expect(400);
    await http()
      .post('/api/v1/attendance')
      .set(as('teacher-b'))
      .send({
        studentId: f.ids.studentB,
        date: '2026-03-02',
        status: 'PRESENT',
      })
      .expect(201);
  });

  it("an admin cannot create a holiday on another school's campus, nor change or delete its holidays", async () => {
    await http()
      .post('/api/v1/holidays')
      .set(as('admin-a'))
      .send({
        title: 'BL20 x',
        startDate: '2026-03-03',
        endDate: '2026-03-03',
        campusId: f.ids.campusB,
      })
      .expect(403);
    const holB = await http()
      .post('/api/v1/holidays')
      .set(as('admin-b'))
      .send({
        title: 'BL20 B holiday',
        startDate: '2026-03-04',
        endDate: '2026-03-04',
      })
      .expect(201);
    await http()
      .patch(`/api/v1/holidays/${holB.body.id}`)
      .set(as('admin-a'))
      .send({ title: 'hijack' })
      .expect(403);
    await http()
      .delete(`/api/v1/holidays/${holB.body.id}`)
      .set(as('admin-a'))
      .expect(403);
    await http()
      .delete(`/api/v1/holidays/${holB.body.id}`)
      .set(as('admin-b'))
      .expect(200);
  });
});
