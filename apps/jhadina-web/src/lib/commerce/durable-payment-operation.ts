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
  resultPayload?: unknown;
};

export type PaymentOperationClaim =
  | { claimed: true }
  | { claimed: false; record: PaymentOperationRecord };

/** Durable execution boundary for irreversible Commerce payment operations. */
export interface PaymentOperationStore {
  claim(input: Omit<PaymentOperationRecord, "status" | "providerReference" | "resultStatus" | "resultPayload">): Promise<PaymentOperationClaim>;
  complete(key: PaymentOperationKey, result: { providerReference: string; resultStatus: string; resultPayload: unknown }): Promise<void>;
  fail(key: PaymentOperationKey, result: { providerReference?: string; resultStatus: string; resultPayload?: unknown }): Promise<void>;
}

export function assertPaymentOperationBinding(
  record: PaymentOperationRecord,
  expected: Omit<PaymentOperationRecord, "status" | "providerReference" | "resultStatus" | "resultPayload">,
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

export function requireStoredPaymentIntent(record: PaymentOperationRecord): unknown {
  if (record.status === "processing") throw new Error("COMMERCE_PAYMENT_OPERATION_IN_PROGRESS");
  if (record.status === "failed") throw new Error(`COMMERCE_PAYMENT_OPERATION_FAILED:${record.resultStatus ?? "unknown"}`);
  if (record.resultPayload === undefined) throw new Error("COMMERCE_PAYMENT_OPERATION_RESULT_MISSING");
  return record.resultPayload;
}
