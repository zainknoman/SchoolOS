import { ConfigService } from '@nestjs/config';
import { resolveAccessTokenSecret } from './jwt-secret';

describe('resolveAccessTokenSecret', () => {
  it('throws when JWT_ACCESS_SECRET is unset and NODE_ENV is production', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'NODE_ENV' ? 'production' : undefined,
      ),
    } as unknown as ConfigService;

    expect(() => resolveAccessTokenSecret(config)).toThrow(
      /JWT_ACCESS_SECRET must be set/,
    );
  });

  it('does not throw when JWT_ACCESS_SECRET is unset and NODE_ENV is development', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'NODE_ENV' ? 'development' : undefined,
      ),
    } as unknown as ConfigService;

    expect(resolveAccessTokenSecret(config)).toBe('dev-only-change-me-access');
  });

  // BL-51 replaced the old behaviour (unset NODE_ENV defaulted to development and got the fallback).
  it('throws when JWT_ACCESS_SECRET and NODE_ENV are both unset — unset is no longer development', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    expect(() => resolveAccessTokenSecret(config)).toThrow(
      /JWT_ACCESS_SECRET must be set/,
    );
  });

  it('treats an empty JWT_ACCESS_SECRET as unset (a copied .env.example has JWT_ACCESS_SECRET="")', () => {
    const env: Record<string, string> = {
      JWT_ACCESS_SECRET: '  ',
      NODE_ENV: 'test',
    };
    const config = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;
    expect(resolveAccessTokenSecret(config)).toBe('dev-only-change-me-access');
    env.NODE_ENV = 'production';
    expect(() => resolveAccessTokenSecret(config)).toThrow(
      /JWT_ACCESS_SECRET must be set/,
    );
  });

  it('never throws when JWT_ACCESS_SECRET is set, regardless of NODE_ENV', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'JWT_ACCESS_SECRET' ? 'real-secret' : 'production',
      ),
    } as unknown as ConfigService;
    expect(resolveAccessTokenSecret(config)).toBe('real-secret');
  });
});
