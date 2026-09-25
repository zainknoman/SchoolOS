import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';

/**
 * BL-25 (Q15, M8): teaching-assignment history. Rows are written by DB triggers on
 * Section.classTeacherId and Timetable; a change end-dates the old row and opens a new one, an
 * unchanged re-save changes nothing, rows are immutable, and the report is school-scoped.
 */
describe('Teaching-assignment history (e2e, BL-25)', () => {
  let f: TwoSchools;
  let adminA: string;
  let teacher2: string;
  let math: string;
  const http = () => request(f.app.getHttpServer());

  beforeAll(async () => {
    f = await createTwoSchools('bl25');
    adminA = await f.login('admin-a');
    const user = await f.prisma.user.create({
      data: {
        identifier: 'bl25-teacher-a2',
        passwordHash: 'x',
        role: 'TEACHER',
        schoolId: f.ids.schoolA,
        campusId: f.ids.campusA,
      },
    });
    teacher2 = (
      await f.prisma.teacher.create({
        data: {
          userId: user.id,
          name: 'BL25 Second Teacher',
          campusId: f.ids.campusA,
        },
      })
    ).id;
    math = (
      await f.prisma.subject.create({
        data: { name: 'BL25 Maths', schoolId: f.ids.schoolA },
      })
    ).id;
  });

  afterAll(async () => {
    await f.prisma.timetable.deleteMany({
      where: { sectionId: f.ids.sectionA },
    });
    await f.close();
    await f.prisma.subject
      .deleteMany({ where: { name: 'BL25 Maths' } })
      .catch(() => undefined);
  });

  const rowsFor = () =>
    f.prisma.teachingAssignment.findMany({
      where: { sectionId: f.ids.sectionA },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

  it('creating a section with a class teacher opened a CLASS_TEACHER row', async () => {
    const rows = await rowsFor();
    expect(rows).toEqual([
      expect.objectContaining({
        role: 'CLASS_TEACHER',
        teacherName: 'BL25 Teacher A',
        sessionLabel: 'BL25 A',
        sectionName: 'BL25-A',
        startDateUnknown: false,
        endDate: null,
        schoolId: f.ids.schoolA,
      }),
    ]);
  });

  it('changing the class teacher end-dates the old row and opens a new one (nothing overwritten)', async () => {
    await http()
      .patch(`/api/v1/sections/${f.ids.sectionA}`)
      .set('Authorization', `Bearer ${adminA}`)
      .send({ classTeacherId: teacher2 })
      .expect(200);
    const rows = await rowsFor();
    expect(rows.map((r) => [r.teacherName, r.endDate === null])).toEqual([
      ['BL25 Teacher A', false],
      ['BL25 Second Teacher', true],
    ]);
  });

  it('a timetable save opens SUBJECT_TEACHER rows; saving it again unchanged changes nothing', async () => {
    const entries = [
      {
        subjectId: math,
        teacherId: teacher2,
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
      },
      {
        subjectId: math,
        teacherId: teacher2,
        dayOfWeek: 2,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
      },
    ];
    const save = () =>
      http()
        .put(`/api/v1/sections/${f.ids.sectionA}/timetable`)
        .set('Authorization', `Bearer ${adminA}`)
        .send({ entries })
        .expect(200);
    await save();
    const first = await rowsFor();
    expect(first.filter((r) => r.role === 'SUBJECT_TEACHER')).toEqual([
      expect.objectContaining({
        teacherId: teacher2,
        subjectId: math,
        subjectName: 'BL25 Maths',
        endDate: null,
      }),
    ]);
    await save();
    expect(await rowsFor()).toEqual(first);
  });

  it('"who taught Maths in session A": the report, scoped to the school', async () => {
    const res = await http()
      .get(
        `/api/v1/teaching-assignments?academicSessionId=${f.ids.sessionA}&subjectId=${math}`,
      )
      .set('Authorization', `Bearer ${adminA}`)
      .expect(200);
    expect(res.body).toEqual([
      expect.objectContaining({
        role: 'SUBJECT_TEACHER',
        teacherName: 'BL25 Second Teacher',
        className: 'BL25 Grade A',
      }),
    ]);

    const current = await http()
      .get(
        `/api/v1/teaching-assignments?sectionId=${f.ids.sectionA}&role=CLASS_TEACHER&current=true`,
      )
      .set('Authorization', `Bearer ${adminA}`)
      .expect(200);
    expect(
      current.body.map((r: { teacherName: string }) => r.teacherName),
    ).toEqual(['BL25 Second Teacher']);

    const adminB = await f.login('admin-b');
    const other = await http()
      .get(`/api/v1/teaching-assignments?sectionId=${f.ids.sectionA}`)
      .set('Authorization', `Bearer ${adminB}`)
      .expect(200);
    expect(other.body).toEqual([]);

    await http()
      .get('/api/v1/teaching-assignments?role=NOPE')
      .set('Authorization', `Bearer ${adminA}`)
      .expect(400);
  });

  it('history rows cannot be rewritten', async () => {
    await expect(
      f.prisma.teachingAssignment.updateMany({
        where: { sectionId: f.ids.sectionA },
        data: { teacherName: 'rewritten' },
      }),
    ).rejects.toThrow(/cannot be modified/);
  });
});
