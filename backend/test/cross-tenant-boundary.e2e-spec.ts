import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * This is Sprint L's headline new guarantee — a caller scoped to one `School` cannot reach a
 * student, campus, or admin-teacher-creation route belonging to another `School` — proven here
 * against two REAL `School` rows (not two Campuses under one School, which every other e2e
 * fixture in this codebase uses). Every other spec's tenant-comparison branch is only exercised
 * against hand-built unit-test mocks; this is the one place it runs against a real Prisma query
 * with two actual tenants.
 */
describe('Cross-tenant boundary (e2e)', () => {
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

    // Self-healing: if a prior run's afterAll didn't complete, clear stale fixtures before
    // creating fresh ones. Users first (Teacher.userId is Cascade, so this also removes stale
    // Teacher rows that would otherwise Restrict-block the Campus/School cascade below), then
    // Students (Enrollment.studentId is Cascade, removing stale Enrollment rows that would
    // otherwise Restrict-block Campus/Section deletion), then the Schools themselves.
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'ctb-' } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'CTB-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: { in: ['CTB School A', 'CTB School B'] } },
    });
    for (const s of stale) {
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const passwordHash = await argon2.hash(password);

    // --- School A: its own Campus/AcademicSession/Class/Section/Teacher ---
    const schoolA = await prisma.school.create({
      data: { name: 'CTB School A' },
    });
    const campusA = await prisma.campus.create({
      data: { schoolId: schoolA.id, name: 'CTB Campus A' },
    });
    const sessionA = await prisma.academicSession.create({
      data: {
        label: 'CTB A',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const classA = await prisma.class.create({
      data: {
        campusId: campusA.id,
        academicSessionId: sessionA.id,
        name: 'CTB Grade A',
      },
    });
    const sectionA = await prisma.section.create({
      data: { classId: classA.id, name: 'CTB-A' },
    });
    const teacherAUser = await prisma.user.create({
      data: {
        identifier: 'ctb-teacher-a@schoolos.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    await prisma.teacher.create({
      data: {
        userId: teacherAUser.id,
        name: 'CTB Teacher A',
        campusId: campusA.id,
      },
    });

    // --- School B: a fully separate tenant, its own Campus/AcademicSession/Class/Section/Teacher ---
    const schoolB = await prisma.school.create({
      data: { name: 'CTB School B' },
    });
    const campusB = await prisma.campus.create({
      data: { schoolId: schoolB.id, name: 'CTB Campus B' },
    });
    const sessionB = await prisma.academicSession.create({
      data: {
        label: 'CTB B',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const classB = await prisma.class.create({
      data: {
        campusId: campusB.id,
        academicSessionId: sessionB.id,
        name: 'CTB Grade B',
      },
    });
    const sectionB = await prisma.section.create({
      data: { classId: classB.id, name: 'CTB-B' },
    });
    const teacherBUser = await prisma.user.create({
      data: {
        identifier: 'ctb-teacher-b@schoolos.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    await prisma.teacher.create({
      data: {
        userId: teacherBUser.id,
        name: 'CTB Teacher B',
        campusId: campusB.id,
      },
    });

    // --- School A's staff: SCHOOL_ADMIN and ACCOUNTS, both scoped to School A ---
    const schoolAdminUser = await prisma.user.create({
      data: {
        identifier: 'ctb-school-admin@schoolos.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: schoolA.id,
      },
    });
    const accountsUser = await prisma.user.create({
      data: {
        identifier: 'ctb-accounts@schoolos.edu.pk',
        passwordHash,
        role: 'ACCOUNTS',
        schoolId: schoolA.id,
      },
    });

    // --- One student enrolled in each School ---
    const studentA = await prisma.student.create({
      data: { grNumber: 'CTB-A1', name: 'CTB Student A' },
    });
    await prisma.enrollment.create({
      data: {
        studentId: studentA.id,
        campusId: campusA.id,
        sectionId: sectionA.id,
        academicSessionId: sessionA.id,
        startDate: sessionA.startDate,
        status: 'ACTIVE',
      },
    });
    const studentB = await prisma.student.create({
      data: { grNumber: 'CTB-B1', name: 'CTB Student B' },
    });
    await prisma.enrollment.create({
      data: {
        studentId: studentB.id,
        campusId: campusB.id,
        sectionId: sectionB.id,
        academicSessionId: sessionB.id,
        startDate: sessionB.startDate,
        status: 'ACTIVE',
      },
    });

    Object.assign(ids, {
      schoolA: schoolA.id,
      schoolB: schoolB.id,
      campusA: campusA.id,
      campusB: campusB.id,
      studentA: studentA.id,
      studentB: studentB.id,
      schoolAdminUser: schoolAdminUser.id,
      accountsUser: accountsUser.id,
    });
  });

  afterAll(async () => {
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'ctb-' } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'CTB-' } } })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.schoolA } })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.schoolB } })
      .catch(() => undefined);
    await app.close();
  });

  it("a SCHOOL_ADMIN reads their own school's student attendance (200)", async () => {
    const token = await loginAs('ctb-school-admin@schoolos.edu.pk');

    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.studentA}/attendance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it("a SCHOOL_ADMIN is denied another school's student attendance (403) — the real cross-tenant proof", async () => {
    const token = await loginAs('ctb-school-admin@schoolos.edu.pk');

    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.studentB}/attendance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it("an ACCOUNTS user reads their own school's student attendance (200)", async () => {
    const token = await loginAs('ctb-accounts@schoolos.edu.pk');

    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.studentA}/attendance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it("an ACCOUNTS user is denied another school's student attendance (403)", async () => {
    const token = await loginAs('ctb-accounts@schoolos.edu.pk');

    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.studentB}/attendance`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it("GET /api/v1/campuses as a SCHOOL_ADMIN returns only their own school campus(es), never another tenant's", async () => {
    const token = await loginAs('ctb-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const returnedIds = (res.body as Array<{ id: string }>).map((c) => c.id);
    expect(returnedIds).toContain(ids.campusA);
    expect(returnedIds).not.toContain(ids.campusB);
  });

  it("a SCHOOL_ADMIN creating a teacher in another school's campus is rejected (403)", async () => {
    const token = await loginAs('ctb-school-admin@schoolos.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/admin/teachers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        identifier: 'ctb-cross-tenant-teacher@schoolos.edu.pk',
        password,
        name: 'Should Not Be Created',
        campusId: ids.campusB,
      })
      .expect(403);
  });
});
