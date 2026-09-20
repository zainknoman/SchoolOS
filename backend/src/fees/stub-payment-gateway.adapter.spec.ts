import { StubPaymentGatewayAdapter } from './stub-payment-gateway.adapter';

describe('StubPaymentGatewayAdapter', () => {
  const adapter = new StubPaymentGatewayAdapter();

  it('initiate() returns a distinct gatewayReference per call, and a redirectUrl carrying the amount', async () => {
    const first = await adapter.initiate({ amount: 50000, reference: 'ref-1' });
    const second = await adapter.initiate({
      amount: 50000,
      reference: 'ref-2',
    });

    expect(first.gatewayReference).not.toBe(second.gatewayReference);
    expect(first.redirectUrl).toContain('amount=50000');
  });
});
