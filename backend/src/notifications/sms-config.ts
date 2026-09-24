import { ConfigService } from '@nestjs/config';
import { isDevOrTestEnv } from '../config/env.validation';

export interface SmsConfig {
  // TODO: confirm these field names against the actual contracted Pakistani SMS gateway —
  // placeholders here mirror the shape of a typical HTTP SMS gateway (API key + sender id),
  // matching Sprint E's EasyPaisa precedent for an unconfirmed field list.
  apiKey: string;
  senderId: string;
}

// Unset NODE_ENV is NOT development (BL-51); boot-time validateEnv already requires it.
function isDevOrTest(config: ConfigService): boolean {
  return isDevOrTestEnv(config.get<string>('NODE_ENV'));
}

/**
 * Same all-or-nothing shape as resolveFirebaseConfig (backend/src/notifications/fcm-config.ts):
 * unset entirely means "no real SMS gateway contracted yet" and falls back to the
 * channel-agnostic LoggingPushAdapter; a partial config outside dev/test is treated as a real
 * misconfiguration and fails loudly at boot.
 */
export function resolveSmsConfig(config: ConfigService): SmsConfig | undefined {
  const apiKey = config.get<string>('SMS_GATEWAY_API_KEY');
  const senderId = config.get<string>('SMS_GATEWAY_SENDER_ID');
  const values = [apiKey, senderId];
  const presentCount = values.filter((v) => !!v).length;

  if (presentCount === 0) return undefined;
  if (presentCount < values.length && !isDevOrTest(config)) {
    throw new Error(
      'Incomplete SMS gateway configuration — SMS_GATEWAY_API_KEY/SMS_GATEWAY_SENDER_ID must ' +
        'both be set together, or both left unset to disable SMS notifications.',
    );
  }
  if (presentCount < values.length) return undefined;

  return {
    apiKey: apiKey!,
    senderId: senderId!,
  };
}
