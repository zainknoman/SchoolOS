import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/**
 * HTTP hardening shared by main.ts and the e2e suite (BL-12), so the tests exercise exactly what
 * production runs.
 *
 * - helmet's standard security headers. Cross-Origin-Resource-Policy is `cross-origin` because the
 *   staff console (a different origin) embeds API-served files directly — school/campus logos and
 *   profile photos via `<img src=".../files/:id?access_token=...">` — and helmet's default
 *   `same-origin` would block them. Those files are still token-protected.
 * - Express `trust proxy`, from TRUST_PROXY. Unset means "trust no proxy", so a client cannot
 *   spoof `X-Forwarded-For` to dodge the rate limiter. Behind a load balancer set it to the
 *   number of proxy hops (usually `1`) so `req.ip` — the throttler's key — is the real client IP.
 */
export function applyHttpSecurity(
  app: NestExpressApplication,
  env: NodeJS.ProcessEnv = process.env,
): void {
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.set('trust proxy', parseTrustProxy(env.TRUST_PROXY));
}

/**
 * TRUST_PROXY accepts what Express's `trust proxy` setting accepts: a hop count (`1`), `true`/
 * `false`, or a comma-separated list of addresses/subnets or the names `loopback`,
 * `linklocal`, `uniquelocal`. Unset or empty means `false`.
 */
export function parseTrustProxy(
  raw: string | undefined,
): boolean | number | string {
  const value = raw?.trim();
  if (!value || value === 'false') return false;
  if (value === 'true') return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}
