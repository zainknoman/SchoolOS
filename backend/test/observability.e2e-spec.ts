import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { applyRequestObservability } from '../src/observability/http-observability';

/** BL-11: health endpoints, request ids, error bodies and the access log, end to end. */
describe('Observability (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    applyRequestObservability(app);
    prisma = moduleFixture.get(PrismaService);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live and /health/ready answer without authentication', async () => {
    await request(app.getHttpServer())
      .get('/health/live')
      .expect(200, { status: 'ok' });
    const ready = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);
    expect(ready.body).toEqual({ status: 'ok', checks: { database: 'up' } });
  });

  it('readiness reports 503 when the database does not answer', async () => {
    const spy = jest
      .spyOn(prisma, '$queryRaw')
      .mockRejectedValueOnce(new Error('connection refused'));
    try {
      const res = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(503);
      expect(res.body).toMatchObject({
        status: 'unavailable',
        checks: { database: 'down' },
      });
      expect(JSON.stringify(res.body)).not.toContain('connection refused');
    } finally {
      spy.mockRestore();
    }
  });

  it('echoes a generated request id, or a safe incoming one, and puts it in error bodies', async () => {
    const generated = await request(app.getHttpServer()).get('/health/live');
    expect(generated.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const res = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('X-Request-Id', 'lb-trace-12345678')
      .expect(401);
    expect(res.headers['x-request-id']).toBe('lb-trace-12345678');
    expect(res.body.requestId).toBe('lb-trace-12345678');
  });

  it('writes one access-log line per request, without the query string', async () => {
    const lines: unknown[] = [];
    const spy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation((m: unknown) => {
        lines.push(m);
      });
    try {
      await request(app.getHttpServer())
        .get('/api/v1/files/some-id?access_token=secret-value')
        .expect(401);
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      spy.mockRestore();
    }
    const access = lines.find(
      (l) =>
        typeof l === 'object' &&
        l !== null &&
        (l as { msg?: string }).msg === 'request',
    ) as { path: string; status: number; method: string };
    expect(access).toMatchObject({
      method: 'GET',
      path: '/api/v1/files/some-id',
      status: 401,
    });
    expect(JSON.stringify(lines)).not.toContain('secret-value');
  });
});
