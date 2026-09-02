export type PaymentOperationStatus = "processing" | "completed" | "failed";

export type PaymentOperationKey = {
  provider: string;
  paymentId: string;
};

export type PaymentOperationRecord = PaymentOperationKey & {
  actorId: string;
  actionId: string;
  capability: string;
  requestFingerprint: string;
  status: PaymentOperationStatus;
  providerReference?: string;
  resultStatus?: string;
};

export type PaymentOperationClaim =
  | { claimed: true }
  | { claimed: false; record: PaymentOperationRecord };

/**
 * Durable execution boundary for irreversible Commerce payment operations.
 * Production implementations must make claim atomic and persist terminal
 * outcomes. In-memory implementations belong only in tests/live fixtures.
 */
export interface PaymentOperationStore {
  claim(input: Omit<PaymentOperationRecord, "status" | "providerReference" | "resultStatus">): Promise<PaymentOperationClaim>;
  complete(key: PaymentOperationKey, result: { providerReference: string; resultStatus: string }): Promise<void>;
  fail(key: PaymentOperationKey, result: { providerReference?: string; resultStatus: string }): Promise<void>;
}

export function assertPaymentOperationBinding(
  record: PaymentOperationRecord,
  expected: Omit<PaymentOperationRecord, "status" | "providerReference" | "resultStatus">,
): void {
  if (
    record.provider !== expected.provider ||
    record.paymentId !== expected.paymentId ||
    record.actorId !== expected.actorId ||
    record.actionId !== expected.actionId ||
    record.capability !== expected.capability ||
    record.requestFingerprint !== expected.requestFingerprint
  ) {
    throw new Error("COMMERCE_PAYMENT_OPERATION_BINDING_MISMATCH");
  }
}
