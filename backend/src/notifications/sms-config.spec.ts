import { ConfigService } from '@nestjs/config';
import { resolveSmsConfig, toE164 } from './sms-config';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

/** BL-38: the SMS provider comes from configuration; unset = SMS off (RD-4). */
describe('resolveSmsConfig', () => {
  const http = {
    SMS_PROVIDER: 'http',
    SMS_GATEWAY_URL: 'https://sms.example.pk/v1/send',
    SMS_GATEWAY_API_KEY: 'k',
    SMS_GATEWAY_SENDER_ID: 'SchoolOS',
  };

  it('is off when SMS_PROVIDER is unset, even if gateway variables are present', () => {
    expect(
      resolveSmsConfig(fakeConfig({ NODE_ENV: 'production' })),
    ).toBeUndefined();
    expect(
      resolveSmsConfig(
        fakeConfig({ NODE_ENV: 'production', SMS_GATEWAY_API_KEY: 'k' }),
      ),
    ).toBeUndefined();
  });

  it('builds the http gateway configuration', () => {
    expect(
      resolveSmsConfig(fakeConfig({ NODE_ENV: 'production', ...http })),
    ).toEqual({
      provider: 'http',
      url: 'https://sms.example.pk/v1/send',
      apiKey: 'k',
      senderId: 'SchoolOS',
    });
  });

  it('builds the twilio configuration', () => {
    expect(
      resolveSmsConfig(
        fakeConfig({
          NODE_ENV: 'production',
          SMS_PROVIDER: 'twilio',
          TWILIO_ACCOUNT_SID: 'AC1',
          TWILIO_AUTH_TOKEN: 't',
          TWILIO_FROM: '+15550001111',
        }),
      ),
    ).toEqual({
      provider: 'twilio',
      accountSid: 'AC1',
      authToken: 't',
      from: '+15550001111',
    });
  });

  it('refuses an unknown provider, an incomplete set, or plain http outside development/test', () => {
    expect(() =>
      resolveSmsConfig(
        fakeConfig({ NODE_ENV: 'production', SMS_PROVIDER: 'carrier-pigeon' }),
      ),
    ).toThrow('Unknown SMS_PROVIDER');
    expect(() =>
      resolveSmsConfig(
        fakeConfig({
          NODE_ENV: 'production',
          ...http,
          SMS_GATEWAY_SENDER_ID: '',
        }),
      ),
    ).toThrow('missing SMS_GATEWAY_SENDER_ID');
    expect(() =>
      resolveSmsConfig(
        fakeConfig({
          NODE_ENV: 'production',
          ...http,
          SMS_GATEWAY_URL: 'http://sms.example.pk',
        }),
      ),
    ).toThrow('https://');
  });

  it('treats an incomplete set as off in development/test', () => {
    expect(
      resolveSmsConfig(
        fakeConfig({ NODE_ENV: 'test', SMS_PROVIDER: 'twilio' }),
      ),
    ).toBeUndefined();
  });
});

describe('toE164', () => {
  it.each([
    ['0300-1234567', '+923001234567'],
    ['03001234567', '+923001234567'],
    ['+92 300 1234567', '+923001234567'],
    ['923001234567', '+923001234567'],
    ['+44 20 7946 0958', '+442079460958'],
  ])('%s -> %s', (input, out) => expect(toE164(input)).toBe(out));
});
