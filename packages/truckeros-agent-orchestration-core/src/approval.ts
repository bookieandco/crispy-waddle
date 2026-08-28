import { randomUUID } from "node:crypto";
import type { ActionProposal, ApprovalRecord, ExecutionAuthorization } from "./types.js";
import type { AgentEventLog } from "./audit.js";
import { eventId } from "./audit.js";

export interface ApprovalGateway {
  request(proposal: ActionProposal): Promise<string>;
}

export interface ApprovalController extends ApprovalGateway {
  get(approvalId: string): ApprovalRecord;
  approve(approvalId: string, approvedBy: string, now?: Date): ApprovalRecord;
  reject(approvalId: string, rejectedBy: string, now?: Date): ApprovalRecord;
  authorizeExecution(approvalId: string, now?: Date): ExecutionAuthorization;
}

const DEFAULT_TTL_MS = 15 * 60 * 1000;

export class InMemoryApprovalGateway implements ApprovalController {
  private readonly records = new Map<string, ApprovalRecord>();

  constructor(
    private readonly events?: AgentEventLog,
    private readonly ttlMs = DEFAULT_TTL_MS,
  ) {}

  async request(proposal: ActionProposal): Promise<string> {
    const id = `approval:${randomUUID()}`;
    const requestedAt = new Date().toISOString();
    const expiresAt = proposal.expiresAt ?? new Date(Date.now() + this.ttlMs).toISOString();
    const record: ApprovalRecord = Object.freeze({
      id,
      proposalId: proposal.id,
      workflowRunId: proposal.workflowRunId,
      status: "PENDING_APPROVAL",
      requestedAt,
      expiresAt,
      authorizationContext: Object.freeze({ ...proposal.authorizationContext }),
      version: 1,
    });
    this.records.set(id, record);
    this.append(record, "approval.requested", { proposalId: proposal.id, approvalId: id, expiresAt });
    return id;
  }

  get(approvalId: string): ApprovalRecord {
    const record = this.records.get(approvalId);
    if (!record) throw new Error(`Approval not found: ${approvalId}`);
    return this.expireIfNeeded(record, new Date());
  }

  approve(approvalId: string, approvedBy: string, now = new Date()): ApprovalRecord {
    if (!approvedBy.trim()) throw new Error("approvedBy is required");
    const current = this.records.get(approvalId);
    if (!current) throw new Error(`Approval not found: ${approvalId}`);
    if (current.status !== "PENDING_APPROVAL") throw new Error(`Approval is not pending: ${current.status}`);
    if (now >= new Date(current.expiresAt)) {
      this.expire(current, now);
      throw new Error("Approval expired before approval");
    }

    const next: ApprovalRecord = Object.freeze({
      ...current,
      status: "APPROVED",
      approvedAt: now.toISOString(),
      approvedBy,
      version: current.version + 1,
    });
    this.records.set(approvalId, next);
    this.append(next, "approval.approved", { approvalId, proposalId: next.proposalId, approvedBy });
    return next;
  }

  reject(approvalId: string, rejectedBy: string, now = new Date()): ApprovalRecord {
    if (!rejectedBy.trim()) throw new Error("rejectedBy is required");
    const current = this.get(approvalId);
    if (current.status !== "PENDING_APPROVAL") throw new Error(`Approval is not pending: ${current.status}`);

    const next: ApprovalRecord = Object.freeze({ ...current, status: "REJECTED", version: current.version + 1 });
    this.records.set(approvalId, next);
    this.append(next, "approval.rejected", { approvalId, proposalId: next.proposalId, rejectedBy });
    return next;
  }

  authorizeExecution(approvalId: string, now = new Date()): ExecutionAuthorization {
    const current = this.get(approvalId);
    if (current.status !== "APPROVED") throw new Error(`Execution is not eligible: ${current.status}`);
    if (!current.approvedBy || !current.approvedAt) throw new Error("Approved record is missing authorization identity");
    if (now >= new Date(current.expiresAt)) {
      this.expire(current, now);
      throw new Error("Approval expired before execution authorization");
    }

    const authorization: ExecutionAuthorization = Object.freeze({
      approvalId,
      proposalId: current.proposalId,
      workflowRunId: current.workflowRunId,
      approvedBy: current.approvedBy,
      approvedAt: current.approvedAt,
      authorizationContext: Object.freeze({ ...current.authorizationContext }),
      expiresAt: current.expiresAt,
      nonce: randomUUID(),
    });

    const consumed: ApprovalRecord = Object.freeze({ ...current, status: "CONSUMED", version: current.version + 1 });
    this.records.set(approvalId, consumed);
    this.append(consumed, "execution.authorized", {
      approvalId,
      proposalId: current.proposalId,
      workflowRunId: current.workflowRunId,
      approvedBy: current.approvedBy,
      nonce: authorization.nonce,
    });
    return authorization;
  }

  private expireIfNeeded(record: ApprovalRecord, now: Date): ApprovalRecord {
    if (record.status !== "PENDING_APPROVAL" && record.status !== "APPROVED") return record;
    if (now < new Date(record.expiresAt)) return record;
    this.expire(record, now);
    return this.records.get(record.id)!;
  }

  private expire(record: ApprovalRecord, now: Date): void {
    const expired: ApprovalRecord = Object.freeze({ ...record, status: "EXPIRED", version: record.version + 1 });
    this.records.set(record.id, expired);
    this.append(expired, "approval.expired", {
      approvalId: record.id,
      proposalId: record.proposalId,
      workflowRunId: record.workflowRunId,
      expiredAt: now.toISOString(),
    });
  }

  private append(
    record: ApprovalRecord,
    type: "approval.requested" | "approval.approved" | "approval.rejected" | "approval.expired" | "execution.authorized",
    payload: Record<string, unknown>,
  ): void {
    if (!this.events) return;
    const sequenceHint = this.events.list().length + 1;
    this.events.append({
      id: eventId(record.workflowRunId, sequenceHint, type),
      type,
      workflowRunId: record.workflowRunId,
      occurredAt: new Date().toISOString(),
      payload,
    });
  }
}
