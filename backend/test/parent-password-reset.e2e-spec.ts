import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MAIL_ADAPTER } from '../src/notifications/mail-adapter';

/**
 * BL-35 (Q41, KI-7): the parent reset flow is separate from the staff one — its own endpoints,
 * token audience, link (PARENT_RESET_URL, an app deep link by default) and a 30-minute,
 * single-use token sent to the e-mail on the parent's profile.
 */
describe('Parent password reset (e2e, BL-35)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const sent: Array<{ to: string; body: string }> = [];
  const PASSWORD = 'OriginalHorseBattery9!';
  const parentId = 'bl35-parent-03001234567';
  const noEmailParentId = 'bl35-parent-noemail';
  const staffId = 'bl35-staff@schoolos.edu.pk';
  const http = () => request(app.getHttpServer());

  const lastToken = () => {
    const m = /reset-password\?token=([0-9a-f]{64})/.exec(sent.at(-1)!.body);
    return m![1];
  };

  const cleanup = async () => {
    const users = { identifier: { startsWith: 'bl35-' } };
    await prisma.passwordResetToken.deleteMany({ where: { user: users } });
    await prisma.refreshToken.deleteMany({ where: { user: users } });
    await prisma.parentProfile.deleteMany({ where: { user: users } });
    await prisma.user.deleteMany({ where: users });
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MAIL_ADAPTER)
      .useValue({
        send: (to: string, _subject: string, body: string) => {
          sent.push({ to, body });
          return Promise.resolve();
        },
      })
      .compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    prisma = moduleFixture.get(PrismaService);
    await app.init();
    await cleanup();

    const passwordHash = await argon2.hash(PASSWORD);
    const parent = await prisma.user.create({
      data: { identifier: parentId, passwordHash, role: 'PARENT' },
    });
    await prisma.parentProfile.create({
      data: {
        userId: parent.id,
        name: 'BL35 Parent',
        email: 'bl35-mother@example.com',
      },
    });
    const noEmail = await prisma.user.create({
      data: { identifier: noEmailParentId, passwordHash, role: 'PARENT' },
    });
    await prisma.parentProfile.create({
      data: { userId: noEmail.id, name: 'BL35 Parent 2' },
    });
    await prisma.user.create({
      data: { identifier: staffId, passwordHash, role: 'TEACHER' },
    });
  });

  afterAll(async () => {
    try {
      await cleanup();
    } finally {
      await app.close();
    }
  });

  it("sends the parent-app link to the parent's profile e-mail; same answer for everyone", async () => {
    const known = await http()
      .post('/api/v1/auth/parent/forgot-password')
      .send({ identifier: parentId })
      .expect(201);
    const unknown = await http()
      .post('/api/v1/auth/parent/forgot-password')
      .send({ identifier: 'bl35-nobody' })
      .expect(201);
    expect(known.body).toEqual(unknown.body);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('bl35-mother@example.com');
    expect(sent[0].body).toMatch(
      /schoolos:\/\/app\/reset-password\?token=[0-9a-f]{64}/,
    );
    expect(sent[0].body).not.toMatch(/localhost:5173/);
  });

  it('a parent without an e-mail gets nothing sent (the school resets it, BL-64)', async () => {
    const before = sent.length;
    await http()
      .post('/api/v1/auth/parent/forgot-password')
      .send({ identifier: noEmailParentId })
      .expect(201);
    expect(sent).toHaveLength(before);
  });

  it('staff and parent flows do not cross', async () => {
    const before = sent.length;
    // A staff identifier on the parent flow, and a parent identifier on the staff flow: nothing.
    await http()
      .post('/api/v1/auth/parent/forgot-password')
      .send({ identifier: staffId })
      .expect(201);
    await http()
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: parentId })
      .expect(201);
    expect(sent).toHaveLength(before);

    // A staff token is refused by the parent reset endpoint (and vice versa).
    await http()
      .post('/api/v1/auth/forgot-password')
      .send({ identifier: staffId })
      .expect(201);
    const staffToken = lastToken();
    expect(sent.at(-1)!.body).toContain('/reset-password?token=');
    await http()
      .post('/api/v1/auth/parent/reset-password')
      .send({ token: staffToken, newPassword: 'NewHorseBattery9!' })
      .expect(400);
  });

  it('the parent token resets the password once', async () => {
    await http()
      .post('/api/v1/auth/parent/forgot-password')
      .send({ identifier: parentId })
      .expect(201);
    const token = lastToken();
    await http()
      .post('/api/v1/auth/reset-password')
      .send({ token, newPassword: 'NewHorseBattery9!' })
      .expect(400); // not on the staff endpoint

    const newPassword = 'NewHorseBattery9!';
    const [a, b] = await Promise.all([
      http()
        .post('/api/v1/auth/parent/reset-password')
        .send({ token, newPassword }),
      http()
        .post('/api/v1/auth/parent/reset-password')
        .send({ token, newPassword }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);

    await http()
      .post('/api/v1/auth/login')
      .send({ identifier: parentId, password: PASSWORD })
      .expect(401);
    await http()
      .post('/api/v1/auth/login')
      .send({ identifier: parentId, password: newPassword })
      .expect(201);
  });
});
