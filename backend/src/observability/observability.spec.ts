import { createServer, IncomingMessage } from 'http';
import type { AddressInfo } from 'net';
import {
  BadRequestException,
  ForbiddenException,
  type ArgumentsHost,
} from '@nestjs/common';
import { scrub, scrubString, pathOnly, REDACTED } from './scrub';
import { JsonLogger } from './json-logger';
import {
  buildEvent,
  createErrorReporter,
  NoopErrorReporter,
  parseDsn,
  SentryEnvelopeReporter,
} from './error-reporter';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { requestContext, resolveRequestId } from './request-context';

const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlIjoiUEFSRU5UIn0.c2lnbmF0dXJlLXZhbHVlLXg';
const HEX64 = 'a'.repeat(64);

describe('scrub (BL-11)', () => {
  it('redacts sensitive keys at any depth', () => {
    const out = scrub({
      identifier: 'parent@x.pk',
      password: 'hunter2',
      newPassword: 'x',
      body: {
        refreshToken: 'r',
        cnic: '35202-1111111-1',
        bFormNumber: '1',
        medicalInfo: { allergies: 'nuts' },
      },
      headers: { authorization: 'Bearer abc', cookie: 'c' },
      temporaryPassword: 'Hq7M-wR3k-Tz9c',
    });
    expect(out).toEqual({
      identifier: 'parent@x.pk',
      password: REDACTED,
      newPassword: REDACTED,
      body: {
        refreshToken: REDACTED,
        cnic: REDACTED,
        bFormNumber: REDACTED,
        medicalInfo: REDACTED,
      },
      headers: { authorization: REDACTED, cookie: REDACTED },
      temporaryPassword: REDACTED,
    });
  });

  it('redacts secrets embedded in free text', () => {
    const s = scrubString(
      `token ${JWT} for CNIC 35202-1234567-1 b-form 3520212345671 reset ${HEX64} hdr Bearer abc.def /files/1?access_token=zzz&x=1`,
    );
    expect(s).not.toContain(JWT);
    expect(s).not.toContain('35202-1234567-1');
    expect(s).not.toContain('3520212345671');
    expect(s).not.toContain(HEX64);
    expect(s).not.toContain('abc.def');
    expect(s).not.toContain('zzz');
    expect(s).toContain('&x=1');
  });

  it('drops query strings from paths', () => {
    expect(pathOnly('/api/v1/files/1?access_token=zzz')).toBe(
      '/api/v1/files/1',
    );
    expect(pathOnly('/health/live')).toBe('/health/live');
  });
});

describe('request id', () => {
  it('accepts a safe upstream id and replaces anything else', () => {
    expect(resolveRequestId('lb-1234abcd')).toBe('lb-1234abcd');
    expect(resolveRequestId('bad id\nInjected: x')).toMatch(/^[0-9a-f-]{36}$/);
    expect(resolveRequestId(undefined)).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('JsonLogger (BL-11)', () => {
  it('writes one scrubbed JSON line with level, context and the request id', () => {
    const lines: [string, boolean][] = [];
    const logger = new JsonLogger('log', (l, e) => lines.push([l, e]));
    requestContext.run({ requestId: 'req-12345678' }, () => {
      logger.log(`login ok ${JWT}`, 'AuthService');
      logger.error('boom', 'Error: boom\n    at x', 'Exceptions');
      logger.debug('hidden below the level');
      logger.log({ msg: 'request', path: '/x', password: 'p' }, 'HTTP');
    });
    expect(lines).toHaveLength(3);
    const first = JSON.parse(lines[0][0]);
    expect(first).toMatchObject({
      level: 'log',
      context: 'AuthService',
      requestId: 'req-12345678',
    });
    expect(first.message).not.toContain(JWT);
    const err = JSON.parse(lines[1][0]);
    expect(lines[1][1]).toBe(true);
    expect(err).toMatchObject({
      level: 'error',
      message: 'boom',
      context: 'Exceptions',
    });
    expect(err.stack).toContain('Error: boom');
    expect(JSON.parse(lines[2][0])).toMatchObject({
      msg: 'request',
      path: '/x',
      password: REDACTED,
    });
  });
});

describe('error reporter (BL-11)', () => {
  it('parses DSNs, including path prefixes', () => {
    expect(parseDsn('https://pub123@o1.ingest.example.io/42')).toEqual({
      publicKey: 'pub123',
      envelopeUrl: 'https://o1.ingest.example.io/api/42/envelope/',
    });
    expect(parseDsn('https://k@host.example/sub/7')?.envelopeUrl).toBe(
      'https://host.example/sub/api/7/envelope/',
    );
    expect(parseDsn('not a dsn')).toBeNull();
  });

  it('is a no-op without SENTRY_DSN and rejects a malformed one', () => {
    expect(createErrorReporter(() => undefined)).toBeInstanceOf(
      NoopErrorReporter,
    );
    expect(() =>
      createErrorReporter((k) => (k === 'SENTRY_DSN' ? 'nope' : undefined)),
    ).toThrow(/SENTRY_DSN/);
  });

  it('builds events without passwords, tokens, CNIC or identifiers (scrub test)', () => {
    const event = buildEvent(
      new Error(
        `login failed password=hunter2 cnic 35202-1234567-1 jwt ${JWT}`,
      ),
      {
        requestId: 'r-12345678',
        method: 'POST',
        path: '/api/v1/auth/login',
        userId: 'u1',
        status: 500,
      },
      { environment: 'production' },
    );
    const text = JSON.stringify(event);
    expect(text).not.toContain('35202-1234567-1');
    expect(text).not.toContain(JWT);
    expect(event).toMatchObject({
      level: 'error',
      environment: 'production',
      user: { id: 'u1' },
    });
  });

  it('posts a Sentry envelope to the DSN endpoint and never throws', async () => {
    const received: { url?: string; auth?: string; body: string }[] = [];
    const server = createServer((req: IncomingMessage, res) => {
      let body = '';
      req.on('data', (c) => (body += String(c)));
      req.on('end', () => {
        received.push({
          url: req.url,
          auth: req.headers['x-sentry-auth'] as string,
          body,
        });
        res.end('{}');
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address() as AddressInfo;
    try {
      const reporter = new SentryEnvelopeReporter(
        parseDsn(`http://pubkey@127.0.0.1:${port}/9`)!,
        { environment: 'test' },
      );
      await reporter.report(new Error(`db down; token ${HEX64}`), {
        requestId: 'r-12345678',
      });
      expect(received).toHaveLength(1);
      expect(received[0].url).toBe('/api/9/envelope/');
      expect(received[0].auth).toContain('sentry_key=pubkey');
      const [, itemHeader, event] = received[0].body.split('\n');
      expect(JSON.parse(itemHeader)).toEqual({ type: 'event' });
      expect(event).not.toContain(HEX64);
      expect(JSON.parse(event).tags.requestId).toBe('r-12345678');
    } finally {
      server.close();
    }
    const dead = new SentryEnvelopeReporter(
      parseDsn('http://k@127.0.0.1:1/1')!,
      {},
    );
    await expect(dead.report(new Error('x'))).resolves.toBeUndefined();
  });
});

describe('AllExceptionsFilter (BL-11)', () => {
  function run(exception: unknown, requestId?: string) {
    const reporter = {
      enabled: true,
      report: jest.fn().mockResolvedValue(undefined),
    };
    const filter = new AllExceptionsFilter(reporter);
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const host = {
      switchToHttp: () => ({
        getResponse: () => res,
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/v1/files/1?access_token=zzz',
          user: { id: 'u1' },
        }),
      }),
    } as unknown as ArgumentsHost;
    const call = () => filter.catch(exception, host);
    if (requestId) requestContext.run({ requestId }, call);
    else call();
    return { res, reporter };
  }

  it('keeps HttpException bodies (incl. extra fields) and adds the request id', () => {
    const { res, reporter } = run(
      new ForbiddenException({
        statusCode: 403,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'm',
      }),
      'req-12345678',
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 403,
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'm',
      requestId: 'req-12345678',
    });
    expect(reporter.report).not.toHaveBeenCalled();
    const bad = run(new BadRequestException(['name must be a string']));
    expect(bad.res.json.mock.calls[0][0]).toMatchObject({
      statusCode: 400,
      message: ['name must be a string'],
    });
  });

  it('hides unexpected errors behind a generic 500 and reports them without the query string', () => {
    const { res, reporter } = run(
      new Error('relation "X" does not exist'),
      'req-12345678',
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      requestId: 'req-12345678',
    });
    expect(reporter.report).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        path: '/api/v1/files/1',
        userId: 'u1',
        status: 500,
      }),
    );
  });
});
