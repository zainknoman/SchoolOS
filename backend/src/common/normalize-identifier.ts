/**
 * Canonical form for a login identifier that is either an email or a Pakistani mobile number, so
 * "Ali@Mail.com " and "ali@mail.com", or "+92 300 1234567" and "0300-1234567", resolve to the
 * same account. Parents log in with their own mobile number or email — never a per-student value —
 * so one parent has exactly one login however many children they have.
 *
 * Emails are trimmed and lower-cased. Phone numbers are reduced to digits and the +92/0092/92
 * country prefix is rewritten to a leading 0 (03001234567). Anything else is only trimmed.
 */
export function normalizeIdentifier(raw: string): string {
  const value = raw.trim();
  if (value.includes('@')) return value.toLowerCase();

  const digits = value.replace(/[\s\-().]/g, '');
  if (/^\+?\d{10,15}$/.test(digits)) {
    const onlyDigits = digits.replace(/^\+/, '');
    if (onlyDigits.startsWith('0092')) return `0${onlyDigits.slice(4)}`;
    if (onlyDigits.startsWith('92') && onlyDigits.length === 12) return `0${onlyDigits.slice(2)}`;
    return onlyDigits;
  }
  return value;
}
