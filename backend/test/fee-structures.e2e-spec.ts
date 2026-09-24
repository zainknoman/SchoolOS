import request from 'supertest';
import { createTwoSchools, TwoSchools } from './pending/two-school-fixture';

/** BL-03 (migration M5): school-scoped fee structures with a lifecycle; school-scoped terms. */
describe('Fee structures and terms per school (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let tuitionA: string;

  beforeAll(async () => {
    f = await createTwoSchools('bl03');
    for (const who of ['super', 'admin-a', 'admin-b', 'parent-a', 'parent-b']) {
      tokens[who] = await f.login(who);
    }
  });
  afterAll(async () => {
    const students = { grNumber: { startsWith: 'BL03-' } };
    await f.prisma.feeItem.deleteMany({
      where: { feeVoucher: { student: students } },
    });
    await f.prisma.feeVoucher.deleteMany({ where: { student: students } });
    await f.prisma.feeStructure.deleteMany({
      where: { schoolId: { in: [f.ids.schoolA, f.ids.schoolB] } },
    });
    await f.close();
  });

  const issue = (
    who: string,
    feeStructureIds: string[],
    studentIds = [f.ids.studentA],
    month = '2026-10',
  ) =>
    http()
      .post('/api/v1/fee-vouchers')
      .set(as(who))
      .send({ studentIds, month, dueDate: `${month}-10`, feeStructureIds });

  it('a new structure is a DRAFT (not issuable); once active and invoiced it is LOCKED', async () => {
    const created = await http()
      .post('/api/v1/fee-structures')
      .set(as('admin-a'))
      .send({ name: 'BL03 Tuition', amount: 500000 })
      .expect(201);
    tuitionA = created.body.id as string;
    expect(created.body).toMatchObject({
      status: 'DRAFT',
      schoolId: f.ids.schoolA,
    });
    await issue('admin-a', [tuitionA]).expect(400);

    await http()
      .patch(`/api/v1/fee-structures/${tuitionA}`)
      .set(as('admin-a'))
      .send({ amount: 450000 })
      .expect(200);
    await http()
      .patch(`/api/v1/fee-structures/${tuitionA}`)
      .set(as('admin-a'))
      .send({ status: 'ACTIVE' })
      .expect(200);
    await issue('admin-a', [tuitionA]).expect(201);

    const after = await f.prisma.feeStructure.findUniqueOrThrow({
      where: { id: tuitionA },
    });
    expect(after.status).toBe('LOCKED');
    const line = await f.prisma.feeItem.findFirstOrThrow({
      where: { feeStructureId: tuitionA },
    });
    expect(line.amount).toBe(450000);

    await http()
      .patch(`/api/v1/fee-structures/${tuitionA}`)
      .set(as('admin-a'))
      .send({ amount: 1 })
      .expect(400);
  });

  it('an archived structure is hidden from new vouchers, kept in history, and can be restored', async () => {
    await http()
      .patch(`/api/v1/fee-structures/${tuitionA}`)
      .set(as('admin-a'))
      .send({ status: 'ARCHIVED' })
      .expect(200);
    const list = await http()
      .get('/api/v1/fee-structures')
      .set(as('admin-a'))
      .expect(200);
    expect((list.body as { id: string }[]).map((s) => s.id)).not.toContain(
      tuitionA,
    );
    const all = await http()
      .get('/api/v1/fee-structures?includeArchived=true')
      .set(as('admin-a'))
      .expect(200);
    expect((all.body as { id: string }[]).map((s) => s.id)).toContain(tuitionA);
    await issue('admin-a', [tuitionA], [f.ids.studentA], '2026-11').expect(400);

    const restored = await http()
      .patch(`/api/v1/fee-structures/${tuitionA}`)
      .set(as('admin-a'))
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect(restored.body.status).toBe('LOCKED'); // it was invoiced before
  });

  it("another school cannot see, change or issue school A's structure", async () => {
    const listB = await http()
      .get('/api/v1/fee-structures?includeArchived=true')
      .set(as('admin-b'))
      .expect(200);
    expect((listB.body as { id: string }[]).map((s) => s.id)).not.toContain(
      tuitionA,
    );
    await http()
      .patch(`/api/v1/fee-structures/${tuitionA}`)
      .set(as('admin-b'))
      .send({ status: 'ARCHIVED' })
      .expect(403);
    await issue('admin-b', [tuitionA], [f.ids.studentB]).expect(400);
  });

  it('a super admin must name the school of a new structure', async () => {
    await http()
      .post('/api/v1/fee-structures')
      .set(as('super'))
      .send({ name: 'x', amount: 1 })
      .expect(400);
  });

  it('terms are managed and read within their session’s school', async () => {
    await http()
      .post('/api/v1/terms')
      .set(as('admin-b'))
      .send({
        academicSessionId: f.ids.sessionA,
        label: 'BL03 T1',
        order: 1,
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      })
      .expect(403);
    await http()
      .post('/api/v1/terms')
      .set(as('admin-a'))
      .send({
        academicSessionId: f.ids.sessionA,
        label: 'BL03 T1',
        order: 1,
        startDate: '2026-01-01',
        endDate: '2026-03-31',
      })
      .expect(201);
    await http()
      .get(`/api/v1/terms?academicSessionId=${f.ids.sessionA}`)
      .set(as('parent-a'))
      .expect(200);
    await http()
      .get(`/api/v1/terms?academicSessionId=${f.ids.sessionA}`)
      .set(as('parent-b'))
      .expect(403);
    await http()
      .get(`/api/v1/terms?academicSessionId=${f.ids.sessionA}`)
      .set(as('admin-b'))
      .expect(403);
  });
});
