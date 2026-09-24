import { Logger } from '@nestjs/common';
import { LoggingMailAdapter, maskEmail } from './logging-mail.adapter';

describe('LoggingMailAdapter (BL-51, KG-4)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('never logs the message body (reset links are bearer credentials) and masks the recipient', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const body =
      'Use this link: https://console.example.pk/reset-password?token=abc123secret';

    await new LoggingMailAdapter().send(
      'parent.one@example.pk',
      'Reset your SchoolOS password',
      body,
    );

    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0][0]);
    expect(line).not.toContain('abc123secret');
    expect(line).not.toContain('reset-password');
    expect(line).not.toContain('parent.one');
    expect(line).toContain('p***@example.pk');
    expect(line).toContain(`bodyLength=${body.length}`);
  });

  it.each([
    ['parent.one@example.pk', 'p***@example.pk'],
    ['a@b.pk', 'a***@b.pk'],
    ['03001234567', '***'],
    ['@nolocal.pk', '***'],
  ])('masks %s as %s', (input, expected) => {
    expect(maskEmail(input)).toBe(expected);
  });
});
