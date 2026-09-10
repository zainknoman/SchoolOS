import { ConfigService } from '@nestjs/config';
import { JazzCashConfig } from './jazzcash.adapter';
import { EasyPaisaConfig } from './easypaisa.adapter';

const DEV_STUB_WEBHOOK_SECRET = 'dev-only-stub-webhook-secret';

function isDevOrTest(config: ConfigService): boolean {
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  return nodeEnv === 'development' || nodeEnv === 'test';
}

/**
 * A provider is either fully configured or fully absent — absent means "not enabled for this
 * deployment" (a school might run cash-only, or JazzCash-only) and falls back to the stub
 * adapter. A *partial* config outside dev/test is treated as a real misconfiguration and fails
 * loudly, same fail-fast spirit as resolveAccessTokenSecret (backend/src/auth/jwt-secret.ts).
 */
export function resolveJazzCashConfig(config: ConfigService): JazzCashConfig | undefined {
  const merchantId = config.get<string>('JAZZCASH_MERCHANT_ID');
  const password = config.get<string>('JAZZCASH_PASSWORD');
  const integritySalt = config.get<string>('JAZZCASH_INTEGRITY_SALT');
  const returnUrl = config.get<string>('JAZZCASH_RETURN_URL');
  const apiUrl = config.get<string>('JAZZCASH_API_URL');
  const values = [merchantId, password, integritySalt, returnUrl, apiUrl];
  const presentCount = values.filter((v) => !!v).length;

  if (presentCount === 0) return undefined;
  if (presentCount < values.length && !isDevOrTest(config)) {
    throw new Error(
      'Incomplete JazzCash configuration — JAZZCASH_MERCHANT_ID/PASSWORD/INTEGRITY_SALT/RETURN_URL/API_URL must all be set together, or all left unset to disable JazzCash.',
    );
  }
  if (presentCount < values.length) return undefined;
  return { merchantId: merchantId!, password: password!, integritySalt: integritySalt!, returnUrl: returnUrl!, apiUrl: apiUrl! };
}

export function resolveEasyPaisaConfig(config: ConfigService): EasyPaisaConfig | undefined {
  const storeId = config.get<string>('EASYPAISA_STORE_ID');
  const hashKey = config.get<string>('EASYPAISA_HASH_KEY');
  const returnUrl = config.get<string>('EASYPAISA_RETURN_URL');
  const apiUrl = config.get<string>('EASYPAISA_API_URL');
  const values = [storeId, hashKey, returnUrl, apiUrl];
  const presentCount = values.filter((v) => !!v).length;

  if (presentCount === 0) return undefined;
  if (presentCount < values.length && !isDevOrTest(config)) {
    throw new Error(
      'Incomplete EasyPaisa configuration — EASYPAISA_STORE_ID/HASH_KEY/RETURN_URL/API_URL must all be set together, or all left unset to disable EasyPaisa.',
    );
  }
  if (presentCount < values.length) return undefined;
  return { storeId: storeId!, hashKey: hashKey!, returnUrl: returnUrl!, apiUrl: apiUrl! };
}

export function resolveStubWebhookSecret(config: ConfigService): string {
  const secret = config.get<string>('PAYMENT_STUB_WEBHOOK_SECRET');
  if (!secret) {
    if (!isDevOrTest(config)) {
      throw new Error('PAYMENT_STUB_WEBHOOK_SECRET must be set outside development/test.');
    }
    return DEV_STUB_WEBHOOK_SECRET;
  }
  return secret;
}
