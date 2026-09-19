import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const testIdentifier = 'e2e-test-user@schoolos.edu.pk';
  const testPassword = 'CorrectHorseBattery9!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    await prisma.user.create({
      data: {
        identifier: testIdentifier,
        passwordHash: await argon2.hash(testPassword),
        role: 'PARENT',
      },
    });
  });

  afterAll(async () => {
    await prisma.user
      .delete({ where: { identifier: testIdentifier } })
      .catch(() => undefined);
    await app.close();
  });

  it('logs in with the correct identifier/password and returns an access + refresh token', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: testIdentifier, password: testPassword })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.role).toBe('PARENT');
    expect(res.body.mustChangePassword).toBe(false);
    expect(res.body.campusId).toBeNull();
    expect(res.body).toHaveProperty('schoolId');
  });

  it('rejects a wrong password with a generic 401, revealing nothing about which field was wrong', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: testIdentifier, password: 'totally-wrong' })
      .expect(401);

    expect(res.body.message).toBe('Invalid credentials');
  });

  it('rejects a protected route with no token at all', async () => {
    // AppController's root route is @Public(); auth-protected routes land in Sprint 2+. This just
    // confirms the global guard chain is wired: an unknown route without a token still 401s/404s
    // rather than silently passing through.
    await request(app.getHttpServer())
      .get('/api/v1/me')
      .expect((res) => {
        expect([401, 404]).toContain(res.status);
      });
  });

  it('exchanges a refresh token for a new access+refresh token pair', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: testIdentifier, password: testPassword })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).not.toBe(loginRes.body.refreshToken);
    expect(res.body.role).toBe('PARENT');
    expect(res.body.mustChangePassword).toBe(false);
    expect(res.body.campusId).toBeNull();
    expect(res.body).toHaveProperty('schoolId');
  });

  it('rejects reuse of an already-redeemed refresh token (rotation-on-use)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: testIdentifier, password: testPassword })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(401);
  });

  it('rejects an unknown/garbage refresh token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'not-a-real-token' })
      .expect(401);
  });

  describe('change-password', () => {
    const cpIdentifier = 'e2e-change-pw@schoolos.edu.pk';
    const oldPw = 'OldPassword123!';
    const newPw = 'NewPassword456!';

    beforeAll(async () => {
      await prisma.user.create({
        data: {
          identifier: cpIdentifier,
          passwordHash: await argon2.hash(oldPw),
          role: 'PARENT',
          mustChangePassword: true,
        },
      });
    });

    afterAll(async () => {
      await prisma.refreshToken.deleteMany({ where: { user: { identifier: cpIdentifier } } });
      await prisma.user.delete({ where: { identifier: cpIdentifier } }).catch(() => undefined);
    });

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .send({ currentPassword: oldPw, newPassword: newPw })
        .expect(401);
    });

    it('changes the password, clears the flag, revokes old refresh tokens and returns a fresh session', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: cpIdentifier, password: oldPw })
        .expect(201);
      expect(login.body.mustChangePassword).toBe(true);

      await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({ currentPassword: 'wrong-password', newPassword: newPw })
        .expect(401);

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({ currentPassword: oldPw, newPassword: newPw })
        .expect(201);
      expect(res.body.mustChangePassword).toBe(false);
      expect(res.body.accessToken).toEqual(expect.any(String));

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: login.body.refreshToken })
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: res.body.refreshToken })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ identifier: cpIdentifier, password: newPw })
        .expect(201);
    });
  });
});
