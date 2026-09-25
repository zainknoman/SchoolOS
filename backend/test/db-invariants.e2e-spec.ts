import request from 'supertest';
import { Prisma } from '@prisma/client';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/**
 * BL-53 (M12): the database, not only the code, keeps one ACTIVE enrolment per student and one
 * voucher per student/session/month — also when two requests race each other.
 */
describe('DB invariants under concurrent writes (e2e)', () => {
  let f: TwoSchools;
  let token: string;
  let structureId: string;
  let nextSessionId: string;
  let nextSectionId: string;
  const http = () => request(f.app.getHttpServer());

  beforeAll(async () => {
    f = await createTwoSchools('bl53');
    token = await f.login('admin-a');
    structureId = (
      await f.prisma.feeStructure.create({
        data: {
          schoolId: f.ids.schoolA,
          name: 'BL53 Tuition',
          amount: 5000,
          status: 'ACTIVE',
        },
      })
    ).id;
    nextSessionId = (
      await f.prisma.academicSession.create({
        data: {
          schoolId: f.ids.schoolA,
          label: 'BL53 next',
          startDate: new Date('2027-01-01'),
          endDate: new Date('2027-12-31'),
          isActive: false,
        },
      })
    ).id;
    const klass = await f.prisma.class.create({
      data: {
        campusId: f.ids.campusA,
        academicSessionId: nextSessionId,
        name: 'BL53 Grade next',
      },
    });
    nextSectionId = (
      await f.prisma.section.create({
        data: { classId: klass.id, name: 'BL53-next' },
      })
    ).id;
  });

  afterAll(async () => {
    const students = { grNumber: { startsWith: 'BL53-' } };
    await f.prisma.studentPromotion.deleteMany({
      where: { student: students },
    });
    await f.prisma.feeVoucher.deleteMany({ where: { student: students } });
    await f.prisma.feeStructure.deleteMany({ where: { id: structureId } });
    await f.prisma.enrollment.deleteMany({
      where: { academicSessionId: nextSessionId },
    });
    await f.prisma.section.deleteMany({ where: { id: nextSectionId } });
    await f.prisma.class.deleteMany({
      where: { academicSessionId: nextSessionId },
    });
    await f.prisma.academicSession.deleteMany({ where: { id: nextSessionId } });
    await f.close();
  });

  it('two simultaneous voucher runs for the same student and month create exactly one voucher', async () => {
    const body = {
      studentIds: [f.ids.studentA],
      month: '2026-05',
      dueDate: '2026-05-10',
      feeStructureIds: [structureId],
    };
    const results = await Promise.all(
      [0, 1, 2].map(() =>
        http()
          .post('/api/v1/fee-vouchers')
          .set('Authorization', `Bearer ${token}`)
          .send(body),
      ),
    );
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    // The losers see either the pre-check (400) or, when they truly overlapped, the index (409).
    for (const c of codes.filter((x) => x !== 201))
      expect([400, 409]).toContain(c);
    expect(
      await f.prisma.feeVoucher.count({
        where: { studentId: f.ids.studentA, month: '2026-05' },
      }),
    ).toBe(1);
  });

  it('the database itself refuses a duplicate voucher and a second ACTIVE enrolment', async () => {
    const voucher = await f.prisma.feeVoucher.findFirstOrThrow({
      where: { studentId: f.ids.studentA, month: '2026-05' },
    });
    await expect(
      f.prisma.feeVoucher.create({
        data: {
          studentId: voucher.studentId,
          academicSessionId: voucher.academicSessionId,
          month: voucher.month,
          issueDate: new Date(),
          dueDate: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    const active = await f.prisma.enrollment.findFirstOrThrow({
      where: { studentId: f.ids.studentA, status: 'ACTIVE' },
    });
    await expect(
      f.prisma.enrollment.create({
        data: {
          studentId: active.studentId,
          campusId: active.campusId,
          sectionId: active.sectionId,
          academicSessionId: active.academicSessionId,
          startDate: new Date(),
          status: 'ACTIVE',
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it('two simultaneous promotions of the same student leave exactly one ACTIVE enrolment', async () => {
    const body = {
      sourceAcademicSessionId: f.ids.sessionA,
      targetAcademicSessionId: nextSessionId,
      confirmed: true,
      decisions: [
        {
          studentId: f.ids.studentANoTeacher,
          decision: 'PROMOTED',
          targetSectionId: nextSectionId,
        },
      ],
    };
    const results = await Promise.all(
      [0, 1].map(() =>
        http()
          .post('/api/v1/promotions/execute')
          .set('Authorization', `Bearer ${token}`)
          .send(body),
      ),
    );
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 201)).toHaveLength(1);
    for (const c of codes.filter((x) => x !== 201))
      expect([400, 409]).toContain(c);
    expect(
      await f.prisma.enrollment.count({
        where: { studentId: f.ids.studentANoTeacher, status: 'ACTIVE' },
      }),
    ).toBe(1);
  });
});
