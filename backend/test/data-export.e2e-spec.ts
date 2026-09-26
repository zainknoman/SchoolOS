import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';

const BOM = String.fromCharCode(0xfeff);

/**
 * BL-41 (Q7, Q22): controlled data export — one school only, every export audited, sensitive
 * columns (national identifiers, medical) left out unless requested by the principal or SUPER_ADMIN.
 */
describe('Data export (e2e, BL-41)', () => {
  let f: TwoSchools;
  let adminA: string;
  let superAdmin: string;
  let teacherA: string;
  let adminAUserId: string;
  let subjectId: string;
  const http = () => request(f.app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  const lines = (text: string) =>
    text
      .slice(text.startsWith(BOM) ? 1 : 0)
      .trimEnd()
      .split('\r\n');
  const csv = (res: request.Response) => lines(res.text);

  beforeAll(async () => {
    f = await createTwoSchools('bl41');
    [adminA, superAdmin, teacherA] = await Promise.all([
      f.login('admin-a'),
      f.login('super'),
      f.login('teacher-a'),
    ]);
    adminAUserId = (
      await f.prisma.user.findUniqueOrThrow({
        where: { identifier: 'bl41-admin-a' },
      })
    ).id;

    await f.prisma.student.update({
      where: { id: f.ids.studentA },
      data: {
        bFormNumber: 'BL41-BFORM-A1',
        medicalInfo: { create: { allergies: 'Peanuts' } },
      },
    });
    await f.prisma.parentProfile.update({
      where: { id: f.ids.parentShared },
      data: { cnic: 'BL41-CNIC-SHARED' },
    });

    // Attendance: one row inside A1's enrolment, one before it started (another school's past).
    await f.prisma.attendance.createMany({
      data: [
        {
          studentId: f.ids.studentA,
          date: new Date('2026-03-02'),
          status: 'PRESENT',
        },
        {
          studentId: f.ids.studentA,
          date: new Date('2025-11-03'),
          status: 'ABSENT',
        },
        {
          studentId: f.ids.studentB,
          date: new Date('2026-03-02'),
          status: 'PRESENT',
        },
      ],
    });

    // Fees: one voucher per school.
    for (const [studentId, sessionId] of [
      [f.ids.studentA, f.ids.sessionA],
      [f.ids.studentB, f.ids.sessionB],
    ]) {
      await f.prisma.feeVoucher.create({
        data: {
          studentId,
          academicSessionId: sessionId,
          month: '2026-03',
          issueDate: new Date('2026-03-01'),
          dueDate: new Date('2026-03-10'),
          items: { create: [{ label: 'Tuition', amount: 500000 }] },
        },
      });
    }

    // Results: one mark in school A.
    const klass = await f.prisma.class.findFirstOrThrow({
      where: { sections: { some: { id: f.ids.sectionA } } },
    });
    const term = await f.prisma.term.create({
      data: {
        academicSessionId: f.ids.sessionA,
        label: 'BL41 Term 1',
        order: 1,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-06-30'),
      },
    });
    subjectId = (
      await f.prisma.subject.create({
        data: { name: 'BL41 Maths', schoolId: f.ids.schoolA },
      })
    ).id;
    await f.prisma.assessmentCategory.create({
      data: {
        classId: klass.id,
        termId: term.id,
        name: 'Quizzes',
        weightPercent: 100,
        assessments: {
          create: {
            subjectId,
            label: 'Quiz 1',
            maxMarks: 10,
            marks: {
              create: {
                studentId: f.ids.studentA,
                obtainedMarks: 8,
                enteredById: adminAUserId,
              },
            },
          },
        },
      },
    });
  });

  afterAll(async () => {
    await f.prisma.feeVoucher.deleteMany({
      where: { student: { grNumber: { startsWith: 'BL41-' } } },
    });
    await f.prisma.assessmentCategory.deleteMany({
      where: { term: { label: 'BL41 Term 1' } },
    });
    await f.prisma.term.deleteMany({ where: { label: 'BL41 Term 1' } });
    await f.prisma.subject.deleteMany({ where: { id: subjectId } });
    await f.prisma.parentProfile.update({
      where: { id: f.ids.parentShared },
      data: { cnic: null },
    });
    await f.close();
  });

  it('students: only the caller’s school, sensitive columns left out, audited', async () => {
    const res = await http()
      .get('/api/v1/admin/exports/students')
      .set(auth(adminA))
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="students-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const [header, ...rows] = csv(res);
    expect(header).not.toMatch(/bFormNumber|religion|allergies/);
    expect(res.text).not.toContain('BL41-BFORM-A1');
    expect(rows.map((r) => r.split(',')[1]).sort()).toEqual([
      'BL41-A1',
      'BL41-A2',
    ]);

    const audit = await f.prisma.auditLog.findFirstOrThrow({
      where: { userId: adminAUserId, action: 'data-export.students' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.entityId).toBe(f.ids.schoolA);
    expect(JSON.parse(audit.metadata!)).toMatchObject({
      includeSensitive: false,
      rowCount: 2,
    });
  });

  it('sensitive fields need the principal (or SUPER_ADMIN)', async () => {
    await http()
      .get('/api/v1/admin/exports/students?includeSensitive=true')
      .set(auth(adminA))
      .expect(403);

    await f.prisma.user.update({
      where: { id: adminAUserId },
      data: { isPrincipal: true },
    });
    try {
      const res = await http()
        .get('/api/v1/admin/exports/students?includeSensitive=true')
        .set(auth(adminA))
        .expect(200);
      expect(csv(res)[0]).toMatch(/bFormNumber.*allergies/);
      expect(res.text).toContain('BL41-BFORM-A1');
      expect(res.text).toContain('Peanuts');
      const audit = await f.prisma.auditLog.findFirstOrThrow({
        where: { userId: adminAUserId, action: 'data-export.students' },
        orderBy: { createdAt: 'desc' },
      });
      expect(JSON.parse(audit.metadata!).includeSensitive).toBe(true);
    } finally {
      await f.prisma.user.update({
        where: { id: adminAUserId },
        data: { isPrincipal: false },
      });
    }
  });

  it('another school, campus or session is refused', async () => {
    await http()
      .get(`/api/v1/admin/exports/students?schoolId=${f.ids.schoolB}`)
      .set(auth(adminA))
      .expect(403);
    await http()
      .get(`/api/v1/admin/exports/students?campusId=${f.ids.campusB}`)
      .set(auth(adminA))
      .expect(403);
    await http()
      .get(`/api/v1/admin/exports/fees?academicSessionId=${f.ids.sessionB}`)
      .set(auth(adminA))
      .expect(403);
  });

  it('SUPER_ADMIN must name one school and gets only that school', async () => {
    await http()
      .get('/api/v1/admin/exports/students')
      .set(auth(superAdmin))
      .expect(400);
    const res = await http()
      .get(
        `/api/v1/admin/exports/guardians?schoolId=${f.ids.schoolB}&includeSensitive=true`,
      )
      .set(auth(superAdmin))
      .expect(200);
    const rows = csv(res).slice(1);
    expect(rows.every((r) => r.startsWith('BL41-B1,'))).toBe(true);
    expect(res.text).toContain('BL41-CNIC-SHARED');
  });

  it('guardians: a shared guardian appears only against this school’s student, CNIC hidden', async () => {
    const res = await http()
      .get('/api/v1/admin/exports/guardians')
      .set(auth(adminA))
      .expect(200);
    const [header, ...rows] = csv(res);
    expect(header).not.toContain('cnic');
    expect(res.text).not.toContain('BL41-CNIC-SHARED');
    expect(res.text).not.toContain('BL41-B1');
    const shared = rows.filter((r) => r.includes('BL41 Parent shared'));
    expect(shared).toHaveLength(1);
    expect(shared[0].startsWith('BL41-A1,')).toBe(true);
  });

  it('attendance: only rows inside an in-scope enrolment, date window honoured', async () => {
    const res = await http()
      .get('/api/v1/admin/exports/attendance')
      .set(auth(adminA))
      .expect(200);
    expect(csv(res).slice(1)).toEqual([
      '2026-03-02,BL41-A1,BL41 Student A1,BL41 Grade A,BL41-A,PRESENT',
    ]);
    const none = await http()
      .get('/api/v1/admin/exports/attendance?from=2026-04-01&to=2026-04-30')
      .set(auth(adminA))
      .expect(200);
    expect(csv(none)).toHaveLength(1);
    await http()
      .get('/api/v1/admin/exports/attendance?from=2026-05-01&to=2026-04-01')
      .set(auth(adminA))
      .expect(400);
  });

  it('fees, results and enrolments stay inside the school', async () => {
    const fees = await http()
      .get('/api/v1/admin/exports/fees')
      .set(auth(adminA))
      .expect(200);
    const feeRows = csv(fees).slice(1);
    expect(feeRows).toHaveLength(1);
    expect(feeRows[0]).toContain('BL41-A1');
    expect(feeRows[0]).toMatch(/,500000,0,500000$/);

    const results = await http()
      .get('/api/v1/admin/exports/results')
      .set(auth(adminA))
      .expect(200);
    expect(csv(results).slice(1)).toEqual([
      'BL41-A1,BL41 Student A1,BL41 A,BL41 Grade A,BL41 Term 1,BL41 Maths,Quizzes,Quiz 1,10,8',
    ]);

    const enrolments = await http()
      .get('/api/v1/admin/exports/enrolments')
      .set(auth(adminA))
      .expect(200);
    expect(csv(enrolments).slice(1)).toHaveLength(2);
    expect(enrolments.text).not.toContain('BL41-B1');
  });

  it('teachers cannot export; unknown datasets are rejected', async () => {
    await http()
      .get('/api/v1/admin/exports/students')
      .set(auth(teacherA))
      .expect(403);
    await http()
      .get('/api/v1/admin/exports/passwords')
      .set(auth(adminA))
      .expect(400);
    const list = await http()
      .get('/api/v1/admin/exports')
      .set(auth(adminA))
      .expect(200);
    expect(list.body.datasets).toContain('students');
  });
});
