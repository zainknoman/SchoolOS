import { ConfigService } from '@nestjs/config';
import { isDevOrTestEnv } from '../config/env.validation';

const DEV_ONLY_FALLBACK_SECRET = 'dev-only-change-me-access';

// JwtModule.registerAsync's factory (signing) and JwtStrategy (verifying) must resolve to the
// exact same secret, so this lives in one place both import. The fallback exists only when
// NODE_ENV is explicitly development/test; an unset NODE_ENV no longer counts as development
// (BL-51) and an empty value counts as unset. Boot-time validateEnv also rejects placeholder or
// short secrets outside development/test — this check is the last line of defence.
export function resolveAccessTokenSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_ACCESS_SECRET')?.trim();
  if (secret) return secret;

  if (!isDevOrTestEnv(config.get<string>('NODE_ENV'))) {
    throw new Error(
      'JWT_ACCESS_SECRET must be set outside development/test — refusing to boot with the insecure fallback secret.',
    );
  }
  return DEV_ONLY_FALLBACK_SECRET;
}
