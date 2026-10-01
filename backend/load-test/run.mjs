#!/usr/bin/env node
// BL-15 load test for the Q44 targets: auth p95 < 1 s, CRUD p95 < 500 ms, error rate < 1 %,
// 100 concurrent users. Plain Node (no dependencies): neither k6 nor autocannon is installed, and
// autocannon replays fixed requests — it cannot log in, keep a cookie per user, or walk a user's
// own children/sections the way these flows do.
//
// Each virtual user (VU) is one person: a parent on the app (bearer tokens), a teacher or an
// office user on the console (cookie mode: X-SchoolOS-Session: cookie + Origin; the refresh token
// lives in the HttpOnly cookie). A VU logs in once, then repeats its role's requests with think
// time between them, refreshing its session now and then.
//
// Throttling: the API limits every client IP (100 requests/min; 5/min on login). The production
// defaults are never changed for a load test. Locally each VU sends from its own loopback address
// (127.0.0.x, `--source-ips loopback`), exactly like 100 users on 100 devices; against staging use
// several load-generator hosts or keep the per-VU rate under the limit (see the report's runbook).
//
//   node load-test/run.mjs --base http://127.0.0.1:3000 --vus 100 --ramp 60 --duration 300
//
// Needs the data from `npm run load:data` (LOAD_PASSWORD must match). Writes
// load-test/results/<stamp>.json and prints a summary table; exits 1 when a threshold fails.
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(' ')
    .split(/\s*--/)
    .filter(Boolean)
    .map((kv) => {
      const [k, ...v] = kv.split(/[= ]/);
      return [k, v.join(' ') || 'true'];
    }),
);
const cfg = {
  base: (args.base ?? process.env.LOAD_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, ''),
  origin: args.origin ?? process.env.LOAD_ORIGIN ?? 'http://localhost:5173',
  password: args.password ?? process.env.LOAD_PASSWORD,
  vus: Number(args.vus ?? 100),
  rampS: Number(args.ramp ?? 60),
  durationS: Number(args.duration ?? 300),
  thinkMinMs: Number(args['think-min'] ?? 1000),
  thinkMaxMs: Number(args['think-max'] ?? 3000),
  sourceIps: args['source-ips'] ?? 'loopback', // loopback | none
  mix: (args.mix ?? '60,25,15').split(',').map(Number), // parents, teachers, office
  month: args.month ?? '2026-09',
  students: Number(args.students ?? 2000),
  teachers: Number(args.teachers ?? 60),
  label: args.label ?? '',
};
const THRESHOLDS = { authP95: 1000, crudP95: 500, errorRate: 0.01 };
if (!cfg.password) {
  console.error('LOAD_PASSWORD (or --password) is required — the password given to npm run load:data.');
  process.exit(2);
}

const target = new URL(cfg.base);
const transport = target.protocol === 'https:' ? https : http;
const DOMAIN = 'lts.load.schoolos.local';
const pad = (n, w) => String(n).padStart(w, '0');
const rand = (n) => Math.floor(Math.random() * n);
const pick = (xs) => xs[rand(xs.length)];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const think = () => sleep(cfg.thinkMinMs + Math.random() * (cfg.thinkMaxMs - cfg.thinkMinMs));

/** Weekdays of the load month up to today (attendance cannot be marked in the future). */
const markDates = (() => {
  const out = [];
  const d = new Date(`${cfg.month}-01T00:00:00Z`);
  const today = new Date();
  while (d.toISOString().startsWith(cfg.month) && d <= today) {
    if (d.getUTCDay() >= 1 && d.getUTCDay() <= 5) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out.length ? out : [`${cfg.month}-01`];
})();

const samples = []; // { name, kind, ms, status, ok, t }
const startedAt = Date.now();
let stopAt = Infinity;

function record(name, kind, ms, status, ok, error) {
  samples.push({ name, kind, ms, status, ok, t: Date.now() - startedAt, ...(error ? { error } : {}) });
}

class Client {
  constructor(vu, cookieMode) {
    this.cookieMode = cookieMode;
    this.cookies = new Map();
    this.accessToken = null;
    this.refreshToken = null;
    const localAddress =
      cfg.sourceIps === 'loopback' ? `127.0.${Math.floor((vu + 2) / 250)}.${((vu + 2) % 250) + 2}` : undefined;
    this.agent = new transport.Agent({ keepAlive: true, maxSockets: 1, localAddress });
  }

  request(method, path, { body, name, kind = 'crud', expect = [200, 201, 204] } = {}) {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const headers = { accept: 'application/json' };
    if (payload) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = Buffer.byteLength(payload);
    }
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    if (this.cookieMode) {
      headers['x-schoolos-session'] = 'cookie';
      headers.origin = cfg.origin;
      if (this.cookies.size) headers.cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    }
    const label = name ?? `${method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, ':id').replace(/\?.*/, '')}`;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const req = transport.request(
        { protocol: target.protocol, hostname: target.hostname, port: target.port, path: target.pathname.replace(/\/$/, '') + path, method, headers, agent: this.agent },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const ms = performance.now() - t0;
            for (const c of res.headers['set-cookie'] ?? []) {
              const [pair] = c.split(';');
              const eq = pair.indexOf('=');
              const [k, v] = [pair.slice(0, eq), pair.slice(eq + 1)];
              if (v) this.cookies.set(k, v);
              else this.cookies.delete(k);
            }
            const ok = expect.includes(res.statusCode);
            record(label, kind, ms, res.statusCode, ok);
            let json = null;
            try {
              json = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : null;
            } catch {
              /* non-JSON body */
            }
            resolve({ status: res.statusCode, json, headers: res.headers, ok });
          });
        },
      );
      req.on('error', (err) => {
        // status 0 = no HTTP response (socket error); keep the reason for the report
        record(label, kind, performance.now() - t0, 0, false, err.code ?? err.message);
        resolve({ status: 0, json: null, error: err.message, ok: false });
      });
      if (payload) req.write(payload);
      req.end();
    });
  }

  async login(identifier) {
    const r = await this.request('POST', '/api/v1/auth/login', {
      body: { identifier, password: cfg.password },
      name: 'POST /auth/login',
      kind: 'auth',
      expect: [200, 201],
    });
    if (!r.ok) throw new Error(`login ${identifier} -> ${r.status} ${r.error ?? JSON.stringify(r.json)}`);
    this.accessToken = r.json.accessToken;
    this.refreshToken = r.json.refreshToken ?? null;
    return r.json;
  }

  async refresh() {
    const r = await this.request('POST', '/api/v1/auth/refresh', {
      body: this.cookieMode ? {} : { refreshToken: this.refreshToken },
      name: 'POST /auth/refresh',
      kind: 'auth',
      expect: [200, 201],
    });
    if (r.ok) {
      this.accessToken = r.json.accessToken;
      if (!this.cookieMode) this.refreshToken = r.json.refreshToken;
    }
  }
}

const ids = (json) => (Array.isArray(json) ? json.map((x) => x.id).filter(Boolean) : []);

// --- role flows ------------------------------------------------------------------------------

async function parentVu(vu) {
  const c = new Client(vu, false);
  const no = 1 + ((vu * 37) % cfg.students);
  await c.login(`${vu % 2 ? 'mother' : 'father'}.${pad(no, 5)}@parent.load.schoolos.local`);
  await c.request('GET', '/api/v1/me');
  const children = ids((await c.request('GET', '/api/v1/me/children')).json);
  if (!children.length) throw new Error(`parent ${no} has no children`);
  const circulars = ids((await c.request('GET', '/api/v1/circulars')).json);
  const conversations = ids((await c.request('GET', '/api/v1/conversations')).json);
  const steps = [
    () => c.request('GET', `/api/v1/students/${pick(children)}/attendance?month=${cfg.month}`),
    () => c.request('GET', `/api/v1/students/${pick(children)}/diary?month=${cfg.month}`),
    () => c.request('GET', `/api/v1/students/${pick(children)}/timetable`),
    () => c.request('GET', `/api/v1/students/${pick(children)}/fees`),
    () => c.request('GET', `/api/v1/students/${pick(children)}/fees/payments`),
    () => c.request('GET', `/api/v1/report-cards/generated?studentId=${pick(children)}`),
    () => c.request('GET', `/api/v1/me/children/${pick(children)}`),
    () => c.request('GET', '/api/v1/circulars'),
    () => c.request('GET', '/api/v1/notifications'),
    () => c.request('GET', '/api/v1/conversations'),
    () => (circulars.length ? c.request('POST', `/api/v1/circulars/${pick(circulars)}/read`) : null),
    () => (conversations.length ? c.request('GET', `/api/v1/conversations/${pick(conversations)}`) : null),
  ];
  await loop(c, steps);
}

async function teacherVu(vu) {
  const c = new Client(vu, true);
  const no = 1 + (vu % cfg.teachers);
  await c.login(`teacher.${pad(no, 3)}@${DOMAIN}`);
  await c.request('GET', '/api/v1/me');
  await c.request('GET', '/api/v1/teachers/me/day');
  const sections = ids((await c.request('GET', '/api/v1/sections')).json);
  if (!sections.length) throw new Error(`teacher ${no} has no sections`);
  const roster = new Map();
  const studentsOf = async (id) => {
    const r = await c.request('GET', `/api/v1/sections/${id}/students`);
    if (r.ok) roster.set(id, ids(r.json));
    return r;
  };
  const steps = [
    () => studentsOf(pick(sections)),
    () => c.request('GET', `/api/v1/sections/${pick(sections)}/attendance?date=${pick(markDates)}`),
    async () => {
      const id = pick(sections);
      if (!roster.has(id)) await studentsOf(id);
      const students = roster.get(id) ?? [];
      if (!students.length) return null;
      return c.request('POST', '/api/v1/attendance/bulk', {
        body: {
          date: pick(markDates),
          marks: students.map((studentId) => ({ studentId, status: Math.random() < 0.9 ? 'PRESENT' : 'ABSENT' })),
        },
      });
    },
    () => c.request('GET', `/api/v1/sections/${pick(sections)}/diary?month=${cfg.month}`),
    () => c.request('GET', '/api/v1/teachers/me/timetable'),
    () => c.request('GET', '/api/v1/teachers/me/day'),
    () => c.request('GET', '/api/v1/conversations'),
    () => c.request('GET', '/api/v1/notifications'),
    () => c.request('GET', '/api/v1/me'),
  ];
  await loop(c, steps);
}

async function officeVu(vu) {
  const c = new Client(vu, true);
  const who = ['admin', 'principal', 'accounts'][vu % 3];
  await c.login(`${who}@${DOMAIN}`);
  await c.request('GET', '/api/v1/me');
  // Office staff open a student from a list: the admin student list, or (accounts, which has no
  // access to it) a section roster.
  let students;
  if (who === 'accounts') {
    const sections = ids((await c.request('GET', '/api/v1/sections')).json);
    students = ids((await c.request('GET', `/api/v1/sections/${pick(sections)}/students`)).json);
  } else {
    students = ids((await c.request('GET', '/api/v1/admin/students?page=1&limit=25')).json);
  }
  const steps =
    who === 'accounts'
      ? [
          () => c.request('GET', `/api/v1/students/${pick(students)}/fees`),
          () => c.request('GET', `/api/v1/students/${pick(students)}/fees/payments`),
          () => c.request('GET', '/api/v1/admin/dashboard-summary'),
          () => c.request('GET', '/api/v1/fee-structures'),
          () => c.request('GET', '/api/v1/sections'),
          () => c.request('GET', '/api/v1/me'),
        ]
      : [
          () => c.request('GET', `/api/v1/admin/students?page=${1 + rand(80)}&limit=25`),
          () => c.request('GET', `/api/v1/admin/students?page=1&limit=25&q=${encodeURIComponent(`Student 0${rand(20)}`)}`),
          () => c.request('GET', `/api/v1/admin/parents?page=${1 + rand(160)}&limit=25`),
          () => c.request('GET', `/api/v1/admin/parents?page=1&limit=25&q=${encodeURIComponent(`Father of Load Student 0${rand(20)}`)}`),
          () => c.request('GET', `/api/v1/admin/students/${pick(students)}/profile`),
          () => c.request('GET', `/api/v1/students/${pick(students)}/fees`),
          () => c.request('GET', `/api/v1/students/${pick(students)}/attendance?month=${cfg.month}`),
          () => c.request('GET', '/api/v1/admin/dashboard-summary'),
          () => c.request('GET', '/api/v1/sections'),
          () => c.request('GET', '/api/v1/circulars'),
          () => c.request('GET', '/api/v1/leave-requests'),
        ];
  if (!students.length) throw new Error(`${who}: no students listed`);
  await loop(c, steps);
}

async function loop(c, steps) {
  let n = 0;
  while (Date.now() < stopAt) {
    await think();
    if (Date.now() >= stopAt) break;
    // A client refreshes every ~15 requests (the console on reload/expiry, the app on resume).
    if (++n % 15 === 0) await c.refresh();
    else await pick(steps)();
  }
}

// --- run ---------------------------------------------------------------------------------------

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}
function stats(list, seconds) {
  const ms = list.map((s) => s.ms).sort((a, b) => a - b);
  const errors = list.filter((s) => !s.ok).length;
  return {
    count: list.length,
    rps: +(list.length / seconds).toFixed(2),
    p50: +percentile(ms, 50).toFixed(1),
    p95: +percentile(ms, 95).toFixed(1),
    p99: +percentile(ms, 99).toFixed(1),
    max: +(ms.at(-1) ?? 0).toFixed(1),
    errors,
    errorRate: list.length ? +(errors / list.length).toFixed(4) : 0,
  };
}

async function main() {
  const total = cfg.mix.reduce((a, b) => a + b, 0);
  const counts = cfg.mix.map((m) => Math.round((m / total) * cfg.vus));
  counts[0] += cfg.vus - counts.reduce((a, b) => a + b, 0);
  const roles = [...Array(counts[0]).fill(parentVu), ...Array(counts[1]).fill(teacherVu), ...Array(counts[2]).fill(officeVu)];
  console.log(
    `BL-15 load test: ${cfg.vus} VUs (${counts[0]} parents, ${counts[1]} teachers, ${counts[2]} office), ` +
      `ramp ${cfg.rampS}s, steady ${cfg.durationS}s, think ${cfg.thinkMinMs}-${cfg.thinkMaxMs}ms, ` +
      `source IPs ${cfg.sourceIps}, target ${cfg.base}`,
  );
  stopAt = Date.now() + (cfg.rampS + cfg.durationS) * 1000;
  const failures = [];
  const progress = setInterval(() => {
    const recent = samples.filter((s) => s.t > Date.now() - startedAt - 10_000);
    const st = stats(recent, 10);
    console.log(`  t=${((Date.now() - startedAt) / 1000).toFixed(0)}s  last10s: ${st.count} req, p95 ${st.p95} ms, errors ${st.errors}`);
  }, 10_000);
  await Promise.all(
    roles.map(async (fn, vu) => {
      await sleep((vu / cfg.vus) * cfg.rampS * 1000);
      try {
        await fn(vu);
      } catch (err) {
        failures.push(`VU ${vu} (${fn.name}): ${err.message}`);
      }
    }),
  );
  clearInterval(progress);

  const seconds = (Date.now() - startedAt) / 1000;
  const byName = {};
  for (const s of samples) (byName[s.name] ??= []).push(s);
  const endpoints = Object.entries(byName)
    .map(([name, list]) => ({ name, kind: list[0].kind, ...stats(list, seconds), statuses: countBy(list.map((s) => s.status)) }))
    .sort((a, b) => b.p95 - a.p95);
  const auth = stats(samples.filter((s) => s.kind === 'auth'), seconds);
  const crud = stats(samples.filter((s) => s.kind === 'crud'), seconds);
  const all = stats(samples, seconds);
  const checks = {
    authP95: { value: auth.p95, limit: THRESHOLDS.authP95, pass: auth.p95 < THRESHOLDS.authP95 },
    crudP95: { value: crud.p95, limit: THRESHOLDS.crudP95, pass: crud.p95 < THRESHOLDS.crudP95 },
    errorRate: { value: all.errorRate, limit: THRESHOLDS.errorRate, pass: all.errorRate < THRESHOLDS.errorRate },
    vusStarted: { value: cfg.vus - failures.length, limit: cfg.vus, pass: failures.length === 0 },
  };
  const result = {
    label: cfg.label,
    startedAt: new Date(startedAt).toISOString(),
    seconds: +seconds.toFixed(1),
    config: { ...cfg, password: undefined },
    machine: {
      cpu: os.cpus()[0]?.model,
      cores: os.cpus().length,
      memoryGb: +(os.totalmem() / 2 ** 30).toFixed(1),
      platform: `${os.platform()} ${os.release()}`,
      node: process.version,
    },
    checks,
    summary: { all, auth, crud },
    endpoints,
    vuFailures: failures,
    errorsByEndpoint: errorCounts(),
  };
  const out = join(dirname(fileURLToPath(import.meta.url)), 'results');
  mkdirSync(out, { recursive: true });
  const file = join(out, `${new Date(startedAt).toISOString().replace(/[:.]/g, '-')}${cfg.label ? `-${cfg.label}` : ''}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2));

  const row = (n, s) => `| ${n} | ${s.count} | ${s.rps} | ${s.p50} | ${s.p95} | ${s.p99} | ${s.max} | ${s.errors} |`;
  console.log('\n| Endpoint | Requests | req/s | p50 ms | p95 ms | p99 ms | max ms | errors |\n|---|---|---|---|---|---|---|---|');
  for (const e of endpoints) console.log(row(e.name, e));
  console.log(row('**auth (all)**', auth));
  console.log(row('**CRUD (all)**', crud));
  console.log(row('**total**', all));
  console.log('\nThresholds:');
  for (const [k, v] of Object.entries(checks)) console.log(`  ${v.pass ? 'PASS' : 'FAIL'}  ${k}: ${v.value} (limit ${v.limit})`);
  if (failures.length) console.log(`VU failures:\n  ${failures.slice(0, 10).join('\n  ')}`);
  const statusCounts = errorCounts();
  if (Object.keys(statusCounts).length) console.log('Errors by endpoint:', statusCounts);
  console.log(`\nresults: ${file}`);
  process.exit(Object.values(checks).every((c) => c.pass) ? 0 : 1);
}

function errorCounts() {
  return countBy(samples.filter((s) => !s.ok).map((s) => `${s.name} -> ${s.status}${s.error ? ` (${s.error})` : ''}`));
}

function countBy(xs) {
  return xs.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {});
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
