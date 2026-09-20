import { buildCorsOriginOption, parseCorsOrigins } from './cors.config';

describe('parseCorsOrigins', () => {
  it('defaults to the staff-console dev origin when unset', () => {
    expect(parseCorsOrigins(undefined)).toEqual(['http://localhost:5173']);
  });

  it('defaults to the staff-console dev origin when set to an empty string', () => {
    expect(parseCorsOrigins('')).toEqual(['http://localhost:5173']);
  });

  it('splits a comma-separated list and trims whitespace', () => {
    expect(
      parseCorsOrigins('https://staff.example.com, https://staff2.example.com'),
    ).toEqual(['https://staff.example.com', 'https://staff2.example.com']);
  });

  it('drops empty entries from a trailing comma', () => {
    expect(parseCorsOrigins('https://staff.example.com,')).toEqual([
      'https://staff.example.com',
    ]);
  });
});

describe('buildCorsOriginOption', () => {
  function allow(
    option: ReturnType<typeof buildCorsOriginOption>,
    origin: string | undefined,
  ) {
    if (Array.isArray(option)) {
      return origin !== undefined && option.includes(origin);
    }
    let allowed: boolean | undefined;
    option(origin, (_err, ok) => {
      allowed = ok;
    });
    return allowed;
  }

  it('returns the plain allow-list outside development/test (no wildcard, unchanged behavior)', () => {
    const option = buildCorsOriginOption(undefined, 'production');

    expect(option).toEqual(['http://localhost:5173']);
    expect(allow(option, 'http://localhost:54321')).toBe(false);
  });

  it('accepts any localhost origin, any port, in development', () => {
    const option = buildCorsOriginOption(undefined, 'development');

    expect(allow(option, 'http://localhost:5173')).toBe(true);
    expect(allow(option, 'http://localhost:54321')).toBe(true);
    expect(allow(option, 'http://127.0.0.1:8765')).toBe(true);
  });

  it('accepts any localhost origin in test, same as development', () => {
    const option = buildCorsOriginOption(undefined, 'test');

    expect(allow(option, 'http://localhost:9999')).toBe(true);
  });

  it('treats an unset NODE_ENV as development (matches resolveAccessTokenSecret)', () => {
    const option = buildCorsOriginOption(undefined, undefined);

    expect(allow(option, 'http://localhost:54321')).toBe(true);
  });

  it('still rejects a non-localhost origin in development', () => {
    const option = buildCorsOriginOption(undefined, 'development');

    expect(allow(option, 'https://evil.example.com')).toBe(false);
  });

  it('still honors an explicit CORS_ORIGINS entry in development', () => {
    const option = buildCorsOriginOption(
      'https://staff.example.com',
      'development',
    );

    expect(allow(option, 'https://staff.example.com')).toBe(true);
    expect(allow(option, 'http://localhost:5173')).toBe(true);
  });
});
