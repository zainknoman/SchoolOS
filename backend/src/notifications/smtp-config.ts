import { ConfigService } from '@nestjs/config';
import { isDevOrTestEnv } from '../config/env.validation';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

// Unset NODE_ENV is NOT development (BL-51); boot-time validateEnv already requires it.
function isDevOrTest(config: ConfigService): boolean {
  return isDevOrTestEnv(config.get<string>('NODE_ENV'));
}

/**
 * Same all-or-nothing contract as resolveFirebaseConfig: unset entirely -> undefined
 * (LoggingMailAdapter used); a partial config outside dev/test is a startup error; a partial
 * config inside dev/test is treated the same as unset.
 */
export function resolveSmtpConfig(
  config: ConfigService,
): SmtpConfig | undefined {
  const host = config.get<string>('SMTP_HOST');
  const portRaw = config.get<string>('SMTP_PORT');
  const user = config.get<string>('SMTP_USER');
  const pass = config.get<string>('SMTP_PASS');
  const from = config.get<string>('SMTP_FROM');
  const values = [host, portRaw, user, pass, from];
  const presentCount = values.filter((v) => !!v).length;

  if (presentCount === 0) return undefined;
  if (presentCount < values.length && !isDevOrTest(config)) {
    throw new Error(
      'Incomplete SMTP configuration — SMTP_HOST/PORT/USER/PASS/FROM must all be set together, or all left unset to disable email delivery.',
    );
  }
  if (presentCount < values.length) return undefined;

  return {
    host: host!,
    port: Number(portRaw),
    user: user!,
    pass: pass!,
    from: from!,
  };
}
