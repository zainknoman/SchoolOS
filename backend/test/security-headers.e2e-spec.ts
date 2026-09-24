import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyHttpSecurity } from '../src/config/app-security';

/**
 * BL-12: the response carries standard security headers, and the rate limiter keys on the real
 * client IP behind a trusted proxy — while a client talking to the API directly cannot spoof
 * X-Forwarded-For to get a fresh rate-limit bucket.
 */
describe('HTTP security headers and trust proxy (e2e)', () => {
  type Tracker = { getTracker(req: unknown): Promise<string> };

  /**
   * Boots the app with a call-through spy on the throttler's key function. The guard binds
   * getTracker once at init, so the spy must exist BEFORE app.init().
   */
  async function boot(env: NodeJS.ProcessEnv) {
    const tracker = jest.spyOn(
      ThrottlerGuard.prototype as unknown as Tracker,
      'getTracker',
    );
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleFixture.createNestApplication<NestExpressApplication>();
    applyHttpSecurity(app, env);
    await app.init();
    const keys = () =>
      Promise.all(tracker.mock.results.map((r) => r.value as Promise<string>));
    const close = async () => {
      tracker.mockRestore();
      await app.close();
    };
    return { app, keys, close };
  }

  describe('defaults (TRUST_PROXY unset)', () => {
    let b: Awaited<ReturnType<typeof boot>>;
    beforeAll(async () => {
      b = await boot({});
    });
    afterAll(async () => {
      await b.close();
    });

    it('sets the standard helmet headers and hides X-Powered-By', async () => {
      const res = await request(b.app.getHttpServer()).get('/api/v1/auth/me');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['content-security-policy']).toContain(
        "default-src 'self'",
      );
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('allows cross-origin embedding of API resources (console <img> logos)', async () => {
      const res = await request(b.app.getHttpServer()).get('/api/v1/auth/me');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('ignores a client-supplied X-Forwarded-For when no proxy is trusted', async () => {
      await request(b.app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '203.0.113.7')
        .send({ identifier: 'nobody@example.pk', password: 'x' });
      const keys = await b.keys();
      expect(keys.length).toBeGreaterThan(0);
      expect(keys).not.toContain('203.0.113.7');
    });
  });

  describe('behind one trusted proxy (TRUST_PROXY=1)', () => {
    let b: Awaited<ReturnType<typeof boot>>;
    beforeAll(async () => {
      b = await boot({ TRUST_PROXY: '1' });
    });
    afterAll(async () => {
      await b.close();
    });

    it('keys the rate limiter on the forwarded client IP', async () => {
      for (const ip of ['203.0.113.7', '198.51.100.9']) {
        await request(b.app.getHttpServer())
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', ip)
          .send({ identifier: 'nobody@example.pk', password: 'x' });
      }
      const keys = await b.keys();
      expect(keys).toContain('203.0.113.7');
      expect(keys).toContain('198.51.100.9');
    });
  });
});
