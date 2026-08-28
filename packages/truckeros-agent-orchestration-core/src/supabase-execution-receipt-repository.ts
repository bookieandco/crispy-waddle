import type { ExecutionReceipt, ExecutionReceiptRepository } from "./execution-receipt";

/** Minimal Supabase client surface required by this adapter. */
export interface SupabaseExecutionReceiptClient {
  from(table: "jhadina_execution_receipts"): {
    insert(values: Record<string, unknown>): {
      select(): {
        single(): PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };
}

export interface SupabaseExecutionReceiptRepositoryOptions {
  /** The authenticated actor UUID required by the durable table's foreign key. */
  resolveActorId: (receipt: ExecutionReceipt) => string | undefined;
}

/**
 * Durable adapter for the execution receipt boundary.
 *
 * The orchestration core remains provider/database neutral: only this adapter
 * knows the Supabase table shape. Receipt fields that do not have first-class
 * columns are retained in JSON metadata so persistence remains lossless.
 */
export class SupabaseExecutionReceiptRepository implements ExecutionReceiptRepository {
  constructor(
    private readonly client: SupabaseExecutionReceiptClient,
    private readonly options: SupabaseExecutionReceiptRepositoryOptions,
  ) {}

  async write(receipt: ExecutionReceipt): Promise<void> {
    const actorId = this.options.resolveActorId(receipt);
    if (!actorId) {
      throw new Error("Execution receipt persistence requires an authenticated actor UUID");
    }

    const authorizationContext = {
      receiptId: receipt.receiptId,
      bookingPackageId: receipt.bookingPackageId,
      offerId: receipt.offerId,
      proposalId: receipt.proposalId,
      approvalId: receipt.approvalId,
      workflowRunId: receipt.workflowRunId,
      authorizationNonce: receipt.authorizationNonce,
    };

    const resultMetadata = {
      provider: receipt.provider,
      providerBookingId: receipt.providerBookingId,
      status: receipt.status,
      startedAt: receipt.startedAt,
      completedAt: receipt.completedAt,
      errorCode: receipt.errorCode,
      errorMessage: receipt.errorMessage,
    };

    const { error } = await this.client
      .from("jhadina_execution_receipts")
      .insert({
        receipt_id: receipt.receiptId,
        request_id: receipt.workflowRunId,
        action_id: receipt.receiptId,
        actor_id: actorId,
        capability: `execution:${receipt.provider}`,
        authorization_context: authorizationContext,
        approval_state: "APPROVED",
        execution_state: receipt.status === "SUCCEEDED" ? "EXECUTED" : "FAILED",
        approved_at: receipt.startedAt,
        executed_at: receipt.completedAt,
        result_metadata: resultMetadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to persist execution receipt: ${error.message}`);
    }
  }
}
