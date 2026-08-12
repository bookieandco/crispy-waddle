import type { EvolutionCandidate } from "./evolution-registry";

export type ExecutionRequestStatus = "REQUESTED" | "DISPATCHED" | "RUNNING" | "COMPLETED" | "FAILED" | "BLOCKED";

export interface ExecutionRequest {
  id: string;
  candidateId: string;
  requestedBy: string;
  approvalId: string;
  status: ExecutionRequestStatus;
  createdAt: string;
  dispatchedAt?: string;
  workflowRunId?: string;
  reason?: string;
}

export interface ExecutionRequestStore {
  get(id: string): ExecutionRequest | undefined;
  findActive(candidateId: string): ExecutionRequest | undefined;
  create(request: ExecutionRequest): ExecutionRequest;
  update(id: string, patch: Partial<ExecutionRequest>): ExecutionRequest;
}

export class InMemoryExecutionRequestStore implements ExecutionRequestStore {
  private readonly requests = new Map<string, ExecutionRequest>();

  get(id: string) {
    return this.requests.get(id);
  }

  findActive(candidateId: string) {
    return [...this.requests.values()].find(
      (request) => request.candidateId === candidateId &&
        ["REQUESTED", "DISPATCHED", "RUNNING"].includes(request.status),
    );
  }

  create(request: ExecutionRequest) {
    this.requests.set(request.id, request);
    return request;
  }

  update(id: string, patch: Partial<ExecutionRequest>) {
    const current = this.requests.get(id);
    if (!current) throw new Error(`Execution request not found: ${id}`);
    const updated = { ...current, ...patch };
    this.requests.set(id, updated);
    return updated;
  }
}

export function createExecutionRequest(
  candidate: EvolutionCandidate,
  requestedBy: string,
  approvalId: string,
  store: ExecutionRequestStore,
  now = new Date(),
) {
  if (candidate.requiresApproval && !approvalId.trim()) {
    throw new Error("approvalId is required for an approval-gated candidate");
  }

  if (["critical", "high"].includes(candidate.risk)) {
    throw new Error("High-risk evolution requires the controlled execution approval path");
  }

  const active = store.findActive(candidate.id);
  if (active) return active;

  return store.create({
    id: crypto.randomUUID(),
    candidateId: candidate.id,
    requestedBy,
    approvalId,
    status: "REQUESTED",
    createdAt: now.toISOString(),
  });
}
