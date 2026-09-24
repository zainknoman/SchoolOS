import { parseTrustProxy } from './app-security';

describe('parseTrustProxy (BL-12)', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['  ', false],
    ['false', false],
    ['true', true],
    ['1', 1],
    ['2', 2],
    ['loopback', 'loopback'],
    ['10.0.0.0/8, 172.16.0.0/12', '10.0.0.0/8, 172.16.0.0/12'],
  ])('TRUST_PROXY=%p -> %p', (raw, expected) => {
    expect(parseTrustProxy(raw)).toEqual(expected);
  });
});
