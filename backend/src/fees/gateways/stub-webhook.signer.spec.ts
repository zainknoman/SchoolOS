import { StubWebhookSigner } from './stub-webhook.signer';

describe('StubWebhookSigner', () => {
  it('accepts a matching x-stub-signature header with a valid completed/failed status', () => {
    const signer = new StubWebhookSigner('secret-1');
    const result = signer.verifyAndParse(
      { reference: 'stub_1', status: 'completed' },
      { 'x-stub-signature': 'secret-1' },
    );
    expect(result).toEqual({ valid: true, reference: 'stub_1', status: 'completed' });
  });

  it('rejects a missing or wrong signature header', () => {
    const signer = new StubWebhookSigner('secret-1');
    expect(signer.verifyAndParse({ reference: 'stub_1', status: 'completed' }, {}).valid).toBe(false);
    expect(
      signer.verifyAndParse({ reference: 'stub_1', status: 'completed' }, { 'x-stub-signature': 'wrong' })
        .valid,
    ).toBe(false);
  });

  it('rejects a status that is neither completed nor failed', () => {
    const signer = new StubWebhookSigner('secret-1');
    const result = signer.verifyAndParse(
      { reference: 'stub_1', status: 'bogus' },
      { 'x-stub-signature': 'secret-1' },
    );
    expect(result.valid).toBe(false);
  });
});
