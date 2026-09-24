import { ConfigService } from '@nestjs/config';
import { isDevOrTestEnv } from '../config/env.validation';

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

// Unset NODE_ENV is NOT development (BL-51); boot-time validateEnv already requires it.
function isDevOrTest(config: ConfigService): boolean {
  return isDevOrTestEnv(config.get<string>('NODE_ENV'));
}

/**
 * Same all-or-nothing shape as resolveJazzCashConfig/resolveEasyPaisaConfig
 * (backend/src/fees/gateways/gateway-config.ts): unset entirely means "no real Firebase project
 * yet" and falls back to the logging no-op adapter; a partial config outside dev/test is treated
 * as a real misconfiguration and fails loudly at boot.
 *
 * FIREBASE_PRIVATE_KEY arrives from most secret managers / .env files with literal `\n`
 * sequences (real newlines don't survive a single-line env var) — unescape them here so the PEM
 * key `firebase-admin`'s credential.cert() receives is well-formed.
 */
export function resolveFirebaseConfig(
  config: ConfigService,
): FirebaseAdminConfig | undefined {
  const projectId = config.get<string>('FIREBASE_PROJECT_ID');
  const clientEmail = config.get<string>('FIREBASE_CLIENT_EMAIL');
  const privateKeyRaw = config.get<string>('FIREBASE_PRIVATE_KEY');
  const values = [projectId, clientEmail, privateKeyRaw];
  const presentCount = values.filter((v) => !!v).length;

  if (presentCount === 0) return undefined;
  if (presentCount < values.length && !isDevOrTest(config)) {
    throw new Error(
      'Incomplete Firebase configuration — FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY must all be set together, or all left unset to disable push notifications.',
    );
  }
  if (presentCount < values.length) return undefined;

  return {
    projectId: projectId!,
    clientEmail: clientEmail!,
    privateKey: privateKeyRaw!.replace(/\\n/g, '\n'),
  };
}
