import { ConfigService } from '@nestjs/config';
import { PaymentGatewayAdapterFactoryImpl } from './payment-gateway-adapter-factory';
import { StubPaymentGatewayAdapter } from './stub-payment-gateway.adapter';
import { JazzCashAdapter } from './gateways/jazzcash.adapter';
import { EasyPaisaAdapter } from './gateways/easypaisa.adapter';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('PaymentGatewayAdapterFactoryImpl', () => {
  it('falls back to the stub adapter for jazzcash when unconfigured', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(fakeConfig({ NODE_ENV: 'test' }));
    expect(factory.getAdapter('jazzcash')).toBeInstanceOf(StubPaymentGatewayAdapter);
  });

  it('returns a real JazzCashAdapter when fully configured', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(
      fakeConfig({
        NODE_ENV: 'production',
        JAZZCASH_MERCHANT_ID: 'MC1',
        JAZZCASH_PASSWORD: 'pw',
        JAZZCASH_INTEGRITY_SALT: 'salt',
        JAZZCASH_RETURN_URL: 'https://x/return',
        JAZZCASH_API_URL: 'https://x/api',
      }),
    );
    expect(factory.getAdapter('jazzcash')).toBeInstanceOf(JazzCashAdapter);
  });

  it('returns a real EasyPaisaAdapter when fully configured', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(
      fakeConfig({
        NODE_ENV: 'production',
        EASYPAISA_STORE_ID: 'ST1',
        EASYPAISA_HASH_KEY: 'key',
        EASYPAISA_RETURN_URL: 'https://x/return',
        EASYPAISA_API_URL: 'https://x/api',
      }),
    );
    expect(factory.getAdapter('easypaisa')).toBeInstanceOf(EasyPaisaAdapter);
  });

  it('getSigner("stub") returns a signer using the resolved dev-only secret', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(fakeConfig({ NODE_ENV: 'test' }));
    const signer = factory.getSigner('stub');
    expect(
      signer?.verifyAndParse(
        { reference: 'r1', status: 'completed' },
        { 'x-stub-signature': 'dev-only-stub-webhook-secret' },
      ),
    ).toEqual({ valid: true, reference: 'r1', status: 'completed' });
  });

  it('getSigner returns undefined for an unconfigured real gateway', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(fakeConfig({ NODE_ENV: 'test' }));
    expect(factory.getSigner('jazzcash')).toBeUndefined();
  });

  it('getSigner returns undefined for an unknown gateway name', () => {
    const factory = new PaymentGatewayAdapterFactoryImpl(fakeConfig({ NODE_ENV: 'test' }));
    expect(factory.getSigner('bogus')).toBeUndefined();
  });
});
