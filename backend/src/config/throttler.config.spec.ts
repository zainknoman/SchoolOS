import { getThrottlerLimits } from './throttler.config';

describe('throttler.config', () => {
  it('uses the strict production limits when NODE_ENV is not test', () => {
    const limits = getThrottlerLimits('production');

    expect(limits.authLogin).toBe(5);
    expect(limits.general).toBe(100);
  });

  it('uses generous limits under NODE_ENV=test so e2e suites logging in repeatedly are unaffected', () => {
    const limits = getThrottlerLimits('test');

    expect(limits.authLogin).toBe(1000);
    expect(limits.general).toBe(1000);
  });
});