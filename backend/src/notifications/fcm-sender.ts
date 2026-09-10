import * as admin from 'firebase-admin';
import { FirebaseAdminConfig } from './fcm-config';
import { PushPayload } from './push-adapter';

export interface FcmSendResponse {
  success: boolean;
  /** Set when success is false — used to detect a token FCM will never accept again. */
  errorCode?: string;
}

export interface FcmSendResult {
  responses: FcmSendResponse[];
}

/**
 * Thin seam over the firebase-admin SDK — FcmPushAdapter depends on this interface, not on
 * firebase-admin directly, so its tests supply a fake sender instead of mocking the whole SDK
 * module.
 */
export interface FcmSender {
  sendEachForMulticast(
    tokens: string[],
    payload: PushPayload,
  ): Promise<FcmSendResult>;
}

/**
 * Each real FcmPushAdapter instance gets its own named admin app (rather than the SDK default) so
 * that constructing more than one in a process — e.g. across NestJS's hot-reload in dev, or in a
 * test that builds several — never collides with "app already exists" from admin.initializeApp().
 */
let appCounter = 0;

export class AdminFcmSender implements FcmSender {
  private readonly app: admin.app.App;

  constructor(config: FirebaseAdminConfig) {
    this.app = admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey,
        }),
      },
      `fcm-push-adapter-${appCounter++}`,
    );
  }

  async sendEachForMulticast(
    tokens: string[],
    payload: PushPayload,
  ): Promise<FcmSendResult> {
    const response = await this.app.messaging().sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
    });
    return {
      responses: response.responses.map((r) => ({
        success: r.success,
        errorCode: r.error?.code,
      })),
    };
  }
}
