/**
 * KI-5 / KG-22: how hard the API tries to deliver a notification through the user's channel
 * (push, WhatsApp, SMS). The in-app Notification row is written first and never depends on this.
 */

/** One provider call may take at most this long before it counts as failed. */
export const DELIVERY_TIMEOUT_MS = 10_000;

/** After this many failed attempts a notification is FAILED and an error is logged for alerting. */
export const MAX_DELIVERY_ATTEMPTS = 5;

/** Wait before attempt n+1 (index n-1): 1 min, 5 min, 30 min, 2 h. */
export const RETRY_BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000];

/** How often the retry job looks for due notifications, and how many it takes per run. */
export const NOTIFICATION_RETRY_CRON = '* * * * *';
export const RETRY_BATCH_SIZE = 100;

export type DeliveryStatus = 'PENDING' | 'SENT' | 'RETRY' | 'FAILED';

/** Error text kept on the row: the provider's message, never the notification body. */
export function deliveryErrorText(err: unknown): string {
  const text =
    err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return text.slice(0, 500);
}

/** Status after one more failed attempt (`attempts` includes it). */
export function afterFailure(
  attempts: number,
  now: number,
): { deliveryStatus: DeliveryStatus; nextAttemptAt: Date | null } {
  if (attempts >= MAX_DELIVERY_ATTEMPTS) {
    return { deliveryStatus: 'FAILED', nextAttemptAt: null };
  }
  const wait =
    RETRY_BACKOFF_MS[Math.min(attempts, RETRY_BACKOFF_MS.length) - 1];
  return { deliveryStatus: 'RETRY', nextAttemptAt: new Date(now + wait) };
}
