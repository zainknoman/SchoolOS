import request from 'supertest';
import * as argon2 from 'argon2';
import {
  createTwoSchools,
  PASSWORD,
  TwoSchools,
} from './pending/two-school-fixture';

/**
 * BL-32 (Q18): ACCOUNTS is finance-only by default. Admissions, complaints and messages need an
 * explicit, audited grant set by a school admin of the same school (or a super admin).
 */
describe('ACCOUNTS module grants (e2e)', () => {
  let f: TwoSchools;
  const tokens: Record<string, string> = {};
  const http = () => request(f.app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  let accountsId: string;

  beforeAll(async () => {
    f = await createTwoSchools('bl32');
    const accounts = await f.prisma.user.create({
      data: {
        identifier: 'bl32-accounts-a',
        passwordHash: await argon2.hash(PASSWORD),
        role: 'ACCOUNTS',
        schoolId: f.ids.schoolA,
      },
    });
    accountsId = accounts.id;
    for (const who of ['admin-a', 'admin-b', 'accounts-a', 'parent-a'])
      tokens[who] = await f.login(who);
  });
  afterAll(async () => {
    await f.prisma.auditLog.deleteMany({ where: { entityId: accountsId } });
    await f.close();
  });

  it('by default reaches fees but not admissions, complaints or messages', async () => {
    await http()
      .get('/api/v1/fee-structures')
      .set(as('accounts-a'))
      .expect(200);
    await http().get('/api/v1/applications').set(as('accounts-a')).expect(403);
    await http().get('/api/v1/applicants').set(as('accounts-a')).expect(403);
    await http()
      .get(`/api/v1/complaints?studentId=${f.ids.studentA}`)
      .set(as('accounts-a'))
      .expect(403);
    await http().get('/api/v1/conversations').set(as('accounts-a')).expect(403);
  });

  it('a parent cannot message an ACCOUNTS user who lacks the messages grant', async () => {
    await http()
      .post('/api/v1/conversations')
      .set(as('parent-a'))
      .send({ recipientType: 'ACCOUNTS', body: 'Fee question' })
      .expect(400);
  });

  it("another school's admin cannot grant; only accounts staff take grants", async () => {
    await http()
      .put(`/api/v1/admin/users/${accountsId}/grants`)
      .set(as('admin-b'))
      .send({ grants: ['ADMISSIONS'] })
      .expect(403);
    await http()
      .put(`/api/v1/admin/users/${f.ids.parentAUser}/grants`)
      .set(as('admin-a'))
      .send({ grants: ['ADMISSIONS'] })
      .expect(400);
    await http()
      .put(`/api/v1/admin/users/${accountsId}/grants`)
      .set(as('admin-a'))
      .send({ grants: ['PAYROLL'] })
      .expect(400);
  });

  it('a grant opens the module on the next request and is audited', async () => {
    const res = await http()
      .put(`/api/v1/admin/users/${accountsId}/grants`)
      .set(as('admin-a'))
      .send({ grants: ['MESSAGES', 'ADMISSIONS'] })
      .expect(200);
    expect(res.body.grants).toEqual(['ADMISSIONS', 'MESSAGES']);

    await http().get('/api/v1/applications').set(as('accounts-a')).expect(200);
    await http().get('/api/v1/conversations').set(as('accounts-a')).expect(200);
    await http()
      .get(`/api/v1/complaints?studentId=${f.ids.studentA}`)
      .set(as('accounts-a'))
      .expect(403);

    const audit = await f.prisma.auditLog.findFirstOrThrow({
      where: { action: 'account.grants', entityId: accountsId },
    });
    expect(JSON.parse(audit.metadata!)).toEqual({
      before: [],
      after: ['ADMISSIONS', 'MESSAGES'],
    });

    // The next sign-in tells the console which modules to show.
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ identifier: 'bl32-accounts-a', password: PASSWORD })
      .expect(201);
    expect(login.body.grants).toEqual(['ADMISSIONS', 'MESSAGES']);

    // Revoking takes effect immediately too.
    await http()
      .put(`/api/v1/admin/users/${accountsId}/grants`)
      .set(as('admin-a'))
      .send({ grants: [] })
      .expect(200);
    await http().get('/api/v1/applications').set(as('accounts-a')).expect(403);
  });
});
