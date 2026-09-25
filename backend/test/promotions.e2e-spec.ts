import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
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
    await prisma.attendance
      .deleteMany({
        where: { student: { grNumber: { startsWith: 'PROMO-' } } },
      })
      .catch(() => undefined);
    await prisma.mark
      .deleteMany({
        where: { student: { grNumber: { startsWith: 'PROMO-' } } },
      })
      .catch(() => undefined);
    await prisma.feeVoucher
      .deleteMany({
        where: { student: { grNumber: { startsWith: 'PROMO-' } } },
      })
      .catch(() => undefined);
    await prisma.assessment
      .deleteMany({ where: { label: { startsWith: 'PROMO ' } } })
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
      .deleteMany({
        where: { student: { grNumber: { startsWith: 'PROMO-' } } },
      })
      .catch(() => undefined);
    await prisma.attendance
      .deleteMany({
        where: { student: { grNumber: { startsWith: 'PROMO-' } } },
      })
      .catch(() => undefined);
    await prisma.mark
      .deleteMany({
        where: { student: { grNumber: { startsWith: 'PROMO-' } } },
      })
      .catch(() => undefined);
    await prisma.feeVoucher
      .deleteMany({
        where: { student: { grNumber: { startsWith: 'PROMO-' } } },
      })
      .catch(() => undefined);
    await prisma.assessment
      .deleteMany({ where: { label: { startsWith: 'PROMO ' } } })
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

  it('GET /api/v1/promotions/preview returns the seeded ACTIVE student with indicators and no pre-selected decision (BL-05)', async () => {
    const token = await loginAs('promo-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/promotions/preview?sourceSectionId=${ids.sourceSection}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.sourceAcademicSessionId).toBe(ids.sourceSession);
    expect(res.body.policy).toEqual({
      minAttendancePercent: 75,
      minResultPercent: 40,
      blockOnAttendance: false,
      blockOnResults: false,
      blockOnFees: false,
    });
    expect(res.body.rows).toEqual([
      {
        studentId: ids.student,
        name: 'Promo Student One',
        grNumber: 'PROMO-1',
        currentRollNumber: null,
        indicators: expect.objectContaining({ blocked: false }),
      },
    ]);
    expect(res.body.rows[0]).not.toHaveProperty('suggestedDecision');
  });

  it('POST /api/v1/promotions/execute promotes the student into the target session, closing the old enrollment and opening a new ACTIVE one', async () => {
    const token = await loginAs('promo-school-admin@schoolos.edu.pk');

    const res = await request(app.getHttpServer())
      .post('/api/v1/promotions/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAcademicSessionId: ids.sourceSession,
        confirmed: true,
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
        confirmed: true,
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
        confirmed: true,
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

  it('BL-61: a TRANSFERRED decision stores TRANSFERRED on the promotion, the enrolment and the student (never LEFT)', async () => {
    const token = await loginAs('promo-school-admin@schoolos.edu.pk');
    const student = await prisma.student.create({
      data: { grNumber: 'PROMO-2', name: 'Promo Student Two' },
    });
    const enrollment = await prisma.enrollment.create({
      data: {
        studentId: student.id,
        campusId: ids.campusA,
        sectionId: ids.sourceSection,
        academicSessionId: ids.sourceSession,
        startDate: new Date('2025-08-01'),
        status: 'ACTIVE',
      },
    });

    await request(app.getHttpServer())
      .post('/api/v1/promotions/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAcademicSessionId: ids.sourceSession,
        confirmed: true,
        targetAcademicSessionId: ids.targetSession,
        decisions: [
          {
            studentId: student.id,
            decision: 'TRANSFERRED',
            remarks: 'Moved city',
          },
        ],
      })
      .expect(201);

    const after = await prisma.student.findUniqueOrThrow({
      where: { id: student.id },
    });
    expect(after.status).toBe('TRANSFERRED');
    expect(after.leavingReason).toBe('Moved city');
    const closed = await prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollment.id },
    });
    expect(closed.status).toBe('TRANSFERRED'); // EnrollmentStatus is unchanged by M7
    const promotion = await prisma.studentPromotion.findFirstOrThrow({
      where: { studentId: student.id },
    });
    expect(promotion.decision).toBe('TRANSFERRED');
    ids.student2 = student.id;
  });

  it('BL-61: the retired decision TRANSFERRED_OUT is rejected (400)', async () => {
    const token = await loginAs('promo-school-admin@schoolos.edu.pk');
    await request(app.getHttpServer())
      .post('/api/v1/promotions/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({
        sourceAcademicSessionId: ids.sourceSession,
        confirmed: true,
        targetAcademicSessionId: ids.targetSession,
        decisions: [{ studentId: ids.student2, decision: 'TRANSFERRED_OUT' }],
      })
      .expect(400);
  });

  it('BL-61: a profile edit cannot set the retired status LEFT (400) but can set TRANSFERRED', async () => {
    const token = await loginAs('promo-school-admin@schoolos.edu.pk');
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/students/${ids.student2}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'LEFT' })
      .expect(400);
    expect(JSON.stringify(res.body)).toContain('TRANSFERRED');
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/students/${ids.student2}/profile`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'TRANSFERRED' })
      .expect(200);
  });

  describe('BL-05: indicators, blocking rules, conditions, confirmation, untouched history', () => {
    let token: string;
    let student3: string;
    let enrollment3: string;
    const snapshot = async () =>
      JSON.stringify({
        attendance: await prisma.attendance.findMany({
          where: { studentId: student3 },
          orderBy: { date: 'asc' },
          select: { date: true, status: true, updatedAt: true },
        }),
        marks: await prisma.mark.findMany({
          where: { studentId: student3 },
          select: { obtainedMarks: true, updatedAt: true },
        }),
        vouchers: await prisma.feeVoucher.findMany({
          where: { studentId: student3 },
          select: {
            academicSessionId: true,
            month: true,
            updatedAt: true,
            items: { select: { label: true, amount: true } },
          },
        }),
      });

    beforeAll(async () => {
      token = await loginAs('promo-school-admin@schoolos.edu.pk');
      const admin = await prisma.user.findUniqueOrThrow({
        where: { identifier: 'promo-school-admin@schoolos.edu.pk' },
      });
      const student = await prisma.student.create({
        data: { grNumber: 'PROMO-3', name: 'Promo Student Three' },
      });
      student3 = student.id;
      enrollment3 = (
        await prisma.enrollment.create({
          data: {
            studentId: student3,
            campusId: ids.campusA,
            sectionId: ids.sourceSection,
            academicSessionId: ids.sourceSession,
            startDate: new Date('2025-08-01'),
            status: 'ACTIVE',
          },
        })
      ).id;
      // attendance 3 present / 2 absent (+1 leave, excused) = 60 %
      const days: Array<['PRESENT' | 'ABSENT' | 'LEAVE', string]> = [
        ['PRESENT', '2025-09-01'],
        ['PRESENT', '2025-09-02'],
        ['PRESENT', '2025-09-03'],
        ['ABSENT', '2025-09-04'],
        ['ABSENT', '2025-09-05'],
        ['LEAVE', '2025-09-08'],
      ];
      for (const [status, date] of days) {
        await prisma.attendance.create({
          data: { studentId: student3, date: new Date(date), status },
        });
      }
      // results 30 / 100 = 30 %
      const sourceClass = await prisma.section.findUniqueOrThrow({
        where: { id: ids.sourceSection },
        select: { classId: true },
      });
      const term = await prisma.term.create({
        data: {
          academicSessionId: ids.sourceSession,
          label: 'PROMO Term 1',
          order: 1,
          startDate: new Date('2025-08-01'),
          endDate: new Date('2025-12-31'),
        },
      });
      const category = await prisma.assessmentCategory.create({
        data: {
          classId: sourceClass.classId,
          termId: term.id,
          name: 'PROMO Exams',
          weightPercent: 100,
        },
      });
      const subject = await prisma.subject.create({
        data: { name: 'PROMO Maths', schoolId: ids.schoolA },
      });
      const assessment = await prisma.assessment.create({
        data: {
          assessmentCategoryId: category.id,
          subjectId: subject.id,
          label: 'PROMO Final',
          maxMarks: 100,
        },
      });
      await prisma.mark.create({
        data: {
          assessmentId: assessment.id,
          studentId: student3,
          obtainedMarks: 30,
          enteredById: admin.id,
        },
      });
      // one unpaid voucher of Rs 50.00
      await prisma.feeVoucher.create({
        data: {
          studentId: student3,
          academicSessionId: ids.sourceSession,
          month: '2025-09',
          issueDate: new Date('2025-09-01'),
          dueDate: new Date('2025-09-10'),
          items: { create: [{ label: 'Tuition', amount: 5000 }] },
        },
      });
    });

    const execute = (decision: Record<string, unknown>, confirmed = true) =>
      request(app.getHttpServer())
        .post('/api/v1/promotions/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({
          sourceAcademicSessionId: ids.sourceSession,
          targetAcademicSessionId: ids.targetSession,
          confirmed,
          decisions: [{ studentId: student3, ...decision }],
        });

    it('the preview shows results, attendance and fee indicators as non-blocking warnings', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/promotions/preview?sourceSectionId=${ids.sourceSection}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      const row = res.body.rows.find(
        (r: { studentId: string }) => r.studentId === student3,
      );
      expect(row.indicators.attendance).toEqual({
        present: 3,
        late: 0,
        absent: 2,
        leave: 1,
        percent: 60,
      });
      expect(row.indicators.results).toEqual({
        obtained: 30,
        max: 100,
        assessments: 1,
        percent: 30,
      });
      expect(row.indicators.fees).toEqual({
        outstanding: 5000,
        unpaidVouchers: 1,
      });
      expect(
        row.indicators.warnings.map(
          (w: { code: string; blocking: boolean }) => [w.code, w.blocking],
        ),
      ).toEqual([
        ['LOW_ATTENDANCE', false],
        ['LOW_RESULTS', false],
        ['FEES_OUTSTANDING', false],
      ]);
      expect(row.indicators.blocked).toBe(false);
    });

    it('a school admin sets a blocking fee rule; another school cannot read or change it', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/promotions/policy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          minAttendancePercent: 75,
          minResultPercent: 40,
          blockOnAttendance: false,
          blockOnResults: false,
          blockOnFees: true,
        })
        .expect(200);
      const got = await request(app.getHttpServer())
        .get('/api/v1/promotions/policy')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(got.body).toEqual(
        expect.objectContaining({ schoolId: ids.schoolA, blockOnFees: true }),
      );
      const audit = await prisma.auditLog.count({
        where: { action: 'promotion-policy.update', entityId: ids.schoolA },
      });
      expect(audit).toBe(1);

      const tokenB = await loginAs('promo-school-admin-b@schoolos.edu.pk');
      await request(app.getHttpServer())
        .get(`/api/v1/promotions/policy?schoolId=${ids.schoolA}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
      await request(app.getHttpServer())
        .put('/api/v1/promotions/policy')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          schoolId: ids.schoolA,
          minAttendancePercent: 0,
          minResultPercent: 0,
          blockOnAttendance: false,
          blockOnResults: false,
          blockOnFees: false,
        })
        .expect(403);
    });

    it('an unconfirmed batch is refused (400) and changes nothing', async () => {
      await execute(
        { decision: 'RETAINED', targetSectionId: ids.targetSection },
        false,
      ).expect(400);
      const e = await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollment3 },
      });
      expect(e.status).toBe('ACTIVE');
    });

    it('the blocking rule refuses a plain PROMOTED (409) and changes nothing', async () => {
      const res = await execute({
        decision: 'PROMOTED',
        targetSectionId: ids.targetSection,
      }).expect(409);
      expect(res.body.message).toContain('Fees outstanding');
      const e = await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollment3 },
      });
      expect(e.status).toBe('ACTIVE');
      expect(
        await prisma.studentPromotion.count({ where: { studentId: student3 } }),
      ).toBe(0);
    });

    it('PROMOTED_WITH_CONDITIONS needs conditions (400), then records them with the indicators; prior-session data is untouched', async () => {
      await execute({
        decision: 'PROMOTED_WITH_CONDITIONS',
        targetSectionId: ids.targetSection,
      }).expect(400);

      const before = await snapshot();
      await execute({
        decision: 'PROMOTED_WITH_CONDITIONS',
        targetSectionId: ids.targetSection,
        conditions: 'Clear the September dues by the first term',
      }).expect(201);

      // session rollover: the source session's attendance, marks and vouchers are exactly as before
      expect(await snapshot()).toBe(before);
      const old = await prisma.enrollment.findUniqueOrThrow({
        where: { id: enrollment3 },
      });
      expect(old.academicSessionId).toBe(ids.sourceSession);
      expect(old.status).toBe('COMPLETED');
      const current = await prisma.enrollment.findFirstOrThrow({
        where: { studentId: student3, status: 'ACTIVE' },
      });
      expect(current.academicSessionId).toBe(ids.targetSession);

      const history = await request(app.getHttpServer())
        .get(`/api/v1/admin/students/${student3}/promotion-history`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(history.body).toHaveLength(1);
      expect(history.body[0]).toEqual(
        expect.objectContaining({
          decision: 'PROMOTED_WITH_CONDITIONS',
          conditions: 'Clear the September dues by the first term',
        }),
      );
      expect(history.body[0].indicators.blocked).toBe(true);
      expect(history.body[0].indicators.fees.outstanding).toBe(5000);
    });

    it('promotion history cannot be modified (DB trigger)', async () => {
      await expect(
        prisma.studentPromotion.updateMany({
          where: { studentId: student3 },
          data: { remarks: 'rewritten' },
        }),
      ).rejects.toThrow(/cannot be modified/);
    });
  });
});
