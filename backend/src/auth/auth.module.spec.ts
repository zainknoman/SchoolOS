import { ConfigService } from '@nestjs/config';
import { jwtModuleFactory } from './auth.module';
import { ACCESS_TOKEN_TTL } from './auth.constants';

describe('jwtModuleFactory', () => {
  it('reads the access-token secret from ConfigService, not from process.env directly', () => {
    const config = { get: jest.fn().mockReturnValue('secret-from-config') } as unknown as ConfigService;

    const options = jwtModuleFactory(config);

    expect(config.get).toHaveBeenCalledWith('JWT_ACCESS_SECRET');
    expect(options).toEqual({
      secret: 'secret-from-config',
      signOptions: { expiresIn: ACCESS_TOKEN_TTL },
    });
  });

  it('falls back to the dev-only default when JWT_ACCESS_SECRET is unset', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) } as unknown as ConfigService;

    expect(jwtModuleFactory(config).secret).toBe('dev-only-change-me-access');
  });
});
