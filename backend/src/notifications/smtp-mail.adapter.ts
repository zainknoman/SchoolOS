import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { MailAdapter } from './mail-adapter';
import type { SmtpConfig } from './smtp-config';

@Injectable()
export class SmtpMailAdapter implements MailAdapter {
  private readonly transport: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: SmtpConfig) {
    this.from = config.from;
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
      // KI-5: a hung mail server must not hold a password-reset request open.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async send(to: string, subject: string, body: string): Promise<void> {
    await this.transport.sendMail({ from: this.from, to, subject, text: body });
  }
}
