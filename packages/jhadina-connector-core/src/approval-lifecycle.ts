import type { ApprovalGrant } from './approval.js'
import { verifyApproval } from './approval.js'
import type { AuthoritativeActionProposal } from './governed-action.js'

export type ApprovalState = 'requested' | 'approved' | 'rejected' | 'consumed' | 'expired'

export interface ApprovalRecord {
  readonly requestId: string
  readonly proposalId: string
  readonly proposalHash: string
  readonly approverIdentityId: string
  state: ApprovalState
  readonly createdAt: string
  readonly expiresAt: string
  consumedAt?: string
}

export class ApprovalLifecycle {
  private readonly records = new Map<string, ApprovalRecord>()

  request(record: Omit<ApprovalRecord, 'state'>): ApprovalRecord {
    if (this.records.has(record.requestId)) throw new Error('Approval request already exists')
    const stored: ApprovalRecord = { ...record, state: 'requested' }
    this.records.set(record.requestId, stored)
    return stored
  }

  approve(requestId: string, approverIdentityId: string, now = new Date()): ApprovalRecord {
    const record = this.require(requestId)
    this.expireIfNeeded(record, now)
    if (record.state !== 'requested') throw new Error(`Approval cannot be approved from state: ${record.state}`)
    if (record.approverIdentityId !== approverIdentityId) throw new Error('Approval identity mismatch')
    record.state = 'approved'
    return record
  }

  reject(requestId: string, approverIdentityId: string, now = new Date()): ApprovalRecord {
    const record = this.require(requestId)
    this.expireIfNeeded(record, now)
    if (record.state !== 'requested') throw new Error(`Approval cannot be rejected from state: ${record.state}`)
    if (record.approverIdentityId !== approverIdentityId) throw new Error('Approval identity mismatch')
    record.state = 'rejected'
    return record
  }

  consume(requestId: string, proposal: AuthoritativeActionProposal, grant: ApprovalGrant, approverIdentityId: string, now = new Date()): ApprovalRecord {
    const record = this.require(requestId)
    this.expireIfNeeded(record, now)
    if (record.state !== 'approved') throw new Error(`Approval cannot be consumed from state: ${record.state}`)
    verifyApproval(proposal, grant, approverIdentityId, now)
    if (record.proposalHash !== grant.proposalHash) throw new Error('Approval record proposal mismatch')
    record.state = 'consumed'
    record.consumedAt = now.toISOString()
    return record
  }

  get(requestId: string): ApprovalRecord | undefined { return this.records.get(requestId) }

  private require(requestId: string): ApprovalRecord {
    const record = this.records.get(requestId)
    if (!record) throw new Error(`Approval request not found: ${requestId}`)
    return record
  }

  private expireIfNeeded(record: ApprovalRecord, now: Date): void {
    if ((record.state === 'requested' || record.state === 'approved') && new Date(record.expiresAt).getTime() <= now.getTime()) record.state = 'expired'
  }
}
