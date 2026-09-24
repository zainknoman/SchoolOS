import { ConfigService } from '@nestjs/config';
import { isDevOrTestEnv } from '../config/env.validation';

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

// Unset NODE_ENV is NOT development (BL-51); boot-time validateEnv already requires it.
function isDevOrTest(config: ConfigService): boolean {
  return isDevOrTestEnv(config.get<string>('NODE_ENV'));
}

/**
 * Same all-or-nothing shape as resolveFirebaseConfig (backend/src/notifications/fcm-config.ts):
 * unset entirely means "no real WhatsApp Business account yet" and falls back to the
 * channel-agnostic LoggingPushAdapter; a partial config outside dev/test is treated as a real
 * misconfiguration and fails loudly at boot.
 */
export function resolveWhatsAppConfig(
  config: ConfigService,
): WhatsAppConfig | undefined {
  const phoneNumberId = config.get<string>('WHATSAPP_BUSINESS_PHONE_ID');
  const accessToken = config.get<string>('WHATSAPP_ACCESS_TOKEN');
  const values = [phoneNumberId, accessToken];
  const presentCount = values.filter((v) => !!v).length;

  if (presentCount === 0) return undefined;
  if (presentCount < values.length && !isDevOrTest(config)) {
    throw new Error(
      'Incomplete WhatsApp configuration — WHATSAPP_BUSINESS_PHONE_ID/WHATSAPP_ACCESS_TOKEN must ' +
        'both be set together, or both left unset to disable WhatsApp notifications.',
    );
  }
  if (presentCount < values.length) return undefined;

  return {
    phoneNumberId: phoneNumberId!,
    accessToken: accessToken!,
  };
}
