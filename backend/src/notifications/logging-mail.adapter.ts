import { Injectable, Logger } from '@nestjs/common';
import { MailAdapter } from './mail-adapter';

/**
 * Default MailAdapter when SMTP is not configured — it records THAT a message would have been
 * sent, never WHAT it says. The body can carry a password-reset link (a bearer credential), so it
 * is never logged in any environment (BL-51, KG-4); the recipient is masked. Without SMTP, the
 * pilot fallback for a forgotten password is the admin-assisted reset (BL-64).
 */
@Injectable()
export class LoggingMailAdapter implements MailAdapter {
  private readonly logger = new Logger(LoggingMailAdapter.name);

  // eslint-disable-next-line @typescript-eslint/require-await -- the adapter interface is Promise-based
  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(
      `[mail:not-configured] not sent: to=${maskEmail(to)} subject="${subject}" bodyLength=${body.length}`,
    );
  }
}

/** "parent.one@example.com" -> "p***@example.com"; anything without an "@" -> "***". */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@');
  if (at <= 0) return '***';
  return `${address[0]}***${address.slice(at)}`;
}
