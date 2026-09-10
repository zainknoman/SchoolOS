import { createHmac, timingSafeEqual } from 'crypto';

/**
 * EasyPaisa's exact hash field order/encoding varies by product line (Hosted Checkout vs Mobile
 * Account API vs older APIs) and is NOT confirmed for any specific one in this codebase — every
 * source checked while building this (including the two URLs the user asked to be checked)
 * either hedges this explicitly or doesn't cover it. This implementation is a defensible,
 * swappable placement for a real algorithm, not an assertion that this exact field order/key
 * usage is correct: sorted field-name concatenation of values, HMAC-SHA256 keyed by the merchant
 * hash key, hex output. CONFIRM AGAINST YOUR EASYPAISA MERCHANT INTEGRATION DOC before any live
 * sandbox use (see docs/superpowers/specs/2026-09-10-sprint-e-payment-gateway-design.md).
 */
export class EasyPaisaSigner {
  constructor(private readonly hashKey: string) {}

  sign(fields: Record<string, string>): string {
    const sortedValues = Object.keys(fields)
      .filter((key) => fields[key] !== '')
      .sort()
      .map((key) => fields[key]);
    return createHmac('sha256', this.hashKey).update(sortedValues.join('')).digest('hex');
  }

  verify(fields: Record<string, string>, providedHash: string | undefined): boolean {
    if (!providedHash) return false;
    const expected = Buffer.from(this.sign(fields));
    const provided = Buffer.from(providedHash);
    if (expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
  }
}
