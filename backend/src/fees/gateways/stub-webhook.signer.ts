import {
  PaymentWebhookSigner,
  WebhookVerificationResult,
} from './webhook-signer';

/**
 * The stub gateway has no real signing scheme to reproduce — this exists only so local dev/tests
 * exercise the *same* webhook-verification code path a real gateway would hit (see
 * PaymentsWebhookController), rather than special-casing "no signature check" for dev. A plain
 * shared-secret header compare, not HMAC — there is nothing to compute a real signature over
 * since the stub gateway doesn't exist server-side.
 */
export class StubWebhookSigner implements PaymentWebhookSigner {
  constructor(private readonly secret: string) {}

  verifyAndParse(
    body: Record<string, string>,
    headers: Record<string, string | undefined>,
  ): WebhookVerificationResult {
    if (headers['x-stub-signature'] !== this.secret) {
      return { valid: false };
    }
    if (body.status !== 'completed' && body.status !== 'failed') {
      return { valid: false };
    }
    return { valid: true, reference: body.reference, status: body.status };
  }
}
