import type { PaymentIntent, PaymentProvider } from "@jhadina/payment-core"
import { assertPaymentOperationBinding, type PaymentOperationBinding, type PaymentOperationRecord, type PaymentOperationStore } from "./durable-payment-operation"

export interface PaymentOperationReconciliationDeps {
  store: PaymentOperationStore
  provider: PaymentProvider
}

/**
 * Recovery is read-only with respect to the external provider: it may inspect
 * provider state and durably record the observed terminal result, but it never
 * creates, captures, or refunds a payment.
 */
export async function reconcileProcessingPaymentOperation(
  deps: PaymentOperationReconciliationDeps,
  binding: PaymentOperationBinding,
): Promise<PaymentIntent> {
  const claim = await deps.store.claim(binding)
  if (claim.claimed) throw new Error("PAYMENT_RECONCILIATION_OPERATION_NOT_EXISTING")

  const record: PaymentOperationRecord = claim.record
  assertPaymentOperationBinding(record, binding)
  if (record.status === "completed") return record.resultPayload as PaymentIntent
  if (record.status === "failed") throw new Error(`COMMERCE_PAYMENT_OPERATION_FAILED:${record.resultStatus ?? "unknown"}`)

  let observed: PaymentIntent
  try {
    observed = await deps.provider.getPayment(binding.paymentId)
  } catch (error) {
    throw new Error(`PAYMENT_RECONCILIATION_UNAVAILABLE:${error instanceof Error ? error.message : String(error)}`)
  }

  await deps.store.complete(binding, {
    providerReference: observed.providerReference ?? binding.paymentId,
    resultStatus: observed.status,
    resultPayload: observed,
  })
  return observed
}
