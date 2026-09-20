import {
  PaymentGatewayAdapter,
  PaymentInitiation,
} from '../payment-gateway-adapter';
import {
  PaymentWebhookSigner,
  WebhookVerificationResult,
} from './webhook-signer';
import { EasyPaisaSigner } from './easypaisa.signer';

export interface EasyPaisaConfig {
  storeId: string;
  hashKey: string;
  returnUrl: string;
  apiUrl: string;
}

/**
 * TODO: confirm against your EasyPaisa merchant integration doc — field names/order below
 * (storeId, amount, orderRefNum, postBackURL, expiryDate) are a reasonable placement, not a
 * confirmed spec (see EasyPaisaSigner's own caveat and the design doc).
 */
export class EasyPaisaAdapter implements PaymentGatewayAdapter {
  constructor(private readonly config: EasyPaisaConfig) {}

  // eslint-disable-next-line @typescript-eslint/require-await -- the adapter interface is Promise-based
  async initiate(input: {
    amount: number;
    reference: string;
  }): Promise<PaymentInitiation> {
    const signer = new EasyPaisaSigner(this.config.hashKey);
    const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

    const fields: Record<string, string> = {
      storeId: this.config.storeId,
      amount: (input.amount / 100).toFixed(2),
      orderRefNum: input.reference,
      postBackURL: this.config.returnUrl,
      expiryDate,
    };
    const merchantHashedReq = signer.sign(fields);
    const query = new URLSearchParams({
      ...fields,
      merchantHashedReq,
    }).toString();

    return {
      redirectUrl: `${this.config.apiUrl}?${query}`,
      gatewayReference: input.reference,
    };
  }
}

export class EasyPaisaWebhookSigner implements PaymentWebhookSigner {
  private readonly signer: EasyPaisaSigner;
  constructor(hashKey: string) {
    this.signer = new EasyPaisaSigner(hashKey);
  }

  verifyAndParse(
    body: Record<string, string>,
    _headers: Record<string, string | undefined>,
  ): WebhookVerificationResult {
    const { merchantHashedReq, ...rest } = body;
    if (!this.signer.verify(rest, merchantHashedReq)) {
      return { valid: false };
    }
    return {
      valid: true,
      reference: rest.orderRefNum,
      status: rest.status === 'SUCCESS' ? 'completed' : 'failed',
    };
  }
}
