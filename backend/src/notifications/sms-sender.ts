import { SmsConfig, toE164 } from './sms-config';
import { DELIVERY_TIMEOUT_MS } from './delivery-policy';

/**
 * The seam SmsAdapter depends on (BL-38) — one implementation per provider, picked by
 * `createSmsSender` from configuration; tests supply a fake sender instead of mocking HTTP.
 */
export interface SmsSender {
  sendMessage(phoneNumber: string, body: string): Promise<void>;
}

type Fetch = typeof fetch;

async function ensureOk(response: Response, provider: string): Promise<void> {
  if (response.ok) return;
  const text = await response.text().catch(() => '');
  throw new Error(
    `SMS send failed via ${provider} (${response.status}): ${(text || response.statusText).slice(0, 200)}`,
  );
}

/** JSON gateway: POST {sender_id, to, message} with a Bearer API key. */
export class HttpSmsSender implements SmsSender {
  constructor(
    private readonly config: Extract<SmsConfig, { provider: 'http' }>,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async sendMessage(phoneNumber: string, body: string): Promise<void> {
    const response = await this.fetchImpl(this.config.url, {
      // KI-5: a hung gateway must not hold the caller open.
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_id: this.config.senderId,
        to: toE164(phoneNumber),
        message: body,
      }),
    });
    await ensureOk(response, 'http gateway');
  }
}

/** Twilio Messaging REST API (form-encoded, HTTP Basic with the account SID and auth token). */
export class TwilioSmsSender implements SmsSender {
  constructor(
    private readonly config: Extract<SmsConfig, { provider: 'twilio' }>,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async sendMessage(phoneNumber: string, body: string): Promise<void> {
    const { accountSid, authToken, from } = this.config;
    const response = await this.fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: toE164(phoneNumber),
          From: from,
          Body: body,
        }).toString(),
      },
    );
    await ensureOk(response, 'twilio');
  }
}

export function createSmsSender(config: SmsConfig): SmsSender {
  return config.provider === 'twilio'
    ? new TwilioSmsSender(config)
    : new HttpSmsSender(config);
}
