import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// BL-36 / KG-15: an access token is never accepted from a query string. A plain link that cannot
// carry an Authorization header (a system browser opened by the parent app) uses a short-lived
// download link instead: minted with the bearer token, valid for ONE download path, and useless
// as an access token.
describe('Download links (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const identifier = 'dl-e2e-admin@schoolos.edu.pk';
  const password = 'CorrectHorseBattery9!';
  let accessToken: string;
  let fileA: string;
  let fileB: string;

  const http = () => request(app.getHttpServer());

  async function login(): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/login')
      .send({ identifier, password })
      .expect(201);
    return res.body.accessToken as string;
  }

  async function upload(token: string, body: string): Promise<string> {
    const res = await http()
      .post('/api/v1/files')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(body), `${body}.txt`)
      .expect(201);
    return res.body.id as string;
  }

  function mintLink(token: string, path: string) {
    return http()
      .post('/api/v1/auth/download-link')
      .set('Authorization', `Bearer ${token}`)
      .send({ path });
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

    // Upsert, not delete + create: the audit log may still reference a previous run's user.
    const passwordHash = await argon2.hash(password);
    await prisma.user.upsert({
      where: { identifier },
      update: { passwordHash, isLocked: false, mustChangePassword: false },
      create: { identifier, passwordHash, role: 'SUPER_ADMIN' },
    });
    accessToken = await login();
    fileA = await upload(accessToken, 'file-a');
    fileB = await upload(accessToken, 'file-b');
  });

  afterAll(async () => {
    const user = await prisma.user.findUnique({ where: { identifier } });
    if (user) {
      await prisma.file
        .deleteMany({ where: { uploadedById: user.id } })
        .catch(() => undefined);
      await prisma.refreshToken
        .deleteMany({ where: { userId: user.id } })
        .catch(() => undefined);
      await prisma.user
        .delete({ where: { id: user.id } })
        .catch(() => undefined);
    }
    await app.close();
  });

  it.each([
    ['a file', () => `/api/v1/files/${fileA}`],
    ['a fee voucher PDF', () => '/api/v1/fee-vouchers/x/pdf'],
    ['a fee receipt PDF', () => '/api/v1/fee-payments/x/receipt.pdf'],
    ['a report card PDF', () => '/api/v1/report-cards/x/pdf'],
    [
      'a generated report card PDF',
      () => '/api/v1/report-cards/generated/x/pdf',
    ],
  ])(
    'rejects ?access_token= on %s download route (KG-15)',
    async (_label, path) => {
      await http().get(`${path()}?access_token=${accessToken}`).expect(401);
    },
  );

  it('mints a link that downloads the file without an Authorization header', async () => {
    const res = await mintLink(accessToken, `/api/v1/files/${fileA}`).expect(
      201,
    );
    expect(res.body.url).toMatch(
      new RegExp(`^/api/v1/files/${fileA}\\?dl=[\\w.-]+$`),
    );
    expect(new Date(res.body.expiresAt as string).getTime()).toBeGreaterThan(
      Date.now(),
    );

    const download = await http()
      .get(res.body.url as string)
      .expect(200);
    expect(download.text).toBe('file-a');
  });

  it('a link is bound to its path: it does not open another file', async () => {
    const res = await mintLink(accessToken, `/api/v1/files/${fileA}`).expect(
      201,
    );
    const dl = new URL(res.body.url as string, 'http://x').searchParams.get(
      'dl',
    );
    await http().get(`/api/v1/files/${fileB}?dl=${dl}`).expect(401);
  });

  it('a link token is not an access token', async () => {
    const res = await mintLink(accessToken, `/api/v1/files/${fileA}`).expect(
      201,
    );
    const dl = new URL(res.body.url as string, 'http://x').searchParams.get(
      'dl',
    );
    await http()
      .get(`/api/v1/files/${fileA}`)
      .set('Authorization', `Bearer ${dl}`)
      .expect(401);
    await http().get(`/api/v1/me?dl=${dl}`).expect(401);
  });

  it('an access token passed as ?dl= is rejected', async () => {
    await http().get(`/api/v1/files/${fileA}?dl=${accessToken}`).expect(401);
  });

  it('refuses to mint a link for a path that is not a download route', async () => {
    await mintLink(accessToken, '/api/v1/me').expect(400);
    await mintLink(accessToken, `/api/v1/files/${fileA}/../../me`).expect(400);
    await mintLink(
      accessToken,
      `https://evil.example/api/v1/files/${fileA}`,
    ).expect(400);
  });

  it('requires a bearer token to mint a link', async () => {
    await http()
      .post('/api/v1/auth/download-link')
      .send({ path: `/api/v1/files/${fileA}` })
      .expect(401);
  });

  it('a link stops working once the sessions are revoked (tokenVersion)', async () => {
    const token = await login();
    const res = await mintLink(token, `/api/v1/files/${fileA}`).expect(201);
    await http()
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    await http()
      .get(res.body.url as string)
      .expect(401);
    accessToken = await login();
  });
});
