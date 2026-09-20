import { JazzCashSigner } from './jazzcash.signer';

describe('JazzCashSigner', () => {
  const salt = 'test-integrity-salt';
  const fields = {
    pp_Version: '1.1',
    pp_TxnType: 'MWALLET',
    pp_MerchantID: 'MC12345',
    pp_Amount: '500000',
    pp_TxnRefNo: 'pay_abc123',
  };

  it('produces a deterministic uppercase hex hash for the same fields', () => {
    const signer = new JazzCashSigner(salt);
    const hash1 = signer.sign(fields);
    const hash2 = signer.sign(fields);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9A-F]+$/);
  });

  it('verifies its own signed output', () => {
    const signer = new JazzCashSigner(salt);
    const hash = signer.sign(fields);
    expect(signer.verify(fields, hash)).toBe(true);
  });

  it('rejects a hash computed for different field values (tamper detection)', () => {
    const signer = new JazzCashSigner(salt);
    const hash = signer.sign(fields);
    const tampered = { ...fields, pp_Amount: '999999' };
    expect(signer.verify(tampered, hash)).toBe(false);
  });

  it('rejects a missing hash', () => {
    const signer = new JazzCashSigner(salt);
    expect(signer.verify(fields, undefined)).toBe(false);
  });

  it('ignores pp_SecureHash itself and non-pp_ fields when sorting/concatenating', () => {
    const signer = new JazzCashSigner(salt);
    const withExtras = {
      ...fields,
      pp_SecureHash: 'ignored-input-value',
      unrelatedField: 'x',
    };
    expect(signer.sign(withExtras)).toBe(signer.sign(fields));
  });
});
