import { findEnvProblems, validateEnv } from './env.validation';

describe('validateEnv (BL-51)', () => {
  const strongSecret = 'k7Qx2mV9pL4sT8wZ1nR6yB3cF5hJ0dG2aE7uI9oP';
  const production = {
    NODE_ENV: 'production',
    JWT_ACCESS_SECRET: strongSecret,
    DATABASE_URL: 'postgresql://app@db:5432/schoolos',
    CORS_ORIGINS: 'https://console.example.pk',
    FRONTEND_URL: 'https://console.example.pk',
    STORAGE_DRIVER: 's3',
    S3_BUCKET: 'schoolos-files',
  };

  it('refuses to boot when NODE_ENV is unset (it no longer defaults to development)', () => {
    expect(() => validateEnv({ JWT_ACCESS_SECRET: strongSecret })).toThrow(
      /NODE_ENV must be set explicitly/,
    );
  });

  it('refuses an unknown NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'prod' })).toThrow(
      /NODE_ENV="prod" is not one of/,
    );
  });

  it.each(['development', 'test'])(
    'accepts %s without secrets (local fallbacks stay available)',
    (NODE_ENV) => {
      expect(findEnvProblems({ NODE_ENV })).toEqual([]);
    },
  );

  it('accepts a complete production configuration', () => {
    expect(validateEnv(production)).toBe(production);
  });

  it.each(['production', 'staging'])(
    'rejects the shipped "change-me" secret when NODE_ENV=%s',
    (NODE_ENV) => {
      expect(() =>
        validateEnv({
          ...production,
          NODE_ENV,
          JWT_ACCESS_SECRET: 'change-me',
        }),
      ).toThrow(/at least 32 characters[\s\S]*looks like a placeholder/);
    },
  );

  it('rejects a long placeholder and a short random secret', () => {
    expect(
      findEnvProblems({
        ...production,
        JWT_ACCESS_SECRET: 'dev-only-change-me-access-000000000000',
      }),
    ).toEqual([expect.stringMatching(/looks like a placeholder/)]);
    expect(
      findEnvProblems({ ...production, JWT_ACCESS_SECRET: 'k7Qx2mV9pL4s' }),
    ).toEqual([expect.stringMatching(/at least 32 characters/)]);
  });

  it('lists every missing production variable in one error', () => {
    const problems = findEnvProblems({ NODE_ENV: 'production' });
    expect(problems).toEqual([
      'JWT_ACCESS_SECRET must be set when NODE_ENV=production.',
      'STORAGE_DRIVER must be "s3" when NODE_ENV=production (local disk storage is for development/test only).',
      'DATABASE_URL must be set when NODE_ENV=production.',
      'CORS_ORIGINS must be set when NODE_ENV=production.',
      'FRONTEND_URL must be set when NODE_ENV=production.',
    ]);
  });

  it('requires S3 storage with a bucket outside development/test (BL-10)', () => {
    expect(findEnvProblems({ ...production, STORAGE_DRIVER: 'local' })).toEqual(
      [expect.stringMatching(/STORAGE_DRIVER must be "s3"/)],
    );
    expect(findEnvProblems({ ...production, S3_BUCKET: '' })).toEqual([
      'S3_BUCKET must be set when STORAGE_DRIVER=s3.',
    ]);
    expect(findEnvProblems({ NODE_ENV: 'development' })).toEqual([]);
  });

  it('treats whitespace-only values as unset', () => {
    expect(findEnvProblems({ ...production, CORS_ORIGINS: '   ' })).toEqual([
      'CORS_ORIGINS must be set when NODE_ENV=production.',
    ]);
  });
});
