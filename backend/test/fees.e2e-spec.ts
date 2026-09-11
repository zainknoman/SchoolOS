import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Fees (e2e)', () => {
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

    await prisma.user.deleteMany({ where: { identifier: { startsWith: 'fee-' } } }).catch(() => undefined);
    const staleStudents = await prisma.student.findMany({ where: { grNumber: { startsWith: 'FEE-' } } });
    for (const s of staleStudents) {
      await prisma.feePaymentAllocation
        .deleteMany({ where: { feeVoucher: { studentId: s.id } } })
        .catch(() => undefined);
      await prisma.feeVoucher.deleteMany({ where: { studentId: s.id } }).catch(() => undefined);
    }
    await prisma.student.deleteMany({ where: { grNumber: { startsWith: 'FEE-' } } }).catch(() => undefined);
    await prisma.feeStructure.deleteMany({ where: { name: 'FEE E2E Tuition' } }).catch(() => undefined);
    const stale = await prisma.school.findMany({ where: { name: 'FEE E2E School' } });
    for (const s of stale) {
      await prisma.school.delete({ where: { id: s.id } }).catch(() => undefined);
    }

    const school = await prisma.school.create({ data: { name: 'FEE E2E School' } });
    const campus = await prisma.campus.create({ data: { schoolId: school.id, name: 'Main' } });
    const session = await prisma.academicSession.upsert({
      where: { id: 'fee-e2e-session' },
      update: { isActive: true },
      create: {
        id: 'fee-e2e-session',
        label: 'FEE',
        startDate: new Date(),
        endDate: new Date(),
        isActive: true,
      },
    });
    const klass = await prisma.class.create({
      data: { campusId: campus.id, academicSessionId: session.id, name: 'FEE Grade' },
    });
    const section = await prisma.section.create({ data: { classId: klass.id, name: 'FEE-A' } });

    const passwordHash = await argon2.hash(password);
    const adminUser = await prisma.user.create({
      data: { identifier: 'fee-admin@seeds.edu.pk', passwordHash, role: 'SCHOOL_ADMIN' },
    });
    const teacherUser = await prisma.user.create({
      data: { identifier: 'fee-teacher@seeds.edu.pk', passwordHash, role: 'TEACHER' },
    });
    await prisma.teacher.create({ data: { userId: teacherUser.id, name: 'FEE Teacher' } });

    const parentAUser = await prisma.user.create({
      data: { identifier: 'fee-parent-a@seeds.edu.pk', passwordHash, role: 'PARENT' },
    });
    const parentBUser = await prisma.user.create({
      data: { identifier: 'fee-parent-b@seeds.edu.pk', passwordHash, role: 'PARENT' },
    });
    const parentAProfile = await prisma.parentProfile.create({
      data: { userId: parentAUser.id, name: 'FEE Parent A' },
    });
    const parentBProfile = await prisma.parentProfile.create({
      data: { userId: parentBUser.id, name: 'FEE Parent B' },
    });

    const childA = await prisma.student.create({ data: { grNumber: 'FEE-A1', name: 'FEE Child A' } });
    const childB = await prisma.student.create({ data: { grNumber: 'FEE-B1', name: 'FEE Child B' } });
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
    await prisma.studentParent.create({ data: { studentId: childA.id, parentProfileId: parentAProfile.id } });
    await prisma.studentParent.create({ data: { studentId: childB.id, parentProfileId: parentBProfile.id } });

    const structure = await prisma.feeStructure.create({ data: { name: 'FEE E2E Tuition', amount: 500000 } });

    Object.assign(ids, {
      school: school.id,
      childA: childA.id,
      childB: childB.id,
      structure: structure.id,
    });
  });

  afterAll(async () => {
    await prisma.feePaymentAllocation
      .deleteMany({ where: { feeVoucher: { studentId: ids.childA } } })
      .catch(() => undefined);
    await prisma.feeVoucher.deleteMany({ where: { studentId: ids.childA } }).catch(() => undefined);
    await prisma.feeStructure.delete({ where: { id: ids.structure } }).catch(() => undefined);
    await prisma.student
      .deleteMany({ where: { grNumber: { in: ['FEE-A1', 'FEE-B1'] } } })
      .catch(() => undefined);
    await prisma.school.delete({ where: { id: ids.school } }).catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          identifier: {
            in: ['fee-admin@seeds.edu.pk', 'fee-teacher@seeds.edu.pk', 'fee-parent-a@seeds.edu.pk', 'fee-parent-b@seeds.edu.pk'],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  it('a TEACHER cannot issue vouchers — issuance is Admin/Accounts only', async () => {
    const teacherToken = await loginAs('fee-teacher@seeds.edu.pk');

    await request(app.getHttpServer())
      .post('/api/v1/fee-vouchers')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ studentIds: [ids.childA], month: '2026-09', dueDate: '2026-09-25', feeStructureIds: [ids.structure] })
      .expect(403);
  });

  it('an admin issues a voucher, a second issue for the same student+month is rejected, and the owning parent sees a server-computed amountDue', async () => {
    const adminToken = await loginAs('fee-admin@seeds.edu.pk');

    const issued = await request(app.getHttpServer())
      .post('/api/v1/fee-vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [ids.childA], month: '2026-09', dueDate: '2026-09-25', feeStructureIds: [ids.structure] })
      .expect(201);
    ids.voucher = issued.body[0].id;

    await request(app.getHttpServer())
      .post('/api/v1/fee-vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [ids.childA], month: '2026-09', dueDate: '2026-09-25', feeStructureIds: [ids.structure] })
      .expect(400);

    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');
    const fees = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/fees`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(fees.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.voucher, amountDue: 500000, status: 'unpaid' }),
      ]),
    );

    const parentBToken = await loginAs('fee-parent-b@seeds.edu.pk');
    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childB}/fees`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(403);
    // sanity: parent B *can* see their own (empty) list
    await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childB}/fees`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .expect(200);
  });

  it("a parent cannot pay another parent's child's voucher", async () => {
    const parentBToken = await loginAs('fee-parent-b@seeds.edu.pk');

    await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${ids.voucher}/pay`)
      .set('Authorization', `Bearer ${parentBToken}`)
      .send({ method: 'jazzcash' })
      .expect(403);
  });

  it('a parent pays a voucher end-to-end via the stub gateway webhook, and can then download the receipt PDF', async () => {
    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');

    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${ids.voucher}/pay`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ method: 'jazzcash' })
      .expect(201);
    expect(initiated.body.redirectUrl).toBeDefined();
    const paymentId = initiated.body.paymentId as string;
    const reference = new URL(`http://x${initiated.body.redirectUrl}`).searchParams.get('ref');

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/stub')
      .set('x-stub-signature', 'dev-only-stub-webhook-secret')
      .send({ reference, status: 'completed' })
      .expect(200);

    const payment = await request(app.getHttpServer())
      .get(`/api/v1/fee-payments/${paymentId}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(payment.body).toEqual(expect.objectContaining({ status: 'completed', voucherIds: [ids.voucher] }));

    const fees = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/fees`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(fees.body.find((v: { id: string }) => v.id === ids.voucher)).toEqual(
      expect.objectContaining({ amountDue: 0, status: 'paid' }),
    );

    const receipt = await request(app.getHttpServer())
      .get(`/api/v1/fee-payments/${paymentId}/receipt.pdf`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(receipt.headers['content-type']).toBe('application/pdf');
  });

  it('a repeated webhook call for an already-completed payment is a no-op', async () => {
    const adminToken = await loginAs('fee-admin@seeds.edu.pk');
    const issued = await request(app.getHttpServer())
      .post('/api/v1/fee-vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [ids.childA], month: '2026-10', dueDate: '2026-10-10', feeStructureIds: [ids.structure] })
      .expect(201);
    const voucherId = issued.body[0].id;

    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${voucherId}/pay`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ method: 'jazzcash' })
      .expect(201);
    const reference = new URL(`http://x${initiated.body.redirectUrl}`).searchParams.get('ref');

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/stub')
      .set('x-stub-signature', 'dev-only-stub-webhook-secret')
      .send({ reference, status: 'completed' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/stub')
      .set('x-stub-signature', 'dev-only-stub-webhook-secret')
      .send({ reference, status: 'completed' })
      .expect(200);

    const payments = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/fees/payments`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    const matching = payments.body.filter((p: { voucherIds: string[] }) => p.voucherIds.includes(voucherId));
    expect(matching).toHaveLength(1);
  });

  it('an unsigned webhook call is rejected and does not mutate payment state', async () => {
    const adminToken = await loginAs('fee-admin@seeds.edu.pk');
    const issued = await request(app.getHttpServer())
      .post('/api/v1/fee-vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [ids.childA], month: '2026-11', dueDate: '2026-11-10', feeStructureIds: [ids.structure] })
      .expect(201);
    const voucherId = issued.body[0].id;

    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');
    const initiated = await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${voucherId}/pay`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .send({ method: 'jazzcash' })
      .expect(201);
    const reference = new URL(`http://x${initiated.body.redirectUrl}`).searchParams.get('ref');

    await request(app.getHttpServer())
      .post('/api/v1/payments/webhook/stub')
      .set('x-stub-signature', 'wrong-secret')
      .send({ reference, status: 'completed' })
      .expect(401);

    const payment = await request(app.getHttpServer())
      .get(`/api/v1/fee-payments/${initiated.body.paymentId}`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(payment.body.status).toBe('pending');
  });

  it('the old client-callable confirm route no longer exists', async () => {
    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');
    await request(app.getHttpServer())
      .post('/api/v1/fee-payments/some-id/confirm')
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(404);
  });

  it('staff records a cash payment against a voucher, and it appears completed with a receipt', async () => {
    const adminToken = await loginAs('fee-admin@seeds.edu.pk');
    const issued = await request(app.getHttpServer())
      .post('/api/v1/fee-vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [ids.childA], month: '2026-12', dueDate: '2026-12-10', feeStructureIds: [ids.structure] })
      .expect(201);
    const voucherId = issued.body[0].id;

    const reconciled = await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${voucherId}/reconcile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 500000, method: 'cash', note: 'Paid at front office' })
      .expect(201);
    expect(reconciled.body).toEqual(expect.objectContaining({ status: 'completed', method: 'cash' }));

    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');
    const fees = await request(app.getHttpServer())
      .get(`/api/v1/students/${ids.childA}/fees`)
      .set('Authorization', `Bearer ${parentAToken}`)
      .expect(200);
    expect(fees.body.find((v: { id: string }) => v.id === voucherId)).toEqual(
      expect.objectContaining({ status: 'paid', amountDue: 0 }),
    );
  });

  it("reconciling more than a voucher's remaining balance is rejected", async () => {
    const adminToken = await loginAs('fee-admin@seeds.edu.pk');
    const issued = await request(app.getHttpServer())
      .post('/api/v1/fee-vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [ids.childA], month: '2027-01', dueDate: '2027-01-10', feeStructureIds: [ids.structure] })
      .expect(201);
    const voucherId = issued.body[0].id;

    await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${voucherId}/reconcile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: 99999999, method: 'cash' })
      .expect(400);
  });

  it('a TEACHER cannot reconcile a payment', async () => {
    const adminToken = await loginAs('fee-admin@seeds.edu.pk');
    const issued = await request(app.getHttpServer())
      .post('/api/v1/fee-vouchers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [ids.childA], month: '2027-02', dueDate: '2027-02-10', feeStructureIds: [ids.structure] })
      .expect(201);
    const voucherId = issued.body[0].id;

    const teacherToken = await loginAs('fee-teacher@seeds.edu.pk');
    await request(app.getHttpServer())
      .post(`/api/v1/fee-vouchers/${voucherId}/reconcile`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ amount: 100, method: 'cash' })
      .expect(403);
  });

  it('a voucher PDF is downloadable by the owning parent via the ?access_token= fallback', async () => {
    const parentAToken = await loginAs('fee-parent-a@seeds.edu.pk');

    const res = await request(app.getHttpServer())
      .get(`/api/v1/fee-vouchers/${ids.voucher}/pdf?access_token=${parentAToken}`)
      .expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
  });
});
