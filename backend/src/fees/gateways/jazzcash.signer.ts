import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Implements JazzCash's pp_SecureHash scheme as consistently reproduced across independent
 * third-party JazzCash integrations: sort pp_* fields alphabetically (excluding pp_SecureHash
 * itself and empty values), '&'-join their values, prepend the Integrity Salt, HMAC-SHA256 keyed
 * by that same salt, uppercase hex output. NOT verified against JazzCash's own merchant-onboarding
 * PDF — no merchant account exists in this environment. Confirm against the real spec before
 * pointing this at a live sandbox (see docs/superpowers/specs/2026-09-10-sprint-e-payment-gateway-design.md).
 */
export class JazzCashSigner {
  constructor(private readonly integritySalt: string) {}

  sign(fields: Record<string, string>): string {
    const sortedValues = Object.keys(fields)
      .filter(
        (key) =>
          key.startsWith('pp_') &&
          key !== 'pp_SecureHash' &&
          fields[key] !== '',
      )
      .sort()
      .map((key) => fields[key]);
    const stringToHash = [this.integritySalt, ...sortedValues].join('&');
    return createHmac('sha256', this.integritySalt)
      .update(stringToHash)
      .digest('hex')
      .toUpperCase();
  }

  verify(
    fields: Record<string, string>,
    providedHash: string | undefined,
  ): boolean {
    if (!providedHash) return false;
    const expected = Buffer.from(this.sign(fields));
    const provided = Buffer.from(providedHash.toUpperCase());
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }
}
