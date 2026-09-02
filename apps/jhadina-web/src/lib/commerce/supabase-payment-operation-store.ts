import type { PaymentOperationClaim, PaymentOperationKey, PaymentOperationRecord, PaymentOperationStore } from "./durable-payment-operation"
import type { AuditRpcClient } from "@jhadina/action-core"

export class SupabasePaymentOperationStore implements PaymentOperationStore {
  constructor(private readonly client: AuditRpcClient) {}

  async claim(input: Omit<PaymentOperationRecord, "status" | "providerReference" | "resultStatus">): Promise<PaymentOperationClaim> {
    const { data, error } = await this.client.rpc<PaymentOperationRecord | null>("claim_jhadina_commerce_payment_operation", {
      p_provider: input.provider,
      p_payment_id: input.paymentId,
      p_actor_id: input.actorId,
      p_action_id: input.actionId,
      p_capability: input.capability,
      p_request_fingerprint: input.requestFingerprint,
    })
    if (error) throw new Error(`COMMERCE_PAYMENT_OPERATION_CLAIM_FAILED:${error.message}`)
    if (!data) throw new Error("COMMERCE_PAYMENT_OPERATION_CLAIM_NO_RESULT")
    return { claimed: data.status === "processing" && data.actorId === input.actorId && data.actionId === input.actionId && data.capability === input.capability && data.requestFingerprint === input.requestFingerprint, record: data } as PaymentOperationClaim
  }

  async complete(key: PaymentOperationKey, result: { providerReference: string; resultStatus: string }): Promise<void> {
    const { error } = await this.client.rpc("complete_jhadina_commerce_payment_operation", {
      p_provider: key.provider,
      p_payment_id: key.paymentId,
      p_provider_reference: result.providerReference,
      p_result_status: result.resultStatus,
    })
    if (error) throw new Error(`COMMERCE_PAYMENT_OPERATION_COMPLETE_FAILED:${error.message}`)
  }

  async fail(key: PaymentOperationKey, result: { providerReference?: string; resultStatus: string }): Promise<void> {
    const { error } = await this.client.rpc("fail_jhadina_commerce_payment_operation", {
      p_provider: key.provider,
      p_payment_id: key.paymentId,
      p_provider_reference: result.providerReference ?? null,
      p_result_status: result.resultStatus,
    })
    if (error) throw new Error(`COMMERCE_PAYMENT_OPERATION_FAIL_FAILED:${error.message}`)
  }
}
