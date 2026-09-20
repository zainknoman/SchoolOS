import { ConfigService } from '@nestjs/config';
import {
  resolveJazzCashConfig,
  resolveEasyPaisaConfig,
  resolveStubWebhookSecret,
} from './gateway-config';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('resolveJazzCashConfig', () => {
  it('returns undefined (falls back to stub) when no JazzCash vars are set, in any environment', () => {
    expect(
      resolveJazzCashConfig(fakeConfig({ NODE_ENV: 'production' })),
    ).toBeUndefined();
  });

  it('returns a full config object when all vars are set', () => {
    const config = resolveJazzCashConfig(
      fakeConfig({
        NODE_ENV: 'production',
        JAZZCASH_MERCHANT_ID: 'MC1',
        JAZZCASH_PASSWORD: 'pw',
        JAZZCASH_INTEGRITY_SALT: 'salt',
        JAZZCASH_RETURN_URL: 'https://x/return',
        JAZZCASH_API_URL: 'https://x/api',
      }),
    );
    expect(config).toEqual({
      merchantId: 'MC1',
      password: 'pw',
      integritySalt: 'salt',
      returnUrl: 'https://x/return',
      apiUrl: 'https://x/api',
    });
  });

  it('throws if only some JazzCash vars are set outside development/test', () => {
    expect(() =>
      resolveJazzCashConfig(
        fakeConfig({ NODE_ENV: 'production', JAZZCASH_MERCHANT_ID: 'MC1' }),
      ),
    ).toThrow(/Incomplete JazzCash configuration/);
  });

  it('does not throw on a partial config in development', () => {
    expect(
      resolveJazzCashConfig(
        fakeConfig({ NODE_ENV: 'development', JAZZCASH_MERCHANT_ID: 'MC1' }),
      ),
    ).toBeUndefined();
  });
});

describe('resolveEasyPaisaConfig', () => {
  it('returns undefined when no EasyPaisa vars are set', () => {
    expect(
      resolveEasyPaisaConfig(fakeConfig({ NODE_ENV: 'production' })),
    ).toBeUndefined();
  });

  it('returns a full config object when all vars are set', () => {
    const config = resolveEasyPaisaConfig(
      fakeConfig({
        NODE_ENV: 'production',
        EASYPAISA_STORE_ID: 'ST1',
        EASYPAISA_HASH_KEY: 'key',
        EASYPAISA_RETURN_URL: 'https://x/return',
        EASYPAISA_API_URL: 'https://x/api',
      }),
    );
    expect(config).toEqual({
      storeId: 'ST1',
      hashKey: 'key',
      returnUrl: 'https://x/return',
      apiUrl: 'https://x/api',
    });
  });
});

describe('resolveStubWebhookSecret', () => {
  it('falls back to a fixed dev-only secret in development/test', () => {
    expect(resolveStubWebhookSecret(fakeConfig({ NODE_ENV: 'test' }))).toBe(
      'dev-only-stub-webhook-secret',
    );
  });

  it('throws outside development/test if unset', () => {
    expect(() =>
      resolveStubWebhookSecret(fakeConfig({ NODE_ENV: 'production' })),
    ).toThrow(/PAYMENT_STUB_WEBHOOK_SECRET/);
  });

  it('uses the configured value when set', () => {
    expect(
      resolveStubWebhookSecret(
        fakeConfig({
          NODE_ENV: 'production',
          PAYMENT_STUB_WEBHOOK_SECRET: 'real-secret',
        }),
      ),
    ).toBe('real-secret');
  });
});
