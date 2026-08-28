import type { ExecutionReceipt } from "./execution-receipt.js";

/**
 * Durable persistence seam for execution receipts.
 *
 * The orchestration package owns the receipt contract but not the database,
 * tenant model, credentials, or transport. Application infrastructure injects
 * an implementation of this repository.
 */
export interface ExecutionReceiptRepository {
  insert(receipt: ExecutionReceipt): Promise<void>;
  get(id: string): Promise<ExecutionReceipt | undefined>;
  listByWorkflowRun(workflowRunId: string): Promise<readonly ExecutionReceipt[]>;
}

/**
 * Store implementation used by GuardedExecutionGateway when the application
 * supplies a durable repository. The repository is authoritative; this class
 * intentionally contains no caching or alternate persistence path.
 */
export class PersistentExecutionReceiptStore {
  constructor(private readonly repository: ExecutionReceiptRepository) {}

  async record(receipt: ExecutionReceipt): Promise<void> {
    await this.repository.insert(Object.freeze({ ...receipt }));
  }

  async get(id: string): Promise<ExecutionReceipt | undefined> {
    return this.repository.get(id);
  }

  async listByWorkflowRun(workflowRunId: string): Promise<readonly ExecutionReceipt[]> {
    return this.repository.listByWorkflowRun(workflowRunId);
  }
}
