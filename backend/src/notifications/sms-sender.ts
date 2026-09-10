import { SmsConfig } from './sms-config';

/**
 * Thin seam over a generic HTTP SMS gateway — SmsAdapter depends on this interface, not on
 * `fetch`/the gateway directly, so its tests supply a fake sender instead of mocking HTTP.
 * // TODO: confirm the actual endpoint/field names once a Pakistani SMS provider is contracted;
 * this mirrors Sprint E's EasyPaisa precedent for shipping against an unconfirmed field list.
 */
export interface SmsSender {
  sendMessage(phoneNumber: string, body: string): Promise<void>;
}

export class HttpSmsSender implements SmsSender {
  constructor(private readonly config: SmsConfig) {}

  async sendMessage(phoneNumber: string, body: string): Promise<void> {
    // TODO: confirm the real gateway's endpoint URL and payload shape.
    const url = 'https://api.sms-gateway.example.pk/v1/send';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender_id: this.config.senderId,
        to: phoneNumber,
        message: body,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `SMS send failed (${response.status}): ${text || response.statusText}`,
      );
    }
  }
}
