import { HttpSmsSender, TwilioSmsSender, createSmsSender } from './sms-sender';

/** BL-38: one sender per provider; requests checked against a fake fetch. */
describe('SMS senders', () => {
  const ok = () =>
    jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));

  it('http gateway: JSON body, Bearer key, E.164 recipient', async () => {
    const fetchImpl = ok();
    await new HttpSmsSender(
      {
        provider: 'http',
        url: 'https://sms.example.pk/send',
        apiKey: 'k',
        senderId: 'SchoolOS',
      },
      fetchImpl,
    ).sendMessage('0300-1234567', 'Hello');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sms.example.pk/send');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer k',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      sender_id: 'SchoolOS',
      to: '+923001234567',
      message: 'Hello',
    });
    expect(init.signal).toBeDefined();
  });

  it('twilio: form body to the account Messages endpoint with Basic auth', async () => {
    const fetchImpl = ok();
    await new TwilioSmsSender(
      {
        provider: 'twilio',
        accountSid: 'AC1',
        authToken: 't',
        from: '+15550001111',
      },
      fetchImpl,
    ).sendMessage('03001234567', 'Hi');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json',
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from('AC1:t').toString('base64')}`,
    );
    expect(
      Object.fromEntries(new URLSearchParams(init.body as string)),
    ).toEqual({
      To: '+923001234567',
      From: '+15550001111',
      Body: 'Hi',
    });
  });

  it('a provider error becomes a failed delivery with a short reason', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response('invalid number', { status: 400 }));
    await expect(
      new HttpSmsSender(
        { provider: 'http', url: 'https://x', apiKey: 'k', senderId: 's' },
        fetchImpl,
      ).sendMessage('0300', 'x'),
    ).rejects.toThrow('SMS send failed via http gateway (400): invalid number');
  });

  it('picks the sender by provider', () => {
    expect(
      createSmsSender({
        provider: 'twilio',
        accountSid: 'a',
        authToken: 'b',
        from: 'c',
      }),
    ).toBeInstanceOf(TwilioSmsSender);
    expect(
      createSmsSender({
        provider: 'http',
        url: 'https://x',
        apiKey: 'k',
        senderId: 's',
      }),
    ).toBeInstanceOf(HttpSmsSender);
  });
});
