export interface PaymentInitiation {
  redirectUrl: string;
  gatewayReference: string;
}

export interface PaymentConfirmation {
  status: 'completed' | 'failed';
}

export interface PaymentGatewayAdapter {
  initiate(input: { amount: number; reference: string }): Promise<PaymentInitiation>;
  // Standing in for a real gateway's webhook — called by the client after the stub "checkout"
  // completes.
  confirm(gatewayReference: string): Promise<PaymentConfirmation>;
}

export const PAYMENT_GATEWAY_ADAPTER = 'PAYMENT_GATEWAY_ADAPTER';
