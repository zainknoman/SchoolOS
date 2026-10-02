import { WhatsAppConfig } from './whatsapp-config';
import { DELIVERY_TIMEOUT_MS } from './delivery-policy';

/**
 * Thin seam over the WhatsApp Business Cloud API — WhatsAppAdapter depends on this interface, not
 * on `fetch`/the Graph API directly, so its tests supply a fake sender instead of mocking HTTP.
 */
export interface WhatsAppSender {
  sendMessage(phoneNumber: string, body: string): Promise<void>;
}

const GRAPH_API_VERSION = 'v21.0';

export class HttpWhatsAppSender implements WhatsAppSender {
  constructor(private readonly config: WhatsAppConfig) {}

  async sendMessage(phoneNumber: string, body: string): Promise<void> {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.config.phoneNumberId}/messages`;
    const response = await fetch(url, {
      // KI-5: a hung gateway must not hold the caller open.
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `WhatsApp send failed (${response.status}): ${text || response.statusText}`,
      );
    }
  }
}
