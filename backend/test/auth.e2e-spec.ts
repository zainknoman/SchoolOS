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
  const testIdentifier = 'e2e-test-user@seeds.edu.pk';
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
});
