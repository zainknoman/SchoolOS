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
      .deleteMany({
        where: { identifier: { startsWith: 'os-' } },
      })
      .catch(() => undefined);

    const staleSchools = await prisma.school.findMany({
      where: {
        name: {
          in: [
            'OS E2E School',
            'OS E2E School 2',
            'OS E2E Uniqueness School 1',
            'OS E2E Uniqueness School 2',
            'OS Extended School',
            'OS Default Status School',
            'OS Duplicate Campus Code School',
            'OS Preserve School',
            'OS Departments School',
          ],
        },
      },
    });

    for (const school of staleSchools) {
      await prisma.school
        .delete({ where: { id: school.id } })
        .catch(() => undefined);
    }

    const passwordHash = await argon2.hash(password);

    const superAdminUser = await prisma.user.create({
      data: {
        identifier: 'os-super-admin@schoolos.edu.pk',
        passwordHash,
        role: 'SUPER_ADMIN',
      },
    });

    const schoolAdminUser = await prisma.user.create({
      data: {
        identifier: 'os-school-admin@schoolos.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
      },
    });

    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'os-teacher@schoolos.edu.pk',
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
    if (ids.section) {
      await prisma.section
        .delete({ where: { id: ids.section } })
        .catch(() => undefined);
    }

    if (ids.class) {
      await prisma.class
        .delete({ where: { id: ids.class } })
        .catch(() => undefined);
    }

    if (ids.academicSession) {
      await prisma.academicSession
        .delete({ where: { id: ids.academicSession } })
        .catch(() => undefined);
    }

    if (ids.campus) {
      await prisma.campus
        .delete({ where: { id: ids.campus } })
        .catch(() => undefined);
    }

    if (ids.school) {
      await prisma.school
        .delete({ where: { id: ids.school } })
        .catch(() => undefined);
    }

    // Deleting each School cascades away its Campuses (Campus.school is onDelete: Cascade),
    // so the paired Campus ids created alongside these Schools need no separate delete call.
    for (const key of [
      'extendedSchool',
      'defaultStatusSchool',
      'uniqueSchoolOne',
      'uniqueSchoolTwo',
      'duplicateCodeSchool',
      'preserveSchool',
      'departmentsSchool',
    ]) {
      if (ids[key]) {
        await prisma.school
          .delete({ where: { id: ids[key] } })
          .catch(() => undefined);
      }
    }

    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: [
              'os-super-admin@schoolos.edu.pk',
              'os-school-admin@schoolos.edu.pk',
              'os-teacher@schoolos.edu.pk',
            ],
          },
        },
      })
      .catch(() => undefined);

    await app.close();
  });

  it('a SCHOOL_ADMIN (not SUPER_ADMIN) is blocked from every write route in this plan', async () => {
    const schoolAdminToken = await loginAs('os-school-admin@schoolos.edu.pk');

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
      .send({
        campusId: 'x',
        academicSessionId: 'x',
        name: 'Blocked Class',
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/sections')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .send({
        classId: 'x',
        name: 'Blocked Section',
      })
      .expect(403);
  });

  it('a SCHOOL_ADMIN can read the academic sessions list (write routes stay blocked)', async () => {
    const schoolAdminToken = await loginAs('os-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a TEACHER can read the academic sessions list (needed to pick a session for report card uploads)', async () => {
    const teacherToken = await loginAs('os-teacher@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a SCHOOL_ADMIN can read the classes list (needed by the gradebook class picker; write routes stay blocked)', async () => {
    const schoolAdminToken = await loginAs('os-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${schoolAdminToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a TEACHER can read the classes list (needed by the marks-entry class picker)', async () => {
    const teacherToken = await loginAs('os-teacher@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .get('/api/v1/classes')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('a SUPER_ADMIN can create the full School -> Campus -> AcademicSession/Class -> Section chain', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

    const school = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'OS E2E School',
        address: '1 School Rd',
        phone: '021-000',
        email: 'os@schoolos.edu.pk',
      })
      .expect(201);

    ids.school = school.body.id;

    expect(school.body.address).toBe('1 School Rd');
    expect(school.body.campusCount).toBe(0);
    expect(school.body.studentCount).toBe(0);
    expect(school.body.staffCount).toBe(0);

    await prisma.user.update({
      where: { id: ids.schoolAdminUser },
      data: { schoolId: ids.school },
    });

    const campus = await request(app.getHttpServer())
      .post('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        schoolId: ids.school,
        name: 'OS Campus',
        address: '2 Campus Rd',
        phone: '021-111',
        email: 'campus@schoolos.edu.pk',
      })
      .expect(201);

    ids.campus = campus.body.id;

    expect(campus.body.schoolName).toBe('OS E2E School');
    expect(campus.body.address).toBe('2 Campus Rd');
    expect(campus.body.studentCount).toBe(0);
    expect(campus.body.staffCount).toBe(0);

    const schoolAfterCampus = await request(app.getHttpServer())
      .get('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(
      schoolAfterCampus.body.find((s: { id: string }) => s.id === ids.school)
        .campusCount,
    ).toBe(1);

    const session = await request(app.getHttpServer())
      .post('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'OS Session',
        schoolId: ids.school,
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
      .send({
        classId: ids.class,
        name: 'OS-A',
      })
      .expect(201);

    ids.section = section.body.id;

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/sections/${ids.section}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'OS-A Renamed' })
      .expect(200);

    expect(updated.body.name).toBe('OS-A Renamed');
  });

  it('creates a School with every extended profile field and round-trips them through GET /schools', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

    const school = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'OS Extended School',
        code: 'OS-EXT-001',
        address: '100 Extended School Road',
        phone: '021-1000001',
        alternatePhone: '021-1000002',
        email: 'extended@schoolos.edu.pk',
        website: 'https://extended.schoolos.edu.pk',
        principalName: 'Ahmed Principal',
        principalPhone: '0300-1000001',
        principalEmail: 'principal.extended@schoolos.edu.pk',
        registrationNumber: 'REG-OS-001',
        establishedDate: '2010-04-15',
        schoolType: 'PRIVATE',
        educationBoard: 'Cambridge',
        timezone: 'Asia/Karachi',
        currency: 'PKR',
      })
      .expect(201);

    const schoolId = school.body.id;
    ids.extendedSchool = schoolId;

    expect(school.body.name).toBe('OS Extended School');
    expect(school.body.code).toBe('OS-EXT-001');
    expect(school.body.address).toBe('100 Extended School Road');
    expect(school.body.phone).toBe('021-1000001');
    expect(school.body.alternatePhone).toBe('021-1000002');
    expect(school.body.email).toBe('extended@schoolos.edu.pk');
    expect(school.body.website).toBe('https://extended.schoolos.edu.pk');
    expect(school.body.principalName).toBe('Ahmed Principal');
    expect(school.body.principalPhone).toBe('0300-1000001');
    expect(school.body.principalEmail).toBe(
      'principal.extended@schoolos.edu.pk',
    );
    expect(school.body.registrationNumber).toBe('REG-OS-001');
    expect(new Date(school.body.establishedDate).toISOString()).toBe(
      new Date('2010-04-15').toISOString(),
    );
    expect(school.body.schoolType).toBe('PRIVATE');
    expect(school.body.educationBoard).toBe('Cambridge');
    expect(school.body.timezone).toBe('Asia/Karachi');
    expect(school.body.currency).toBe('PKR');
    expect(school.body.logoFileId).toBeNull();
    expect(school.body.status).toBe('ACTIVE');

    const schools = await request(app.getHttpServer())
      .get('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const stored = schools.body.find(
      (item: { id: string }) => item.id === schoolId,
    );

    expect(stored).toBeDefined();
    expect(stored.name).toBe('OS Extended School');
    expect(stored.code).toBe('OS-EXT-001');
    expect(stored.address).toBe('100 Extended School Road');
    expect(stored.phone).toBe('021-1000001');
    expect(stored.alternatePhone).toBe('021-1000002');
    expect(stored.email).toBe('extended@schoolos.edu.pk');
    expect(stored.website).toBe('https://extended.schoolos.edu.pk');
    expect(stored.principalName).toBe('Ahmed Principal');
    expect(stored.principalPhone).toBe('0300-1000001');
    expect(stored.principalEmail).toBe('principal.extended@schoolos.edu.pk');
    expect(stored.registrationNumber).toBe('REG-OS-001');
    expect(new Date(stored.establishedDate).toISOString()).toBe(
      new Date('2010-04-15').toISOString(),
    );
    expect(stored.schoolType).toBe('PRIVATE');
    expect(stored.educationBoard).toBe('Cambridge');
    expect(stored.timezone).toBe('Asia/Karachi');
    expect(stored.currency).toBe('PKR');
    expect(stored.logoFileId).toBeNull();
    expect(stored.status).toBe('ACTIVE');
  });

  it('defaults a newly created School status to ACTIVE when status is omitted', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

    const school = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'OS Default Status School',
        code: 'OS-DEFAULT-STATUS',
      })
      .expect(201);

    ids.defaultStatusSchool = school.body.id;

    expect(school.body.status).toBe('ACTIVE');
  });

  it('allows the same Campus code under different Schools', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

    const schoolOne = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'OS E2E Uniqueness School 1',
        code: 'OS-UNIQUE-SCHOOL-1',
      })
      .expect(201);

    ids.uniqueSchoolOne = schoolOne.body.id;

    const schoolTwo = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'OS E2E Uniqueness School 2',
        code: 'OS-UNIQUE-SCHOOL-2',
      })
      .expect(201);

    ids.uniqueSchoolTwo = schoolTwo.body.id;

    const campusOne = await request(app.getHttpServer())
      .post('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        schoolId: ids.uniqueSchoolOne,
        name: 'OS Unique Campus One',
        code: 'SAME-CAMPUS-CODE',
      })
      .expect(201);

    const campusTwo = await request(app.getHttpServer())
      .post('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        schoolId: ids.uniqueSchoolTwo,
        name: 'OS Unique Campus Two',
        code: 'SAME-CAMPUS-CODE',
      })
      .expect(201);

    expect(campusOne.body.id).toBeDefined();
    expect(campusTwo.body.id).toBeDefined();
    expect(campusOne.body.id).not.toBe(campusTwo.body.id);

    ids.uniqueCampusOne = campusOne.body.id;
    ids.uniqueCampusTwo = campusTwo.body.id;
  });

  it('rejects duplicate Campus code within the same School', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

    const school = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'OS Duplicate Campus Code School',
        code: 'OS-DUP-CODE-SCHOOL',
      })
      .expect(201);

    ids.duplicateCodeSchool = school.body.id;

    await request(app.getHttpServer())
      .post('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        schoolId: ids.duplicateCodeSchool,
        name: 'OS Duplicate Campus One',
        code: 'DUPLICATE-CAMPUS-CODE',
      })
      .expect(201);

    const duplicateResponse = await request(app.getHttpServer())
      .post('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        schoolId: ids.duplicateCodeSchool,
        name: 'OS Duplicate Campus Two',
        code: 'DUPLICATE-CAMPUS-CODE',
      });

    expect([400, 409]).toContain(duplicateResponse.status);
  });

  it('updates only the requested School field and preserves all other extended fields', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

    const school = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'OS Preserve School',
        code: 'OS-PRESERVE-001',
        address: '200 Preserve Road',
        phone: '021-2000001',
        alternatePhone: '021-2000002',
        email: 'preserve@schoolos.edu.pk',
        website: 'https://preserve.schoolos.edu.pk',
        principalName: 'Preserve Principal',
        principalPhone: '0300-2000001',
        principalEmail: 'preserve.principal@schoolos.edu.pk',
        registrationNumber: 'REG-PRESERVE-001',
        establishedDate: '2012-05-20',
        schoolType: 'PRIVATE',
        educationBoard: 'Federal',
        timezone: 'Asia/Karachi',
        currency: 'PKR',
        status: 'INACTIVE',
      })
      .expect(201);

    ids.preserveSchool = school.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/schools/${ids.preserveSchool}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' })
      .expect(200);

    const schools = await request(app.getHttpServer())
      .get('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const stored = schools.body.find(
      (item: { id: string }) => item.id === ids.preserveSchool,
    );

    expect(stored).toBeDefined();
    expect(stored.name).toBe('New Name');
    expect(stored.code).toBe('OS-PRESERVE-001');
    expect(stored.address).toBe('200 Preserve Road');
    expect(stored.phone).toBe('021-2000001');
    expect(stored.alternatePhone).toBe('021-2000002');
    expect(stored.email).toBe('preserve@schoolos.edu.pk');
    expect(stored.website).toBe('https://preserve.schoolos.edu.pk');
    expect(stored.principalName).toBe('Preserve Principal');
    expect(stored.principalPhone).toBe('0300-2000001');
    expect(stored.principalEmail).toBe('preserve.principal@schoolos.edu.pk');
    expect(stored.registrationNumber).toBe('REG-PRESERVE-001');
    expect(new Date(stored.establishedDate).toISOString()).toBe(
      new Date('2012-05-20').toISOString(),
    );
    expect(stored.schoolType).toBe('PRIVATE');
    expect(stored.educationBoard).toBe('Federal');
    expect(stored.timezone).toBe('Asia/Karachi');
    expect(stored.currency).toBe('PKR');
    expect(stored.logoFileId).toBeNull();
    expect(stored.status).toBe('INACTIVE');
  });

  it('round-trips Campus departments through create, read and update', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

    const school = await request(app.getHttpServer())
      .post('/api/v1/schools')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'OS Departments School',
        code: 'OS-DEPARTMENTS-SCHOOL',
      })
      .expect(201);

    ids.departmentsSchool = school.body.id;

    const campus = await request(app.getHttpServer())
      .post('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        schoolId: ids.departmentsSchool,
        name: 'OS Departments Campus',
        code: 'OS-DEPARTMENTS-CAMPUS',
        campusType: 'MAIN',
        address: '300 Departments Road',
        phone: '021-3000001',
        alternatePhone: '021-3000002',
        email: 'departments@schoolos.edu.pk',
        principalName: 'Departments Principal',
        principalPhone: '0300-3000001',
        principalEmail: 'departments.principal@schoolos.edu.pk',
        latitude: 24.8607,
        longitude: 67.0011,
        capacity: 500,
        openingDate: '2018-08-01',
        departments: ['Science', 'Admin', 'IT'],
      })
      .expect(201);

    ids.departmentsCampus = campus.body.id;

    expect(campus.body.departments).toEqual(['Science', 'Admin', 'IT']);

    const campuses = await request(app.getHttpServer())
      .get('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const stored = campuses.body.find(
      (item: { id: string }) => item.id === ids.departmentsCampus,
    );

    expect(stored).toBeDefined();
    expect(stored.departments).toEqual(['Science', 'Admin', 'IT']);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/campuses/${ids.departmentsCampus}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        departments: ['Science', 'Admin', 'IT', 'Sports'],
      })
      .expect(200);

    expect(updated.body.departments).toEqual([
      'Science',
      'Admin',
      'IT',
      'Sports',
    ]);

    const campusesAfterUpdate = await request(app.getHttpServer())
      .get('/api/v1/campuses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const storedAfterUpdate = campusesAfterUpdate.body.find(
      (item: { id: string }) => item.id === ids.departmentsCampus,
    );

    expect(storedAfterUpdate).toBeDefined();
    expect(storedAfterUpdate.departments).toEqual([
      'Science',
      'Admin',
      'IT',
      'Sports',
    ]);
  });

  it('deleting a Section with a real Timetable row is blocked with a 400, then succeeds once the row is gone', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

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

    await prisma.timetable.delete({
      where: { id: timetableEntry.id },
    });

    await prisma.subject.delete({
      where: { id: subject.id },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/sections/${ids.section}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    ids.section = '';
  });

  it('creating a second active AcademicSession deactivates the first', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

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
        schoolId: ids.school,
        startDate: '2027-08-01',
        endDate: '2028-06-30',
        isActive: true,
      })
      .expect(201);

    const firstAfter = await prisma.academicSession.findUnique({
      where: { id: ids.academicSession },
    });

    expect(firstAfter?.isActive).toBe(false);

    await prisma.academicSession.delete({
      where: { id: second.body.id },
    });
  });

  it('refuses to leave zero active academic sessions, by deactivation or by deletion', async () => {
    const token = await loginAs('os-super-admin@schoolos.edu.pk');

    const session = await request(app.getHttpServer())
      .post('/api/v1/academic-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        label: 'OS Floor Session',
        schoolId: ids.school,
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

    await prisma.academicSession.delete({
      where: { id: session.body.id },
    });
  });
});
