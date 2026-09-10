import { EasyPaisaAdapter, EasyPaisaWebhookSigner } from './easypaisa.adapter';
import { EasyPaisaSigner } from './easypaisa.signer';

const config = {
  storeId: 'ST1',
  hashKey: 'hash-key',
  returnUrl: 'https://staff.example.com/pay/return',
  apiUrl: 'https://easypay.easypaisa.com.pk/easypay/Index.jsf',
};

describe('EasyPaisaAdapter', () => {
  it('initiate() returns a signed redirect URL carrying the reference as orderRefNum', async () => {
    const adapter = new EasyPaisaAdapter(config);
    const result = await adapter.initiate({ amount: 500000, reference: 'pay_abc123' });

    expect(result.gatewayReference).toBe('pay_abc123');
    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('orderRefNum')).toBe('pay_abc123');
    expect(url.searchParams.get('storeId')).toBe('ST1');

    const signer = new EasyPaisaSigner(config.hashKey);
    const fields: Record<string, string> = {};
    url.searchParams.forEach((value, key) => (fields[key] = value));
    const providedHash = fields.merchantHashedReq;
    delete fields.merchantHashedReq;
    expect(signer.verify(fields, providedHash)).toBe(true);
  });
});

describe('EasyPaisaWebhookSigner', () => {
  it('rejects a call with a bad merchantHashedReq', () => {
    const verifier = new EasyPaisaWebhookSigner(config.hashKey);
    const result = verifier.verifyAndParse(
      { orderRefNum: 'pay_1', status: 'SUCCESS', merchantHashedReq: 'WRONG' },
      {},
    );
    expect(result.valid).toBe(false);
  });

  it('accepts a correctly-signed successful callback', () => {
    const signer = new EasyPaisaSigner(config.hashKey);
    const body = { orderRefNum: 'pay_1', status: 'SUCCESS' };
    const merchantHashedReq = signer.sign(body);
    const verifier = new EasyPaisaWebhookSigner(config.hashKey);
    expect(verifier.verifyAndParse({ ...body, merchantHashedReq }, {})).toEqual({
      valid: true,
      reference: 'pay_1',
      status: 'completed',
    });
  });

  it('maps any non-SUCCESS status to failed', () => {
    const signer = new EasyPaisaSigner(config.hashKey);
    const body = { orderRefNum: 'pay_1', status: 'FAILED' };
    const merchantHashedReq = signer.sign(body);
    const verifier = new EasyPaisaWebhookSigner(config.hashKey);
    expect(verifier.verifyAndParse({ ...body, merchantHashedReq }, {}).status).toBe('failed');
  });
});
