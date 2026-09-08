import { ConfigService } from '@nestjs/config';
import { resolveAccessTokenSecret } from './jwt-secret';

describe('resolveAccessTokenSecret', () => {
  it('throws when JWT_ACCESS_SECRET is unset and NODE_ENV is production', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'production' : undefined)),
    } as unknown as ConfigService;

    expect(() => resolveAccessTokenSecret(config)).toThrow(
      /JWT_ACCESS_SECRET must be set/,
    );
  });

  it('does not throw when JWT_ACCESS_SECRET is unset and NODE_ENV is development', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'NODE_ENV' ? 'development' : undefined)),
    } as unknown as ConfigService;

    expect(resolveAccessTokenSecret(config)).toBe('dev-only-change-me-access');
  });

  it('does not throw when JWT_ACCESS_SECRET is unset and NODE_ENV is unset (defaults to development)', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;
    expect(resolveAccessTokenSecret(config)).toBe('dev-only-change-me-access');
  });

  it('never throws when JWT_ACCESS_SECRET is set, regardless of NODE_ENV', () => {
    const config = {
      get: jest.fn((key: string) => (key === 'JWT_ACCESS_SECRET' ? 'real-secret' : 'production')),
    } as unknown as ConfigService;
    expect(resolveAccessTokenSecret(config)).toBe('real-secret');
  });
});
