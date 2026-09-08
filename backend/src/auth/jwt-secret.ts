import { ConfigService } from '@nestjs/config';

const DEV_ONLY_FALLBACK_SECRET = 'dev-only-change-me-access';

// JwtModule.registerAsync's factory (signing) and JwtStrategy (verifying) must resolve to the
// exact same secret, so this lives in one place both import. Refuses to boot with the insecure
// fallback outside development/test — a misconfigured production deploy must fail loudly at
// startup, not silently sign tokens with a publicly-known default.
export function resolveAccessTokenSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_ACCESS_SECRET');
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';

  if (!secret && nodeEnv !== 'development' && nodeEnv !== 'test') {
    throw new Error(
      'JWT_ACCESS_SECRET must be set outside development/test — refusing to boot with the insecure fallback secret.',
    );
  }

  return secret ?? DEV_ONLY_FALLBACK_SECRET;
}
