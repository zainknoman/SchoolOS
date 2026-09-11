import { Injectable, Logger } from '@nestjs/common';
import { MailAdapter } from './mail-adapter';

/**
 * Default MailAdapter — no real SMTP account exists in this environment, so this logs the
 * message (including the reset link, in `body`) instead of sending it. Same "structurally
 * complete, not live-verified" bar as every other adapter's logging fallback in this codebase.
 */
@Injectable()
export class LoggingMailAdapter implements MailAdapter {
  private readonly logger = new Logger(LoggingMailAdapter.name);

  async send(to: string, subject: string, body: string): Promise<void> {
    this.logger.log(`[mail:not-configured] to=${to} subject="${subject}" body=${body}`);
  }
}
