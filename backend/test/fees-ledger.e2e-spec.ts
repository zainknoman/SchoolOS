import request from 'supertest';
import {
  createTwoSchools,
  type TwoSchools,
} from './pending/two-school-fixture';

/**
 * BL-08 (Q9, BR-FEE-06..10): the pilot fee ledger — standing discounts/scholarships, one-off
 * adjustments and their reversals, manual payments and payment reversals, late fees, outstanding
 * balances / defaulters and carry-forward — all school-scoped, with paid history immutable.
 */
describe('Fee ledger (e2e, BL-08)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const future = new Date(Date.now() + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const past = new Date(Date.now() - 20 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  let structureA: string;
  let structureB: string;
  let oldSessionA: string;
  let oldVoucherA: string;
  let voucherM1: string;
  let voucherM2: string;

  beforeAll(async () => {
    f = await createTwoSchools('bl08');
    const adminA = await f.prisma.user.findUniqueOrThrow({
      where: { identifier: 'bl08-admin-a' },
    });
    await f.prisma.user.create({
      data: {
        identifier: 'bl08-accounts-a',
        passwordHash: adminA.passwordHash,
        role: 'ACCOUNTS',
        schoolId: f.ids.schoolA,
      },
    });
    for (const who of [
      'super',
      'admin-a',
      'admin-b',
      'accounts-a',
      'parent-a',
    ]) {
      tokens[who] = await f.login(who);
    }
    structureA = (
      await f.prisma.feeStructure.create({
        data: {
          schoolId: f.ids.schoolA,
          name: 'BL08 Tuition A',
          amount: 100000,
        },
      })
    ).id;
    structureB = (
      await f.prisma.feeStructure.create({
        data: {
          schoolId: f.ids.schoolB,
          name: 'BL08 Tuition B',
          amount: 100000,
        },
      })
    ).id;
    // A finished earlier session of school A with an unpaid voucher (for carry-forward).
    oldSessionA = (
      await f.prisma.academicSession.create({
        data: {
          schoolId: f.ids.schoolA,
          label: 'BL08 OLD',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
          isActive: false,
        },
      })
    ).id;
    oldVoucherA = (
      await f.prisma.feeVoucher.create({
        data: {
          studentId: f.ids.studentA,
          academicSessionId: oldSessionA,
          month: '2025-12',
          issueDate: new Date('2025-12-01'),
          dueDate: new Date('2025-12-10'),
          items: { create: [{ label: 'BL08 Tuition A', amount: 30000 }] },
        },
      })
    ).id;
  });

  // The fixture removes the students' fee ledger (payments, lines, vouchers) before the schools,
  // whose deletion cascades to their fee structures.
  afterAll(() => f.close());

  describe('cross-school boundary (fixed in BL-08)', () => {
    it('a school admin cannot issue vouchers to another school', async () => {
      await http()
        .post('/api/v1/fee-vouchers')
        .set(as('admin-a'))
        .send({
          studentIds: [f.ids.studentB],
          month: '2026-02',
          dueDate: future,
          feeStructureIds: [structureB],
        })
        .expect(403);
      await http()
        .post('/api/v1/fee-vouchers')
        .set(as('admin-a'))
        .send({
          sectionId: f.ids.sectionB,
          month: '2026-02',
          dueDate: future,
          feeStructureIds: [structureB],
        })
        .expect(403);
      expect(
        await f.prisma.feeVoucher.count({
          where: { studentId: f.ids.studentB },
        }),
      ).toBe(0);
    });

    it("a school admin cannot record a payment on another school's voucher", async () => {
      await http()
        .post(`/api/v1/fee-vouchers/${oldVoucherA}/reconcile`)
        .set(as('admin-b'))
        .send({ amount: 100, method: 'cash' })
        .expect(403);
    });
  });

  describe('concessions (discounts / scholarships)', () => {
    it('another school cannot grant a concession to our student', async () => {
      await http()
        .post(`/api/v1/students/${f.ids.studentA}/fee-concessions`)
        .set(as('admin-b'))
        .send({ kind: 'SCHOLARSHIP', label: 'Merit', percent: 10, reason: 'x' })
        .expect(403);
    });

    it('rejects a concession with both or neither of percent / amount', async () => {
      await http()
        .post(`/api/v1/students/${f.ids.studentA}/fee-concessions`)
        .set(as('accounts-a'))
        .send({ kind: 'DISCOUNT', label: 'Sibling', reason: 'x' })
        .expect(400);
      await http()
        .post(`/api/v1/students/${f.ids.studentA}/fee-concessions`)
        .set(as('accounts-a'))
        .send({
          kind: 'DISCOUNT',
          label: 'Sibling',
          percent: 5,
          amount: 10,
          reason: 'x',
        })
        .expect(400);
    });

    it('an active scholarship becomes a line on each voucher issued', async () => {
      const c = await http()
        .post(`/api/v1/students/${f.ids.studentA}/fee-concessions`)
        .set(as('accounts-a'))
        .send({
          kind: 'SCHOLARSHIP',
          label: 'Merit scholarship',
          percent: 10,
          reason: 'Board result',
        })
        .expect(201);
      expect(c.body).toMatchObject({
        kind: 'SCHOLARSHIP',
        percent: 10,
        isActive: true,
      });

      const issued = await http()
        .post('/api/v1/fee-vouchers')
        .set(as('accounts-a'))
        .send({
          sectionId: f.ids.sectionA,
          month: '2026-03',
          dueDate: future,
          feeStructureIds: [structureA],
        })
        .expect(201);
      const v = issued.body.find(
        (x: { studentId: string }) => x.studentId === f.ids.studentA,
      );
      voucherM1 = v.id;
      expect(v.totalAmount).toBe(90000);
      expect(v.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'CHARGE', amount: 100000 }),
          expect.objectContaining({
            kind: 'SCHOLARSHIP',
            amount: -10000,
            label: 'Merit scholarship',
          }),
        ]),
      );

      const list = await http()
        .get(`/api/v1/students/${f.ids.studentA}/fee-concessions`)
        .set(as('admin-a'))
        .expect(200);
      expect(list.body).toHaveLength(1);
      await http()
        .post(`/api/v1/fee-concessions/${c.body.id}/end`)
        .set(as('admin-b'))
        .expect(403);
      await http()
        .post(`/api/v1/fee-concessions/${c.body.id}/end`)
        .set(as('admin-a'))
        .expect(201);
    });
  });

  describe('adjustments and reversals', () => {
    let discountItemId: string;

    it('adds a one-off discount as its own line (audited)', async () => {
      const res = await http()
        .post(`/api/v1/fee-vouchers/${voucherM1}/adjustments`)
        .set(as('accounts-a'))
        .send({ kind: 'DISCOUNT', amount: 5000, reason: 'Hardship' })
        .expect(201);
      expect(res.body.totalAmount).toBe(85000);
      const line = res.body.items.find(
        (i: { kind: string }) => i.kind === 'DISCOUNT',
      );
      expect(line).toMatchObject({ amount: -5000, reason: 'Hardship' });
      discountItemId = line.id;
      expect(
        await f.prisma.auditLog.count({
          where: { action: 'fee-voucher.adjust', entityId: voucherM1 },
        }),
      ).toBe(1);
    });

    it('a reduction may not exceed what is still due, and needs a reason', async () => {
      await http()
        .post(`/api/v1/fee-vouchers/${voucherM1}/adjustments`)
        .set(as('accounts-a'))
        .send({ kind: 'WAIVER', amount: 85001, reason: 'too much' })
        .expect(400);
      await http()
        .post(`/api/v1/fee-vouchers/${voucherM1}/adjustments`)
        .set(as('accounts-a'))
        .send({ kind: 'WAIVER', amount: 100 })
        .expect(400);
      await http()
        .post(`/api/v1/fee-vouchers/${voucherM1}/adjustments`)
        .set(as('admin-b'))
        .send({ kind: 'WAIVER', amount: 100, reason: 'x' })
        .expect(403);
    });

    it('reverses a discount with a reversing line, once', async () => {
      const res = await http()
        .post(`/api/v1/fee-items/${discountItemId}/reverse`)
        .set(as('admin-a'))
        .send({ reason: 'Entered by mistake' })
        .expect(201);
      expect(res.body.totalAmount).toBe(90000);
      expect(
        res.body.items.find(
          (i: { reversesItemId?: string }) =>
            i.reversesItemId === discountItemId,
        ),
      ).toMatchObject({ amount: 5000, kind: 'DISCOUNT' });
      await http()
        .post(`/api/v1/fee-items/${discountItemId}/reverse`)
        .set(as('admin-a'))
        .send({ reason: 'again' })
        .expect(400);
      const charge = await f.prisma.feeItem.findFirstOrThrow({
        where: { feeVoucherId: voucherM1, kind: 'CHARGE' },
      });
      await http()
        .post(`/api/v1/fee-items/${charge.id}/reverse`)
        .set(as('admin-a'))
        .send({ reason: 'charges are waived, not reversed' })
        .expect(400);
    });

    it('the database refuses to edit a voucher line', async () => {
      await expect(
        f.prisma.feeItem.update({
          where: { id: discountItemId },
          data: { amount: -1 },
        }),
      ).rejects.toThrow(/cannot be changed/);
    });
  });

  describe('manual payments and reversals', () => {
    let paymentId: string;

    it('a partial payment leaves an outstanding balance and a receipt', async () => {
      const res = await http()
        .post(`/api/v1/fee-vouchers/${voucherM1}/reconcile`)
        .set(as('accounts-a'))
        .send({ amount: 40000, method: 'cash', note: 'counter 1' })
        .expect(201);
      paymentId = res.body.id;
      expect(res.body.receiptId).toBeTruthy();
      const fees = await http()
        .get(`/api/v1/students/${f.ids.studentA}/fees`)
        .set(as('parent-a'))
        .expect(200);
      expect(
        fees.body.find((v: { id: string }) => v.id === voucherM1),
      ).toMatchObject({
        amountPaid: 40000,
        amountDue: 50000,
        status: 'partial',
      });
    });

    it('the database refuses to edit a settled payment', async () => {
      await expect(
        f.prisma.feePayment.update({
          where: { id: paymentId },
          data: { amount: 1 },
        }),
      ).rejects.toThrow(/cannot be changed/);
      await expect(
        f.prisma.feePaymentAllocation.updateMany({
          where: { feePaymentId: paymentId },
          data: { amount: 1 },
        }),
      ).rejects.toThrow(/cannot be changed/);
    });

    it('a mistaken payment is corrected by a reversal, once; other schools cannot', async () => {
      await http()
        .post(`/api/v1/fee-payments/${paymentId}/reverse`)
        .set(as('admin-b'))
        .send({ reason: 'x' })
        .expect(403);
      const rev = await http()
        .post(`/api/v1/fee-payments/${paymentId}/reverse`)
        .set(as('accounts-a'))
        .send({ reason: 'Wrong student' })
        .expect(201);
      expect(rev.body).toMatchObject({
        amount: -40000,
        status: 'completed',
        reversesPaymentId: paymentId,
      });
      await http()
        .post(`/api/v1/fee-payments/${paymentId}/reverse`)
        .set(as('accounts-a'))
        .send({ reason: 'again' })
        .expect(400);
      await http()
        .post(`/api/v1/fee-payments/${rev.body.id}/reverse`)
        .set(as('accounts-a'))
        .send({ reason: 'reverse the reversal' })
        .expect(400);
      const fees = await http()
        .get(`/api/v1/students/${f.ids.studentA}/fees`)
        .set(as('admin-a'))
        .expect(200);
      expect(
        fees.body.find((v: { id: string }) => v.id === voucherM1),
      ).toMatchObject({
        amountPaid: 0,
        amountDue: 90000,
      });
    });
  });

  describe('late fees', () => {
    it('policy: defaults, school-scoped update (audited)', async () => {
      const def = await http()
        .get('/api/v1/fee-policy')
        .set(as('admin-a'))
        .expect(200);
      expect(def.body).toEqual({
        schoolId: f.ids.schoolA,
        lateFeeAmount: 0,
        lateFeeGraceDays: 0,
      });
      await http()
        .put('/api/v1/fee-policy')
        .set(as('accounts-a'))
        .send({ lateFeeAmount: 20000, lateFeeGraceDays: 5 })
        .expect(200);
      const b = await http()
        .get('/api/v1/fee-policy')
        .set(as('admin-b'))
        .expect(200);
      expect(b.body.lateFeeAmount).toBe(0);
      await http()
        .put('/api/v1/fee-policy')
        .set(as('super'))
        .send({ lateFeeAmount: 1 })
        .expect(400); // SUPER_ADMIN must name the school
    });

    it('applies one late fee per overdue voucher, past the grace days', async () => {
      voucherM2 = (
        await http()
          .post('/api/v1/fee-vouchers')
          .set(as('accounts-a'))
          .send({
            studentIds: [f.ids.studentA],
            month: '2026-04',
            dueDate: past,
            feeStructureIds: [structureA],
          })
          .expect(201)
      ).body[0].id;
      // Another school's run touches nothing of school A.
      const other = await http()
        .post('/api/v1/fee-vouchers/apply-late-fees')
        .set(as('admin-b'))
        .expect(201);
      expect(other.body.voucherIds).not.toContain(voucherM2);

      const run = await http()
        .post('/api/v1/fee-vouchers/apply-late-fees')
        .set(as('accounts-a'))
        .expect(201);
      expect(run.body.voucherIds).toContain(voucherM2);
      expect(run.body.voucherIds).not.toContain(voucherM1); // not due yet
      expect(run.body.voucherIds).not.toContain(oldVoucherA); // earlier session: carry-forward handles it
      const again = await http()
        .post('/api/v1/fee-vouchers/apply-late-fees')
        .set(as('accounts-a'))
        .expect(201);
      expect(again.body.applied).toBe(0);
      const v = await http()
        .get(`/api/v1/students/${f.ids.studentA}/fees`)
        .set(as('parent-a'))
        .expect(200);
      expect(
        v.body.find((x: { id: string }) => x.id === voucherM2),
      ).toMatchObject({
        totalAmount: 120000,
        status: 'overdue',
      });
    });
  });

  describe('outstanding balances and defaulters', () => {
    it("lists the school's students with overdue balances, filtered by section", async () => {
      const res = await http()
        .get('/api/v1/fee-reports/outstanding')
        .set(as('admin-a'))
        .expect(200);
      const row = res.body.rows.find(
        (r: { studentId: string }) => r.studentId === f.ids.studentA,
      );
      expect(row).toMatchObject({
        grNumber: 'BL08-A1',
        sectionId: f.ids.sectionA,
        overdueAmount: 120000 + 30000,
        outstanding: 120000 + 30000 + 90000,
      });
      expect(res.body.totals.students).toBeGreaterThanOrEqual(1);
      expect(
        res.body.rows.some(
          (r: { studentId: string }) => r.studentId === f.ids.studentB,
        ),
      ).toBe(false);

      const bySection = await http()
        .get(
          `/api/v1/fee-reports/outstanding?sectionId=${f.ids.sectionANoTeacher}`,
        )
        .set(as('admin-a'))
        .expect(200);
      expect(bySection.body.rows).toHaveLength(0);

      const b = await http()
        .get('/api/v1/fee-reports/outstanding')
        .set(as('admin-b'))
        .expect(200);
      expect(
        b.body.rows.some(
          (r: { studentId: string }) => r.studentId === f.ids.studentA,
        ),
      ).toBe(false);
      await http()
        .get(`/api/v1/fee-reports/outstanding?sectionId=${f.ids.sectionA}`)
        .set(as('admin-b'))
        .expect(403);
    });
  });

  describe('carry-forward', () => {
    it('moves earlier-session arrears into an opening-balance voucher, once', async () => {
      const res = await http()
        .post('/api/v1/fee-vouchers/carry-forward')
        .set(as('accounts-a'))
        .send({ dueDate: future })
        .expect(201);
      expect(res.body).toMatchObject({
        students: 1,
        vouchers: 1,
        amount: 30000,
      });

      const fees = await http()
        .get(`/api/v1/students/${f.ids.studentA}/fees`)
        .set(as('parent-a'))
        .expect(200);
      const old = fees.body.find((v: { id: string }) => v.id === oldVoucherA);
      expect(old).toMatchObject({ totalAmount: 0, amountDue: 0 });
      expect(old.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ kind: 'CARRIED_FORWARD', amount: -30000 }),
        ]),
      );
      const ob = fees.body.find(
        (v: { kind: string }) => v.kind === 'OPENING_BALANCE',
      );
      expect(ob).toMatchObject({
        month: 'OPENING',
        totalAmount: 30000,
        amountDue: 30000,
      });

      const again = await http()
        .post('/api/v1/fee-vouchers/carry-forward')
        .set(as('accounts-a'))
        .send({ dueDate: future })
        .expect(201);
      expect(again.body).toMatchObject({ students: 0, amount: 0 });

      // The old voucher is settled by the carry-forward; money is taken on the new one.
      await http()
        .post(`/api/v1/fee-vouchers/${oldVoucherA}/reconcile`)
        .set(as('accounts-a'))
        .send({ amount: 100, method: 'cash' })
        .expect(400);
    });
  });
});
