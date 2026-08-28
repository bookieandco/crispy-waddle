export type ExecutionReceiptStatus = "SUCCEEDED" | "FAILED";

export interface ExecutionReceipt {
  receiptId: string;
  bookingPackageId: string;
  offerId: string;
  proposalId: string;
  approvalId: string;
  workflowRunId: string;
  authorizationNonce: string;
  provider: string;
  providerBookingId?: string;
  status: ExecutionReceiptStatus;
  startedAt: string;
  completedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ExecutionReceiptRepository {
  write(receipt: ExecutionReceipt): Promise<void>;
}

export function createExecutionReceipt(input: Omit<ExecutionReceipt, "receiptId">, id: () => string = () => crypto.randomUUID()): ExecutionReceipt {
  if (!input.bookingPackageId || !input.offerId || !input.proposalId || !input.approvalId || !input.workflowRunId || !input.authorizationNonce) {
    throw new Error("Execution receipt requires booking, offer, proposal, approval, workflow, and authorization identifiers");
  }
  if (!input.provider) throw new Error("Execution receipt requires provider");
  if (new Date(input.completedAt).getTime() < new Date(input.startedAt).getTime()) {
    throw new Error("Execution receipt completedAt cannot precede startedAt");
  }
  if (input.status === "SUCCEEDED" && !input.providerBookingId) {
    throw new Error("Successful execution receipt requires providerBookingId");
  }
  return { receiptId: id(), ...input };
}

export async function persistExecutionReceipt(
  repository: ExecutionReceiptRepository,
  input: Omit<ExecutionReceipt, "receiptId">,
  id?: () => string,
): Promise<ExecutionReceipt> {
  const receipt = createExecutionReceipt(input, id);
  await repository.write(receipt);
  return receipt;
}
