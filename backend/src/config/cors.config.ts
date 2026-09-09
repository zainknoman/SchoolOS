// staff-console's Vite dev server default — the only origin that should reach this API without
// explicit operator configuration. Anything beyond dev (staging/prod) must set CORS_ORIGINS.
const DEV_DEFAULT_ORIGINS = ['http://localhost:5173'];

/**
 * Parses the CORS_ORIGINS env var (a comma-separated origin list) into the array shape
 * `app.enableCors({ origin })` expects. Falls back to the staff-console dev origin when unset —
 * the parent app is a Flutter mobile client, not a browser, so it is never subject to CORS and
 * never needs to appear in this list.
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