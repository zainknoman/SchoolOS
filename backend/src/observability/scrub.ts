/**
 * PII / secret scrubbing for logs and error reports (BL-11). Anything that leaves the process for
 * a log sink or an error tracker goes through here. Redacts by KEY (passwords, tokens, CNIC,
 * B-Form, medical fields…) and by VALUE shape (JWTs, CNIC numbers, 64-hex reset/refresh tokens,
 * bearer headers, access_token query parameters), so a secret embedded in a message string is
 * caught too.
 */
export const REDACTED = '[redacted]';

const SENSITIVE_KEY =
  /pass(word)?|secret|token|authorization|cookie|api[-_]?key|cnic|b-?form|bformnumber|medical|allerg|diagnos|medication|blood|disabilit|temporarypassword|signature/i;

const VALUE_PATTERNS: [RegExp, string][] = [
  [
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    '[redacted-jwt]',
  ],
  [/\b\d{5}-\d{7}-\d\b/g, '[redacted-cnic]'],
  [/\b\d{13}\b/g, '[redacted-id-number]'],
  [/\b[0-9a-f]{64}\b/gi, '[redacted-token]'],
  [/(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi, `$1${REDACTED}`],
  [/([?&](access_token|token|refreshToken)=)[^&\s"]+/gi, `$1${REDACTED}`],
];

export function scrubString(value: string): string {
  let out = value;
  for (const [pattern, replacement] of VALUE_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function scrub<T>(value: T, depth = 0): T {
  if (depth > 8) return '[truncated]' as T;
  if (typeof value === 'string') return scrubString(value) as T;
  if (Array.isArray(value)) {
    return value.map((v: unknown) => scrub(v, depth + 1)) as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? REDACTED : scrub(v, depth + 1);
    }
    return out as T;
  }
  return value;
}

/** Path without its query string — query strings carry download tokens (?access_token=). */
export function pathOnly(url: string): string {
  const i = url.indexOf('?');
  return i === -1 ? url : url.slice(0, i);
}
