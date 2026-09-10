// staff-console's Vite dev server default — the only origin that should reach this API without
// explicit operator configuration. Anything beyond dev (staging/prod) must set CORS_ORIGINS.
const DEV_DEFAULT_ORIGINS = ['http://localhost:5173'];

// The parent app is a Flutter mobile client in production, not subject to CORS — but this repo's
// dev environment has no Android emulator and no Windows desktop toolchain, so `flutter run -d
// chrome` (a real browser origin) is the only way to run/preview it locally, and it picks a fresh
// port every run unless one is pinned with --web-port. Requiring every developer to allow-list a
// new port each run isn't workable, so any localhost/127.0.0.1 origin is accepted in dev/test only
// — staging/production still require an explicit CORS_ORIGINS allow-list (see
// resolveAccessTokenSecret for the same dev/test-vs-everything-else split, applied there to the
// JWT secret).
const LOCALHOST_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Parses the CORS_ORIGINS env var (a comma-separated origin list) into the array shape
 * `app.enableCors({ origin })` expects. Falls back to the staff-console dev origin when unset.
 */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw || raw.trim() === '') {
    return DEV_DEFAULT_ORIGINS;
  }
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;
export type CorsOriginOption = string[] | ((origin: string | undefined, callback: CorsOriginCallback) => void);

/**
 * Builds the `origin` option for `app.enableCors()`. Outside development/test this is just the
 * static CORS_ORIGINS allow-list (unchanged behavior). In development/test, it additionally
 * accepts any localhost/127.0.0.1 origin regardless of port, so local Flutter web previews work
 * without per-run configuration while production stays a strict allow-list.
 */
export function buildCorsOriginOption(
  raw: string | undefined,
  nodeEnv: string | undefined,
): CorsOriginOption {
  const allowList = parseCorsOrigins(raw);
  const env = nodeEnv ?? 'development';

  if (env !== 'development' && env !== 'test') {
    return allowList;
  }

  return (origin, callback) => {
    if (!origin || allowList.includes(origin) || LOCALHOST_ORIGIN_PATTERN.test(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}