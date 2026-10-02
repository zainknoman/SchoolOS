import { redactPersonalData } from './redact';

describe('redactPersonalData (BL-49)', () => {
  it.each([
    ['CNIC 35202-1234567-1 and 3520212345671', 'CNIC [CNIC] and [CNIC]', 2],
    ['mail ali.khan@example.com now', 'mail [EMAIL] now', 1],
    [
      'call 0300-1234567 or +92 321 7654321 or 03001234567',
      'call [PHONE] or [PHONE] or [PHONE]',
      3,
    ],
    ['UK +44 20 7946 0958', 'UK [PHONE]', 1],
    [
      'PTM on 20 Sept, fee Rs 3500, class 7',
      'PTM on 20 Sept, fee Rs 3500, class 7',
      0,
    ],
  ])('%s', (input, out, n) => {
    expect(redactPersonalData(input)).toEqual({ text: out, redactions: n });
  });
});
