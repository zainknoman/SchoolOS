import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { createHash } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Forgot/Reset Password (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const originalPassword = 'OriginalHorseBattery9!';
  const userIdentifier = 'apr-user@schoolos.edu.pk';
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get(PrismaService);
    await app.init();

    await prisma.user
      .deleteMany({ where: { identifier: userIdentifier } })
      .catch(() => undefined);
    const passwordHash = await argon2.hash(originalPassword);
    const user = await prisma.user.create({
      data: { identifier: userIdentifier, passwordHash, role: 'PARENT' },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.passwordResetToken
      .deleteMany({ where: { userId } })
      .catch(() => undefined);
    await prisma.refreshToken
      .deleteMany({ where: { userId } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { identifier: userIdentifier } })
      .catch(() => undefined);
    await app.close();
  });

  it('forgot-password always returns 200 with a generic message, whether or not the identifier exists (no enumeration)', async () => {
    const known = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: userIdentifier })
      .expect(201);
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: 'nobody-at-all@schoolos.edu.pk' })
      .expect(201);

    expect(known.body.message).toEqual(unknown.body.message);

    const tokenRows = await prisma.passwordResetToken.findMany({
      where: { userId },
    });
    expect(tokenRows).toHaveLength(1);
  });

  it('forgot-password never writes the reset link or token to any log (BL-51, KG-4)', async () => {
    const captured: string[] = [];
    const capture = (chunk: unknown): boolean => {
      captured.push(String(chunk));
      return true;
    };
    const out = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const err = jest.spyOn(process.stderr, 'write').mockImplementation(capture);
    const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
    const consoleSpies = methods.map((m) =>
      jest.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        captured.push(args.map(String).join(' '));
      }),
    );
    // @nestjs/testing's TestingLogger drops log-level output before it reaches a stream, so the
    // Logger API itself is captured too (it is what a production ConsoleLogger would print).
    const loggerMethods = ['log', 'warn', 'error', 'debug', 'verbose'] as const;
    const loggerSpies = loggerMethods.map((m) =>
      jest
        .spyOn(Logger.prototype, m)
        .mockImplementation((...args: unknown[]) => {
          captured.push(args.map(String).join(' '));
        }),
    );
    try {
      await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ identifier: userIdentifier })
        .expect(201);
    } finally {
      out.mockRestore();
      err.mockRestore();
      [...consoleSpies, ...loggerSpies].forEach((s) => s.mockRestore());
    }
    const logged = captured.join('\n');
    expect(logged).toContain('[mail:not-configured]');
    expect(logged).not.toMatch(/reset-password\?token=/);
    expect(logged).not.toMatch(/\b[0-9a-f]{64}\b/);
    expect(logged).not.toContain(userIdentifier);
  });

  it('resetting with a fabricated (never-issued) token is rejected', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'WontWork9!' })
      .expect(400);
  });

  it('a full reset round trip: old password stops working, new password works, and old sessions are revoked', async () => {
    // Log in once with the original password to create a refresh token that the reset must revoke.
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: userIdentifier, password: originalPassword })
      .expect(201);
    const oldRefreshToken = loginRes.body.refreshToken as string;

    // Drive a token this test controls end-to-end: insert a PasswordResetToken row hashed the
    // same way auth.service.ts's hashToken() does (sha256), so reset-password's real
    // lookup-by-hash path is exercised without depending on log/email output (forgotPassword
    // never returns the raw token — it only ever reaches the user via MailAdapter, and
    // LoggingMailAdapter only logs it in this environment).
    const rawToken = 'e2e-test-raw-token-value';
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    await prisma.passwordResetToken.deleteMany({ where: { userId } });
    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    const newPassword = 'BrandNewHorseBattery9!';
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword })
      .expect(201);

    // Old password no longer works.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: userIdentifier, password: originalPassword })
      .expect(401);

    // New password works.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: userIdentifier, password: newPassword })
      .expect(201);

    // The refresh token issued before the reset is revoked.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: oldRefreshToken })
      .expect(401);

    // Reusing the same reset token again is rejected (single-use).
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: rawToken, newPassword: 'AnotherPassword9!' })
      .expect(400);
  });
});
