import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Holidays + Complaints + Report Cards (e2e)', () => {
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
      .deleteMany({ where: { identifier: { startsWith: 'hcr-' } } })
      .catch(() => undefined);
    const staleStudents = await prisma.student.findMany({
      where: { grNumber: { startsWith: 'HCR-' } },
    });
    for (const s of staleStudents) {
      await prisma.complaint
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
      await prisma.reportCard
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
    }
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'HCR-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'HCR E2E School' },
    });
    for (const s of stale) {
      await prisma.holiday
        .deleteMany({ where: { campus: { schoolId: s.id } } })
        .catch(() => undefined);
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const school = await prisma.school.create({
      data: { name: 'HCR E2E School' },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'HCR',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'HCR Grade',
      },
    });
    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'HCR-A' },
    });
    ids.school = school.id;
    ids.campus = campus.id;
    ids.session = session.id;
    ids.section = section.id;

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'hcr-teacher@seeds.edu.pk',
        passwordHash,
        role: 'TEACHER',
      },
    });
    await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'HCR Teacher', campusId: campus.id },
    });
    const campusB = await prisma.campus.create({
      data: { schoolId: school.id, name: 'HCR Campus B' },
    });
    const teacherBUser = await prisma.user.create({
      data: { identifier: 'hcr-teacher-b@seeds.edu.pk', passwordHash, role: 'TEACHER' },
    });
    await prisma.teacher.create({
      data: { userId: teacherBUser.id, name: 'HCR Teacher B', campusId: campusB.id },
    });
    await prisma.user.create({
      data: {
        identifier: 'hcr-admin@seeds.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
      },
    });

    const parentAUser = await prisma.user.create({
      data: {
        identifier: 'hcr-parent-a@seeds.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    const parentBUser = await prisma.user.create({
      data: {
        identifier: 'hcr-parent-b@seeds.edu.pk',
        passwordHash,
        role: 'PARENT',
      },
    });
    const parentAProfile = await prisma.parentProfile.create({
      data: { userId: parentAUser.id, name: 'HCR Parent A' },
    });
    const parentBProfile = await prisma.parentProfile.create({
      data: { userId: parentBUser.id, name: 'HCR Parent B' },
    });

    const childA = await prisma.student.create({
      data: { grNumber: 'HCR-A1', name: 'HCR Child A' },
    });
    const childB = await prisma.student.create({
      data: { grNumber: 'HCR-B1', name: 'HCR Child B' },
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
    await prisma.studentParent.create({
      data: { studentId: childA.id, parentProfileId: parentAProfile.id },
    });
    await prisma.studentParent.create({
      data: { studentId: childB.id, parentProfileId: parentBProfile.id },
    });

    Object.assign(ids, { childA: childA.id, childB: childB.id });
  });

  afterAll(async () => {
    await prisma.complaint
      .deleteMany({ where: { studentId: { in: [ids.childA, ids.childB] } } })
      .catch(() => undefined);
    await prisma.reportCard
      .deleteMany({ where: { studentId: { in: [ids.childA, ids.childB] } } })
      .catch(() => undefined);
    await prisma.holiday
      .deleteMany({ where: { campusId: ids.campus } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { in: ['HCR-A1', 'HCR-B1'] } } })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.school } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: [
              'hcr-teacher@seeds.edu.pk',
              'hcr-teacher-b@seeds.edu.pk',
              'hcr-admin@seeds.edu.pk',
              'hcr-parent-a@seeds.edu.pk',
              'hcr-parent-b@seeds.edu.pk',
            ],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  describe('Holidays', () => {
    it('a SCHOOL_ADMIN can create a holiday; any authenticated user (including a parent) can read it', async () => {
      const adminToken = await loginAs('hcr-admin@seeds.edu.pk');

      const created = await request(app.getHttpServer())
        .post('/api/v1/holidays')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'HCR Test Holiday',
          startDate: '2026-12-01',
          endDate: '2026-12-01',
          campusId: ids.campus,
        })
        .expect(201);
      ids.holiday = created.body.id;

      const parentToken = await loginAs('hcr-parent-a@seeds.edu.pk');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/holidays?campusId=${ids.campus}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      expect(res.body.map((h: { title: string }) => h.title)).toContain(
        'HCR Test Holiday',
      );
    });

    it('a TEACHER cannot create, update, or delete a holiday', async () => {
      const teacherToken = await loginAs('hcr-teacher@seeds.edu.pk');

      await request(app.getHttpServer())
        .post('/api/v1/holidays')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          title: 'Unauthorized',
          startDate: '2026-12-02',
          endDate: '2026-12-02',
        })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/v1/holidays/${ids.holiday}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ title: 'Renamed' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/holidays/${ids.holiday}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(403);
    });
  });

  describe('Complaints', () => {
    it('a TEACHER can raise a complaint for a student, and the linked parent can read it', async () => {
      const teacherToken = await loginAs('hcr-teacher@seeds.edu.pk');

      const created = await request(app.getHttpServer())
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          studentId: ids.childA,
          subject: 'Late homework',
          description: 'Missed 3 deadlines',
        })
        .expect(201);
      ids.complaint = created.body.id;
      expect(created.body.status).toBe('open');

      const parentAToken = await loginAs('hcr-parent-a@seeds.edu.pk');
      const res = await request(app.getHttpServer())
        .get(`/api/v1/complaints?studentId=${ids.childA}`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(200);
      expect(res.body.map((c: { id: string }) => c.id)).toContain(
        ids.complaint,
      );
    });

    it("a parent CANNOT read another parent's child's complaints", async () => {
      const parentBToken = await loginAs('hcr-parent-b@seeds.edu.pk');

      await request(app.getHttpServer())
        .get(`/api/v1/complaints?studentId=${ids.childA}`)
        .set('Authorization', `Bearer ${parentBToken}`)
        .expect(403);
    });

    it('a PARENT cannot create or update a complaint — read-only for parents', async () => {
      const parentToken = await loginAs('hcr-parent-a@seeds.edu.pk');

      await request(app.getHttpServer())
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ studentId: ids.childA, subject: 'X', description: 'Y' })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/v1/complaints/${ids.complaint}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .send({ status: 'resolved' })
        .expect(403);
    });

    it("a SCHOOL_ADMIN can update a complaint's status", async () => {
      const adminToken = await loginAs('hcr-admin@seeds.edu.pk');

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/complaints/${ids.complaint}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'resolved' })
        .expect(200);

      expect(res.body.status).toBe('resolved');
    });

    it('denies a teacher raising a complaint about a student outside their campus', async () => {
      const token = await loginAs('hcr-teacher-b@seeds.edu.pk');
      const res = await request(app.getHttpServer())
        .post('/api/v1/complaints')
        .set('Authorization', `Bearer ${token}`)
        .send({ studentId: ids.childA, subject: 'Test', description: 'Test' });
      expect(res.status).toBe(403);
    });
  });

  describe('Report Cards', () => {
    it('a TEACHER can upload a report card; the linked parent can list and download it', async () => {
      const teacherToken = await loginAs('hcr-teacher@seeds.edu.pk');

      const uploadRes = await request(app.getHttpServer())
        .post('/api/v1/report-cards')
        .set('Authorization', `Bearer ${teacherToken}`)
        .field('studentId', ids.childA)
        .field('academicSessionId', ids.session)
        .attach('file', Buffer.from('%PDF-1.4 fake report card'), 'report.pdf')
        .expect(201);
      ids.reportCard = uploadRes.body.id;

      const parentAToken = await loginAs('hcr-parent-a@seeds.edu.pk');
      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/report-cards?studentId=${ids.childA}`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(200);
      expect(listRes.body.map((r: { id: string }) => r.id)).toContain(
        ids.reportCard,
      );

      await request(app.getHttpServer())
        .get(`/api/v1/report-cards/${ids.reportCard}/pdf`)
        .set('Authorization', `Bearer ${parentAToken}`)
        .expect(200);
    });

    it("a parent CANNOT download another parent's child's report card", async () => {
      const parentBToken = await loginAs('hcr-parent-b@seeds.edu.pk');

      await request(app.getHttpServer())
        .get(`/api/v1/report-cards/${ids.reportCard}/pdf`)
        .set('Authorization', `Bearer ${parentBToken}`)
        .expect(403);
    });

    it('uploading a second report card for the same student+session is rejected as a conflict', async () => {
      const teacherToken = await loginAs('hcr-teacher@seeds.edu.pk');

      await request(app.getHttpServer())
        .post('/api/v1/report-cards')
        .set('Authorization', `Bearer ${teacherToken}`)
        .field('studentId', ids.childA)
        .field('academicSessionId', ids.session)
        .attach('file', Buffer.from('%PDF-1.4 duplicate'), 'report2.pdf')
        .expect(409);
    });

    it('a PARENT cannot upload a report card', async () => {
      const parentToken = await loginAs('hcr-parent-a@seeds.edu.pk');

      await request(app.getHttpServer())
        .post('/api/v1/report-cards')
        .set('Authorization', `Bearer ${parentToken}`)
        .field('studentId', ids.childB)
        .field('academicSessionId', ids.session)
        .attach('file', Buffer.from('%PDF-1.4 x'), 'x.pdf')
        .expect(403);
    });

    it('denies a teacher uploading a report card for a student outside their campus', async () => {
      const token = await loginAs('hcr-teacher-b@seeds.edu.pk');
      const res = await request(app.getHttpServer())
        .post('/api/v1/report-cards')
        .set('Authorization', `Bearer ${token}`)
        .field('studentId', ids.childA)
        .field('academicSessionId', ids.session)
        .attach('file', Buffer.from('%PDF-1.4'), 'report.pdf');
      expect(res.status).toBe(403);
    });
  });
});
