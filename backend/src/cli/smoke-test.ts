/**
 * Automated production/staging smoke test (RELEASE-VALIDATION §3, PILOT-EXIT A5). A black-box
 * HTTP client: it only calls the public API (and, optionally, fetches the console page), so it runs
 * the same against local, staging and production. Read-only checks always run; writes (attendance,
 * diary, a file upload) run only with SMOKE_WRITES=1 and are meant for a test school.
 *
 * Configuration comes from the environment (see `smokeConfigFrom`); accounts are test accounts
 * created by a controlled process, never real people's.
 */

export type SmokeStatus = 'PASS' | 'FAIL' | 'SKIP';

export interface SmokeResult {
  id: string;
  name: string;
  status: SmokeStatus;
  detail: string;
}

export const SMOKE_ROLES = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'ACCOUNTS',
  'TEACHER',
  'PARENT',
] as const;
export type SmokeRole = (typeof SMOKE_ROLES)[number];

export interface SmokeConfig {
  baseUrl: string;
  consoleUrl?: string;
  accounts: Partial<
    Record<SmokeRole, { identifier: string; password: string }>
  >;
  writes: boolean;
  checkRateLimit: boolean;
  sectionId?: string;
  studentId?: string;
  subjectId?: string;
  foreignStudentId?: string;
  /** Wait before retrying a login answered with 429 (the login limit is 5 per minute). */
  throttleWaitMs: number;
}

export function smokeConfigFrom(
  env: Record<string, string | undefined>,
): SmokeConfig {
  const baseUrl = env['SMOKE_BASE_URL']?.replace(/\/$/, '');
  if (!baseUrl) throw new Error('SMOKE_BASE_URL is required');
  const accounts: SmokeConfig['accounts'] = {};
  for (const role of SMOKE_ROLES) {
    const identifier = env[`SMOKE_${role}_IDENTIFIER`];
    const password = env[`SMOKE_${role}_PASSWORD`];
    if (identifier && password) accounts[role] = { identifier, password };
  }
  return {
    baseUrl,
    consoleUrl: env['SMOKE_CONSOLE_URL']?.replace(/\/$/, '') || undefined,
    accounts,
    writes: env['SMOKE_WRITES'] === '1',
    checkRateLimit: env['SMOKE_CHECK_RATE_LIMIT'] === '1',
    sectionId: env['SMOKE_SECTION_ID'] || undefined,
    studentId: env['SMOKE_STUDENT_ID'] || undefined,
    subjectId: env['SMOKE_SUBJECT_ID'] || undefined,
    foreignStudentId: env['SMOKE_FOREIGN_STUDENT_ID'] || undefined,
    throttleWaitMs: 61_000,
  };
}

type Fetch = typeof fetch;

/** A 1×1 PNG — the upload check sends real image bytes (BL-52 checks the content). */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export async function runSmoke(
  cfg: SmokeConfig,
  fetchImpl: Fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<SmokeResult[]> {
  const results: SmokeResult[] = [];
  const record = (id: string, name: string, status: SmokeStatus, detail = '') =>
    results.push({ id, name, status, detail });
  const api = (path: string) => `${cfg.baseUrl}${path}`;
  const call = async (
    path: string,
    init: RequestInit & { token?: string } = {},
  ) => {
    const headers = new Headers(init.headers);
    if (init.token) headers.set('Authorization', `Bearer ${init.token}`);
    if (typeof init.body === 'string')
      headers.set('Content-Type', 'application/json');
    return fetchImpl(api(path), { ...init, headers });
  };
  const check = async (
    id: string,
    name: string,
    fn: () => Promise<string | void>,
  ) => {
    try {
      record(id, name, 'PASS', (await fn()) ?? '');
    } catch (err) {
      record(
        id,
        name,
        'FAIL',
        err instanceof Error ? err.message : String(err),
      );
    }
  };
  const expectStatus = (res: Response, ...ok: number[]) => {
    if (!ok.includes(res.status)) {
      throw new Error(`HTTP ${res.status} (expected ${ok.join(' or ')})`);
    }
  };

  // 1. Reachability, HTTPS, database-backed readiness.
  await check('S1', 'API reachable, live and ready', async () => {
    const url = new URL(cfg.baseUrl);
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) {
      throw new Error(`${cfg.baseUrl} is not HTTPS`);
    }
    expectStatus(await call('/health/live'), 200);
    expectStatus(await call('/health/ready'), 200);
    return local ? 'local run (HTTPS not checked)' : 'HTTPS';
  });

  // 2. Authentication for every configured role; a wrong password is a plain 401.
  const tokens: Partial<Record<SmokeRole, string>> = {};
  const login = async (identifier: string, password: string) => {
    let res = await call('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    if (res.status === 429) {
      await sleep(cfg.throttleWaitMs);
      res = await call('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
    }
    return res;
  };
  await check('S2a', 'Wrong credentials are refused (401)', async () => {
    const res = await login(
      `smoke-no-such-user-${Date.now()}@invalid.example`,
      'not-the-password',
    );
    expectStatus(res, 401);
  });
  for (const role of SMOKE_ROLES) {
    const account = cfg.accounts[role];
    if (!account) {
      record(
        `S2-${role}`,
        `${role} signs in`,
        'SKIP',
        'no test account configured',
      );
      continue;
    }
    await check(`S2-${role}`, `${role} signs in`, async () => {
      const res = await login(account.identifier, account.password);
      expectStatus(res, 200, 201);
      const body = (await res.json()) as {
        accessToken?: string;
        role?: string;
      };
      if (!body.accessToken) throw new Error('no access token in the response');
      if (body.role !== role) {
        throw new Error(`signed in as ${body.role}, expected ${role}`);
      }
      tokens[role] = body.accessToken;
    });
  }
  if (cfg.checkRateLimit) {
    await check('S2b', 'Login rate limit answers 429', async () => {
      for (let i = 0; i < 8; i++) {
        const res = await call('/api/v1/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            identifier: `smoke-throttle-${i}@invalid.example`,
            password: 'x',
          }),
        });
        if (res.status === 429) return `429 after ${i + 1} attempts`;
      }
      throw new Error('8 failed logins in a row were never throttled');
    });
  } else {
    record(
      'S2b',
      'Login rate limit answers 429',
      'SKIP',
      'set SMOKE_CHECK_RATE_LIMIT=1',
    );
  }

  // 3. Staff console page (and its Content-Security-Policy).
  if (cfg.consoleUrl) {
    const consoleUrl = cfg.consoleUrl;
    await check(
      'S3',
      'Staff console loads with a Content-Security-Policy',
      async () => {
        const res = await fetchImpl(`${consoleUrl}/`);
        expectStatus(res, 200);
        const html = await res.text();
        if (!html.includes('id="app"')) throw new Error('not the console page');
        const header = res.headers.get('content-security-policy');
        const meta = html.includes('http-equiv="Content-Security-Policy"');
        if (!header && !meta) throw new Error('no Content-Security-Policy');
        if (!header || !header.includes('frame-ancestors')) {
          return 'policy present as <meta> only — add the header (frame-ancestors) on the host';
        }
        return 'header present';
      },
    );
  } else {
    record(
      'S3',
      'Staff console loads with a Content-Security-Policy',
      'SKIP',
      'set SMOKE_CONSOLE_URL',
    );
  }

  // 4. One read path per role.
  const reads: [SmokeRole, string, string][] = [
    ['SUPER_ADMIN', '/api/v1/schools', 'S4-SUPER_ADMIN'],
    ['SCHOOL_ADMIN', '/api/v1/admin/students', 'S4-SCHOOL_ADMIN'],
    ['ACCOUNTS', '/api/v1/fee-structures', 'S4-ACCOUNTS'],
    ['TEACHER', '/api/v1/teachers/me/day', 'S4-TEACHER'],
    ['PARENT', '/api/v1/me/children', 'S4-PARENT'],
  ];
  for (const [role, path, id] of reads) {
    const token = tokens[role];
    if (!token) {
      record(id, `${role} reads ${path}`, 'SKIP', 'not signed in');
      continue;
    }
    await check(id, `${role} reads ${path}`, async () => {
      expectStatus(await call(path, { token }), 200);
    });
  }

  // 5 + 6. Writes on the test school (opt-in).
  const staff = tokens.TEACHER ?? tokens.SCHOOL_ADMIN;
  if (!cfg.writes) {
    for (const [id, name] of [
      ['S5a', 'Attendance marked and seen by the parent'],
      ['S5b', 'Diary posted and seen by the parent'],
      ['S6', 'File upload/download; disallowed type refused'],
    ]) {
      record(id, name, 'SKIP', 'set SMOKE_WRITES=1 (test school only)');
    }
  } else {
    const today = new Date().toISOString().slice(0, 10);
    await check('S5a', 'Attendance marked and seen by the parent', async () => {
      if (!staff || !cfg.studentId)
        throw new Error(
          'needs a TEACHER or SCHOOL_ADMIN account and SMOKE_STUDENT_ID',
        );
      expectStatus(
        await call('/api/v1/attendance', {
          method: 'POST',
          token: staff,
          body: JSON.stringify({
            studentId: cfg.studentId,
            date: today,
            status: 'PRESENT',
          }),
        }),
        200,
        201,
      );
      if (tokens.PARENT) {
        const res = await call(
          `/api/v1/students/${cfg.studentId}/attendance?month=${today.slice(0, 7)}`,
          { token: tokens.PARENT },
        );
        expectStatus(res, 200);
        const body = (await res.json()) as { days?: { date: string }[] };
        if (!body.days?.some((d) => d.date.startsWith(today))) {
          throw new Error("the parent does not see today's mark");
        }
      }
    });
    await check('S5b', 'Diary posted and seen by the parent', async () => {
      if (!staff || !cfg.sectionId || !cfg.subjectId || !cfg.studentId) {
        throw new Error(
          'needs SMOKE_SECTION_ID, SMOKE_SUBJECT_ID and SMOKE_STUDENT_ID',
        );
      }
      const text = `Smoke test ${new Date().toISOString()}`;
      expectStatus(
        await call('/api/v1/diary', {
          method: 'POST',
          token: staff,
          body: JSON.stringify({
            sectionId: cfg.sectionId,
            subjectId: cfg.subjectId,
            date: today,
            text,
          }),
        }),
        200,
        201,
      );
      if (tokens.PARENT) {
        const res = await call(`/api/v1/students/${cfg.studentId}/diary`, {
          token: tokens.PARENT,
        });
        expectStatus(res, 200);
        if (!(await res.text()).includes(text)) {
          throw new Error('the parent does not see the entry');
        }
      }
    });
    await check(
      'S6',
      'File upload/download; disallowed type refused',
      async () => {
        const token = tokens.SCHOOL_ADMIN ?? staff;
        if (!token) throw new Error('needs a staff account');
        const upload = (bytes: Buffer, name: string, type: string) => {
          const form = new FormData();
          form.append(
            'file',
            new Blob([new Uint8Array(bytes)], { type }),
            name,
          );
          return call('/api/v1/files', { method: 'POST', token, body: form });
        };
        const ok = await upload(PNG_1X1, 'smoke.png', 'image/png');
        expectStatus(ok, 200, 201);
        const { id } = (await ok.json()) as { id: string };
        const down = await call(`/api/v1/files/${id}`, { token });
        expectStatus(down, 200);
        const got = Buffer.from(await down.arrayBuffer());
        if (!got.equals(PNG_1X1)) throw new Error('downloaded bytes differ');
        const bad = await upload(
          Buffer.from('MZ\x90\x00 not a document'),
          'smoke.exe',
          'application/octet-stream',
        );
        expectStatus(bad, 400, 415);
      },
    );
  }

  // 7. Cross-school isolation.
  if (cfg.foreignStudentId && tokens.SCHOOL_ADMIN) {
    const token = tokens.SCHOOL_ADMIN;
    const foreign = cfg.foreignStudentId;
    await check(
      'S7',
      "A school admin cannot read another school's student",
      async () => {
        expectStatus(
          await call(`/api/v1/admin/students/${foreign}`, { token }),
          403,
          404,
        );
      },
    );
  } else {
    record(
      'S7',
      "A school admin cannot read another school's student",
      'SKIP',
      'needs SMOKE_FOREIGN_STUDENT_ID and a SCHOOL_ADMIN account',
    );
  }

  // 8–10. Not checkable over HTTP here.
  record(
    'S8',
    'Payment gateway round-trip',
    'SKIP',
    'gateways are off for the pilot (RD-14)',
  );
  record(
    'S9',
    'Scheduled jobs logged a run',
    'SKIP',
    'check the logs: attendance-risk 03:00, digest every 15 min, notification-retry every minute',
  );
  record(
    'S10',
    'Parent app release build signs in and receives a push',
    'SKIP',
    'manual (BL-43/BL-54/BL-14)',
  );
  return results;
}

export function formatSmoke(results: SmokeResult[]): string {
  const lines = results.map(
    (r) =>
      `${r.status.padEnd(4)}  ${r.id.padEnd(16)} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`,
  );
  const count = (s: SmokeStatus) =>
    results.filter((r) => r.status === s).length;
  lines.push(
    `\n${count('PASS')} passed, ${count('FAIL')} failed, ${count('SKIP')} skipped`,
  );
  return lines.join('\n');
}
