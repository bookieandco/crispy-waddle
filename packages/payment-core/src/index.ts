export type Currency = string;
export type PaymentStatus =
  | "pending"
  | "requires_action"
  | "authorized"
  | "captured"
  | "partially_refunded"
  | "refunded"
  | "failed"
  | "cancelled";
export type PaymentRail = "card" | "bank" | "cash" | "other";
export type LedgerEntryType = "charge" | "fee" | "tax" | "payout" | "refund" | "adjustment";

export interface Money {
  amountMinor: number;
  currency: Currency;
}

export interface PaymentParty {
  id: string;
  type: "customer" | "merchant" | "platform" | "courier" | "tax_authority";
}

export interface PaymentLine {
  id: string;
  description: string;
  amount: Money;
  quantity?: number;
  taxCode?: string;
  sellerId?: string;
}

export interface PaymentIntentRequest {
  paymentId: string;
  orderId: string;
  customer: PaymentParty;
  seller: PaymentParty;
  amount: Money;
  lines: PaymentLine[];
  taxes: TaxLine[];
  platformFees: FeeLine[];
  metadata?: Record<string, string>;
}

export interface PaymentIntent {
  paymentId: string;
  provider: string;
  providerReference?: string;
  orderId: string;
  amount: Money;
  status: PaymentStatus;
  rail?: PaymentRail;
  createdAt: string;
  updatedAt: string;
}

export interface FeeLine {
  code: string;
  description: string;
  amount: Money;
  recipient: PaymentParty;
}

export interface TaxLine {
  code: string;
  jurisdictionId: string;
  description: string;
  amount: Money;
  recipient: PaymentParty;
}

export interface PayoutInstruction {
  payoutId: string;
  merchant: PaymentParty;
  orderId: string;
  gross: Money;
  fees: Money;
  taxesWithheld: Money;
  refunds: Money;
  net: Money;
  scheduledFor?: string;
}

export interface RefundRequest {
  refundId: string;
  paymentId: string;
  amount?: Money;
  reason: "customer_request" | "order_cancelled" | "delivery_failed" | "compliance" | "other";
  requestedBy: string;
}

export interface ReconciliationEntry {
  entryId: string;
  provider: string;
  providerReference: string;
  internalReference: string;
  type: LedgerEntryType;
  amount: Money;
  occurredAt: string;
}

export interface ReconciliationReport {
  reconciliationId: string;
  provider: string;
  periodStart: string;
  periodEnd: string;
  matched: ReconciliationEntry[];
  unmatched: ReconciliationEntry[];
  discrepancies: Array<{
    internalReference?: string;
    providerReference?: string;
    expected: Money;
    observed: Money;
    reason: string;
  }>;
}

export interface PaymentProvider {
  readonly name: string;
  createPaymentIntent(request: PaymentIntentRequest): Promise<PaymentIntent>;
  capture(paymentId: string): Promise<PaymentIntent>;
  refund(request: RefundRequest): Promise<PaymentIntent>;
  getPayment(paymentId: string): Promise<PaymentIntent>;
  createPayout(instruction: PayoutInstruction): Promise<{ payoutId: string; providerReference?: string }>;
  reconcile(periodStart: string, periodEnd: string): Promise<ReconciliationReport>;
}

export interface PaymentPolicy {
  jurisdictionId: string;
  providerId: string;
  currency: Currency;
  allowedRails: PaymentRail[];
  supportsMerchantPayouts: boolean;
  supportsRefunds: boolean;
  sellerOfRecord: "merchant" | "platform";
  requiresManualReview: boolean;
}

export const PAYMENT_CORE_VERSION = "0.1.0" as const;

export function calculateNetPayout(instruction: Omit<PayoutInstruction, "net">): Money {
  const net =
    instruction.gross.amountMinor -
    instruction.fees.amountMinor -
    instruction.taxesWithheld.amountMinor -
    instruction.refunds.amountMinor;

  if (net < 0) {
    throw new Error("Payout net amount cannot be negative");
  }

  return { amountMinor: net, currency: instruction.gross.currency };
}

export function assertSameCurrency(...money: Money[]): void {
  const currencies = new Set(money.map((value) => value.currency));
  if (currencies.size > 1) {
    throw new Error("Payment amounts must use the same currency");
  }
}
