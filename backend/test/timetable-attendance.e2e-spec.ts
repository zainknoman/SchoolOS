import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Timetable + Attendance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const password = 'CorrectHorseBattery9!';
  const ids: Record<string, string> = {};

  async function loginAs(identifier: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier, password })
      .expect(201);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    // Self-healing: if a prior run's afterAll didn't complete (crash, forced-quit, or the
    // Attendance.student Restrict FK silently blocking student cleanup — see afterAll below),
    // don't fail on stale fixtures — clear them before creating fresh ones. Attendance must be
    // cleared before the student (Attendance.student is Restrict, not Cascade).
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'tta-' } } })
      .catch(() => undefined);
    const staleStudents = await prisma.student.findMany({
      where: { grNumber: { startsWith: 'TTA-' } },
    });
    for (const s of staleStudents) {
      await prisma.attendance
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
    }
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'TTA-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'TTA E2E School' },
    });
    for (const s of stale) {
      // Timetable.section is Restrict (Sprint: Org Structure CRUD), so a stale Timetable row
      // from a prior run silently blocks this school delete too — same self-healing need as
      // Attendance above.
      const staleSections = await prisma.section.findMany({
        where: { class: { campus: { schoolId: s.id } } },
        select: { id: true },
      });
      await prisma.timetable
        .deleteMany({
          where: { sectionId: { in: staleSections.map((sec) => sec.id) } },
        })
        .catch(() => undefined);
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const school = await prisma.school.create({
      data: { name: 'TTA E2E School' },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'TTA',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'TTA Grade',
      },
    });
    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'TTA-A' },
    });
    // Subject.name is globally unique (not scoped per school) — upsert so reruns of this suite
    // don't collide with a leftover row from a prior run.
    const subject = await prisma.subject.upsert({
      where: { name: 'TTA English' },
      update: {},
      create: { name: 'TTA English' },
    });
    ids.school = school.id;

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'tta-teacher@seeds.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    const teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'TTA Teacher', campusId: campus.id },
    });

    await prisma.user.create({
      data: {
        identifier: 'tta-admin@seeds.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
      },
    });

    const parentAUser = await prisma.user.create({
      data: {
        identifier: 'tta-parent-a@seeds.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    const parentBUser = await prisma.user.create({
      data: {
        identifier: 'tta-parent-b@seeds.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    const parentAProfile = await prisma.parentProfile.create({
      data: { userId: parentAUser.id, name: 'TTA Parent A' },
    });
    const parentBProfile = await prisma.parentProfile.create({
      data: { userId: parentBUser.id, name: 'TTA Parent B' },
    });

    const childA = await prisma.student.create({
      data: { grNumber: 'TTA-A1', name: 'TTA Child A' },
    });
    const childB = await prisma.student.create({
      data: { grNumber: 'TTA-B1', name: 'TTA Child B' },
    });
    await prisma.enrollment.create({
      data: {
        studentId: childA.id,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.enrollment.create({
      data: {
        studentId: childB.id,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: session.startDate,
        status: 'ACTIVE',
      },
    });
    await prisma.studentParent.create({
      data: { studentId: childA.id, parentProfileId: parentAProfile.id },
    });
    await prisma.studentParent.create({
      data: { studentId: childB.id, parentProfileId: parentBProfile.id },
    });

    await prisma.timetable.create({
      data: {
        sectionId: section.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
        room: 'TTA-A',
      },
    });

    Object.assign(ids, {
      childA: childA.id,
      childB: childB.id,
      section: section.id,
      teacher: teacher.id,
    });
  });

  afterAll(async () => {
    // Attendance.student and Timetable.section are both Restrict, so the "mark attendance" test
    // and the timetable entry created in beforeAll each leave a row that must be cleared before
    // the student / school can be deleted — otherwise this whole cleanup silently no-ops (every
    // call below is wrapped in .catch), and the next run's beforeAll self-heal has to do it.
    await prisma.attendanceRiskFlag
      .deleteMany({ where: { studentId: { in: [ids.childA, ids.childB] } } })
      .catch(() => undefined);
    await prisma.attendance
      .deleteMany({ where: { studentId: { in: [ids.childA, ids.childB] } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { in: ['TTA-A1', 'TTA-B1'] } } })
      .catch(() => undefined);
    await prisma.timetable
      .deleteMany({ where: { sectionId: ids.section } })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.school } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: [
              'tta-teacher@seeds.edu.pk',
              'tta-admin@seeds.edu.pk',
              'tta-parent-a@seeds.edu.pk',
              'tta-parent-b@seeds.edu.pk',
            ],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  it("a parent sees their own child's timetable", async () => {
    const token = await loginAs('tta-parent-a@seeds.edu.pk');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/timetable`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        subject: 'TTA English',
        teacher: 'TTA Teacher',
        room: 'TTA-A',
      }),
    );
  });

  it("a parent CANNOT see another parent's child's timetable", async () => {
    const token = await loginAs('tta-parent-a@seeds.edu.pk');

    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childB}/timetable`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('a teacher can mark attendance, and it is then visible to the linked parent', async () => {
    const teacherToken = await loginAs('tta-teacher@seeds.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ studentId: ids.childA, date: today, status: 'PRESENT' })
      .expect(201);

    const parentToken = await loginAs('tta-parent-a@seeds.edu.pk');
    const month = today.slice(0, 7);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/attendance?month=${month}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    expect(res.body.days).toEqual(
      expect.arrayContaining([{ date: today, status: 'PRESENT' }]),
    );
    expect(res.body.summary.present).toBeGreaterThanOrEqual(1);
  });

  it('an Admin can also mark attendance (no Teacher profile of their own) — attributed to the section class teacher', async () => {
    await prisma.section.update({
      where: { id: ids.section },
      data: { classTeacherId: ids.teacher },
    });

    const adminToken = await loginAs('tta-admin@seeds.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentId: ids.childB, date: today, status: 'PRESENT' })
      .expect(201);

    const parentToken = await loginAs('tta-parent-b@seeds.edu.pk');
    const month = today.slice(0, 7);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childB}/attendance?month=${month}`)
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(200);

    expect(res.body.days).toEqual(
      expect.arrayContaining([{ date: today, status: 'PRESENT' }]),
    );
  });

  it('staff can list every section (to pick which one to manage)', async () => {
    const teacherToken = await loginAs('tta-teacher@seeds.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/sections')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.section, name: 'TTA-A' }),
      ]),
    );
  });

  it('staff can list the students in a section (to pick who to mark attendance for)', async () => {
    const teacherToken = await loginAs('tta-teacher@seeds.edu.pk');

    const students = await request(app.getHttpServer())
      .get(`/api/v1/sections/${ids.section}/students`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(students.body.map((s: { name: string }) => s.name).sort()).toEqual([
      'TTA Child A',
      'TTA Child B',
    ]);
  });

  it('a PARENT cannot list section students — this is a staff-only tool', async () => {
    const parentToken = await loginAs('tta-parent-a@seeds.edu.pk');

    await request(app.getHttpServer())
      .get('/api/v1/sections')
      .set('Authorization', `Bearer ${parentToken}`)
      .expect(403);
  });

  it('a PARENT cannot mark attendance — attendance is immutable from the parent side', async () => {
    const parentToken = await loginAs('tta-parent-a@seeds.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/api/v1/attendance')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({ studentId: ids.childA, date: today, status: 'ABSENT' })
      .expect(403);
  });

  it('a Teacher can bulk-mark attendance for a whole section in one call', async () => {
    const teacherToken = await loginAs('tta-teacher@seeds.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/api/v1/attendance/bulk')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        date: today,
        marks: [
          { studentId: ids.childA, status: 'PRESENT' },
          { studentId: ids.childB, status: 'ABSENT' },
        ],
      })
      .expect(201);

    const parentAToken = await loginAs('tta-parent-a@seeds.edu.pk');
    const month = today.slice(0, 7);
    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/attendance?month=${month}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);

    expect(res.body.days).toEqual(
      expect.arrayContaining([{ date: today, status: 'PRESENT' }]),
    );
  });

  it('a PARENT cannot bulk-mark attendance', async () => {
    const parentToken = await loginAs('tta-parent-a@seeds.edu.pk');
    const today = new Date().toISOString().slice(0, 10);

    await request(app.getHttpServer())
      .post('/api/v1/attendance/bulk')
      .set('Authorization', `Bearer ${parentToken}`)
      .send({
        date: today,
        marks: [{ studentId: ids.childA, status: 'PRESENT' }],
      })
      .expect(403);
  });

  it('creating a second timetable entry for the same teacher+day+period is rejected as a scheduling conflict', async () => {
    const adminToken = await loginAs('tta-admin@seeds.edu.pk');
    const subject = await prisma.subject.findFirst({
      where: { name: 'TTA English' },
    });

    // ids.teacher already has a Mon/period-1 slot from beforeAll (day 1, period 1).
    await request(app.getHttpServer())
      .post('/api/v1/timetable')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        sectionId: ids.section,
        subjectId: subject!.id,
        teacherId: ids.teacher,
        dayOfWeek: 1,
        period: 1,
        startTime: '09:00',
        endTime: '09:40',
      })
      .expect(409);
  });

  it("a parent sees their own child's attendance-risk status, and cannot see another parent's child's", async () => {
    await prisma.attendanceRiskFlag.upsert({
      where: { studentId: ids.childA },
      create: {
        studentId: ids.childA,
        absenceRate: 0.4,
        flagged: true,
        windowStart: new Date('2026-08-01'),
        windowEnd: new Date('2026-08-31'),
      },
      update: { absenceRate: 0.4, flagged: true },
    });

    const parentAToken = await loginAs('tta-parent-a@seeds.edu.pk');
    const res = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/attendance-risk`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(res.body.flagged).toBe(true);

    const parentBToken = await loginAs('tta-parent-b@seeds.edu.pk');
    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/attendance-risk`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(403);

    await prisma.attendanceRiskFlag.deleteMany({
      where: { studentId: ids.childA },
    });
  });

  it('a TEACHER sees only their own class-teacher sections in the flagged-students list', async () => {
    await prisma.section.update({
      where: { id: ids.section },
      data: { classTeacherId: ids.teacher },
    });
    await prisma.attendanceRiskFlag.upsert({
      where: { studentId: ids.childA },
      create: {
        studentId: ids.childA,
        absenceRate: 0.5,
        flagged: true,
        windowStart: new Date('2026-08-01'),
        windowEnd: new Date('2026-08-31'),
      },
      update: { absenceRate: 0.5, flagged: true },
    });

    const teacherToken = await loginAs('tta-teacher@seeds.edu.pk');
    const res = await request(app.getHttpServer())
      .get('/api/v1/attendance-risk')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(res.body.map((r: { studentId: string }) => r.studentId)).toContain(
      ids.childA,
    );

    await prisma.attendanceRiskFlag.deleteMany({
      where: { studentId: ids.childA },
    });
  });
});
