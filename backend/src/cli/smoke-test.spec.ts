import {
  formatSmoke,
  runSmoke,
  smokeConfigFrom,
  type SmokeConfig,
} from './smoke-test';

/** Release smoke test runner (RELEASE-VALIDATION §3) — logic that the e2e cannot reach. */
describe('smoke test runner', () => {
  const base: SmokeConfig = {
    baseUrl: 'http://127.0.0.1:3000',
    accounts: {},
    writes: false,
    checkRateLimit: false,
    throttleWaitMs: 0,
  };
  const reply = (status: number, body: unknown = {}) =>
    new Response(JSON.stringify(body), { status });

  it('reads accounts and switches from the environment; requires the base URL', () => {
    const cfg = smokeConfigFrom({
      SMOKE_BASE_URL: 'https://api.example.org/',
      SMOKE_PARENT_IDENTIFIER: 'p@x',
      SMOKE_PARENT_PASSWORD: 'pw',
      SMOKE_TEACHER_IDENTIFIER: 'only-identifier',
      SMOKE_WRITES: '1',
    });
    expect(cfg.baseUrl).toBe('https://api.example.org');
    expect(cfg.accounts).toEqual({
      PARENT: { identifier: 'p@x', password: 'pw' },
    });
    expect(cfg.writes).toBe(true);
    expect(() => smokeConfigFrom({})).toThrow('SMOKE_BASE_URL');
  });

  it('fails a non-local API that is not HTTPS', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(200));
    const results = await runSmoke(
      { ...base, baseUrl: 'http://api.example.org' },
      fetchImpl,
    );
    expect(results.find((r) => r.id === 'S1')).toMatchObject({
      status: 'FAIL',
      detail: 'http://api.example.org is not HTTPS',
    });
  });

  it('retries a throttled login once after the window and then signs in', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    let logins = 0;
    const fetchImpl = jest.fn((url: string) => {
      if (url.endsWith('/auth/login')) {
        logins++;
        if (logins === 1) return Promise.resolve(reply(401));
        if (logins === 2) return Promise.resolve(reply(429));
        return Promise.resolve(
          reply(201, { accessToken: 't', role: 'PARENT' }),
        );
      }
      return Promise.resolve(reply(200, []));
    });
    const results = await runSmoke(
      { ...base, accounts: { PARENT: { identifier: 'p', password: 'pw' } } },
      fetchImpl,
      sleep,
    );
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(results.find((r) => r.id === 'S2-PARENT')?.status).toBe('PASS');
    expect(results.find((r) => r.id === 'S4-PARENT')?.status).toBe('PASS');
  });

  it('the rate-limit check passes once a 429 arrives and fails when none does', async () => {
    const throttled = jest.fn((url: string) =>
      Promise.resolve(url.endsWith('/auth/login') ? reply(429) : reply(200)),
    );
    let results = await runSmoke(
      { ...base, checkRateLimit: true },
      throttled,
      () => Promise.resolve(),
    );
    expect(results.find((r) => r.id === 'S2b')?.status).toBe('PASS');

    const never = jest.fn((url: string) =>
      Promise.resolve(url.endsWith('/auth/login') ? reply(401) : reply(200)),
    );
    results = await runSmoke({ ...base, checkRateLimit: true }, never);
    expect(results.find((r) => r.id === 'S2b')?.status).toBe('FAIL');
    expect(formatSmoke(results)).toMatch(/\d+ failed/);
  });

  it('skips writes unless asked, and never claims the manual checks', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(reply(401));
    const results = await runSmoke(base, fetchImpl);
    for (const id of ['S5a', 'S5b', 'S6', 'S8', 'S9', 'S10']) {
      expect(results.find((r) => r.id === id)?.status).toBe('SKIP');
    }
    expect(fetchImpl).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/attendance'),
      expect.anything(),
    );
  });
});
