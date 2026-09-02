import type { PaymentOperationBinding, PaymentOperationClaim, PaymentOperationRecord, PaymentOperationStore } from "./durable-payment-operation"
import type { AuditRpcClient } from "@jhadina/action-core"

type ClaimRpcResult = { claimed: boolean; record: PaymentOperationRecord }

type TerminalResult = {
  providerReference?: string
  resultStatus: string
  resultPayload?: unknown
}

export class SupabasePaymentOperationStore implements PaymentOperationStore {
  constructor(private readonly client: AuditRpcClient) {}

  async claim(input: PaymentOperationBinding): Promise<PaymentOperationClaim> {
    const { data, error } = await this.client.rpc<ClaimRpcResult>("claim_jhadina_commerce_payment_operation", {
      p_provider: input.provider,
      p_payment_id: input.paymentId,
      p_actor_id: input.actorId,
      p_action_id: input.actionId,
      p_capability: input.capability,
      p_request_fingerprint: input.requestFingerprint,
    })
    if (error) throw new Error(`COMMERCE_PAYMENT_OPERATION_CLAIM_FAILED:${error.message}`)
    if (!data?.record) throw new Error("COMMERCE_PAYMENT_OPERATION_CLAIM_NO_RESULT")
    return data.claimed ? { claimed: true } : { claimed: false, record: data.record }
  }

  async complete(input: PaymentOperationBinding, result: { providerReference: string; resultStatus: string; resultPayload: unknown }): Promise<void> {
    await this.terminal("complete_jhadina_commerce_payment_operation", input, result)
  }

  async fail(input: PaymentOperationBinding, result: { providerReference?: string; resultStatus: string; resultPayload?: unknown }): Promise<void> {
    await this.terminal("fail_jhadina_commerce_payment_operation", input, result)
  }

  private async terminal(functionName: string, input: PaymentOperationBinding, result: TerminalResult): Promise<void> {
    const { error } = await this.client.rpc(functionName, {
      p_provider: input.provider,
      p_payment_id: input.paymentId,
      p_actor_id: input.actorId,
      p_action_id: input.actionId,
      p_capability: input.capability,
      p_request_fingerprint: input.requestFingerprint,
      p_provider_reference: result.providerReference ?? null,
      p_result_status: result.resultStatus,
      p_result_payload: result.resultPayload ?? null,
    })
    if (error) throw new Error(`COMMERCE_PAYMENT_OPERATION_TERMINAL_FAILED:${error.message}`)
  }
}
