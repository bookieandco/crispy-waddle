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
  /** Resolve the authenticated actor when it is not embedded in authorizationContext. */
  resolveActorId?: (receipt: ExecutionReceipt) => string | undefined;
}

/**
 * Durable adapter for the execution receipt boundary.
 *
 * The orchestration core remains provider/database neutral: only this adapter
 * knows the Supabase table shape. Domain-only receipt fields are retained in
 * authorization_context/result_metadata so the persisted record is lossless.
 */
export class SupabaseExecutionReceiptRepository implements ExecutionReceiptRepository {
  constructor(
    private readonly client: SupabaseExecutionReceiptClient,
    private readonly options: SupabaseExecutionReceiptRepositoryOptions = {},
  ) {}

  async write(receipt: ExecutionReceipt): Promise<void> {
    const context = isRecord(receipt.authorizationContext)
      ? receipt.authorizationContext
      : {};

    const actorId = this.options.resolveActorId?.(receipt) ?? stringValue(context.actorId);
    if (!actorId) {
      throw new Error("Execution receipt persistence requires authorizationContext.actorId");
    }

    const resultMetadata = {
      ...(isRecord(receipt.resultMetadata) ? receipt.resultMetadata : {}),
      bookingPackageId: receipt.bookingPackageId,
      offerId: receipt.offerId,
      proposalId: receipt.proposalId,
      approvalId: receipt.approvalId,
      workflowRunId: receipt.workflowRunId,
      authorizationNonce: receipt.authorizationNonce,
      provider: receipt.provider,
      providerBookingId: receipt.providerBookingId,
      receiptStatus: receipt.status,
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
        authorization_context: context,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
