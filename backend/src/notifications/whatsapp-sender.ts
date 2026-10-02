import { WhatsAppConfig } from './whatsapp-config';
import { DELIVERY_TIMEOUT_MS } from './delivery-policy';
import { toE164 } from './sms-config';

/**
 * Seam over the WhatsApp Business Cloud API — WhatsAppAdapter depends on this interface, so its
 * tests supply a fake sender instead of mocking HTTP.
 *
 * BL-48: messages a school starts must use a template Meta has approved (free text is only
 * allowed inside a 24-hour customer-service window, which a school notification never is). The
 * template is configured (WHATSAPP_TEMPLATE_NAME / _LANGUAGE) and takes the notification's title
 * and body as its two body parameters ({{1}}, {{2}}).
 */
export interface WhatsAppSender {
  sendTemplate(phoneNumber: string, parameters: string[]): Promise<void>;
}

const GRAPH_API_VERSION = 'v21.0';
/** Meta rejects parameters with newlines/tabs or more than four consecutive spaces. */
export function templateParameter(text: string, max = 1024): string {
  return text
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {5,}/g, '    ')
    .trim()
    .slice(0, max);
}

type Fetch = typeof fetch;

export class HttpWhatsAppSender implements WhatsAppSender {
  constructor(
    private readonly config: WhatsAppConfig,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async sendTemplate(phoneNumber: string, parameters: string[]): Promise<void> {
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.config.phoneNumberId}/messages`;
    const response = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toE164(phoneNumber).replace(/^\+/, ''),
        type: 'template',
        template: {
          name: this.config.templateName,
          language: { code: this.config.templateLanguage },
          components: [
            {
              type: 'body',
              parameters: parameters.map((p) => ({
                type: 'text',
                text: templateParameter(p),
              })),
            },
          ],
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `WhatsApp send failed (${response.status}): ${(text || response.statusText).slice(0, 200)}`,
      );
    }
  }
}
