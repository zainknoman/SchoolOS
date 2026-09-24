/**
 * Boot-time environment validation (BL-51, closes KG-2/KG-3). Wired into
 * `ConfigModule.forRoot({ validate })`, so it runs once, before any provider is built — a
 * misconfigured deploy fails at startup with every problem listed, never at first request.
 *
 * - NODE_ENV must be set explicitly to one of ALLOWED_NODE_ENVS. It used to default to
 *   "development" when unset, which silently enabled the JWT fallback secret, stub/logging
 *   adapters and the localhost CORS carve-out on a server that merely forgot to set it.
 * - Outside development/test (i.e. staging/production) the JWT secret must be a real secret —
 *   long enough and not a known placeholder — and the variables that otherwise fall back to
 *   localhost defaults must be set explicitly.
 */
export const ALLOWED_NODE_ENVS = [
  'development',
  'test',
  'staging',
  'production',
] as const;
export type NodeEnv = (typeof ALLOWED_NODE_ENVS)[number];

export const MIN_SECRET_LENGTH = 32;

// Values that have shipped in this repo (.env.example, jwt-secret.ts) or are common defaults.
const PLACEHOLDER_PATTERN =
  /change-?me|changeme|placeholder|secret|example|dev-only/i;

/** Variables with localhost/dev defaults in code that must be explicit outside dev/test. */
const REQUIRED_OUTSIDE_DEV = ['DATABASE_URL', 'CORS_ORIGINS', 'FRONTEND_URL'];

export function isDevOrTestEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}

/** Returns every configuration problem (empty when the environment is acceptable). */
export function findEnvProblems(env: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const str = (key: string) => {
    const value = env[key];
    return typeof value === 'string' ? value.trim() : '';
  };
  const nodeEnv = str('NODE_ENV');

  if (!nodeEnv) {
    problems.push(
      `NODE_ENV must be set explicitly (one of ${ALLOWED_NODE_ENVS.join(', ')}); it no longer defaults to development.`,
    );
    return problems;
  }
  if (!(ALLOWED_NODE_ENVS as readonly string[]).includes(nodeEnv)) {
    problems.push(
      `NODE_ENV="${nodeEnv}" is not one of ${ALLOWED_NODE_ENVS.join(', ')}.`,
    );
    return problems;
  }
  if (isDevOrTestEnv(nodeEnv)) return problems;

  const secret = str('JWT_ACCESS_SECRET');
  if (!secret) {
    problems.push(`JWT_ACCESS_SECRET must be set when NODE_ENV=${nodeEnv}.`);
  } else {
    if (secret.length < MIN_SECRET_LENGTH) {
      problems.push(
        `JWT_ACCESS_SECRET must be at least ${MIN_SECRET_LENGTH} characters when NODE_ENV=${nodeEnv}.`,
      );
    }
    if (PLACEHOLDER_PATTERN.test(secret)) {
      problems.push(
        'JWT_ACCESS_SECRET looks like a placeholder (e.g. "change-me"); generate a random secret.',
      );
    }
  }
  // BL-10: no persistent local file writes outside development/test (owner decision Q40).
  if (str('STORAGE_DRIVER').toLowerCase() !== 's3') {
    problems.push(
      `STORAGE_DRIVER must be "s3" when NODE_ENV=${nodeEnv} (local disk storage is for development/test only).`,
    );
  } else if (!str('S3_BUCKET')) {
    problems.push(`S3_BUCKET must be set when STORAGE_DRIVER=s3.`);
  }
  for (const key of REQUIRED_OUTSIDE_DEV) {
    if (!str(key))
      problems.push(`${key} must be set when NODE_ENV=${nodeEnv}.`);
  }
  return problems;
}

/** `ConfigModule.forRoot({ validate })` hook: throws with every problem, else returns env unchanged. */
export function validateEnv(
  env: Record<string, unknown>,
): Record<string, unknown> {
  const problems = findEnvProblems(env);
  if (problems.length) {
    throw new Error(
      `Refusing to start — invalid configuration:\n- ${problems.join('\n- ')}`,
    );
  }
  return env;
}
