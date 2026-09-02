import type { PaymentIntent, PaymentProvider } from "@jhadina/payment-core"
import { assertPaymentOperationBinding, type PaymentOperationBinding, type PaymentOperationRecord, type PaymentOperationStore } from "./durable-payment-operation"

export type PaymentOperationReconciliationResult =
  | { status: "completed"; payment: PaymentIntent }
  | { status: "still_unknown"; operation: PaymentOperationRecord }

/**
 * Recovery boundary for a provider call whose application process may have
 * crashed or timed out after the external provider accepted the operation.
 *
 * Reconciliation never invokes a mutating provider operation. It only reads
 * the provider's authoritative payment state and, when that state is known,
 * durably closes the existing processing operation. This is intentionally
 * separate from GovernedPaymentProvider execution so recovery can never
 * become a second payment attempt.
 */
export async function reconcilePaymentOperation(
  store: PaymentOperationStore,
  provider: PaymentProvider,
  binding: PaymentOperationBinding,
): Promise<PaymentOperationReconciliationResult> {
  const claim = await store.claim(binding)

  if (claim.claimed) {
    throw new Error("COMMERCE_PAYMENT_RECONCILIATION_OPERATION_NOT_EXISTING")
  }

  assertPaymentOperationBinding(claim.record, binding)

  if (claim.record.status === "completed") {
    if (!claim.record.resultPayload) throw new Error("COMMERCE_PAYMENT_OPERATION_RESULT_MISSING")
    return { status: "completed", payment: claim.record.resultPayload as PaymentIntent }
  }

  if (claim.record.status === "failed") {
    throw new Error(`COMMERCE_PAYMENT_OPERATION_FAILED:${claim.record.resultStatus ?? "unknown"}`)
  }

  let observed: PaymentIntent
  try {
    observed = await provider.getPayment(binding.paymentId)
  } catch {
    // A provider lookup failure does not prove that the original operation
    // failed. Keep the durable operation processing and retry reconciliation.
    return { status: "still_unknown", operation: claim.record }
  }

  // getPayment is read-only; persisting its authoritative state is safe.
  // No approval is consumed and no provider mutation is attempted here.
  await store.complete(binding, {
    providerReference: observed.providerReference ?? binding.operationId,
    resultStatus: observed.status,
    resultPayload: observed,
  })

  return { status: "completed", payment: observed }
}
