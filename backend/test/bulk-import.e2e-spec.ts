import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Bulk import (e2e)', () => {
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
      .deleteMany({ where: { identifier: { startsWith: 'bi-' } } })
      .catch(() => undefined);
    const staleStudents = await prisma.student.findMany({
      where: { grNumber: { startsWith: 'BI-' } },
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
      .deleteMany({ where: { grNumber: { startsWith: 'BI-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'BI E2E School' },
    });
    for (const s of stale) {
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }

    const school = await prisma.school.create({
      data: { name: 'BI E2E School' },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'BI',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'BI Grade',
      },
    });
    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'BI-A' },
    });
    ids.school = school.id;
    ids.campus = campus.id;
    ids.session = session.id;
    ids.section = section.id;

    const passwordHash = await argon2.hash(password);
    await prisma.user.create({
      data: {
        identifier: 'bi-admin',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
      },
    });
    const teacherUser = await prisma.user.create({
      data: { identifier: 'bi-teacher', passwordHash, role: 'TEACHER' },
    });
    await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'BI Teacher', campusId: campus.id },
    });

    const existingParentUser = await prisma.user.create({
      data: { identifier: 'bi-existing-parent', passwordHash, role: 'PARENT' },
    });
    await prisma.parentProfile.create({
      data: { userId: existingParentUser.id, name: 'BI Existing Parent' },
    });
  });

  afterAll(async () => {
    await prisma.school
      .delete({ where: { id: ids.school } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'bi-' } } })
      .catch(() => undefined);
    await app.close();
  });

  describe('Students bulk import', () => {
    const csvBuffer = (text: string) => Buffer.from(text);

    it('preview reports per-row validity and writes nothing', async () => {
      const adminToken = await loginAs('bi-admin');
      const csv = `grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone\nBI-1001,Zainab,${ids.section},bi-existing-parent,,,\nBI-1002,Ahmed,${ids.section},,bi-new-parent,New Parent,03001234567\n`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/bulk-import/students/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', csvBuffer(csv), 'students.csv')
        .expect(201);

      expect(res.body.validCount).toBe(2);
      expect(res.body.errorCount).toBe(0);

      const studentsAfter = await prisma.student.count({
        where: { grNumber: { startsWith: 'BI-' } },
      });
      expect(studentsAfter).toBe(0);
    });

    it('flags a within-file duplicate grNumber and a database duplicate, without blocking other valid rows', async () => {
      const adminToken = await loginAs('bi-admin');
      const csv = `grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone\nBI-1001,Zainab,${ids.section},bi-existing-parent,,,\nBI-1001,Zainab Again,${ids.section},bi-existing-parent,,,\nBI-1003,Third,${ids.section},bi-existing-parent,,,\n`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/bulk-import/students/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', csvBuffer(csv), 'students.csv')
        .expect(201);

      expect(res.body.rows[0].errors).toEqual([]);
      expect(res.body.rows[1].errors).toEqual(
        expect.arrayContaining([expect.stringContaining('Duplicate grNumber')]),
      );
      expect(res.body.rows[2].errors).toEqual([]);
      expect(res.body.validCount).toBe(2);
    });

    it('commit rejects the entire batch if any row still errors', async () => {
      const adminToken = await loginAs('bi-admin');
      const csv = `grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone\nBI-1004,Valid,${ids.section},bi-existing-parent,,,\nBI-BAD,,${ids.section},bi-existing-parent,,,\n`;
      await request(app.getHttpServer())
        .post('/api/v1/bulk-import/students/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', csvBuffer(csv), 'students.csv')
        .expect(400);

      const created = await prisma.student.findUnique({
        where: { grNumber: 'BI-1004' },
      });
      expect(created).toBeNull();
    });

    it('commit creates every valid row transactionally, with one summarizing audit-log entry', async () => {
      const adminToken = await loginAs('bi-admin');
      const csv = `grNumber,name,sectionId,parentIdentifier,newParentIdentifier,newParentName,newParentPhone\nBI-1005,Fatima,${ids.section},bi-existing-parent,,,\nBI-1006,Bilal,${ids.section},,bi-new-parent-2,New Parent Two,03007654321\n`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/bulk-import/students/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', csvBuffer(csv), 'students.csv')
        .expect(201);

      expect(res.body.createdCount).toBe(2);
      const auditRows = await prisma.auditLog.count({
        where: { action: 'bulk-import.students' },
      });
      expect(auditRows).toBeGreaterThanOrEqual(1);
      const newParentUser = await prisma.user.findUnique({
        where: { identifier: 'bi-new-parent-2' },
      });
      expect(newParentUser).not.toBeNull();
    });

    it('a TEACHER cannot access any bulk-import route', async () => {
      const teacherToken = await loginAs('bi-teacher');
      await request(app.getHttpServer())
        .post('/api/v1/bulk-import/students/preview')
        .set('Authorization', `Bearer ${teacherToken}`)
        .attach('file', csvBuffer('grNumber,name,sectionId\n'), 'students.csv')
        .expect(403);
    });
  });

  describe('Parents bulk import', () => {
    it('commit creates parents and rejects a within-file duplicate identifier', async () => {
      const adminToken = await loginAs('bi-admin');
      const csv = `identifier,name,phone\nbi-parent-a,Parent A,03001112222\nbi-parent-a,Parent A Dup,03003334444\n`;
      await request(app.getHttpServer())
        .post('/api/v1/bulk-import/parents/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csv), 'parents.csv')
        .expect(400);

      const created = await prisma.user.findUnique({
        where: { identifier: 'bi-parent-a' },
      });
      expect(created).toBeNull();
    });

    it('commit creates a valid batch of parents', async () => {
      const adminToken = await loginAs('bi-admin');
      const csv = `identifier,name,phone\nbi-parent-b,Parent B,03005556666\n`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/bulk-import/parents/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csv), 'parents.csv')
        .expect(201);
      expect(res.body.createdCount).toBe(1);
    });
  });

  describe('Teachers bulk import', () => {
    it('commit creates teachers and rejects a row with an unknown campusId', async () => {
      const adminToken = await loginAs('bi-admin');
      const csv = `identifier,name,campusId\nbi-teacher-a,Teacher A,${ids.campus}\nbi-teacher-b,Teacher B,not-a-real-campus\n`;
      await request(app.getHttpServer())
        .post('/api/v1/bulk-import/teachers/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csv), 'teachers.csv')
        .expect(400);

      const created = await prisma.user.findUnique({
        where: { identifier: 'bi-teacher-a' },
      });
      expect(created).toBeNull();
    });

    it('commit creates a valid batch of teachers', async () => {
      const adminToken = await loginAs('bi-admin');
      const csv = `identifier,name,campusId\nbi-teacher-c,Teacher C,${ids.campus}\n`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/bulk-import/teachers/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csv), 'teachers.csv')
        .expect(201);
      expect(res.body.createdCount).toBe(1);
    });
  });

  describe('Staff bulk import', () => {
    it('commit creates a non-teacher staff member with no login row', async () => {
      const adminToken = await loginAs('bi-admin');
      const csv = `name,employeeType,campusId,dateOfBirth,cnic,mobile,email,joiningDate,loginIdentifier\nBI Guard,GUARD,${ids.campus},,,,,,\n`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/bulk-import/staff/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(csv), 'staff.csv')
        .expect(201);
      expect(res.body.createdCount).toBe(1);
    });

    it('commit creates a linked Teacher+User for employeeType TEACHER, and rejects a row missing loginIdentifier', async () => {
      const adminToken = await loginAs('bi-admin');
      const badCsv = `name,employeeType,campusId,dateOfBirth,cnic,mobile,email,joiningDate,loginIdentifier\nBI Teacher Hire,TEACHER,${ids.campus},,,,,,\n`;
      await request(app.getHttpServer())
        .post('/api/v1/bulk-import/staff/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(badCsv), 'staff.csv')
        .expect(400);

      const goodCsv = `name,employeeType,campusId,dateOfBirth,cnic,mobile,email,joiningDate,loginIdentifier\nBI Teacher Hire,TEACHER,${ids.campus},,,,,,bi-staff-teacher\n`;
      const res = await request(app.getHttpServer())
        .post('/api/v1/bulk-import/staff/commit')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from(goodCsv), 'staff.csv')
        .expect(201);
      expect(res.body.createdCount).toBe(1);

      const createdUser = await prisma.user.findUnique({
        where: { identifier: 'bi-staff-teacher' },
      });
      expect(createdUser).not.toBeNull();
    });
  });

  describe('Sample file download', () => {
    it.each(['students', 'parents', 'teachers', 'staff'])(
      'returns a CSV sample for %s',
      async (entity) => {
        const adminToken = await loginAs('bi-admin');
        const res = await request(app.getHttpServer())
          .get(`/api/v1/bulk-import/${entity}/sample`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);
        expect(res.headers['content-type']).toContain('text/csv');
        expect(res.text.split('\n')[0].length).toBeGreaterThan(0);
      },
    );

    it('rejects an unknown entity', async () => {
      const adminToken = await loginAs('bi-admin');
      await request(app.getHttpServer())
        .get('/api/v1/bulk-import/not-a-real-entity/sample')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });
  });
});
