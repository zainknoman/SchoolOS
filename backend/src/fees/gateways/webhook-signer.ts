export interface WebhookVerificationResult {
  valid: boolean;
  reference?: string;
  status?: 'completed' | 'failed';
}

export interface PaymentWebhookSigner {
  verifyAndParse(
    body: Record<string, string>,
    headers: Record<string, string | undefined>,
  ): WebhookVerificationResult;
}
