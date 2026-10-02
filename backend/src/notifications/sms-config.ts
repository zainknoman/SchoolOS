import { ConfigService } from '@nestjs/config';
import { isDevOrTestEnv } from '../config/env.validation';

/**
 * BL-38: the SMS provider is chosen by configuration (`SMS_PROVIDER`); business logic only sees
 * the SmsSender interface. Unset = SMS disabled (the pilot decision, RD-4) and the channel falls
 * back to the logging no-op adapter.
 *   http   — a JSON-over-HTTPS gateway (most Pakistani aggregators): SMS_GATEWAY_URL,
 *            SMS_GATEWAY_API_KEY (sent as a Bearer token), SMS_GATEWAY_SENDER_ID
 *   twilio — Twilio Messaging: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM
 */
export type SmsConfig =
  | { provider: 'http'; url: string; apiKey: string; senderId: string }
  | {
      provider: 'twilio';
      accountSid: string;
      authToken: string;
      from: string;
    };

const REQUIRED: Record<SmsConfig['provider'], string[]> = {
  http: ['SMS_GATEWAY_URL', 'SMS_GATEWAY_API_KEY', 'SMS_GATEWAY_SENDER_ID'],
  twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'],
};

export function resolveSmsConfig(config: ConfigService): SmsConfig | undefined {
  const provider = config.get<string>('SMS_PROVIDER')?.trim();
  if (!provider) return undefined;
  const devOrTest = isDevOrTestEnv(config.get<string>('NODE_ENV'));
  if (provider !== 'http' && provider !== 'twilio') {
    throw new Error(
      `Unknown SMS_PROVIDER "${provider}" — use "http" or "twilio", or leave it unset to disable SMS.`,
    );
  }
  const values = Object.fromEntries(
    REQUIRED[provider].map((k) => [k, config.get<string>(k)?.trim() ?? '']),
  );
  const missing = REQUIRED[provider].filter((k) => !values[k]);
  if (missing.length) {
    if (devOrTest) return undefined;
    throw new Error(
      `Incomplete SMS configuration for SMS_PROVIDER=${provider} — missing ${missing.join(', ')}.`,
    );
  }
  if (provider === 'http') {
    const url = values.SMS_GATEWAY_URL;
    if (!url.startsWith('https://') && !devOrTest) {
      throw new Error('SMS_GATEWAY_URL must be an https:// URL.');
    }
    return {
      provider,
      url,
      apiKey: values.SMS_GATEWAY_API_KEY,
      senderId: values.SMS_GATEWAY_SENDER_ID,
    };
  }
  return {
    provider,
    accountSid: values.TWILIO_ACCOUNT_SID,
    authToken: values.TWILIO_AUTH_TOKEN,
    from: values.TWILIO_FROM,
  };
}

/**
 * Pakistani mobile numbers as stored by the console (0300-1234567, 03001234567, +92 300 …) to
 * E.164 (+923001234567); anything else is returned digits-only with its leading +.
 */
export function toE164(phone: string): string {
  const plus = phone.trim().startsWith('+');
  const digits = phone.replace(/\D/g, '');
  if (/^03\d{9}$/.test(digits)) return `+92${digits.slice(1)}`;
  if (/^923\d{9}$/.test(digits)) return `+${digits}`;
  return plus ? `+${digits}` : digits;
}
