export interface PaymentInitiation {
  redirectUrl: string;
  gatewayReference: string;
}

/**
 * initiate() only. There is no confirm() — payment outcome only ever arrives via the signed
 * webhook (see PaymentsWebhookController), never by an adapter calling back to its own gateway.
 * Carrying a confirm() every adapter must implement but nothing calls would be dead-code weight,
 * not a real abstraction.
 */
export interface PaymentGatewayAdapter {
  initiate(input: {
    amount: number;
    reference: string;
  }): Promise<PaymentInitiation>;
}
