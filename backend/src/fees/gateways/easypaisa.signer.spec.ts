import { EasyPaisaSigner } from './easypaisa.signer';

describe('EasyPaisaSigner', () => {
  const hashKey = 'test-hash-key';
  const fields = {
    storeId: 'ST1',
    amount: '5000.00',
    orderRefNum: 'pay_abc123',
  };

  it('produces a deterministic hex hash for the same fields', () => {
    const signer = new EasyPaisaSigner(hashKey);
    expect(signer.sign(fields)).toBe(signer.sign(fields));
    expect(signer.sign(fields)).toMatch(/^[0-9a-f]+$/);
  });

  it('verifies its own signed output', () => {
    const signer = new EasyPaisaSigner(hashKey);
    const hash = signer.sign(fields);
    expect(signer.verify(fields, hash)).toBe(true);
  });

  it('rejects a hash computed for different field values (tamper detection)', () => {
    const signer = new EasyPaisaSigner(hashKey);
    const hash = signer.sign(fields);
    expect(signer.verify({ ...fields, amount: '1.00' }, hash)).toBe(false);
  });

  it('rejects a missing hash', () => {
    const signer = new EasyPaisaSigner(hashKey);
    expect(signer.verify(fields, undefined)).toBe(false);
  });
});
