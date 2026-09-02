export type PaymentOperationStatus = "processing" | "completed" | "failed"

export type PaymentOperationKey = {
  provider: string
  operationId: string
  paymentId: string
}

export type PaymentOperationBinding = PaymentOperationKey & {
  actorId: string
  actionId: string
  capability: string
  requestFingerprint: string
}

export type PaymentOperationRecord = PaymentOperationBinding & {
  status: PaymentOperationStatus
  providerReference?: string
  resultStatus?: string
  resultPayload?: unknown
}

export type PaymentOperationClaim =
  | { claimed: true }
  | { claimed: false; record: PaymentOperationRecord }

/** Durable execution boundary for irreversible Commerce payment operations. */
export interface PaymentOperationStore {
  /** Inspect without creating, claiming, or mutating an operation. */
  get(input: PaymentOperationBinding): Promise<PaymentOperationRecord | undefined>
  claim(input: PaymentOperationBinding): Promise<PaymentOperationClaim>
  complete(input: PaymentOperationBinding, result: { providerReference: string; resultStatus: string; resultPayload: unknown }): Promise<void>
  fail(input: PaymentOperationBinding, result: { providerReference?: string; resultStatus: string; resultPayload?: unknown }): Promise<void>
}

export function assertPaymentOperationBinding(record: PaymentOperationRecord, expected: PaymentOperationBinding): void {
  if (
    record.provider !== expected.provider ||
    record.operationId !== expected.operationId ||
    record.paymentId !== expected.paymentId ||
    record.actorId !== expected.actorId ||
    record.actionId !== expected.actionId ||
    record.capability !== expected.capability ||
    record.requestFingerprint !== expected.requestFingerprint
  ) {
    throw new Error("COMMERCE_PAYMENT_OPERATION_BINDING_MISMATCH")
  }
}

export function requireStoredPaymentIntent(record: PaymentOperationRecord): unknown {
  if (record.status === "processing") throw new Error("COMMERCE_PAYMENT_OPERATION_IN_PROGRESS")
  if (record.status === "failed") throw new Error(`COMMERCE_PAYMENT_OPERATION_FAILED:${record.resultStatus ?? "unknown"}`)
  if (record.resultPayload === undefined) throw new Error("COMMERCE_PAYMENT_OPERATION_RESULT_MISSING")
  return record.resultPayload
}
