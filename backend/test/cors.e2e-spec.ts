import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { parseCorsOrigins } from '../src/config/cors.config';

describe('CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.enableCors({ origin: parseCorsOrigins(process.env.CORS_ORIGINS) });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('reflects Access-Control-Allow-Origin for the allowed staff-console dev origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBe(
      'http://localhost:5173',
    );
  });

  it('omits Access-Control-Allow-Origin for a disallowed origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/auth/login')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
