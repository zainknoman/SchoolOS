export interface MailAdapter {
  send(to: string, subject: string, body: string): Promise<void>;
}

export const MAIL_ADAPTER = 'MAIL_ADAPTER';
