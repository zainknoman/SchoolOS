import { JazzCashAdapter, parseJazzCashWebhook, JazzCashWebhookSigner } from './jazzcash.adapter';
import { JazzCashSigner } from './jazzcash.signer';

const config = {
  merchantId: 'MC1',
  password: 'pw',
  integritySalt: 'salt',
  returnUrl: 'https://staff.example.com/pay/return',
  apiUrl: 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform',
};

describe('JazzCashAdapter', () => {
  it('initiate() returns a signed redirect URL carrying the reference as pp_TxnRefNo', async () => {
    const adapter = new JazzCashAdapter(config);
    const result = await adapter.initiate({ amount: 500000, reference: 'pay_abc123' });

    expect(result.gatewayReference).toBe('pay_abc123');
    const url = new URL(result.redirectUrl);
    expect(url.searchParams.get('pp_TxnRefNo')).toBe('pay_abc123');
    expect(url.searchParams.get('pp_Amount')).toBe('500000');
    expect(url.searchParams.get('pp_MerchantID')).toBe('MC1');

    const signer = new JazzCashSigner(config.integritySalt);
    const fields: Record<string, string> = {};
    url.searchParams.forEach((value, key) => (fields[key] = value));
    expect(signer.verify(fields, fields.pp_SecureHash)).toBe(true);
  });
});

describe('parseJazzCashWebhook', () => {
  it('maps pp_ResponseCode "000" to completed', () => {
    expect(parseJazzCashWebhook({ pp_TxnRefNo: 'pay_1', pp_ResponseCode: '000' })).toEqual({
      reference: 'pay_1',
      status: 'completed',
    });
  });

  it('maps any other response code to failed', () => {
    expect(parseJazzCashWebhook({ pp_TxnRefNo: 'pay_1', pp_ResponseCode: '124' })).toEqual({
      reference: 'pay_1',
      status: 'failed',
    });
  });
});

describe('JazzCashWebhookSigner', () => {
  it('verifyAndParse rejects a call with a bad pp_SecureHash', () => {
    const verifier = new JazzCashWebhookSigner(config.integritySalt);
    const result = verifier.verifyAndParse(
      { pp_TxnRefNo: 'pay_1', pp_ResponseCode: '000', pp_SecureHash: 'WRONG' },
      {},
    );
    expect(result.valid).toBe(false);
  });

  it('verifyAndParse accepts a correctly-signed completed callback', () => {
    const signer = new JazzCashSigner(config.integritySalt);
    const body = { pp_TxnRefNo: 'pay_1', pp_ResponseCode: '000' };
    const pp_SecureHash = signer.sign(body);
    const verifier = new JazzCashWebhookSigner(config.integritySalt);
    expect(verifier.verifyAndParse({ ...body, pp_SecureHash }, {})).toEqual({
      valid: true,
      reference: 'pay_1',
      status: 'completed',
    });
  });
});
