import type { ApprovalGrant } from './approval.js'
import { verifyApproval } from './approval.js'
import type { AuthoritativeActionProposal } from './governed-action.js'

export type ApprovalExecutionState = 'executing' | 'succeeded' | 'failed'

export interface ApprovalExecutionRecord {
  readonly approvalId: string
  readonly proposalHash: string
  state: ApprovalExecutionState
  readonly startedAt: string
  completedAt?: string
  error?: string
}

export interface ApprovalExecutionStore {
  /** Atomically claims an approved action for execution. */
  begin(approvalId: string, proposalHash: string, now?: Date): boolean | Promise<boolean>
  /** Records a verified successful execution. */
  complete(approvalId: string, now?: Date): void | Promise<void>
  /** Records a terminal execution failure without making the approval reusable. */
  fail(approvalId: string, error: string, now?: Date): void | Promise<void>
  get(approvalId: string): ApprovalExecutionRecord | undefined | Promise<ApprovalExecutionRecord | undefined>
  /** Releases a stale in-flight claim back to the approval layer. */
  recoverStale(approvalId: string, staleBefore: Date): boolean | Promise<boolean>
  /** Legacy one-way consumption primitive. Prefer begin/complete/fail. */
  consume(approvalId: string): boolean | Promise<boolean>
}

export class InMemoryApprovalExecutionStore implements ApprovalExecutionStore {
  private readonly records = new Map<string, ApprovalExecutionRecord>()

  begin(approvalId: string, proposalHash: string, now = new Date()): boolean {
    const existing = this.records.get(approvalId)
    if (existing) return false
    this.records.set(approvalId, { approvalId, proposalHash, state: 'executing', startedAt: now.toISOString() })
    return true
  }

  complete(approvalId: string, now = new Date()): void {
    const record = this.require(approvalId)
    if (record.state !== 'executing') throw new Error(`Approval execution cannot complete from state: ${record.state}`)
    record.state = 'succeeded'
    record.completedAt = now.toISOString()
  }

  fail(approvalId: string, error: string, now = new Date()): void {
    const record = this.require(approvalId)
    if (record.state !== 'executing') throw new Error(`Approval execution cannot fail from state: ${record.state}`)
    record.state = 'failed'
    record.error = error
    record.completedAt = now.toISOString()
  }

  get(approvalId: string): ApprovalExecutionRecord | undefined { return this.records.get(approvalId) }

  recoverStale(approvalId: string, staleBefore: Date): boolean {
    const record = this.records.get(approvalId)
    if (!record || record.state !== 'executing') return false
    if (new Date(record.startedAt).getTime() > staleBefore.getTime()) return false
    this.records.delete(approvalId)
    return true
  }

  consume(approvalId: string): boolean { return this.begin(approvalId, `legacy:${approvalId}`) as boolean }

  private require(approvalId: string): ApprovalExecutionRecord {
    const record = this.records.get(approvalId)
    if (!record) throw new Error(`Approval execution not found: ${approvalId}`)
    return record
  }
}

export async function authorizeApprovedExecution(
  proposal: AuthoritativeActionProposal,
  approval: ApprovalGrant,
  approverIdentityId: string,
  store: ApprovalExecutionStore,
  now = new Date(),
): Promise<void> {
  verifyApproval(proposal, approval, approverIdentityId, now)
  if (!(await store.begin(approval.approvalId, approval.proposalHash, now))) {
    throw new Error('Approval execution has already been claimed')
  }
}
