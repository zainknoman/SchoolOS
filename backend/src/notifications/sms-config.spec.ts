import { ConfigService } from '@nestjs/config';
import { resolveSmsConfig } from './sms-config';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('resolveSmsConfig', () => {
  it('returns undefined when nothing is set', () => {
    expect(resolveSmsConfig(fakeConfig({ NODE_ENV: 'test' }))).toBeUndefined();
  });

  it('returns a full config when both vars are set', () => {
    const result = resolveSmsConfig(
      fakeConfig({
        NODE_ENV: 'production',
        SMS_GATEWAY_API_KEY: 'api-key-123',
        SMS_GATEWAY_SENDER_ID: 'SchoolOS',
      }),
    );

    expect(result).toEqual({
      apiKey: 'api-key-123',
      senderId: 'SchoolOS',
    });
  });

  it('returns undefined for a partial config inside development/test', () => {
    expect(
      resolveSmsConfig(
        fakeConfig({
          NODE_ENV: 'development',
          SMS_GATEWAY_API_KEY: 'api-key-123',
        }),
      ),
    ).toBeUndefined();
  });

  it('throws for a partial config outside development/test', () => {
    expect(() =>
      resolveSmsConfig(
        fakeConfig({
          NODE_ENV: 'production',
          SMS_GATEWAY_API_KEY: 'api-key-123',
        }),
      ),
    ).toThrow(/Incomplete SMS gateway configuration/);
  });

  it('treats an unset NODE_ENV as strict, not development — a partial config is a startup error (BL-51)', () => {
    expect(() =>
      resolveSmsConfig(fakeConfig({ SMS_GATEWAY_API_KEY: 'api-key-123' })),
    ).toThrow();
  });
});
