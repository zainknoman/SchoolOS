import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/** BL-01 (migration M3): academic sessions are per school (Q1). */
describe('School-scoped academic sessions (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  beforeAll(async () => {
    f = await createTwoSchools('bl01');
    for (const who of ['super', 'admin-a', 'admin-b', 'teacher-a']) {
      tokens[who] = await f.login(who);
    }
  });
  afterAll(async () => {
    await f.close();
  });

  it("activating school A's session leaves school B's active session active", async () => {
    const next = await http()
      .post('/api/v1/academic-sessions')
      .set(as('super'))
      .send({
        label: 'BL01 A next',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        isActive: false,
        schoolId: f.ids.schoolA,
      })
      .expect(201);
    expect(next.body.schoolId).toBe(f.ids.schoolA);
    await http()
      .patch(`/api/v1/academic-sessions/${next.body.id}`)
      .set(as('super'))
      .send({ isActive: true })
      .expect(200);

    const [a, aNext, b] = await Promise.all(
      [f.ids.sessionA, next.body.id as string, f.ids.sessionB].map((id) =>
        f.prisma.academicSession.findUniqueOrThrow({ where: { id } }),
      ),
    );
    expect(a.isActive).toBe(false); // same school: deactivated
    expect(aNext.isActive).toBe(true);
    expect(b.isActive).toBe(true); // other school: untouched

    // restore for the remaining tests
    await f.prisma.academicSession.update({
      where: { id: next.body.id as string },
      data: { isActive: false },
    });
    await f.prisma.academicSession.update({
      where: { id: f.ids.sessionA },
      data: { isActive: true },
    });
  });

  it('a session must name its school', async () => {
    await http()
      .post('/api/v1/academic-sessions')
      .set(as('super'))
      .send({
        label: 'BL01 x',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        isActive: false,
      })
      .expect(400);
  });

  it("school staff list their own school's sessions only", async () => {
    const ids = async (who: string) =>
      (
        (await http().get('/api/v1/academic-sessions').set(as(who)).expect(200))
          .body as { id: string }[]
      ).map((s) => s.id);
    const a = await ids('admin-a');
    expect(a).toContain(f.ids.sessionA);
    expect(a).not.toContain(f.ids.sessionB);
    expect(await ids('teacher-a')).not.toContain(f.ids.sessionB);
    const filtered = await http()
      .get(`/api/v1/academic-sessions?schoolId=${f.ids.schoolB}`)
      .set(as('super'))
      .expect(200);
    expect((filtered.body as { id: string }[]).map((s) => s.id)).toEqual([
      f.ids.sessionB,
    ]);
  });

  it("a new student is enrolled in their own school's active session", async () => {
    const created = await http()
      .post('/api/v1/admin/students')
      .set(as('admin-b'))
      .send({
        grNumber: 'BL01-NEW',
        name: 'BL01 New',
        sectionId: f.ids.sectionB,
        relationshipType: 'FATHER', // BL-04: required
        parentProfileId: f.ids.parentB,
      })
      .expect(201);
    const enrollment = await f.prisma.enrollment.findFirstOrThrow({
      where: { studentId: created.body.id as string },
    });
    expect(enrollment.academicSessionId).toBe(f.ids.sessionB);
  });

  it('copying a class structure between two schools is refused', async () => {
    await http()
      .post(`/api/v1/academic-sessions/${f.ids.sessionA}/copy-structure`)
      .set(as('super'))
      .send({ sourceSessionId: f.ids.sessionB })
      .expect(400);
  });
});
