import * as argon2 from 'argon2';
import request from 'supertest';
import {
  createTwoSchools,
  TwoSchools,
  PASSWORD,
} from './pending/two-school-fixture';

/**
 * BL-21 (KG-10, KG-11, KG-23): server-side account disable/enable, session revocation and
 * enforcement of mustChangePassword — each effective on the very next request.
 */
describe('Account access: disable, revoke, forced password change (e2e)', () => {
  let f: TwoSchools;
  const http = () => request(f.app.getHttpServer());
  const P = 'bl21';
  const id = (identifier: string) => `${P}-${identifier}`;

  async function session(who: string) {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ identifier: id(who), password: PASSWORD })
      .expect(201);
    return res.body as { accessToken: string; refreshToken: string };
  }
  const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
  async function userId(who: string) {
    return (
      await f.prisma.user.findUniqueOrThrow({ where: { identifier: id(who) } })
    ).id;
  }
  async function reset(who: string) {
    await f.prisma.user.update({
      where: { identifier: id(who) },
      data: {
        isLocked: false,
        lockedUntil: null,
        failedLoginCount: 0,
        mustChangePassword: false,
      },
    });
  }

  beforeAll(async () => {
    f = await createTwoSchools(P);
  });
  afterAll(async () => {
    await f.close();
  });

  describe('disable / enable', () => {
    afterEach(() => reset('teacher-a'));

    it('a disabled user is rejected on the next request, cannot refresh, and cannot sign in', async () => {
      const admin = await session('admin-a');
      const teacher = await session('teacher-a');
      await http()
        .get('/api/v1/me')
        .set(bearer(teacher.accessToken))
        .expect(200);

      const res = await http()
        .post(`/api/v1/admin/users/${await userId('teacher-a')}/disable`)
        .set(bearer(admin.accessToken))
        .expect(201);
      expect(res.body).toMatchObject({ disabled: true });

      await http()
        .get('/api/v1/me')
        .set(bearer(teacher.accessToken))
        .expect(401);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: teacher.refreshToken })
        .expect(401);
      const login = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: id('teacher-a'), password: PASSWORD })
        .expect(401);
      expect(login.body.message).toMatch(/disabled/);
      // Wrong password on a disabled account gets the generic error — no account disclosure.
      const wrong = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: id('teacher-a'), password: 'Wrong-Password-1!' })
        .expect(401);
      expect(wrong.body.message).toBe('Invalid credentials');
    });

    it('enable restores access and clears a failed-login lockout', async () => {
      const admin = await session('admin-a');
      const target = await userId('teacher-a');
      await f.prisma.user.update({
        where: { id: target },
        data: {
          isLocked: true,
          lockedUntil: new Date(Date.now() + 600_000),
          failedLoginCount: 5,
        },
      });
      const res = await http()
        .post(`/api/v1/admin/users/${target}/enable`)
        .set(bearer(admin.accessToken))
        .expect(201);
      expect(res.body).toMatchObject({ disabled: false, lockedUntil: null });
      await session('teacher-a');
    });

    it('writes an audit row naming the acting admin', async () => {
      const admin = await session('admin-a');
      const target = await userId('teacher-a');
      await http()
        .post(`/api/v1/admin/users/${target}/disable`)
        .set(bearer(admin.accessToken))
        .expect(201);
      const row = await f.prisma.auditLog.findFirst({
        where: { action: 'account.disable', entityId: target },
        orderBy: { createdAt: 'desc' },
      });
      expect(row?.userId).toBe(await userId('admin-a'));
    });
  });

  describe('session revocation', () => {
    it('logout revokes that refresh token only', async () => {
      const s = await session('teacher-b');
      await http()
        .post('/api/v1/auth/logout')
        .send({ refreshToken: s.refreshToken })
        .expect(204);
      await http()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: s.refreshToken })
        .expect(401);
      // Unknown tokens get the same 204 — nothing is revealed.
      await http()
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'nope' })
        .expect(204);
    });

    it('logout-all ends every session on every device, including live access tokens', async () => {
      const phone = await session('teacher-b');
      const laptop = await session('teacher-b');
      await http()
        .post('/api/v1/auth/logout-all')
        .set(bearer(phone.accessToken))
        .expect(204);
      for (const s of [phone, laptop]) {
        await http().get('/api/v1/me').set(bearer(s.accessToken)).expect(401);
        await http()
          .post('/api/v1/auth/refresh')
          .send({ refreshToken: s.refreshToken })
          .expect(401);
      }
      await session('teacher-b');
    });

    it('an admin can revoke another user’s sessions', async () => {
      const admin = await session('admin-b');
      const s = await session('teacher-b');
      await http()
        .post(
          `/api/v1/admin/users/${await userId('teacher-b')}/revoke-sessions`,
        )
        .set(bearer(admin.accessToken))
        .expect(201);
      await http().get('/api/v1/me').set(bearer(s.accessToken)).expect(401);
    });
  });

  describe('mustChangePassword is enforced by the server', () => {
    afterEach(() => reset('teacher-a'));

    it('blocks every route except the allow-list until the password is changed', async () => {
      await f.prisma.user.update({
        where: { identifier: id('teacher-a') },
        data: { mustChangePassword: true },
      });
      const s = await session('teacher-a');
      const blocked = await http()
        .get('/api/v1/academic-sessions')
        .set(bearer(s.accessToken))
        .expect(403);
      expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
      await http().get('/api/v1/me').set(bearer(s.accessToken)).expect(200);

      const changed = await http()
        .post('/api/v1/auth/change-password')
        .set(bearer(s.accessToken))
        .send({ currentPassword: PASSWORD, newPassword: 'BrandNewHorse9!' })
        .expect(201);
      expect(changed.body.mustChangePassword).toBe(false);
      // The pre-change token is dead; the new one works everywhere.
      await http().get('/api/v1/me').set(bearer(s.accessToken)).expect(401);
      await http()
        .get('/api/v1/academic-sessions')
        .set(bearer(changed.body.accessToken as string))
        .expect(200);

      // Restore the shared fixture password for later tests.
      await http()
        .post('/api/v1/auth/change-password')
        .set(bearer(changed.body.accessToken as string))
        .send({ currentPassword: 'BrandNewHorse9!', newPassword: PASSWORD })
        .expect(201);
    });

    it('also applies when the flag is set while a session is already open', async () => {
      const s = await session('teacher-a');
      await http()
        .get('/api/v1/academic-sessions')
        .set(bearer(s.accessToken))
        .expect(200);
      await f.prisma.user.update({
        where: { identifier: id('teacher-a') },
        data: { mustChangePassword: true },
      });
      await http()
        .get('/api/v1/academic-sessions')
        .set(bearer(s.accessToken))
        .expect(403);
    });
  });

  describe('BL-64 admin-assisted parent password reset', () => {
    const parentProfile = async (who: string) =>
      (
        await f.prisma.parentProfile.findFirstOrThrow({
          where: { userId: await userId(who) },
        })
      ).id;
    afterEach(async () => {
      delete process.env.ADMIN_PASSWORD_RESET;
      // Restore the shared fixture password.
      await f.prisma.user.update({
        where: { identifier: id('parent-a') },
        data: {
          passwordHash: await argon2.hash(PASSWORD),
          mustChangePassword: false,
        },
      });
    });

    it('issues a one-time password; the parent must change it, and old sessions end', async () => {
      const oldSession = await session('parent-a');
      const admin = await session('admin-a');
      const res = await http()
        .post(
          `/api/v1/admin/parents/${await parentProfile('parent-a')}/reset-password`,
        )
        .set(bearer(admin.accessToken))
        .expect(201);
      const temp = res.body.temporaryPassword as string;
      expect(temp).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(res.body.mustChangePassword).toBe(true);

      await http()
        .get('/api/v1/me')
        .set(bearer(oldSession.accessToken))
        .expect(401);
      await http()
        .post('/api/v1/auth/login')
        .send({ identifier: id('parent-a'), password: PASSWORD })
        .expect(401);

      const login = await http()
        .post('/api/v1/auth/login')
        .send({ identifier: id('parent-a'), password: temp })
        .expect(201);
      expect(login.body.mustChangePassword).toBe(true);
      await http()
        .get('/api/v1/me/children')
        .set(bearer(login.body.accessToken as string))
        .expect(403);
      const changed = await http()
        .post('/api/v1/auth/change-password')
        .set(bearer(login.body.accessToken as string))
        .send({ currentPassword: temp, newPassword: 'ParentsOwnPass9!' })
        .expect(201);
      await http()
        .get('/api/v1/me/children')
        .set(bearer(changed.body.accessToken as string))
        .expect(200);

      // Audited without the password.
      const row = await f.prisma.auditLog.findFirstOrThrow({
        where: {
          action: 'account.admin-password-reset',
          entityId: await userId('parent-a'),
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(JSON.stringify(row)).not.toContain(temp);
    });

    it('is refused outside the admin scope and for a parent shared with another school', async () => {
      const adminB = await session('admin-b');
      await http()
        .post(
          `/api/v1/admin/parents/${await parentProfile('parent-a')}/reset-password`,
        )
        .set(bearer(adminB.accessToken))
        .expect(403);
      const adminA = await session('admin-a');
      await http()
        .post(
          `/api/v1/admin/parents/${await parentProfile('parent-shared')}/reset-password`,
        )
        .set(bearer(adminA.accessToken))
        .expect(403);
    });

    it('is switched off when ADMIN_PASSWORD_RESET=disabled (e-mail reset active)', async () => {
      process.env.ADMIN_PASSWORD_RESET = 'disabled';
      const admin = await session('admin-a');
      await http()
        .post(
          `/api/v1/admin/parents/${await parentProfile('parent-a')}/reset-password`,
        )
        .set(bearer(admin.accessToken))
        .expect(409);
    });
  });

  describe('scope', () => {
    it('a school admin cannot act on another school’s account', async () => {
      const adminB = await session('admin-b');
      await http()
        .post(`/api/v1/admin/users/${await userId('teacher-a')}/disable`)
        .set(bearer(adminB.accessToken))
        .expect(403);
    });

    it('a school admin cannot disable a parent who also has a child in another school; a super admin can', async () => {
      const adminA = await session('admin-a');
      const shared = await userId('parent-shared');
      await http()
        .post(`/api/v1/admin/users/${shared}/disable`)
        .set(bearer(adminA.accessToken))
        .expect(403);
      const superAdmin = await session('super');
      await http()
        .post(`/api/v1/admin/users/${shared}/disable`)
        .set(bearer(superAdmin.accessToken))
        .expect(201);
      await reset('parent-shared');
    });

    it('a school admin can manage a parent whose children are all in their school', async () => {
      const adminA = await session('admin-a');
      await http()
        .get(`/api/v1/admin/users/${await userId('parent-a')}/access`)
        .set(bearer(adminA.accessToken))
        .expect(200);
    });

    it('refuses self-disable and a school admin acting on a super admin', async () => {
      const adminA = await session('admin-a');
      await http()
        .post(`/api/v1/admin/users/${await userId('admin-a')}/disable`)
        .set(bearer(adminA.accessToken))
        .expect(400);
      await http()
        .post(`/api/v1/admin/users/${await userId('super')}/disable`)
        .set(bearer(adminA.accessToken))
        .expect(403);
    });

    it('teachers and parents cannot call the admin endpoints', async () => {
      const teacher = await session('teacher-a');
      await http()
        .post(`/api/v1/admin/users/${await userId('parent-a')}/disable`)
        .set(bearer(teacher.accessToken))
        .expect(403);
    });
  });
});
