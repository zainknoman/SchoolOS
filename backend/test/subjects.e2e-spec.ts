import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/** BL-02 (migration M4): school-scoped subject management. */
describe('Subjects per school (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let physicsA: string;

  beforeAll(async () => {
    f = await createTwoSchools('bl02');
    for (const who of ['super', 'admin-a', 'admin-b', 'teacher-a']) {
      tokens[who] = await f.login(who);
    }
  });
  afterAll(async () => {
    await f.prisma.timetable.deleteMany({
      where: {
        section: {
          class: {
            campus: { schoolId: { in: [f.ids.schoolA, f.ids.schoolB] } },
          },
        },
      },
    });
    await f.prisma.subject.deleteMany({
      where: { schoolId: { in: [f.ids.schoolA, f.ids.schoolB] } },
    });
    await f.close();
  });

  it("a school admin creates their school's subject; it is not visible to another school", async () => {
    const res = await http()
      .post('/api/v1/subjects')
      .set(as('admin-a'))
      .send({ name: 'BL02 Physics' })
      .expect(201);
    physicsA = res.body.id as string;
    expect(res.body).toMatchObject({ schoolId: f.ids.schoolA, isActive: true });

    const names = async (who: string) =>
      (
        (await http().get('/api/v1/subjects').set(as(who)).expect(200))
          .body as { name: string }[]
      ).map((s) => s.name);
    expect(await names('admin-a')).toContain('BL02 Physics');
    expect(await names('teacher-a')).toContain('BL02 Physics');
    expect(await names('admin-b')).not.toContain('BL02 Physics');

    // the same name is fine in another school, a duplicate in the same school is not
    await http()
      .post('/api/v1/subjects')
      .set(as('admin-b'))
      .send({ name: 'BL02 Physics' })
      .expect(201);
    await http()
      .post('/api/v1/subjects')
      .set(as('admin-a'))
      .send({ name: 'BL02 Physics' })
      .expect(409);
  });

  it('teachers cannot manage subjects; a super admin must name the school', async () => {
    await http()
      .post('/api/v1/subjects')
      .set(as('teacher-a'))
      .send({ name: 'BL02 x' })
      .expect(403);
    await http()
      .post('/api/v1/subjects')
      .set(as('super'))
      .send({ name: 'BL02 x' })
      .expect(400);
    await http()
      .post('/api/v1/subjects')
      .set(as('super'))
      .send({ name: 'BL02 Chemistry', schoolId: f.ids.schoolB })
      .expect(201);
  });

  it("another school cannot rename, deactivate or schedule school A's subject", async () => {
    await http()
      .patch(`/api/v1/subjects/${physicsA}`)
      .set(as('admin-b'))
      .send({ isActive: false })
      .expect(403);
    await http()
      .post('/api/v1/timetable')
      .set(as('admin-b'))
      .send({
        sectionId: f.ids.sectionB,
        subjectId: physicsA,
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
      })
      .expect(400);
  });

  it('a subject in use cannot be deleted; deactivated, it can no longer be scheduled', async () => {
    await http()
      .post('/api/v1/timetable')
      .set(as('admin-a'))
      .send({
        sectionId: f.ids.sectionA,
        subjectId: physicsA,
        dayOfWeek: 2,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
      })
      .expect(201);
    await http()
      .delete(`/api/v1/subjects/${physicsA}`)
      .set(as('admin-a'))
      .expect(400);

    await http()
      .patch(`/api/v1/subjects/${physicsA}`)
      .set(as('admin-a'))
      .send({ isActive: false })
      .expect(200);
    await http()
      .post('/api/v1/timetable')
      .set(as('admin-a'))
      .send({
        sectionId: f.ids.sectionA,
        subjectId: physicsA,
        dayOfWeek: 3,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
      })
      .expect(400);
    // hidden from pickers, still listed for admins who ask for inactive ones
    const active = await http()
      .get('/api/v1/subjects')
      .set(as('admin-a'))
      .expect(200);
    expect((active.body as { id: string }[]).map((s) => s.id)).not.toContain(
      physicsA,
    );
    const all = await http()
      .get('/api/v1/subjects?includeInactive=true')
      .set(as('admin-a'))
      .expect(200);
    expect((all.body as { id: string }[]).map((s) => s.id)).toContain(physicsA);
  });
});
