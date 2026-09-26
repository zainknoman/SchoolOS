import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';

/**
 * BL-26 (Q2, Q19): yearly syllabus per class + subject (and so per session). Admins of the
 * class's school write (audited), teachers of the class read, other schools get 403, and a
 * session that has ended is read-only history.
 */
describe('Syllabus (e2e, BL-26)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let classA: string;
  let classB: string;
  let subjectA: string;
  let subjectB: string;
  let termA: string;
  let termB: string;
  let oldSession: string;
  let oldSyllabus: string;
  let syllabusId: string;

  beforeAll(async () => {
    f = await createTwoSchools('bl26');
    for (const who of [
      'super',
      'admin-a',
      'admin-b',
      'teacher-a',
      'teacher-b',
    ]) {
      tokens[who] = await f.login(who);
    }
    classA = (
      await f.prisma.class.findFirstOrThrow({
        where: { academicSessionId: f.ids.sessionA },
      })
    ).id;
    classB = (
      await f.prisma.class.findFirstOrThrow({
        where: { academicSessionId: f.ids.sessionB },
      })
    ).id;
    subjectA = (
      await f.prisma.subject.create({
        data: { name: 'BL26 Science', schoolId: f.ids.schoolA },
      })
    ).id;
    subjectB = (
      await f.prisma.subject.create({
        data: { name: 'BL26 Science', schoolId: f.ids.schoolB },
      })
    ).id;
    const term = (sessionId: string) =>
      f.prisma.term.create({
        data: {
          academicSessionId: sessionId,
          label: 'BL26 Term 1',
          order: 1,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-06-30'),
        },
      });
    termA = (await term(f.ids.sessionA)).id;
    termB = (await term(f.ids.sessionB)).id;

    // An ended session of school A with a syllabus: history, read-only.
    oldSession = (
      await f.prisma.academicSession.create({
        data: {
          schoolId: f.ids.schoolA,
          label: 'BL26 2020',
          startDate: new Date('2020-01-01'),
          endDate: new Date('2020-12-31'),
        },
      })
    ).id;
    const oldClass = await f.prisma.class.create({
      data: {
        campusId: f.ids.campusA,
        academicSessionId: oldSession,
        name: 'BL26 Old Grade',
      },
    });
    oldSyllabus = (
      await f.prisma.syllabus.create({
        data: { classId: oldClass.id, subjectId: subjectA },
      })
    ).id;
  });

  afterAll(async () => {
    await f.prisma.syllabus.deleteMany({
      where: { subjectId: { in: [subjectA, subjectB] } },
    });
    await f.prisma.subject.deleteMany({
      where: { id: { in: [subjectA, subjectB] } },
    });
    await f.prisma.academicSession.deleteMany({ where: { id: oldSession } });
    await f.close();
  });

  it('a school admin creates a syllabus with ordered units; it is audited', async () => {
    const res = await http()
      .post('/api/v1/syllabi')
      .set(as('admin-a'))
      .send({
        classId: classA,
        subjectId: subjectA,
        overview: 'Living things',
        units: [
          {
            title: 'Plants',
            topics: 'Roots, leaves',
            termId: termA,
            plannedStart: '2026-01-10',
            plannedEnd: '2026-02-10',
          },
          { title: 'Animals' },
        ],
      })
      .expect(201);
    syllabusId = res.body.id;
    expect(res.body).toMatchObject({
      classId: classA,
      subjectName: 'BL26 Science',
      editable: true,
      overview: 'Living things',
    });
    expect(
      res.body.units.map((u: { order: number; title: string }) => [
        u.order,
        u.title,
      ]),
    ).toEqual([
      [1, 'Plants'],
      [2, 'Animals'],
    ]);
    expect(res.body.units[0].termLabel).toBe('BL26 Term 1');
    const audit = await f.prisma.auditLog.findFirst({
      where: { action: 'syllabus.create', entityId: syllabusId },
    });
    expect(audit).not.toBeNull();
  });

  it('one syllabus per class + subject; the subject and terms must be the school’s', async () => {
    await http()
      .post('/api/v1/syllabi')
      .set(as('admin-a'))
      .send({ classId: classA, subjectId: subjectA })
      .expect(409);
    await http()
      .post('/api/v1/syllabi')
      .set(as('admin-a'))
      .send({ classId: classA, subjectId: subjectB })
      .expect(400);
    await http()
      .put(`/api/v1/syllabi/${syllabusId}`)
      .set(as('admin-a'))
      .send({ units: [{ title: 'X', termId: termB }] })
      .expect(400);
    await http()
      .put(`/api/v1/syllabi/${syllabusId}`)
      .set(as('admin-a'))
      .send({
        units: [
          { title: 'X', plannedStart: '2026-03-01', plannedEnd: '2026-02-01' },
        ],
      })
      .expect(400);
  });

  it('another school cannot read, list or change it', async () => {
    await http()
      .get(`/api/v1/syllabi/${syllabusId}`)
      .set(as('admin-b'))
      .expect(403);
    await http()
      .put(`/api/v1/syllabi/${syllabusId}`)
      .set(as('admin-b'))
      .send({ units: [] })
      .expect(403);
    await http()
      .delete(`/api/v1/syllabi/${syllabusId}`)
      .set(as('admin-b'))
      .expect(403);
    await http()
      .post('/api/v1/syllabi')
      .set(as('admin-b'))
      .send({ classId: classA, subjectId: subjectA })
      .expect(403);
    const list = await http()
      .get(`/api/v1/syllabi?academicSessionId=${f.ids.sessionA}`)
      .set(as('admin-b'))
      .expect(200);
    expect(list.body).toEqual([]);
    await http()
      .get(`/api/v1/syllabi/${syllabusId}`)
      .set(as('teacher-b'))
      .expect(403);
  });

  it('the class’s teacher reads it but cannot change it', async () => {
    const list = await http()
      .get(`/api/v1/syllabi?academicSessionId=${f.ids.sessionA}`)
      .set(as('teacher-a'))
      .expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: syllabusId, unitCount: 2 }),
    ]);
    await http()
      .get(`/api/v1/syllabi/${syllabusId}`)
      .set(as('teacher-a'))
      .expect(200);
    await http()
      .put(`/api/v1/syllabi/${syllabusId}`)
      .set(as('teacher-a'))
      .send({ units: [] })
      .expect(403);
    await http().get('/api/v1/syllabi').set(as('teacher-a')).expect(400);
  });

  it('an update replaces the units in the given order', async () => {
    const res = await http()
      .put(`/api/v1/syllabi/${syllabusId}`)
      .set(as('admin-a'))
      .send({
        overview: null,
        units: [{ title: 'Animals' }, { title: 'Plants' }, { title: 'Soil' }],
      })
      .expect(200);
    expect(res.body.overview).toBeNull();
    expect(res.body.units.map((u: { title: string }) => u.title)).toEqual([
      'Animals',
      'Plants',
      'Soil',
    ]);
  });

  it('a syllabus of an ended session is read-only history', async () => {
    const res = await http()
      .get(`/api/v1/syllabi/${oldSyllabus}`)
      .set(as('admin-a'))
      .expect(200);
    expect(res.body.editable).toBe(false);
    await http()
      .put(`/api/v1/syllabi/${oldSyllabus}`)
      .set(as('admin-a'))
      .send({ units: [{ title: 'Rewrite history' }] })
      .expect(400);
    await http()
      .delete(`/api/v1/syllabi/${oldSyllabus}`)
      .set(as('super'))
      .expect(400);
  });

  it('SUPER_ADMIN works across schools; delete is audited', async () => {
    const b = await http()
      .post('/api/v1/syllabi')
      .set(as('super'))
      .send({ classId: classB, subjectId: subjectB })
      .expect(201);
    await http()
      .delete(`/api/v1/syllabi/${b.body.id}`)
      .set(as('super'))
      .expect(204);
    await http()
      .delete(`/api/v1/syllabi/${syllabusId}`)
      .set(as('admin-a'))
      .expect(204);
    expect(
      await f.prisma.auditLog.count({
        where: {
          action: 'syllabus.delete',
          entityId: { in: [syllabusId, b.body.id] },
        },
      }),
    ).toBe(2);
  });
});
