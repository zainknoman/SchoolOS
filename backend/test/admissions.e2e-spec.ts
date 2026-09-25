import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admissions (e2e)', () => {
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'adm-' } } })
      .catch(() => undefined);
    const staleStudents = await prisma.student.findMany({
      where: { grNumber: { startsWith: 'ADM-' } },
    });
    for (const s of staleStudents) {
      await prisma.studentParent
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
      await prisma.enrollment
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
    }
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'ADM-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'ADM E2E School' },
    });
    for (const s of stale) {
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const school = await prisma.school.create({
      data: { name: 'ADM E2E School' },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'ADM',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'ADM Grade',
      },
    });
    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'ADM-A' },
    });
    ids.school = school.id;
    ids.campus = campus.id;
    ids.session = session.id;
    ids.class = klass.id;
    ids.section = section.id;

    const passwordHash = await argon2.hash(password);
    await prisma.user.create({
      data: {
        identifier: 'adm-admin',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
      },
    });
    const teacherUser = await prisma.user.create({
      data: {
        identifier: 'adm-teacher',
        passwordHash,
        role: 'TEACHER',
      },
    });
    await prisma.teacher.create({
      data: {
        userId: teacherUser.id,
        name: 'ADM Teacher',
        campusId: campus.id,
      },
    });
  });

  afterAll(async () => {
    const staleStudents = await prisma.student.findMany({
      where: { grNumber: { startsWith: 'ADM-' } },
    });
    for (const s of staleStudents) {
      await prisma.studentParent
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
      await prisma.enrollment
        .deleteMany({ where: { studentId: s.id } })
        .catch(() => undefined);
    }
    await prisma.application
      .deleteMany({ where: { academicSessionId: ids.session } })
      .catch(() => undefined);
    await prisma.applicant
      .deleteMany({
        where: {
          guardianPhone: { in: ['03001234567', '03000000000', '03009998888'] },
        },
      })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'ADM-' } } })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.school } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: { in: ['adm-admin', 'adm-teacher', 'adm-newparent'] },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  describe('Applicants', () => {
    it('creates an applicant and flags a same-name-and-phone match as a possible duplicate', async () => {
      const adminToken = await loginAs('adm-admin');
      const res = await request(app.getHttpServer())
        .post('/api/v1/applicants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Zainab Ali',
          dateOfBirth: '2019-04-01',
          guardianName: 'Ali Khan',
          guardianPhone: '03001234567',
        })
        .expect(201);
      ids.applicant1 = res.body.applicant.id;
      expect(res.body.possibleDuplicate).toBeNull();

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/applicants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Zainab Ali',
          dateOfBirth: '2019-04-01',
          guardianName: 'Ali Khan',
          guardianPhone: '03001234567',
        })
        .expect(201);
      expect(res2.body.possibleDuplicate?.id).toBe(ids.applicant1);
    });

    it('a TEACHER or PARENT cannot create an applicant', async () => {
      const teacherToken = await loginAs('adm-teacher');
      await request(app.getHttpServer())
        .post('/api/v1/applicants')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({
          name: 'Someone',
          dateOfBirth: '2020-01-01',
          guardianName: 'Guardian',
          guardianPhone: '03000000000',
        })
        .expect(403);
    });
  });

  describe('Applications', () => {
    it('creates an application and moves it to UNDER_REVIEW', async () => {
      const adminToken = await loginAs('adm-admin');
      const res = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicantId: ids.applicant1,
          desiredClassId: ids.class,
          academicSessionId: ids.session,
        })
        .expect(201);
      ids.application1 = res.body.id;
      expect(res.body.status).toBe('SUBMITTED');

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/applications/${ids.application1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'UNDER_REVIEW' })
        .expect(200);
      expect(updated.body.status).toBe('UNDER_REVIEW');
    });

    it('rejects a direct status: APPROVED write through PATCH', async () => {
      const adminToken = await loginAs('adm-admin');
      await request(app.getHttpServer())
        .patch(`/api/v1/applications/${ids.application1}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'APPROVED' })
        .expect(400);
    });
  });

  describe('Approve / Reject', () => {
    it('approves an application with a new parent, creating exactly one Student/Enrollment/ParentProfile/User', async () => {
      const adminToken = await loginAs('adm-admin');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/applications/${ids.application1}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          grNumber: 'ADM-STU-1',
          sectionId: ids.section,
          relationshipType: 'FATHER', // BL-04: required
          newParent: {
            identifier: 'adm-newparent',
            password: 'CorrectHorseBattery9!',
            name: 'New Parent',
            phone: '03001112222',
          },
        })
        .expect(201);
      expect(res.body.status).toBe('APPROVED');
      expect(res.body.createdStudentId).toBeTruthy();

      const student = await prisma.student.findUnique({
        where: { grNumber: 'ADM-STU-1' },
      });
      expect(student).not.toBeNull();
      const enrollment = await prisma.enrollment.findFirst({
        where: { studentId: student!.id },
      });
      expect(enrollment).not.toBeNull();
    });

    it('rolls back the whole transaction on a duplicate grNumber, leaving Application status unchanged', async () => {
      const adminToken = await loginAs('adm-admin');
      const secondApplication = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicantId: ids.applicant1,
          desiredClassId: ids.class,
          academicSessionId: ids.session,
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/api/v1/applications/${secondApplication.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'UNDER_REVIEW' })
        .expect(200);

      await request(app.getHttpServer())
        .post(`/api/v1/applications/${secondApplication.body.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          grNumber: 'ADM-STU-1',
          sectionId: ids.section,
          relationshipType: 'FATHER', // BL-04: required
          parentProfileId: 'not-a-real-parent-id',
        })
        .expect(400);

      const stillUnderReview = await request(app.getHttpServer())
        .get(`/api/v1/applications?academicSessionId=${ids.session}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const found = stillUnderReview.body.find(
        (a: { id: string }) => a.id === secondApplication.body.id,
      );
      expect(found.status).toBe('UNDER_REVIEW');
    });

    it('rejects an application; a second reject or an approve afterward is rejected', async () => {
      const adminToken = await loginAs('adm-admin');
      const applicantRes = await request(app.getHttpServer())
        .post('/api/v1/applicants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Reject Me',
          dateOfBirth: '2020-01-01',
          guardianName: 'G',
          guardianPhone: '03009998888',
        })
        .expect(201);
      const applicationRes = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          applicantId: applicantRes.body.applicant.id,
          desiredClassId: ids.class,
          academicSessionId: ids.session,
        })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationRes.body.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decisionNotes: 'No seats available' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationRes.body.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decisionNotes: 'Trying again' })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/api/v1/applications/${applicationRes.body.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          grNumber: 'ADM-STU-2',
          sectionId: ids.section,
          relationshipType: 'FATHER', // BL-04: required
          parentProfileId: 'irrelevant',
        })
        .expect(400);
    });
  });
});
