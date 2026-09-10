import { PaymentGatewayAdapter, PaymentInitiation } from '../payment-gateway-adapter';
import { PaymentWebhookSigner, WebhookVerificationResult } from './webhook-signer';
import { JazzCashSigner } from './jazzcash.signer';

export interface JazzCashConfig {
  merchantId: string;
  password: string;
  integritySalt: string;
  returnUrl: string;
  apiUrl: string;
}

function formatJazzCashDateTime(date: Date): string {
  return date.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

/**
 * Builds the redirect payload against JazzCash's publicly-documented Page Redirection / Mobile
 * Wallet request shape (pp_Version, pp_TxnType, pp_MerchantID, ... — confirmed via JazzCash's own
 * sandbox docs). Payment outcome never comes from this adapter — only from the signed webhook
 * (see PaymentsWebhookController) — so there is no confirm() method here.
 */
export class JazzCashAdapter implements PaymentGatewayAdapter {
  constructor(private readonly config: JazzCashConfig) {}

  async initiate(input: { amount: number; reference: string }): Promise<PaymentInitiation> {
    const signer = new JazzCashSigner(this.config.integritySalt);
    const now = new Date();
    const fields: Record<string, string> = {
      pp_Version: '1.1',
      pp_TxnType: 'MWALLET',
      pp_Language: 'EN',
      pp_MerchantID: this.config.merchantId,
      pp_Password: this.config.password,
      pp_TxnRefNo: input.reference,
      pp_Amount: String(input.amount),
      pp_TxnCurrency: 'PKR',
      pp_TxnDateTime: formatJazzCashDateTime(now),
      pp_TxnExpiryDateTime: formatJazzCashDateTime(new Date(now.getTime() + 60 * 60 * 1000)),
      pp_BillReference: input.reference,
      pp_Description: 'SEEDS school fee payment',
      pp_ReturnURL: this.config.returnUrl,
    };
    const pp_SecureHash = signer.sign(fields);
    const query = new URLSearchParams({ ...fields, pp_SecureHash }).toString();

    return { redirectUrl: `${this.config.apiUrl}?${query}`, gatewayReference: input.reference };
  }
}

/** pp_ResponseCode "000" is JazzCash's documented success code. */
export function parseJazzCashWebhook(body: Record<string, string>): { reference: string; status: 'completed' | 'failed' } {
  return { reference: body.pp_TxnRefNo, status: body.pp_ResponseCode === '000' ? 'completed' : 'failed' };
}

export class JazzCashWebhookSigner implements PaymentWebhookSigner {
  private readonly signer: JazzCashSigner;
  constructor(integritySalt: string) {
    this.signer = new JazzCashSigner(integritySalt);
  }

  verifyAndParse(body: Record<string, string>): WebhookVerificationResult {
    if (!this.signer.verify(body, body.pp_SecureHash)) {
      return { valid: false };
    }
    return { valid: true, ...parseJazzCashWebhook(body) };
  }
}
