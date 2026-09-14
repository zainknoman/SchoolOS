import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Gradebook (e2e)', () => {
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
      .deleteMany({ where: { identifier: { startsWith: 'gb-' } } })
      .catch(() => undefined);
    const staleStudents = await prisma.student.findMany({
      where: { grNumber: { startsWith: 'GB-' } },
    });
    for (const s of staleStudents) {
      await prisma.mark.deleteMany({ where: { studentId: s.id } }).catch(() => undefined);
      await prisma.studentParent.deleteMany({ where: { studentId: s.id } }).catch(() => undefined);
    }
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'GB-' } } })
      .catch(() => undefined);
    const stale = await prisma.school.findMany({
      where: { name: 'GB E2E School' },
    });
    for (const s of stale) {
      // Timetable->Section is onDelete: Restrict, so a leftover row from a previously-failed run
      // would otherwise block this cascade delete.
      await prisma.timetable
        .deleteMany({ where: { section: { class: { campus: { schoolId: s.id } } } } })
        .catch(() => undefined);
      await prisma.school.delete({ where: { id: s.id } }).catch(() => undefined);
    }
    const staleSubject = await prisma.subject.findUnique({ where: { name: 'GB Math' } });
    if (staleSubject) {
      await prisma.mark
        .deleteMany({ where: { assessment: { subjectId: staleSubject.id } } })
        .catch(() => undefined);
      await prisma.assessment
        .deleteMany({ where: { subjectId: staleSubject.id } })
        .catch(() => undefined);
      await prisma.subject.delete({ where: { id: staleSubject.id } }).catch(() => undefined);
    }

    const school = await prisma.school.create({
      data: { name: 'GB E2E School' },
    });
    const campus = await prisma.campus.create({
      data: { schoolId: school.id, name: 'GB Main' },
    });
    const session = await prisma.academicSession.create({
      data: {
        label: 'GB Session',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: {
        campusId: campus.id,
        academicSessionId: session.id,
        name: 'GB Grade',
      },
    });
    const section = await prisma.section.create({
      data: { classId: klass.id, name: 'GB-A' },
    });
    ids.school = school.id;
    ids.campus = campus.id;
    ids.session = session.id;
    ids.class = klass.id;
    ids.section = section.id;

    const passwordHash = await argon2.hash(password);
    const teacherUser = await prisma.user.create({
      data: { identifier: 'gb-teacher', passwordHash, role: 'TEACHER' },
    });
    const teacher = await prisma.teacher.create({
      data: { userId: teacherUser.id, name: 'GB Teacher', campusId: campus.id },
    });
    await prisma.user.create({
      data: {
        identifier: 'gb-admin',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: school.id,
      },
    });

    // Task 5: a teacher in a different campus, used to prove assertCanAccessClass denies them.
    const otherCampus = await prisma.campus.create({ data: { schoolId: school.id, name: 'GB Other' } });
    const otherCampusUser = await prisma.user.create({
      data: { identifier: 'gb-teacher-other', passwordHash, role: 'TEACHER' },
    });
    await prisma.teacher.create({
      data: { userId: otherCampusUser.id, name: 'Other Campus Teacher', campusId: otherCampus.id },
    });
    ids.otherCampus = otherCampus.id;

    const subject = await prisma.subject.create({ data: { name: 'GB Math' } });
    const student = await prisma.student.create({ data: { grNumber: 'GB-1001', name: 'GB Student' } });
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        campusId: campus.id,
        sectionId: section.id,
        academicSessionId: session.id,
        startDate: new Date(),
        status: 'ACTIVE',
      },
    });
    ids.subject = subject.id;
    ids.student = student.id;

    // gb-teacher must actually be assigned to teach GB-A/GB Math for the new subject/class
    // assignment check (StudentAccessService) to allow them past campus-only scoping.
    await prisma.timetable.create({
      data: {
        sectionId: section.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        dayOfWeek: 1,
        period: 1,
        startTime: '08:00',
        endTime: '08:40',
      },
    });

    // Task 7: a parent linked to the student, and an unrelated parent/student pair for the
    // cross-tenant denial case.
    const parentUser = await prisma.user.create({
      data: { identifier: 'gb-parent', passwordHash, role: 'PARENT' },
    });
    const parentProfile = await prisma.parentProfile.create({
      data: { userId: parentUser.id, name: 'GB Parent' },
    });
    await prisma.studentParent.create({ data: { studentId: ids.student, parentProfileId: parentProfile.id } });

    const otherStudent = await prisma.student.create({ data: { grNumber: 'GB-OTHER-1', name: 'Other Student' } });
    const otherParentUser = await prisma.user.create({
      data: { identifier: 'gb-other-parent', passwordHash, role: 'PARENT' },
    });
    const otherParentProfile = await prisma.parentProfile.create({
      data: { userId: otherParentUser.id, name: 'GB Other Parent' },
    });
    await prisma.studentParent.create({
      data: { studentId: otherStudent.id, parentProfileId: otherParentProfile.id },
    });
    ids.otherStudent = otherStudent.id;
  });

  afterAll(async () => {
    // Timetable->Section is onDelete: Restrict, so this must go before the school/campus/class
    // cascade below or that cascade fails on the FK constraint.
    await prisma.timetable.deleteMany({ where: { sectionId: ids.section } }).catch(() => undefined);
    await prisma.mark
      .deleteMany({ where: { studentId: { in: [ids.student, ids.otherStudent] } } })
      .catch(() => undefined);
    await prisma.studentParent
      .deleteMany({ where: { studentId: { in: [ids.student, ids.otherStudent] } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { in: ['GB-1001', 'GB-OTHER-1'] } } })
      .catch(() => undefined);
    await prisma.assessment.deleteMany({ where: { subjectId: ids.subject } }).catch(() => undefined);
    await prisma.subject.delete({ where: { id: ids.subject } }).catch(() => undefined);
    await prisma.school.delete({ where: { id: ids.school } }).catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: ['gb-teacher', 'gb-teacher-other', 'gb-admin', 'gb-parent', 'gb-other-parent'],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  describe('Terms', () => {
    it("SCHOOL_ADMIN creates a term and it appears in the session's list", async () => {
      const adminToken = await loginAs('gb-admin');
      const res = await request(app.getHttpServer())
        .post('/api/v1/terms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ academicSessionId: ids.session, label: 'Term 1', order: 1, startDate: '2026-08-01', endDate: '2026-12-15' })
        .expect(201);
      ids.term1 = res.body.id;

      const list = await request(app.getHttpServer())
        .get(`/api/v1/terms?academicSessionId=${ids.session}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(list.body.map((t: { label: string }) => t.label)).toContain('Term 1');
    });

    it('a TEACHER can read terms but cannot create one', async () => {
      const teacherToken = await loginAs('gb-teacher');
      await request(app.getHttpServer())
        .get(`/api/v1/terms?academicSessionId=${ids.session}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/terms')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ academicSessionId: ids.session, label: 'Term 2', order: 2, startDate: '2027-01-05', endDate: '2027-06-30' })
        .expect(403);
    });
  });

  describe('Assessment Categories', () => {
    it('flags a non-100% weight total but still creates the category', async () => {
      const adminToken = await loginAs('gb-admin');
      const res = await request(app.getHttpServer())
        .post('/api/v1/assessment-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ classId: ids.class, termId: ids.term1, name: 'Quizzes', weightPercent: 30 })
        .expect(201);
      ids.categoryQuizzes = res.body.id;
      expect(res.body.weightTotalWarning).toContain('30%');

      const res2 = await request(app.getHttpServer())
        .post('/api/v1/assessment-categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ classId: ids.class, termId: ids.term1, name: 'Final Exam', weightPercent: 70 })
        .expect(201);
      ids.categoryFinal = res2.body.id;
      expect(res2.body.weightTotalWarning).toBeNull();
    });

    it('a TEACHER cannot create an assessment category (admin-only)', async () => {
      const teacherToken = await loginAs('gb-teacher');
      await request(app.getHttpServer())
        .post('/api/v1/assessment-categories')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ classId: ids.class, termId: ids.term1, name: 'Midterm', weightPercent: 10 })
        .expect(403);
    });
  });

  describe('Assessments', () => {
    it("a TEACHER in the class's campus creates an assessment; a different-campus TEACHER cannot", async () => {
      const teacherToken = await loginAs('gb-teacher');
      const res = await request(app.getHttpServer())
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ assessmentCategoryId: ids.categoryQuizzes, subjectId: ids.subject, label: 'Quiz 1', maxMarks: 20 })
        .expect(201);
      ids.assessmentQuiz1 = res.body.id;

      const otherCampusTeacherToken = await loginAs('gb-teacher-other');
      await request(app.getHttpServer())
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${otherCampusTeacherToken}`)
        .send({ assessmentCategoryId: ids.categoryQuizzes, subjectId: ids.subject, label: 'Quiz 2', maxMarks: 20 })
        .expect(403);
    });
  });

  describe('Bulk marks', () => {
    it('saves marks for the enrolled students in one transaction', async () => {
      const teacherToken = await loginAs('gb-teacher');
      const res = await request(app.getHttpServer())
        .post(`/api/v1/assessments/${ids.assessmentQuiz1}/marks`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ marks: [{ studentId: ids.student, obtainedMarks: 18 }] })
        .expect(201);
      expect(res.body[0]).toMatchObject({ studentId: ids.student, obtainedMarks: 18 });
    });

    it("rejects obtainedMarks greater than the assessment's maxMarks", async () => {
      const teacherToken = await loginAs('gb-teacher');
      await request(app.getHttpServer())
        .post(`/api/v1/assessments/${ids.assessmentQuiz1}/marks`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ marks: [{ studentId: ids.student, obtainedMarks: 999 }] })
        .expect(400);
    });

    it("rejects a studentId not enrolled in the assessment's class", async () => {
      const teacherToken = await loginAs('gb-teacher');
      await request(app.getHttpServer())
        .post(`/api/v1/assessments/${ids.assessmentQuiz1}/marks`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ marks: [{ studentId: 'not-a-real-student-id', obtainedMarks: 10 }] })
        .expect(400);
    });
  });

  describe('Grades computation', () => {
    it('computes a weighted final percentage across two categories, with an ungraded category contributing 0', async () => {
      const teacherToken = await loginAs('gb-teacher');
      // Quiz 1: 18/20 already saved in the Bulk marks tests above (Quizzes category, 30% weight).
      // Add a Final Exam assessment (Final Exam category, 70% weight) but never enter marks for it —
      // this is the spec's "zero entered marks contributes 0, not null" case, not merely "no assessment
      // exists yet".
      const assessmentRes = await request(app.getHttpServer())
        .post('/api/v1/assessments')
        .set('Authorization', `Bearer ${teacherToken}`)
        .send({ assessmentCategoryId: ids.categoryFinal, subjectId: ids.subject, label: 'Final Exam', maxMarks: 100 })
        .expect(201);
      ids.assessmentFinal = assessmentRes.body.id;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${ids.student}/grades?termId=${ids.term1}`)
        .set('Authorization', `Bearer ${teacherToken}`)
        .expect(200);

      const subjectGrade = res.body.find((g: { subjectId: string }) => g.subjectId === ids.subject);
      expect(subjectGrade.categories).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Quizzes', obtainedPercent: 90 }),
          expect.objectContaining({ name: 'Final Exam', obtainedPercent: 0 }),
        ]),
      );
      // (30% weight × 90% obtained) + (70% weight × 0% obtained, ungraded) = 27
      expect(subjectGrade.finalPercent).toBe(27);
    });

    it("a parent can read their own child's grades, not another parent's child", async () => {
      const parentToken = await loginAs('gb-parent');
      await request(app.getHttpServer())
        .get(`/api/v1/students/${ids.student}/grades?termId=${ids.term1}`)
        .set('Authorization', `Bearer ${parentToken}`)
        .expect(200);

      const otherParentToken = await loginAs('gb-other-parent');
      await request(app.getHttpServer())
        .get(`/api/v1/students/${ids.student}/grades?termId=${ids.term1}`)
        .set('Authorization', `Bearer ${otherParentToken}`)
        .expect(403);
    });
  });
});
