import { Injectable } from '@nestjs/common';
import { PushAdapter, PushPayload } from './push-adapter';

/**
 * No real Firebase project exists yet (tracked for Sprint 11-12) — this adapter logs what would
 * have been sent and resolves immediately. Swapping in a real FCM-backed implementation later is
 * a one-file change behind the same PushAdapter interface, matching the StorageAdapter pattern.
 */
@Injectable()
export class LoggingPushAdapter implements PushAdapter {
  // eslint-disable-next-line @typescript-eslint/require-await -- the adapter interface is Promise-based
  async send(userId: string, payload: PushPayload): Promise<void> {
    console.log(`[push:noop] would notify user ${userId}:`, payload.title);
  }
}
