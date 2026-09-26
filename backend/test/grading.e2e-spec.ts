import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';

/**
 * BL-27 (Q6, KI-16): per-school grading scales, letter grades, and result publication that
 * requires category weights of exactly 100 %. Also the category scope fix found while doing it.
 */
describe('Grading scales and result publication (e2e, BL-27)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let classA: string;
  let otherClassA: string;
  let termA: string;
  let termB: string;
  let subjectIds: string[] = [];
  let quizzes: string;
  let exams: string;
  let quizAssessment: string;
  let scaleA: string;

  const grades = (who: string) =>
    http()
      .get(`/api/v1/students/${f.ids.studentA}/grades?termId=${termA}`)
      .set(as(who));
  const status = (who = 'admin-a') =>
    http()
      .get(`/api/v1/result-publications?classId=${classA}&termId=${termA}`)
      .set(as(who));

  beforeAll(async () => {
    f = await createTwoSchools('bl27');
    for (const who of [
      'super',
      'admin-a',
      'admin-b',
      'teacher-a',
      'parent-a',
    ]) {
      tokens[who] = await f.login(who);
    }
    classA = (
      await f.prisma.class.findFirstOrThrow({
        where: { academicSessionId: f.ids.sessionA },
      })
    ).id;
    const term = (sessionId: string) =>
      f.prisma.term.create({
        data: {
          academicSessionId: sessionId,
          label: 'BL27 Term 1',
          order: 1,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-06-30'),
        },
      });
    termA = (await term(f.ids.sessionA)).id;
    termB = (await term(f.ids.sessionB)).id;
    const [maths, art] = await Promise.all(
      ['BL27 Maths', 'BL27 Art'].map((name) =>
        f.prisma.subject.create({ data: { name, schoolId: f.ids.schoolA } }),
      ),
    );
    subjectIds = [maths.id, art.id];
    const admin = await f.prisma.user.findUniqueOrThrow({
      where: { identifier: 'bl27-admin-a' },
    });

    // Class A: Quizzes 60 % (9/10) and Exams 30 % (80/100) for Maths — weights total 90 %.
    const category = async (name: string, weight: number, max: number) =>
      f.prisma.assessmentCategory.create({
        data: {
          classId: classA,
          termId: termA,
          name,
          weightPercent: weight,
          assessments: {
            create: { subjectId: maths.id, label: `${name} 1`, maxMarks: max },
          },
        },
        include: { assessments: true },
      });
    const q = await category('Quizzes', 60, 10);
    const e = await category('Exams', 30, 100);
    quizzes = q.id;
    exams = e.id;
    quizAssessment = q.assessments[0].id;
    await f.prisma.mark.createMany({
      data: [
        {
          assessmentId: q.assessments[0].id,
          studentId: f.ids.studentA,
          obtainedMarks: 9,
          enteredById: admin.id,
        },
        {
          assessmentId: e.assessments[0].id,
          studentId: f.ids.studentA,
          obtainedMarks: 80,
          enteredById: admin.id,
        },
      ],
    });

    // Another class in the same session and term: must never show up in student A's grades.
    otherClassA = (
      await f.prisma.class.create({
        data: {
          campusId: f.ids.campusA,
          academicSessionId: f.ids.sessionA,
          name: 'BL27 Other Grade',
          assessmentCategories: {
            create: {
              termId: termA,
              name: 'Projects',
              weightPercent: 100,
              assessments: {
                create: { subjectId: art.id, label: 'Poster', maxMarks: 10 },
              },
            },
          },
        },
      })
    ).id;
  });

  afterAll(async () => {
    await f.prisma.assessmentCategory.deleteMany({
      where: { classId: { in: [classA, otherClassA] } },
    });
    await f.prisma.class.deleteMany({ where: { id: otherClassA } });
    await f.prisma.term.deleteMany({ where: { label: 'BL27 Term 1' } });
    await f.prisma.subject.deleteMany({ where: { id: { in: subjectIds } } });
    await f.close();
  });

  it('publication is refused while weights are not 100 % and there is no scale', async () => {
    const res = await status().expect(200);
    expect(res.body).toMatchObject({
      published: false,
      weightTotal: 90,
      categoryCount: 2,
    });
    expect(res.body.blockers.join(' ')).toMatch(/total 90%.*no default/);
    await http()
      .post('/api/v1/result-publications')
      .set(as('admin-a'))
      .send({ classId: classA, termId: termA })
      .expect(400);
  });

  it('a school admin creates the school’s grading scale; it becomes the default', async () => {
    await http()
      .post('/api/v1/grading-scales')
      .set(as('admin-a'))
      .send({ name: 'Bad', bands: [{ minPercent: 50, letter: 'P' }] })
      .expect(400);
    const res = await http()
      .post('/api/v1/grading-scales')
      .set(as('admin-a'))
      .send({
        name: 'Standard',
        bands: [
          { minPercent: 0, letter: 'F', remark: 'Needs support' },
          { minPercent: 60, letter: 'B', gradePoint: 3 },
          { minPercent: 80, letter: 'A', remark: 'Very good', gradePoint: 4 },
          { minPercent: 90, letter: 'A+', gradePoint: 4 },
        ],
      })
      .expect(201);
    scaleA = res.body.id;
    expect(res.body.isDefault).toBe(true);
    expect(res.body.bands.map((b: { letter: string }) => b.letter)).toEqual([
      'A+',
      'A',
      'B',
      'F',
    ]);
    await http()
      .post('/api/v1/grading-scales')
      .set(as('admin-a'))
      .send({ name: 'Standard', bands: [{ minPercent: 0, letter: 'F' }] })
      .expect(409);
    expect(
      await f.prisma.auditLog.count({
        where: { action: 'grading-scale.create', entityId: scaleA },
      }),
    ).toBe(1);
  });

  it('scales stay inside their school', async () => {
    const b = await http()
      .get('/api/v1/grading-scales')
      .set(as('admin-b'))
      .expect(200);
    expect(b.body).toEqual([]);
    await http()
      .put(`/api/v1/grading-scales/${scaleA}`)
      .set(as('admin-b'))
      .send({ name: 'Hijacked' })
      .expect(403);
    await http()
      .post('/api/v1/grading-scales')
      .set(as('super'))
      .send({ name: 'X', bands: [{ minPercent: 0, letter: 'F' }] })
      .expect(400);
    const teacher = await http()
      .get('/api/v1/grading-scales')
      .set(as('teacher-a'))
      .expect(200);
    expect(teacher.body).toHaveLength(1);
  });

  it('grades show marks, %, letter; only the student’s own class counts; parents wait for publication', async () => {
    const res = await grades('admin-a').expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        subjectName: 'BL27 Maths',
        obtainedMarks: 89,
        maxMarks: 110,
        finalPercent: 78, // 60 % × 90 % + 30 % × 80 %
        letter: 'B',
        gradePoint: 3,
        published: false,
      }),
    ]);
    const parent = await grades('parent-a').expect(200);
    expect(parent.body).toEqual([]);
  });

  it('with weights at 100 % the results publish, with the scale snapshotted; parents then see them', async () => {
    await http()
      .patch(`/api/v1/assessment-categories/${exams}`)
      .set(as('admin-a'))
      .send({ weightPercent: 40 })
      .expect(200);
    const res = await http()
      .post('/api/v1/result-publications')
      .set(as('admin-a'))
      .send({ classId: classA, termId: termA })
      .expect(201);
    expect(res.body).toMatchObject({
      published: true,
      scaleName: 'Standard',
      weightTotal: 100,
      blockers: [],
    });
    await http()
      .post('/api/v1/result-publications')
      .set(as('admin-a'))
      .send({ classId: classA, termId: termA })
      .expect(409);

    const parent = await grades('parent-a').expect(200);
    expect(parent.body).toEqual([
      expect.objectContaining({
        finalPercent: 86,
        letter: 'A',
        remark: 'Very good',
        published: true,
      }),
    ]);

    // Editing the scale later does not change published letters.
    await http()
      .put(`/api/v1/grading-scales/${scaleA}`)
      .set(as('admin-a'))
      .send({
        bands: [
          { minPercent: 0, letter: 'F' },
          { minPercent: 90, letter: 'A' },
        ],
      })
      .expect(200);
    const after = await grades('admin-a').expect(200);
    expect(after.body[0].letter).toBe('A');
  });

  it('while published, categories and assessments are frozen but marks can still be entered', async () => {
    await http()
      .patch(`/api/v1/assessment-categories/${quizzes}`)
      .set(as('admin-a'))
      .send({ weightPercent: 50 })
      .expect(409);
    await http()
      .post('/api/v1/assessment-categories')
      .set(as('admin-a'))
      .send({ classId: classA, termId: termA, name: 'Late', weightPercent: 5 })
      .expect(409);
    await http()
      .post('/api/v1/assessments')
      .set(as('admin-a'))
      .send({
        assessmentCategoryId: quizzes,
        subjectId: subjectIds[0],
        label: 'Quiz 2',
        maxMarks: 10,
      })
      .expect(409);
    await http()
      .post(`/api/v1/assessments/${quizAssessment}/marks`)
      .set(as('admin-a'))
      .send({ marks: [{ studentId: f.ids.studentA, obtainedMarks: 10 }] })
      .expect((r) => expect([200, 201]).toContain(r.status));
  });

  it('only the class’s school publishes or unpublishes; unpublishing is audited', async () => {
    await http()
      .delete(`/api/v1/result-publications?classId=${classA}&termId=${termA}`)
      .set(as('admin-b'))
      .expect(403);
    await http()
      .post('/api/v1/result-publications')
      .set(as('teacher-a'))
      .send({ classId: classA, termId: termA })
      .expect(403);
    const res = await http()
      .delete(`/api/v1/result-publications?classId=${classA}&termId=${termA}`)
      .set(as('admin-a'))
      .expect(200);
    expect(res.body.published).toBe(false);
    expect(
      await f.prisma.auditLog.count({
        where: { action: { in: ['results.publish', 'results.unpublish'] } },
      }),
    ).toBeGreaterThanOrEqual(2);
    expect((await grades('parent-a').expect(200)).body).toEqual([]);
  });

  it('categories are confined to the caller’s school and the class’s session (scope fix)', async () => {
    await http()
      .post('/api/v1/assessment-categories')
      .set(as('admin-b'))
      .send({ classId: classA, termId: termA, name: 'Evil', weightPercent: 1 })
      .expect(403);
    await http()
      .patch(`/api/v1/assessment-categories/${quizzes}`)
      .set(as('admin-b'))
      .send({ weightPercent: 1 })
      .expect(403);
    await http()
      .delete(`/api/v1/assessment-categories/${quizzes}`)
      .set(as('admin-b'))
      .expect(403);
    await http()
      .post('/api/v1/assessment-categories')
      .set(as('admin-a'))
      .send({ classId: classA, termId: termB, name: 'Wrong', weightPercent: 1 })
      .expect(400);
  });
});
