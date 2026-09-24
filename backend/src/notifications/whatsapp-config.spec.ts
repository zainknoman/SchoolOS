import { ConfigService } from '@nestjs/config';
import { resolveWhatsAppConfig } from './whatsapp-config';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('resolveWhatsAppConfig', () => {
  it('returns undefined when nothing is set', () => {
    expect(
      resolveWhatsAppConfig(fakeConfig({ NODE_ENV: 'test' })),
    ).toBeUndefined();
  });

  it('returns a full config when both vars are set', () => {
    const result = resolveWhatsAppConfig(
      fakeConfig({
        NODE_ENV: 'production',
        WHATSAPP_BUSINESS_PHONE_ID: 'phone-id-123',
        WHATSAPP_ACCESS_TOKEN: 'token-abc',
      }),
    );

    expect(result).toEqual({
      phoneNumberId: 'phone-id-123',
      accessToken: 'token-abc',
    });
  });

  it('returns undefined for a partial config inside development/test', () => {
    expect(
      resolveWhatsAppConfig(
        fakeConfig({
          NODE_ENV: 'development',
          WHATSAPP_BUSINESS_PHONE_ID: 'phone-id-123',
        }),
      ),
    ).toBeUndefined();
  });

  it('throws for a partial config outside development/test', () => {
    expect(() =>
      resolveWhatsAppConfig(
        fakeConfig({
          NODE_ENV: 'production',
          WHATSAPP_BUSINESS_PHONE_ID: 'phone-id-123',
        }),
      ),
    ).toThrow(/Incomplete WhatsApp configuration/);
  });

  it('treats an unset NODE_ENV as strict, not development — a partial config is a startup error (BL-51)', () => {
    expect(() =>
      resolveWhatsAppConfig(
        fakeConfig({ WHATSAPP_BUSINESS_PHONE_ID: 'phone-id-123' }),
      ),
    ).toThrow();
  });
});
