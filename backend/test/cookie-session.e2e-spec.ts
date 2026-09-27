import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildCorsOptions } from '../src/config/cors.config';

// BL-36 option B (owner decision 2026-09-28): the staff console keeps its refresh token in an
// HttpOnly Secure SameSite=Strict cookie scoped to /api/v1/auth, and its access token only in
// memory. The cookie is used only with the X-SchoolOS-Session header (a CSRF defence: it forces
// a CORS preflight) and from an allowed Origin. Clients that do not send the header — the parent
// app — keep the body-token contract unchanged.
describe('Cookie session (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const identifier = 'cs-e2e-admin@schoolos.edu.pk';
  const password = 'CorrectHorseBattery9!';
  const CONSOLE = { 'X-SchoolOS-Session': 'cookie' };
  const ORIGIN = 'http://localhost:5173';

  const http = () => request(app.getHttpServer());

  function sessionCookie(res: request.Response): string | undefined {
    const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
    return raw?.find((c) => c.startsWith('__Secure-schoolos-rt='));
  }

  /** The `name=value` part, as a browser would send it back. */
  function cookiePair(setCookie: string): string {
    return setCookie.split(';')[0];
  }

  async function consoleLogin(): Promise<request.Response> {
    return http()
      .post('/api/v1/auth/login')
      .set(CONSOLE)
      .set('Origin', ORIGIN)
      .send({ identifier, password })
      .expect(201);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.enableCors(buildCorsOptions(process.env));
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    const passwordHash = await argon2.hash(password);
    await prisma.user.upsert({
      where: { identifier },
      update: {
        passwordHash,
        isLocked: false,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: { identifier, passwordHash, role: 'SUPER_ADMIN' },
    });
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { identifier } });
    if (user) {
      await prisma.refreshToken
        .deleteMany({ where: { userId: user.id } })
        .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: user.id } })
        .catch(() => undefined);
    }
    await app.close();
  });

  it('console login sets an HttpOnly Secure SameSite=Strict cookie and keeps the refresh token out of the body', async () => {
    const res = await consoleLogin();
    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*Secure/i);
    expect(cookie).toMatch(/;\s*SameSite=Strict/i);
    expect(cookie).toMatch(/;\s*Path=\/api\/v1\/auth(;|$)/);
    expect(res.body.refreshToken).toBeUndefined();
    expect(res.body.accessToken).toEqual(expect.any(String));

    await http()
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${res.body.accessToken as string}`)
      .expect(200);
  });

  it('a login without the header (the parent app) is unchanged: refresh token in the body, no cookie', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ identifier, password })
      .expect(201);
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(sessionCookie(res)).toBeUndefined();
  });

  it('refresh from the cookie rotates it; the old cookie is then refused', async () => {
    const first = cookiePair(sessionCookie(await consoleLogin())!);
    const res = await http()
      .post('/api/v1/auth/refresh')
      .set(CONSOLE)
      .set('Origin', ORIGIN)
      .set('Cookie', first)
      .send({})
      .expect(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toBeUndefined();
    const second = sessionCookie(res);
    expect(second).toBeDefined();
    expect(cookiePair(second!)).not.toBe(first);

    await http()
      .post('/api/v1/auth/refresh')
      .set(CONSOLE)
      .set('Origin', ORIGIN)
      .set('Cookie', first)
      .send({})
      .expect(401);
  });

  it('CSRF: the cookie is ignored without the X-SchoolOS-Session header', async () => {
    const cookie = cookiePair(sessionCookie(await consoleLogin())!);
    await http()
      .post('/api/v1/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(400);
  });

  it('CSRF: the cookie is refused from a foreign Origin', async () => {
    const cookie = cookiePair(sessionCookie(await consoleLogin())!);
    await http()
      .post('/api/v1/auth/refresh')
      .set(CONSOLE)
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .send({})
      .expect(403);
  });

  it('logout revokes the cookie session and clears the cookie', async () => {
    const cookie = cookiePair(sessionCookie(await consoleLogin())!);
    const res = await http()
      .post('/api/v1/auth/logout')
      .set(CONSOLE)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(204);
    const cleared = sessionCookie(res);
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);

    await http()
      .post('/api/v1/auth/refresh')
      .set(CONSOLE)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(401);
  });

  it('logout from a foreign Origin does nothing', async () => {
    const cookie = cookiePair(sessionCookie(await consoleLogin())!);
    await http()
      .post('/api/v1/auth/logout')
      .set(CONSOLE)
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .send({})
      .expect(403);
    await http()
      .post('/api/v1/auth/refresh')
      .set(CONSOLE)
      .set('Origin', ORIGIN)
      .set('Cookie', cookie)
      .send({})
      .expect(201);
  });

  it('moves a pre-BL-36 console session (refresh token from localStorage) into the cookie', async () => {
    const legacy = await http()
      .post('/api/v1/auth/login')
      .send({ identifier, password })
      .expect(201);
    const res = await http()
      .post('/api/v1/auth/refresh')
      .set(CONSOLE)
      .set('Origin', ORIGIN)
      .send({ refreshToken: legacy.body.refreshToken as string })
      .expect(201);
    expect(res.body.refreshToken).toBeUndefined();
    expect(sessionCookie(res)).toBeDefined();
  });

  it('change-password in cookie mode issues the new session as a cookie', async () => {
    const login = await consoleLogin();
    const res = await http()
      .post('/api/v1/auth/change-password')
      .set(CONSOLE)
      .set('Origin', ORIGIN)
      .set('Authorization', `Bearer ${login.body.accessToken as string}`)
      .send({ currentPassword: password, newPassword: 'AnotherHorseBattery9!' })
      .expect(201);
    expect(res.body.refreshToken).toBeUndefined();
    expect(sessionCookie(res)).toBeDefined();
  });

  it('CORS allows credentials and the session header for the console origin only', async () => {
    const ok = await http()
      .options('/api/v1/auth/refresh')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-schoolos-session');
    expect(ok.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    expect(
      String(ok.headers['access-control-allow-headers']).toLowerCase(),
    ).toContain('x-schoolos-session');

    const evil = await http()
      .options('/api/v1/auth/refresh')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});
