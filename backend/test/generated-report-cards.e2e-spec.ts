import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';

/**
 * BL-06 (Q6): report cards generated from the gradebook — only after publication, versioned on
 * change, immutable once issued, PDF export, parents read the current card while published.
 */
describe('Generated report cards (e2e, BL-06)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let classA: string;
  let termA: string;
  let subjectId: string;
  let assessmentId: string;

  const generate = (who = 'admin-a', body: object = {}) =>
    http()
      .post('/api/v1/report-cards/generated')
      .set(as(who))
      .send({ classId: classA, termId: termA, ...body });
  const list = (who: string) =>
    http()
      .get(`/api/v1/report-cards/generated?studentId=${f.ids.studentA}`)
      .set(as(who));

  beforeAll(async () => {
    f = await createTwoSchools('bl06');
    for (const who of [
      'super',
      'admin-a',
      'admin-b',
      'teacher-a',
      'parent-a',
      'parent-b',
    ]) {
      tokens[who] = await f.login(who);
    }
    classA = (
      await f.prisma.class.findFirstOrThrow({
        where: { academicSessionId: f.ids.sessionA },
      })
    ).id;
    termA = (
      await f.prisma.term.create({
        data: {
          academicSessionId: f.ids.sessionA,
          label: 'BL06 Term 1',
          order: 1,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-06-30'),
        },
      })
    ).id;
    subjectId = (
      await f.prisma.subject.create({
        data: { name: 'BL06 English', schoolId: f.ids.schoolA },
      })
    ).id;
    const category = await f.prisma.assessmentCategory.create({
      data: {
        classId: classA,
        termId: termA,
        name: 'Exams',
        weightPercent: 100,
        assessments: {
          create: { subjectId, label: 'Final', maxMarks: 50 },
        },
      },
      include: { assessments: true },
    });
    assessmentId = category.assessments[0].id;
    const admin = await f.prisma.user.findUniqueOrThrow({
      where: { identifier: 'bl06-admin-a' },
    });
    // A1 has 43/50 (86 %); A2 (other section of the same class) has no mark (0 %).
    await f.prisma.mark.create({
      data: {
        assessmentId,
        studentId: f.ids.studentA,
        obtainedMarks: 43,
        enteredById: admin.id,
      },
    });
    await http()
      .post('/api/v1/grading-scales')
      .set(as('admin-a'))
      .send({
        name: 'Standard',
        bands: [
          { minPercent: 0, letter: 'F', gradePoint: 0 },
          { minPercent: 80, letter: 'A', remark: 'Very good', gradePoint: 4 },
        ],
      })
      .expect(201);
  });

  afterAll(async () => {
    // Issued cards are retained records: the class/term cannot be removed while they exist.
    await f.prisma.generatedReportCard.deleteMany({
      where: { termId: termA },
    });
    await f.prisma.assessmentCategory.deleteMany({ where: { termId: termA } });
    await f.prisma.term.deleteMany({ where: { id: termA } });
    await f.prisma.subject.deleteMany({ where: { id: subjectId } });
    await f.close();
  });

  it('cannot generate before the results are published', async () => {
    await generate().expect(400);
  });

  it('generates one card per student of the class from the published results', async () => {
    await http()
      .post('/api/v1/result-publications')
      .set(as('admin-a'))
      .send({ classId: classA, termId: termA })
      .expect(201);
    const res = await generate('admin-a', {
      remarks: [{ studentId: f.ids.studentA, remark: 'Reads widely.' }],
    }).expect(201);
    expect(res.body).toEqual({ generated: 2, unchanged: 0, skipped: [] });

    const cards = await list('admin-a').expect(200);
    expect(cards.body).toEqual([
      expect.objectContaining({
        version: 1,
        current: true,
        overallPercent: 86,
        overallLetter: 'A',
        term: 'BL06 Term 1',
      }),
    ]);
    const detail = await http()
      .get(`/api/v1/report-cards/generated/${cards.body[0].id}`)
      .set(as('teacher-a'))
      .expect(200);
    expect(detail.body.snapshot).toMatchObject({
      student: { grNumber: 'BL06-A1' },
      subjects: [
        expect.objectContaining({
          subjectName: 'BL06 English',
          obtainedMarks: 43,
          maxMarks: 50,
          letter: 'A',
        }),
      ],
      overall: { percent: 86, letter: 'A', gpa: 4 },
      remark: 'Reads widely.',
    });
    expect(
      await f.prisma.auditLog.count({
        where: { action: 'report-card.generate', entityId: classA },
      }),
    ).toBe(1);
  });

  it('regenerating without changes issues nothing; a mark change issues version 2 and keeps the remark', async () => {
    const same = await generate().expect(201);
    expect(same.body).toMatchObject({ generated: 0, unchanged: 2 });

    await http()
      .post(`/api/v1/assessments/${assessmentId}/marks`)
      .set(as('admin-a'))
      .send({ marks: [{ studentId: f.ids.studentA, obtainedMarks: 35 }] })
      .expect((r) => expect([200, 201]).toContain(r.status));
    const changed = await generate('admin-a', {
      studentIds: [f.ids.studentA],
    }).expect(201);
    expect(changed.body).toMatchObject({ generated: 1, unchanged: 0 });

    const cards = await list('admin-a').expect(200);
    expect(
      cards.body.map((c: { version: number; current: boolean }) => [
        c.version,
        c.current,
      ]),
    ).toEqual([
      [2, true],
      [1, false],
    ]);
    const v2 = await http()
      .get(`/api/v1/report-cards/generated/${cards.body[0].id}`)
      .set(as('admin-a'))
      .expect(200);
    expect(v2.body.snapshot.overall).toMatchObject({
      percent: 70,
      letter: 'F',
    });
    expect(v2.body.snapshot.remark).toBe('Reads widely.');
  });

  it('issued cards cannot be changed in the database', async () => {
    const card = await f.prisma.generatedReportCard.findFirstOrThrow({
      where: { studentId: f.ids.studentA, version: 1 },
    });
    await expect(
      f.prisma.generatedReportCard.update({
        where: { id: card.id },
        data: { overallPercent: 99 },
      }),
    ).rejects.toThrow(/cannot be changed/);
    await expect(
      f.prisma.generatedReportCard.update({
        where: { id: card.id },
        data: { supersededAt: null },
      }),
    ).rejects.toThrow(/stays superseded/);
  });

  it('parents see only the current card, only while published, and a PDF of it', async () => {
    const cards = await list('parent-a').expect(200);
    expect(cards.body).toHaveLength(1);
    expect(cards.body[0]).toMatchObject({ version: 2, current: true });
    const pdf = await http()
      .get(
        `/api/v1/report-cards/generated/${cards.body[0].id}/pdf?access_token=${tokens['parent-a']}`,
      )
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');

    const old = await f.prisma.generatedReportCard.findFirstOrThrow({
      where: { studentId: f.ids.studentA, version: 1 },
    });
    await http()
      .get(`/api/v1/report-cards/generated/${old.id}`)
      .set(as('parent-a'))
      .expect(404);
    await http()
      .get(`/api/v1/report-cards/generated/${cards.body[0].id}`)
      .set(as('parent-b'))
      .expect(403);

    await http()
      .delete(`/api/v1/result-publications?classId=${classA}&termId=${termA}`)
      .set(as('admin-a'))
      .expect(200);
    expect((await list('parent-a').expect(200)).body).toEqual([]);
    expect((await list('admin-a').expect(200)).body).toHaveLength(2);
  });

  it('only the class’s school admins generate; parents and teachers cannot', async () => {
    await http()
      .post('/api/v1/result-publications')
      .set(as('admin-a'))
      .send({ classId: classA, termId: termA })
      .expect(201);
    await generate('admin-b').expect(403);
    await generate('teacher-a').expect(403);
    await generate('parent-a').expect(403);
    await list('admin-b').expect(403);
  });
});
