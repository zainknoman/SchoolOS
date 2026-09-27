import { createHmac } from 'crypto';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { resolveAccessTokenSecret } from './jwt-secret';

/**
 * Download links (BL-36, KG-15). A plain link — the parent app opening a PDF in the system browser
 * — cannot set an Authorization header. Before BL-36 such links carried the ACCESS token as
 * `?access_token=`, which leaks a full 15-minute credential through access logs, browser history
 * and Referer headers. Now the client asks `POST /api/v1/auth/download-link` (bearer-authenticated)
 * for a link to ONE download path; the link's `?dl=` token:
 *   - is signed with a key derived from the access secret, so it never verifies as an access token
 *     and an access token never verifies as a link token;
 *   - is bound to the exact path it was minted for;
 *   - expires after DOWNLOAD_LINK_TTL_SECONDS;
 *   - carries the user's tokenVersion, so logout-all / disable / password change kill it too.
 * The route's own authorization (e.g. "may this parent see this file") still runs as the user.
 */
export const DOWNLOAD_LINK_TTL_SECONDS = 120;

export const DOWNLOAD_LINK_QUERY_PARAM = 'dl';

/** `typ` claim that marks a download-link token. */
export const DOWNLOAD_LINK_TOKEN_TYPE = 'dl';

// Only GET routes that stream a file. Matched by exact route shape, not by prefix:
// /api/v1/fee-vouchers/ and /api/v1/fee-payments/ also carry POST mutations (:id/pay,
// :id/confirm). Ids are uuids, so a segment is word characters and dashes only — no `.`/`..`.
const DOWNLOAD_ROUTE_PATTERNS = [
  /^\/api\/v1\/files\/[\w-]+$/,
  /^\/api\/v1\/fee-vouchers\/[\w-]+\/pdf$/,
  /^\/api\/v1\/fee-payments\/[\w-]+\/receipt\.pdf$/,
  /^\/api\/v1\/report-cards\/[\w-]+\/pdf$/,
  // BL-06: a generated report card's PDF
  /^\/api\/v1\/report-cards\/generated\/[\w-]+\/pdf$/,
];

export function isDownloadRoute(path: string): boolean {
  return DOWNLOAD_ROUTE_PATTERNS.some((pattern) => pattern.test(path));
}

/** The `?dl=` token on a GET download route, or null. Never reads `?access_token=`. */
export function extractDownloadLinkToken(req: Request): string | null {
  if (req.method !== 'GET' || !isDownloadRoute(req.path)) return null;
  const value = (req.query as Record<string, unknown> | undefined)?.[
    DOWNLOAD_LINK_QUERY_PARAM
  ];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** HMAC of a fixed label under the access secret: no new env var, never equal to it. */
export function resolveDownloadLinkSecret(config: ConfigService): string {
  return createHmac('sha256', resolveAccessTokenSecret(config))
    .update('schoolos:download-link:v1')
    .digest('hex');
}
