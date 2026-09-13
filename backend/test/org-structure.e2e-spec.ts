import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Org Structure (e2e)', () => {
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

    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'os-' } } })
      .catch(() => undefined);
    const staleSchools = await prisma.school.findMany({
      where: { name: 'OS E2E School' },
    });
    for (const s of staleSchools) {
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const passwordHash = await argon2.hash(password);
    const superAdminUser = await prisma.user.create({
      data: {
        identifier: 'os-super-admin@seeds.edu.pk',
        passwordHash,
        role: 'SUPER_ADMIN',
      },
    });
    const schoolAdminUser = await prisma.user.create({
      data: {
        identifier: 'os-school-admin@seeds.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
      },
    });
    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'os-teacher@seeds.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });

    Object.assign(ids, {
      superAdminUser: superAdminUser.id,
      schoolAdminUser: schoolAdminUser.id,
      teacherUser: teacherUser.id,
    });
  });

  afterAll(async () => {
    if (ids.section)
      await prisma.section
        .delete({ where: { id: ids.section } })
        .catch(() => undefined);
    if (ids.class)
      await prisma.class
        .delete({ where: { id: ids.class } })
        .catch(() => undefined);
    if (ids.academicSession)
      await prisma.academicSession
        .delete({ where: { id: ids.academicSession } })
        .catch(() => undefined);
    if (ids.campus)
      await prisma.campus
        .delete({ where: { id: ids.campus } })
        .catch(() => undefined);
    if (ids.school)
      await prisma.school
        .delete({ where: { id: ids.school } })
        .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: ['os-super-admin@seeds.edu.pk', 'os-school-admin@seeds.edu.pk', 'os-teacher@seeds.edu.pk'],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  it('a SCHOOL_ADMIN (not SUPER_ADMIN) is blocked from every write route in this plan', async () => {
    const schoolAdminToken = await loginAs('os-school-admin@seeds.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({ name: 'Blocked School' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/campuses')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({ schoolId: 'x', name: 'Blocked Campus' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        label: 'x',
        startDate: '2026-08-01',
        endDate: '2027-06-30',
        isActive: false,
      })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({ campusId: 'x', academicSessionId: 'x', name: 'Blocked Class' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/sections')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({ classId: 'x', name: 'Blocked Section' })
      .expect(403);
  });

  it('a SCHOOL_ADMIN can read the academic sessions list (write routes stay blocked)', async () => {
    const schoolAdminToken = await loginAs('os-school-admin@seeds.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a TEACHER can read the academic sessions list (needed to pick a session for report card uploads)', async () => {
    const teacherToken = await loginAs('os-teacher@seeds.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a SCHOOL_ADMIN can read the classes list (needed by the gradebook class picker; write routes stay blocked)', async () => {
    const schoolAdminToken = await loginAs('os-school-admin@seeds.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a TEACHER can read the classes list (needed by the marks-entry class picker)', async () => {
    const teacherToken = await loginAs('os-teacher@seeds.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a SUPER_ADMIN can create the full School -> Campus -> AcademicSession/Class -> Section chain', async () => {
    const token = await loginAs('os-super-admin@seeds.edu.pk');

    const school = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'OS E2E School' })
      .expect(201);
    ids.school = school.body.id;
    // This file's SCHOOL_ADMIN fixture is created in beforeAll, before any School exists (this
    // very test is what creates one) — set its schoolId now, one-line ahead of upcoming route
    // wiring, same intent as the other e2e fixtures (see commit 3352755).
    await prisma.user.update({
      where: { id: ids.schoolAdminUser },
      data: { schoolId: ids.school },
    });

    const campus = await request(app.getHttpServer())
      .post('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .send({ schoolId: ids.school, name: 'OS Campus' })
      .expect(201);
    ids.campus = campus.body.id;
    expect(campus.body.schoolName).toBe('OS E2E School');

    const session = await request(app.getHttpServer())
      .post('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'OS Session',
        startDate: '2026-08-01',
        endDate: '2027-06-30',
        isActive: false,
      })
      .expect(201);
    ids.academicSession = session.body.id;

    const klass = await request(app.getHttpServer())
      .post('/api/v1/classes')
      .set('Authorization', `Bearer ${token}`)
      .send({
        campusId: ids.campus,
        academicSessionId: ids.academicSession,
        name: 'OS Class',
      })
      .expect(201);
    ids.class = klass.body.id;
    expect(klass.body.campusName).toBe('OS Campus');

    const section = await request(app.getHttpServer())
      .post('/api/v1/sections')
      .set('Authorization', `Bearer ${token}`)
      .send({ classId: ids.class, name: 'OS-A' })
      .expect(201);
    ids.section = section.body.id;

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/sections/${ids.section}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'OS-A Renamed' })
      .expect(200);
    expect(updated.body.name).toBe('OS-A Renamed');
  });

  it('deleting a Section with a real Timetable row is blocked with a 400, then succeeds once the row is gone', async () => {
    const token = await loginAs('os-super-admin@seeds.edu.pk');
    const subject = await prisma.subject.create({
      data: { name: 'OS Subject' },
    });
    const timetableEntry = await prisma.timetable.create({
      data: {
        sectionId: ids.section,
        subjectId: subject.id,
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
      },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/sections/${ids.section}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await prisma.timetable.delete({ where: { id: timetableEntry.id } });
    await prisma.subject.delete({ where: { id: subject.id } });

    await request(app.getHttpServer())
      .delete(`/api/v1/sections/${ids.section}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    ids.section = '';
  });

  it('creating a second active AcademicSession deactivates the first', async () => {
    const token = await loginAs('os-super-admin@seeds.edu.pk');

    await request(app.getHttpServer())
      .patch(`/api/v1/academic-sessions/${ids.academicSession}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: true })
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'OS Session 2',
        startDate: '2027-08-01',
        endDate: '2028-06-30',
        isActive: true,
      })
      .expect(201);

    const firstAfter = await prisma.academicSession.findUnique({
      where: { id: ids.academicSession },
    });
    expect(firstAfter?.isActive).toBe(false);

    await prisma.academicSession.delete({ where: { id: second.body.id } });
  });

  it('refuses to leave zero active academic sessions, by deactivation or by deletion', async () => {
    const token = await loginAs('os-super-admin@seeds.edu.pk');

    const session = await request(app.getHttpServer())
      .post('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'OS Floor Session',
        startDate: '2028-08-01',
        endDate: '2029-06-30',
        isActive: true,
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/academic-sessions/${session.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/api/v1/academic-sessions/${session.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);

    await prisma.academicSession.delete({ where: { id: session.body.id } });
  });
});
