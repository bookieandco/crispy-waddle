export type ExecutionReceiptOutcome = "COMPLETED" | "FAILED";

export interface ExecutionReceipt {
  readonly id: string;
  readonly proposalId: string;
  readonly workflowRunId: string;
  readonly approvalId: string;
  readonly authorizationNonce: string;
  readonly toolId: string;
  readonly providerId?: string;
  readonly outcome: ExecutionReceiptOutcome;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outputRef?: string;
  readonly error?: string;
}

export interface ExecutionReceiptStore {
  record(receipt: ExecutionReceipt): void;
  get(id: string): ExecutionReceipt | undefined;
  list(): readonly ExecutionReceipt[];
}

export class InMemoryExecutionReceiptStore implements ExecutionReceiptStore {
  private readonly receipts = new Map<string, ExecutionReceipt>();

  record(receipt: ExecutionReceipt): void {
    if (this.receipts.has(receipt.id)) {
      throw new Error(`Execution receipt already exists: ${receipt.id}`);
    }
    this.receipts.set(receipt.id, Object.freeze({ ...receipt }));
  }

  get(id: string): ExecutionReceipt | undefined {
    return this.receipts.get(id);
  }

  list(): readonly ExecutionReceipt[] {
    return Object.freeze([...this.receipts.values()]);
  }
}

export function executionReceiptId(workflowRunId: string, proposalId: string, nonce: string): string {
  return `execution-receipt:${workflowRunId}:${proposalId}:${nonce}`;
}

export function providerIdFromOutput(output: unknown): string | undefined {
  if (!output || typeof output !== "object") return undefined;
  const provider = (output as { provider?: unknown }).provider;
  return typeof provider === "string" && provider.trim() ? provider : undefined;
}

export function outputRefFromOutput(output: unknown): string | undefined {
  if (!output || typeof output !== "object") return undefined;
  const providerBookingId = (output as { providerBookingId?: unknown }).providerBookingId;
  return typeof providerBookingId === "string" && providerBookingId.trim() ? providerBookingId : undefined;
}
