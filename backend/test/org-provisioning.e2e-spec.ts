import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Everything this spec creates is prefixed so cleanup only ever touches its own rows:
// identifiers start with `prov-`, schools are named `PROV E2E ...`, the session label is `PROV E2E`.
const ID_PREFIX = 'prov-';
const SCHOOL_PREFIX = 'PROV E2E';
const SCHOOL_NAME = 'PROV E2E School';
const OTHER_SCHOOL_NAME = 'PROV E2E Other School';
const DUP_SCHOOL_NAME = 'PROV E2E Dup School';
const DUP_CAMPUS_NAME = 'PROV E2E Dup Campus';

const SUPER_ID = 'prov-super';
const SUPER_PASSWORD = 'SuperPass123!';
const ADMIN_ID = 'prov-admin@x.test';
const ADMIN_NEW_PASSWORD = 'AdminNewPass123!';
const NORTH_ID = 'prov-north@x.test';
const NORTH_PASSWORD = 'NorthPass123!';
const SOUTH_ID = 'prov-south@x.test';
const SOUTH_PASSWORD = 'SouthPass123!';
const TEACHER_PASSWORD = 'TeacherPass123!';

describe('Org provisioning and campus scoping (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  // State shared by the sequential scenarios below.
  const s: {
    superToken: string;
    schoolId: string;
    otherSchoolId: string;
    tempPassword: string;
    tempRefreshToken: string;
    adminToken: string;
    sessionId: string;
    northId: string;
    southId: string;
    northToken: string;
    southClassId: string;
    southSectionId: string;
    northClassId: string;
    northSectionId: string;
    northTeacherId: string;
    southTeacherId: string;
  } = {} as never;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  function login(identifier: string, password: string) {
    return http().post('/api/v1/auth/login').send({ identifier, password });
  }

  async function loginOk(identifier: string, password: string) {
    const res = await login(identifier, password).expect(201);
    return res.body as {
      accessToken: string;
      refreshToken: string;
      role: string;
      isPrincipal: boolean;
      mustChangePassword: boolean;
      campusId: string | null;
      schoolId: string | null;
    };
  }

  // Deletes only rows belonging to this spec, in FK-safe order (users hold Restrict FKs on
  // campus/school; sections reference teachers; classes reference campuses/sessions).
  async function cleanup() {
    const schools = await prisma.school.findMany({
      where: { name: { startsWith: SCHOOL_PREFIX } },
      select: { id: true },
    });
    const schoolIds = schools.map((x) => x.id);
    const campuses = await prisma.campus.findMany({
      where: { schoolId: { in: schoolIds } },
      select: { id: true },
    });
    const campusIds = campuses.map((x) => x.id);
    const classes = await prisma.class.findMany({
      where: { campusId: { in: campusIds } },
      select: { id: true },
    });
    const classIds = classes.map((x) => x.id);

    const superUsers = await prisma.user.findMany({
      where: { identifier: { startsWith: ID_PREFIX } },
      select: { id: true },
    });
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: { in: superUsers.map((u) => u.id) } },
          { entityId: { in: [...schoolIds, ...campusIds, ...classIds] } },
        ],
      },
    });

    await prisma.section.deleteMany({ where: { classId: { in: classIds } } });
    await prisma.class.deleteMany({ where: { id: { in: classIds } } });
    await prisma.teacher.deleteMany({ where: { campusId: { in: campusIds } } });
    await prisma.user.deleteMany({ where: { identifier: { startsWith: ID_PREFIX } } });
    await prisma.campus.deleteMany({ where: { id: { in: campusIds } } });
    await prisma.school.deleteMany({ where: { id: { in: schoolIds } } });
    await prisma.academicSession.deleteMany({ where: { label: SCHOOL_PREFIX } });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    // Same global pipe as src/main.ts: nested admin/principal DTO validation depends on it.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    await cleanup();

    await prisma.user.create({
      data: {
        identifier: SUPER_ID,
        passwordHash: await argon2.hash(SUPER_PASSWORD),
        role: 'SUPER_ADMIN',
      },
    });
    const session = await prisma.academicSession.create({
      data: { label: SCHOOL_PREFIX, startDate: new Date(), endDate: new Date(), isActive: false },
    });
    s.sessionId = session.id;
    const other = await prisma.school.create({ data: { name: OTHER_SCHOOL_NAME } });
    s.otherSchoolId = other.id;
    s.superToken = (await loginOk(SUPER_ID, SUPER_PASSWORD)).accessToken;
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('School provisioning', () => {
    it('a super admin creates a school with an admin login and gets a generated temporary password once', async () => {
      const res = await http()
        .post('/api/v1/schools')
        .set(auth(s.superToken))
        .send({ name: SCHOOL_NAME, admin: { identifier: ADMIN_ID } })
        .expect(201);
      s.schoolId = res.body.id;
      expect(res.body.provisionedLogin.identifier).toBe(ADMIN_ID);
      expect(typeof res.body.provisionedLogin.temporaryPassword).toBe('string');
      s.tempPassword = res.body.provisionedLogin.temporaryPassword;
    });

    it('does not write the generated password into any audit log row for that create', async () => {
      const rows = await prisma.auditLog.findMany({
        where: { OR: [{ entityId: s.schoolId }, { entity: 'User', entityId: s.schoolId }] },
      });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(JSON.stringify(row)).not.toContain(s.tempPassword);
      }
    });

    it('the provisioned admin logs in with mustChangePassword, isPrincipal, a schoolId and no campusId', async () => {
      const body = await loginOk(ADMIN_ID, s.tempPassword);
      s.tempRefreshToken = body.refreshToken;
      expect(body.mustChangePassword).toBe(true);
      expect(body.isPrincipal).toBe(true);
      expect(body.role).toBe('SCHOOL_ADMIN');
      expect(body.schoolId).toBe(s.schoolId);
      expect(body.campusId).toBeNull();
      s.adminToken = body.accessToken;
    });

    it('change-password issues a fresh session with mustChangePassword false', async () => {
      const res = await http()
        .post('/api/v1/auth/change-password')
        .set(auth(s.adminToken))
        .send({ currentPassword: s.tempPassword, newPassword: ADMIN_NEW_PASSWORD })
        .expect(201);
      expect(res.body.mustChangePassword).toBe(false);
      expect(res.body.isPrincipal).toBe(true);
      expect(res.body.schoolId).toBe(s.schoolId);
      expect(res.body.campusId).toBeNull();
      s.adminToken = res.body.accessToken;
    });

    it('after the change the temporary password stops working, the new one works and the old refresh token is rejected', async () => {
      await login(ADMIN_ID, s.tempPassword).expect(401);
      const fresh = await loginOk(ADMIN_ID, ADMIN_NEW_PASSWORD);
      expect(fresh.mustChangePassword).toBe(false);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: s.tempRefreshToken })
        .expect(401);
      s.adminToken = fresh.accessToken;
    });

    it('rejects a duplicate admin identifier with 400 and leaves no School row behind', async () => {
      await http()
        .post('/api/v1/schools')
        .set(auth(s.superToken))
        .send({ name: DUP_SCHOOL_NAME, admin: { identifier: ADMIN_ID } })
        .expect(400);
      expect(await prisma.school.count({ where: { name: DUP_SCHOOL_NAME } })).toBe(0);
    });
  });

  describe('Campus provisioning by the school admin', () => {
    it('the admin of a school with zero campuses creates its first campus with a supplied principal password (temporaryPassword null)', async () => {
      const before = await http().get('/api/v1/campuses').set(auth(s.adminToken)).expect(200);
      expect(before.body).toEqual([]);

      const res = await http()
        .post('/api/v1/campuses')
        .set(auth(s.adminToken))
        .send({
          schoolId: s.schoolId,
          name: 'North',
          principal: { identifier: NORTH_ID, password: NORTH_PASSWORD },
        })
        .expect(201);
      s.northId = res.body.id;
      expect(res.body.provisionedLogin).toEqual({ identifier: NORTH_ID, temporaryPassword: null });
    });

    it('creates a second campus, and a third whose generated temporary password is returned once and kept out of the audit log', async () => {
      const res = await http()
        .post('/api/v1/campuses')
        .set(auth(s.adminToken))
        .send({
          schoolId: s.schoolId,
          name: 'South',
          principal: { identifier: SOUTH_ID, password: SOUTH_PASSWORD },
        })
        .expect(201);
      s.southId = res.body.id;
      expect(res.body.provisionedLogin.temporaryPassword).toBeNull();

      // Generated-password branch: a third campus with no password supplied.
      const gen = await http()
        .post('/api/v1/campuses')
        .set(auth(s.adminToken))
        .send({
          schoolId: s.schoolId,
          name: 'East',
          principal: { identifier: 'prov-east@x.test' },
        })
        .expect(201);
      const temp = gen.body.provisionedLogin.temporaryPassword;
      expect(typeof temp).toBe('string');
      const rows = await prisma.auditLog.findMany({ where: { entityId: gen.body.id } });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(JSON.stringify(row)).not.toContain(temp);
      }
      const eastLogin = await loginOk('prov-east@x.test', temp);
      expect(eastLogin.mustChangePassword).toBe(true);
      expect(eastLogin.campusId).toBe(gen.body.id);
    });

    it('does not write a supplied principal password into the audit log', async () => {
      const rows = await prisma.auditLog.findMany({ where: { entityId: s.northId } });
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(JSON.stringify(row)).not.toContain(NORTH_PASSWORD);
      }
    });

    it('rejects a duplicate principal identifier with 400 and leaves no Campus row behind', async () => {
      await http()
        .post('/api/v1/campuses')
        .set(auth(s.adminToken))
        .send({
          schoolId: s.schoolId,
          name: DUP_CAMPUS_NAME,
          principal: { identifier: NORTH_ID, password: 'Whatever123!' },
        })
        .expect(400);
      expect(await prisma.campus.count({ where: { name: DUP_CAMPUS_NAME } })).toBe(0);
    });

    it('forbids the school admin from creating a campus for a different school', async () => {
      await http()
        .post('/api/v1/campuses')
        .set(auth(s.adminToken))
        .send({ schoolId: s.otherSchoolId, name: 'Intruder' })
        .expect(403);
      expect(await prisma.campus.count({ where: { schoolId: s.otherSchoolId } })).toBe(0);
    });

    it('forbids the school-wide admin from patching or deleting a campus, and from creating an academic session', async () => {
      await http()
        .patch(`/api/v1/campuses/${s.northId}`)
        .set(auth(s.adminToken))
        .send({ name: 'Renamed' })
        .expect(403);
      await http()
        .delete(`/api/v1/campuses/${s.northId}`)
        .set(auth(s.adminToken))
        .expect(403);
      await http()
        .post('/api/v1/academic-sessions')
        .set(auth(s.adminToken))
        .send({ label: SCHOOL_PREFIX, startDate: '2030-01-01', endDate: '2030-12-31' })
        .expect(403);
      expect(await prisma.campus.findUnique({ where: { id: s.northId } })).toMatchObject({ name: 'North' });
    });

    it('provisioned campus principals log in with mustChangePassword, isPrincipal, schoolId and their campusId', async () => {
      const north = await loginOk(NORTH_ID, NORTH_PASSWORD);
      expect(north).toMatchObject({
        mustChangePassword: true,
        isPrincipal: true,
        role: 'SCHOOL_ADMIN',
        schoolId: s.schoolId,
        campusId: s.northId,
      });
      s.northToken = north.accessToken;

      const changed = await http()
        .post('/api/v1/auth/change-password')
        .set(auth(north.accessToken))
        .send({ currentPassword: NORTH_PASSWORD, newPassword: 'NorthNewPass123!' })
        .expect(201);
      expect(changed.body).toMatchObject({
        mustChangePassword: false,
        isPrincipal: true,
        schoolId: s.schoolId,
        campusId: s.northId,
      });
      s.northToken = changed.body.accessToken;
    });
  });

  describe('Campus principal confinement', () => {
    beforeAll(async () => {
      // South structure is created by the school-wide admin; North's by the North principal in the tests.
      const cls = await http()
        .post('/api/v1/classes')
        .set(auth(s.adminToken))
        .send({ campusId: s.southId, academicSessionId: s.sessionId, name: 'PROV South Grade' })
        .expect(201);
      s.southClassId = cls.body.id;
      const sec = await http()
        .post('/api/v1/sections')
        .set(auth(s.adminToken))
        .send({ classId: s.southClassId, name: 'S-A' })
        .expect(201);
      s.southSectionId = sec.body.id;
    });

    it('lists exactly the principal\'s own campus', async () => {
      const res = await http().get('/api/v1/campuses').set(auth(s.northToken)).expect(200);
      expect(res.body.map((c: { id: string }) => c.id)).toEqual([s.northId]);
      expect(res.body[0].name).toBe('North');
    });

    it('forbids a campus principal from creating a campus', async () => {
      await http()
        .post('/api/v1/campuses')
        .set(auth(s.northToken))
        .send({ schoolId: s.schoolId, name: 'Rogue' })
        .expect(403);
      expect(await prisma.campus.count({ where: { name: 'Rogue', schoolId: s.schoolId } })).toBe(0);
    });

    it('forbids creating a class in another campus, and allows creating one in the own campus', async () => {
      await http()
        .post('/api/v1/classes')
        .set(auth(s.northToken))
        .send({ campusId: s.southId, academicSessionId: s.sessionId, name: 'Sneaky' })
        .expect(403);

      const ok = await http()
        .post('/api/v1/classes')
        .set(auth(s.northToken))
        .send({ campusId: s.northId, academicSessionId: s.sessionId, name: 'PROV North Grade' })
        .expect(201);
      s.northClassId = ok.body.id;
    });

    it('allows creating a section under an own-campus class', async () => {
      const res = await http()
        .post('/api/v1/sections')
        .set(auth(s.northToken))
        .send({ classId: s.northClassId, name: 'N-A' })
        .expect(201);
      s.northSectionId = res.body.id;
    });

    it('forbids creating a section under another campus\'s class', async () => {
      await http()
        .post('/api/v1/sections')
        .set(auth(s.northToken))
        .send({ classId: s.southClassId, name: 'Sneaky' })
        .expect(403);
    });

    it('forbids updating and deleting another campus\'s class', async () => {
      await http()
        .patch(`/api/v1/classes/${s.southClassId}`)
        .set(auth(s.northToken))
        .send({ name: 'Hacked' })
        .expect(403);
      await http()
        .delete(`/api/v1/classes/${s.southClassId}`)
        .set(auth(s.northToken))
        .expect(403);
      expect(await prisma.class.findUnique({ where: { id: s.southClassId } })).toMatchObject({
        name: 'PROV South Grade',
      });
    });

    it('forbids updating and deleting another campus\'s section', async () => {
      await http()
        .patch(`/api/v1/sections/${s.southSectionId}`)
        .set(auth(s.northToken))
        .send({ name: 'Hacked' })
        .expect(403);
      await http()
        .delete(`/api/v1/sections/${s.southSectionId}`)
        .set(auth(s.northToken))
        .expect(403);
      expect(await prisma.section.findUnique({ where: { id: s.southSectionId } })).toMatchObject({
        name: 'S-A',
      });
    });

    it('returns only own-campus classes and sections when listing', async () => {
      const classes = await http().get('/api/v1/classes').set(auth(s.northToken)).expect(200);
      expect(classes.body.map((c: { id: string }) => c.id)).toEqual([s.northClassId]);

      const sections = await http().get('/api/v1/sections').set(auth(s.northToken)).expect(200);
      expect(sections.body.map((x: { id: string }) => x.id)).toEqual([s.northSectionId]);
    });

    it('allows the principal to update a section in the own campus', async () => {
      await http()
        .patch(`/api/v1/sections/${s.northSectionId}`)
        .set(auth(s.northToken))
        .send({ name: 'N-A2' })
        .expect(200);
    });
  });

  describe('Teacher scoping', () => {
    beforeAll(async () => {
      const north = await http()
        .post('/api/v1/admin/teachers')
        .set(auth(s.superToken))
        .send({ identifier: 'prov-teacher-north', password: TEACHER_PASSWORD, name: 'PROV North Teacher', campusId: s.northId })
        .expect(201);
      s.northTeacherId = north.body.id;
      const south = await http()
        .post('/api/v1/admin/teachers')
        .set(auth(s.superToken))
        .send({ identifier: 'prov-teacher-south', password: TEACHER_PASSWORD, name: 'PROV South Teacher', campusId: s.southId })
        .expect(201);
      s.southTeacherId = south.body.id;
    });

    it('returns an empty list when a campus principal asks for another campus\'s teachers', async () => {
      const res = await http()
        .get(`/api/v1/teachers?campusId=${s.southId}`)
        .set(auth(s.northToken))
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('lists only the own-campus teacher by default', async () => {
      const res = await http().get('/api/v1/teachers').set(auth(s.northToken)).expect(200);
      expect(res.body.map((t: { id: string }) => t.id)).toEqual([s.northTeacherId]);
    });

    it('rejects a section whose class teacher belongs to another campus with 400', async () => {
      await http()
        .post('/api/v1/sections')
        .set(auth(s.northToken))
        .send({ classId: s.northClassId, name: 'N-B', classTeacherId: s.southTeacherId })
        .expect(400);
      expect(await prisma.section.count({ where: { classId: s.northClassId, name: 'N-B' } })).toBe(0);
    });

    it('accepts a section whose class teacher belongs to the own campus', async () => {
      await http()
        .post('/api/v1/sections')
        .set(auth(s.northToken))
        .send({ classId: s.northClassId, name: 'N-C', classTeacherId: s.northTeacherId })
        .expect(201);
    });
  });
});
