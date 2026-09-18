import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Sprint R's e2e coverage for the promotions feature: preview -> execute -> re-execute-fails ->
 * history, plus the cross-tenant boundary this codebase always proves against two real `School`
 * rows (see `cross-tenant-boundary.e2e-spec.ts`, whose beforeAll/afterAll/login boilerplate this
 * file follows).
 */
describe('Promotions (e2e)', () => {
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
    // creating fresh ones. StudentPromotion first (it Restricts deleting the Enrollment rows it
    // references, and its decidedById Restricts deleting the User who decided it), then Users
    // (Teacher.userId is Cascade), then Students (Enrollment.studentId is Cascade), then the
    // Schools themselves, then any orphaned AcademicSession rows (Class.academicSessionId is
    // Cascade the other way, but nothing cascades an AcademicSession off a deleted School since
    // AcademicSession has no schoolId of its own).
    await prisma.studentPromotion
      .deleteMany({
        where: { student: { grNumber: { startsWith: 'PROMO-' } } },
      })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'promo-' } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'PROMO-' } } })
      .catch(() => undefined);
    const staleSchools = await prisma.school.findMany({
      where: { name: { in: ['PROMO School A', 'PROMO School B'] } },
    });
    for (const s of staleSchools) {
      await prisma.school
        .delete({ where: { id: s.id } })
        .catch(() => undefined);
    }
    await prisma.academicSession
      .deleteMany({ where: { label: { startsWith: 'PROMO ' } } })
      .catch(() => undefined);

    const passwordHash = await argon2.hash(password);

    // --- School A: the tenant under test, with a source and target academic session/class/section
    const schoolA = await prisma.school.create({
      data: { name: 'PROMO School A' },
    });
    const campusA = await prisma.campus.create({
      data: { schoolId: schoolA.id, name: 'PROMO Campus A' },
    });

    const sourceSession = await prisma.academicSession.create({
      data: {
        label: 'PROMO Source Session',
        startDate: new Date('2025-08-01'),
        endDate: new Date('2026-05-31'),
        isActive: true,
      },
    });
    const targetSession = await prisma.academicSession.create({
      data: {
        label: 'PROMO Target Session',
        startDate: new Date('2026-08-01'),
        endDate: new Date('2027-05-31'),
        isActive: false,
      },
    });

    const sourceClass = await prisma.class.create({
      data: {
        campusId: campusA.id,
        academicSessionId: sourceSession.id,
        name: 'PROMO Grade 3',
      },
    });
    const sourceSection = await prisma.section.create({
      data: { classId: sourceClass.id, name: 'PROMO-3A' },
    });

    const targetClass = await prisma.class.create({
      data: {
        campusId: campusA.id,
        academicSessionId: targetSession.id,
        name: 'PROMO Grade 4',
      },
    });
    const targetSection = await prisma.section.create({
      data: { classId: targetClass.id, name: 'PROMO-4A' },
    });

    const schoolAdminUser = await prisma.user.create({
      data: {
        identifier: 'promo-school-admin@schoolos.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: schoolA.id,
      },
    });

    const student = await prisma.student.create({
      data: { grNumber: 'PROMO-1', name: 'Promo Student One' },
    });
    const sourceEnrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        campusId: campusA.id,
        sectionId: sourceSection.id,
        academicSessionId: sourceSession.id,
        startDate: sourceSession.startDate,
        status: 'ACTIVE',
      },
    });

    // --- School B: a fully separate tenant, used only for the cross-tenant boundary checks
    const schoolB = await prisma.school.create({
      data: { name: 'PROMO School B' },
    });
    const campusB = await prisma.campus.create({
      data: { schoolId: schoolB.id, name: 'PROMO Campus B' },
    });
    const sessionB = await prisma.academicSession.create({
      data: {
        label: 'PROMO B Session',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const classB = await prisma.class.create({
      data: {
        campusId: campusB.id,
        academicSessionId: sessionB.id,
        name: 'PROMO Grade B',
      },
    });
    const sectionB = await prisma.section.create({
      data: { classId: classB.id, name: 'PROMO-B' },
    });
    const schoolAdminBUser = await prisma.user.create({
      data: {
        identifier: 'promo-school-admin-b@schoolos.edu.pk',
        passwordHash,
        role: 'SCHOOL_ADMIN',
        schoolId: schoolB.id,
      },
    });

    Object.assign(ids, {
      schoolA: schoolA.id,
      schoolB: schoolB.id,
      campusA: campusA.id,
      campusB: campusB.id,
      sourceSession: sourceSession.id,
      targetSession: targetSession.id,
      sessionB: sessionB.id,
      sourceSection: sourceSection.id,
      targetSection: targetSection.id,
      sectionB: sectionB.id,
      student: student.id,
      sourceEnrollment: sourceEnrollment.id,
      schoolAdminUser: schoolAdminUser.id,
      schoolAdminBUser: schoolAdminBUser.id,
    });
  });

  afterAll(async () => {
    await prisma.studentPromotion
      .deleteMany({ where: { studentId: ids.student } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: { startsWith: 'promo-' } } })
      .catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { startsWith: 'PROMO-' } } })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.schoolA } })
      .catch(() => undefined);
    await prisma.school
      .delete({ where: { id: ids.schoolB } })
      .catch(() => undefined);
    await prisma.academicSession
      .deleteMany({ where: { label: { startsWith: 'PROMO ' } } })
      .catch(() => undefined);
    await app.close();
  });

  it('GET /api/v1/promotions/preview returns the seeded ACTIVE student suggested as PROMOTED', async () => {
    const token = await loginAs('promo-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/promotions/preview?sourceSectionId=${ids.sourceSection}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual([
      {
        studentId: ids.student,
        name: 'Promo Student One',
        grNumber: 'PROMO-1',
        currentRollNumber: null,
        suggestedDecision: 'PROMOTED',
      },
    ]);
  });

  it('POST /api/v1/promotions/execute promotes the student into the target session, closing the old enrollment and opening a new ACTIVE one', async () => {
    const token = await loginAs('promo-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAcademicSessionId: ids.sourceSession,
        targetAcademicSessionId: ids.targetSession,
        decisions: [
          {
            studentId: ids.student,
            decision: 'PROMOTED',
            targetSectionId: ids.targetSection,
            rollNumber: 'PROMO-ROLL-1',
          },
        ],
      })
      .expect(201);

    expect(res.body).toEqual({ processed: 1 });

    // Direct Prisma reads — not just the HTTP response.
    const oldEnrollment = await prisma.enrollment.findUnique({
      where: { id: ids.sourceEnrollment },
    });
    expect(oldEnrollment).not.toBeNull();
    expect(oldEnrollment?.status).toBe('COMPLETED');
    expect(oldEnrollment?.endDate).not.toBeNull();

    const newEnrollment = await prisma.enrollment.findFirst({
      where: { studentId: ids.student, sectionId: ids.targetSection },
    });
    expect(newEnrollment).not.toBeNull();
    expect(newEnrollment?.status).toBe('ACTIVE');
    expect(newEnrollment?.academicSessionId).toBe(ids.targetSession);
    expect(newEnrollment?.campusId).toBe(ids.campusA);
    expect(newEnrollment?.rollNumber).toBe('PROMO-ROLL-1');
    ids.targetEnrollment = newEnrollment!.id;

    const promotion = await prisma.studentPromotion.findFirst({
      where: { studentId: ids.student },
    });
    expect(promotion).not.toBeNull();
    expect(promotion?.decision).toBe('PROMOTED');
    expect(promotion?.fromEnrollmentId).toBe(ids.sourceEnrollment);
    expect(promotion?.toEnrollmentId).toBe(newEnrollment!.id);

    const enrollmentCount = await prisma.enrollment.count({
      where: { studentId: ids.student },
    });
    expect(enrollmentCount).toBe(2);
    const promotionCount = await prisma.studentPromotion.count({
      where: { studentId: ids.student },
    });
    expect(promotionCount).toBe(1);
  });

  it('re-running the exact same execute call 400s (no ACTIVE enrollment left in the source session) and writes no duplicate rows', async () => {
    const token = await loginAs('promo-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAcademicSessionId: ids.sourceSession,
        targetAcademicSessionId: ids.targetSession,
        decisions: [
          {
            studentId: ids.student,
            decision: 'PROMOTED',
            targetSectionId: ids.targetSection,
            rollNumber: 'PROMO-ROLL-1',
          },
        ],
      })
      .expect(400);

    expect(res.body.message).toBe(
      `Student ${ids.student} has no ACTIVE enrollment in the source academic session`,
    );

    const enrollmentCount = await prisma.enrollment.count({
      where: { studentId: ids.student },
    });
    expect(enrollmentCount).toBe(2);
    const promotionCount = await prisma.studentPromotion.count({
      where: { studentId: ids.student },
    });
    expect(promotionCount).toBe(1);
  });

  it('GET /api/v1/admin/students/:studentId/promotion-history returns exactly one PROMOTED row with from/to labels populated', async () => {
    const token = await loginAs('promo-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/students/${ids.student}/promotion-history`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    const row = res.body[0];
    expect(row.decision).toBe('PROMOTED');
    expect(typeof row.decidedAt).toBe('string');
    expect(row.from).toEqual({
      sectionName: 'PROMO-3A',
      className: 'PROMO Grade 3',
      sessionLabel: 'PROMO Source Session',
    });
    expect(row.to).toEqual({
      sectionName: 'PROMO-4A',
      className: 'PROMO Grade 4',
      sessionLabel: 'PROMO Target Session',
    });
  });

  it("a SCHOOL_ADMIN from another school is denied previewing the first school's section (403)", async () => {
    const tokenB = await loginAs('promo-school-admin-b@schoolos.edu.pk');

    await request(app.getHttpServer())
      .get(`/api/v1/promotions/preview?sourceSectionId=${ids.sourceSection}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(403);
  });

  it("a SCHOOL_ADMIN from another school is denied executing a promotion for the first school's student (403)", async () => {
    const tokenB = await loginAs('promo-school-admin-b@schoolos.edu.pk');

    // The student's current ACTIVE enrollment (post earlier tests) is in `targetSession` — use
    // that as the (correct) source so the request fails on the cross-tenant check, not on an
    // unrelated "wrong session" 400.
    await request(app.getHttpServer())
      .post('/api/v1/promotions/execute')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        sourceAcademicSessionId: ids.targetSession,
        targetAcademicSessionId: ids.targetSession,
        decisions: [
          {
            studentId: ids.student,
            decision: 'PROMOTED',
            targetSectionId: ids.targetSection,
          },
        ],
      })
      .expect(403);
  });
});
