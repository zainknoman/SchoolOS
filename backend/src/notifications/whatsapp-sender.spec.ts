import { HttpWhatsAppSender, templateParameter } from './whatsapp-sender';

/** BL-48: school-initiated WhatsApp messages use an approved template. */
describe('HttpWhatsAppSender', () => {
  it('sends the configured template with title and body as parameters', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    await new HttpWhatsAppSender(
      {
        phoneNumberId: 'pn1',
        accessToken: 'tok',
        templateName: 'schoolos_notification',
        templateLanguage: 'ur',
      },
      fetchImpl,
    ).sendTemplate('0300-1234567', ['New circular', 'PTM on\nSaturday']);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v21.0/pn1/messages');
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      to: '923001234567',
      type: 'template',
      template: {
        name: 'schoolos_notification',
        language: { code: 'ur' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'New circular' },
              { type: 'text', text: 'PTM on Saturday' },
            ],
          },
        ],
      },
    });
  });

  it('a Graph API error is a failed delivery', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        new Response('template not approved', { status: 400 }),
      );
    await expect(
      new HttpWhatsAppSender(
        {
          phoneNumberId: 'p',
          accessToken: 't',
          templateName: 'x',
          templateLanguage: 'en',
        },
        fetchImpl,
      ).sendTemplate('03001234567', ['a', 'b']),
    ).rejects.toThrow('WhatsApp send failed (400): template not approved');
  });

  it('cleans parameters to what Meta accepts', () => {
    expect(templateParameter('a\r\n\tb      c')).toBe('a b    c');
    expect(templateParameter('x'.repeat(2000))).toHaveLength(1024);
  });
});
