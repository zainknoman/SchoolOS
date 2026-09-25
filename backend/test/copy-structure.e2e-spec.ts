import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/** BL-33: rollover of a session's structure — new-session records only, idempotent, audited. */
describe('Copy session structure (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let target: string;

  /** Everything in the source session, as comparable text. */
  async function sourceSnapshot() {
    const [terms, classes, sections, categories, timetables] =
      await Promise.all([
        f.prisma.term.findMany({
          where: { academicSessionId: f.ids.sessionA },
          orderBy: { id: 'asc' },
        }),
        f.prisma.class.findMany({
          where: { academicSessionId: f.ids.sessionA },
          orderBy: { id: 'asc' },
        }),
        f.prisma.section.findMany({
          where: { class: { academicSessionId: f.ids.sessionA } },
          orderBy: { id: 'asc' },
        }),
        f.prisma.assessmentCategory.findMany({
          where: { class: { academicSessionId: f.ids.sessionA } },
          orderBy: { id: 'asc' },
        }),
        f.prisma.timetable.findMany({
          where: { section: { class: { academicSessionId: f.ids.sessionA } } },
          orderBy: { id: 'asc' },
        }),
      ]);
    return JSON.stringify({ terms, classes, sections, categories, timetables });
  }

  beforeAll(async () => {
    f = await createTwoSchools('bl33');
    for (const who of ['super', 'admin-a', 'admin-b'])
      tokens[who] = await f.login(who);
    // Source (school A, current session): a term, a category and a timetable slot.
    const klass = await f.prisma.class.findFirstOrThrow({
      where: { academicSessionId: f.ids.sessionA },
    });
    const term = await f.prisma.term.create({
      data: {
        academicSessionId: f.ids.sessionA,
        label: 'Term 1',
        order: 1,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
      },
    });
    await f.prisma.assessmentCategory.create({
      data: {
        classId: klass.id,
        termId: term.id,
        name: 'Quizzes',
        weightPercent: 20,
      },
    });
    const subject = await f.prisma.subject.create({
      data: { name: 'BL33 Maths', schoolId: f.ids.schoolA },
    });
    const teacher = await f.prisma.teacher.findFirstOrThrow({
      where: { user: { identifier: 'bl33-teacher-a' } },
    });
    await f.prisma.timetable.create({
      data: {
        sectionId: f.ids.sectionA,
        subjectId: subject.id,
        teacherId: teacher.id,
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        room: 'R1',
      },
    });
    const next = await f.prisma.academicSession.create({
      data: {
        schoolId: f.ids.schoolA,
        label: 'BL33 A next',
        startDate: new Date('2027-01-01'),
        endDate: new Date('2027-12-31'),
        isActive: false,
      },
    });
    target = next.id;
  });
  afterAll(async () => {
    await f.prisma.timetable.deleteMany({
      where: { section: { class: { campus: { schoolId: f.ids.schoolA } } } },
    });
    await f.prisma.subject.deleteMany({ where: { schoolId: f.ids.schoolA } });
    await f.prisma.academicSession.deleteMany({ where: { id: target } });
    await f.close();
  });

  it('a school admin copies classes, sections, terms, categories and the timetable; the source is untouched', async () => {
    const before = await sourceSnapshot();
    const res = await http()
      .post(`/api/v1/academic-sessions/${target}/copy-structure`)
      .set(as('admin-a'))
      .send({ sourceSessionId: f.ids.sessionA })
      .expect(201);
    expect(res.body).toEqual({
      classesCreated: 1,
      sectionsCreated: 2,
      termsCreated: 1,
      assessmentCategoriesCreated: 1,
      timetableEntriesCreated: 1,
      timetableEntriesSkipped: 0,
    });
    expect(await sourceSnapshot()).toBe(before);

    const term = await f.prisma.term.findFirstOrThrow({
      where: { academicSessionId: target },
    });
    expect(term.startDate.toISOString().slice(0, 10)).toBe('2027-01-01'); // shifted by one year
    const audit = await f.prisma.auditLog.findFirst({
      where: { action: 'academic-session.copy-structure', entityId: target },
    });
    expect(audit).not.toBeNull();
  });

  it('is idempotent: a second run creates nothing', async () => {
    const res = await http()
      .post(`/api/v1/academic-sessions/${target}/copy-structure`)
      .set(as('admin-a'))
      .send({ sourceSessionId: f.ids.sessionA })
      .expect(201);
    expect(res.body).toMatchObject({
      classesCreated: 0,
      sectionsCreated: 0,
      termsCreated: 0,
      assessmentCategoriesCreated: 0,
      timetableEntriesCreated: 0,
    });
  });

  it("another school's admin cannot copy into this school's session; schools never mix", async () => {
    await http()
      .post(`/api/v1/academic-sessions/${target}/copy-structure`)
      .set(as('admin-b'))
      .send({ sourceSessionId: f.ids.sessionA })
      .expect(403);
    await http()
      .post(`/api/v1/academic-sessions/${target}/copy-structure`)
      .set(as('super'))
      .send({ sourceSessionId: f.ids.sessionB })
      .expect(400);
  });
});
