import { NotificationChannel } from '@prisma/client';
import { PushAdapter } from './push-adapter';

export const WHATSAPP_ADAPTER = 'WHATSAPP_ADAPTER';
export const SMS_ADAPTER = 'SMS_ADAPTER';

export interface ChannelAdapters {
  push: PushAdapter;
  whatsapp: PushAdapter;
  sms: PushAdapter;
}

/**
 * Maps a user's NotificationChannel preference to the PushAdapter that should carry their
 * notification. Every branch resolves to a real PushAdapter (never undefined) so callers never
 * need a further fallback — an unset channel preference defaults to PUSH at the schema level.
 */
export function resolveAdapterFor(
  channel: NotificationChannel,
  adapters: ChannelAdapters,
): PushAdapter {
  switch (channel) {
    case 'WHATSAPP':
      return adapters.whatsapp;
    case 'SMS':
      return adapters.sms;
    case 'PUSH':
    default:
      return adapters.push;
  }
}
