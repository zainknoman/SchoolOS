import { normalizeIdentifier } from './normalize-identifier';

describe('normalizeIdentifier', () => {
  it('lower-cases and trims emails', () => {
    expect(normalizeIdentifier('  Ali@Mail.COM ')).toBe('ali@mail.com');
  });
  it.each([
    '+92 300 1234567',
    '0092-300-1234567',
    '923001234567',
    '0300 1234567',
    '(0300) 123-4567',
  ])('canonicalises phone %s', (input) =>
    expect(normalizeIdentifier(input)).toBe('03001234567'),
  );
  it('leaves other identifiers (staff/admin) only trimmed', () => {
    expect(normalizeIdentifier(' ayesha.khan ')).toBe('ayesha.khan');
  });
});
